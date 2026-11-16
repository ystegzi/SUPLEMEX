import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const validStatuses = new Set(['pending', 'confirmed', 'shipped', 'cancelled']);

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405);

    const projectUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!projectUrl || !serviceKey || !anonKey) {
        console.error('Falta configurar el backend admin o ADMIN_EMAILS.');
        return jsonResponse({ error: 'El servicio de cuenta no está configurado.' }, 500);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Inicia sesión con una cuenta autorizada.' }, 401);
    }

    const userClient = createClient(projectUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice(7));
    if (userError || !userData.user) return jsonResponse({ error: 'La sesión ya no es válida. Inicia sesión de nuevo.' }, 401);
    let payload: Record<string, unknown>;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
    }

    const adminClient = createClient(projectUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    if (payload.action === 'delete-account') {
        const password = typeof payload.password === 'string' ? payload.password : '';
        if (payload.confirmation !== 'ELIMINAR' || password.length < 8 || password.length > 1024) {
            return jsonResponse({ error: 'La confirmación o contraseña no es válida.' }, 400);
        }
        if (!userData.user.email || !userData.user.email_confirmed_at) {
            return jsonResponse({ error: 'Confirma primero el correo asociado a tu cuenta.' }, 403);
        }

        const verificationClient = createClient(projectUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: verifiedSession, error: verificationError } = await verificationClient.auth.signInWithPassword({
            email: userData.user.email,
            password,
        });
        if (verificationError || verifiedSession.user?.id !== userData.user.id) {
            return jsonResponse({ error: 'La contraseña actual es incorrecta.' }, 401);
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
        if (deleteError) {
            console.error('No se pudo eliminar la cuenta:', deleteError.message);
            return jsonResponse({ error: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.' }, 500);
        }
        return jsonResponse({ deleted: true });
    }

    const allowedAdmins = (Deno.env.get('ADMIN_EMAILS') || '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);
    if (allowedAdmins.length === 0) {
        console.error('Falta configurar ADMIN_EMAILS para el panel.');
        return jsonResponse({ error: 'El panel de administración no está configurado.' }, 500);
    }
    if (!userData.user.email_confirmed_at) {
        return jsonResponse({ error: 'Confirma el correo de la cuenta administradora antes de entrar.' }, 403);
    }
    if (!userData.user.email || !allowedAdmins.includes(userData.user.email.toLowerCase())) {
        return jsonResponse({ error: 'Esta cuenta no tiene permisos de administración.' }, 403);
    }

    if (payload.action === 'admin-send-password-reset') {
        const userId = typeof payload.userId === 'string' ? payload.userId : '';
        const redirectTo = typeof payload.redirectTo === 'string' ? payload.redirectTo : '';
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {
            return jsonResponse({ error: 'La cuenta seleccionada no es válida.' }, 400);
        }
        if (userId === userData.user.id) {
            return jsonResponse({ error: 'Para tu cuenta administradora, usa la opción de recuperación desde Mi cuenta.' }, 403);
        }

        const origin = request.headers.get('Origin');
        let redirectUrl: URL;
        let requestOrigin: URL;
        try {
            if (!origin) throw new Error('Falta el origen de la solicitud.');
            redirectUrl = new URL(redirectTo);
            requestOrigin = new URL(origin);
        } catch {
            return jsonResponse({ error: 'La dirección de retorno no es válida.' }, 400);
        }
        const localHttp = redirectUrl.protocol === 'http:'
            && ['localhost', '127.0.0.1'].includes(redirectUrl.hostname);
        if (redirectUrl.origin !== requestOrigin.origin
            || (!localHttp && redirectUrl.protocol !== 'https:')
            || !redirectUrl.pathname.endsWith('/login.html')
            || redirectUrl.username || redirectUrl.password
            || redirectUrl.search || redirectUrl.hash) {
            return jsonResponse({ error: 'La dirección de retorno no está permitida.' }, 400);
        }

        const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(userId);
        if (targetError || !targetData.user?.email) {
            return jsonResponse({ error: 'La cuenta seleccionada no tiene un correo válido.' }, 404);
        }
        if (!targetData.user.email_confirmed_at) {
            return jsonResponse({ error: 'El usuario debe confirmar su correo antes de restablecer la contraseña.' }, 409);
        }
        if (allowedAdmins.includes(targetData.user.email.toLowerCase())) {
            return jsonResponse({ error: 'No se pueden restablecer contraseñas de cuentas administradoras desde este panel.' }, 403);
        }

        const recoveryClient = createClient(projectUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        try {
            const { error: recoveryError } = await recoveryClient.auth.resetPasswordForEmail(
                targetData.user.email,
                { redirectTo: redirectUrl.href },
            );
            if (recoveryError) {
                console.error('No se pudo enviar el restablecimiento:', recoveryError.message);
                return jsonResponse({ error: 'No se pudo enviar el enlace. Comprueba el servicio de correo de Supabase.' }, 502);
            }
        } catch (error) {
            console.error('Falló el envío del enlace de restablecimiento:', error);
            return jsonResponse({ error: 'No se pudo enviar el enlace de restablecimiento.' }, 502);
        }
        return jsonResponse({ sent: true });
    }

    if (payload.action === 'admin-delete-account') {
        const userId = typeof payload.userId === 'string' ? payload.userId : '';
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {
            return jsonResponse({ error: 'La cuenta seleccionada no es válida.' }, 400);
        }
        if (userId === userData.user.id) {
            return jsonResponse({ error: 'No puedes eliminar tu propia cuenta administradora desde este panel.' }, 403);
        }

        const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(userId);
        if (targetError || !targetData.user) {
            return jsonResponse({ error: 'La cuenta seleccionada ya no existe.' }, 404);
        }
        if (targetData.user.email && allowedAdmins.includes(targetData.user.email.toLowerCase())) {
            return jsonResponse({ error: 'No se pueden eliminar cuentas con permisos de administración.' }, 403);
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error('El administrador no pudo eliminar la cuenta:', deleteError.message);
            return jsonResponse({ error: 'No se pudo eliminar la cuenta.' }, 500);
        }
        return jsonResponse({ deleted: true });
    }

    if (payload.action === 'dashboard') {
        const users: {
            id: string;
            email: string;
            email_confirmed_at: string | undefined;
            created_at: string;
            last_sign_in_at: string | undefined;
            name: string;
        }[] = [];
        for (let page = 1; ; page += 1) {
            const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) {
                console.error('No se pudieron consultar las cuentas:', error.message);
                return jsonResponse({ error: 'No se pudieron cargar las cuentas.' }, 500);
            }
            users.push(...data.users.map(user => ({
                id: user.id,
                email: user.email || '',
                email_confirmed_at: user.email_confirmed_at,
                created_at: user.created_at,
                last_sign_in_at: user.last_sign_in_at,
                name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '',
            })));
            if (data.users.length < 1000) break;
        }

        const { data: orders, error: ordersError } = await adminClient
            .from('orders')
            .select('id, order_number, account_user_id, customer_name, customer_email, customer_phone, customer_city, customer_address, customer_notes, status, total, created_at, confirmed_at, order_items(id, product_name, presentation, flavor, quantity, unit_price, line_total)')
            .order('created_at', { ascending: false });
        if (ordersError) {
            console.error('No se pudieron consultar los pedidos:', ordersError.message);
            return jsonResponse({ error: 'No se pudieron cargar los pedidos.' }, 500);
        }
        return jsonResponse({ users, orders });
    }

    if (payload.action === 'update-order') {
        const orderId = typeof payload.orderId === 'string' ? payload.orderId : '';
        const status = typeof payload.status === 'string' ? payload.status : '';
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId) || !validStatuses.has(status)) {
            return jsonResponse({ error: 'El pedido o estado no es válido.' }, 400);
        }
        const update: Record<string, unknown> = { status };
        if (status === 'confirmed') {
            update.confirmed_at = new Date().toISOString();
            update.confirmed_by = userData.user.id;
        }
        const { data, error } = await adminClient
            .from('orders')
            .update(update)
            .eq('id', orderId)
            .select('id, status, confirmed_at')
            .single();
        if (error) {
            console.error('No se pudo actualizar el pedido:', error.message);
            return jsonResponse({ error: 'No se pudo actualizar el pedido.' }, 500);
        }
        return jsonResponse({ order: data });
    }

    return jsonResponse({ error: 'Acción desconocida.' }, 400);
});
