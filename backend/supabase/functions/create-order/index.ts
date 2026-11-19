import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const products: Record<string, Record<string, { price: number; flavors: string[] }>> = {
    'Proteína Whey Optimum Nutrition': {
        '0,91 kg': { price: 80, flavors: ['Vainilla', 'Chocolate', 'Cookies and Cream'] },
        '2,27 kg': { price: 150, flavors: ['Vainilla', 'Chocolate', 'Cookies and Cream'] },
    },
    Creatina: {
        '300 g': { price: 22, flavors: [''] },
        '500 g': { price: 40, flavors: [''] },
        '1 kg': { price: 60, flavors: [''] },
    },
    BCAA: {
        '60 cápsulas': { price: 28, flavors: [''] },
        '100 cápsulas': { price: 40, flavors: [''] },
    },
    'Red Rex Big Whey': {
        '4.5 Lbs': { price: 79.8, flavors: ['Vainilla'] },
    },
    'CBUM Essential Pre': {
        '30 servicios': { price: 36, flavors: ['Champion Mentality – Citrus Slush'] },
    },
    'Saxofit Colágeno': {
        '300 g · 30 servicios': { price: 23, flavors: [''] },
    },
} as const;

type OrderLineInput = {
    name: string;
    presentation: string;
    flavor?: string;
    quantity: number;
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function text(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const result = value.trim();
    return result.length > 0 && result.length <= maxLength ? result : null;
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405);

    const projectUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!projectUrl || !serviceKey || !anonKey) {
        console.error('Falta configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY.');
        return jsonResponse({ error: 'El servicio de pedidos no está configurado.' }, 500);
    }

    let payload: Record<string, unknown>;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
    }

    if (payload.website) return jsonResponse({ error: 'No se pudo validar el pedido.' }, 400);

    const customerName = text(payload.customerName, 100);
    const customerEmail = text(payload.customerEmail, 254)?.toLowerCase();
    const customerPhone = text(payload.customerPhone, 30);
    const customerCity = text(payload.customerCity, 100);
    const customerAddress = typeof payload.customerAddress === 'string' ? payload.customerAddress.trim().slice(0, 300) : null;
    const customerNotes = typeof payload.customerNotes === 'string' ? payload.customerNotes.trim().slice(0, 500) : null;
    if (!customerName || !customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
        || !customerPhone || customerPhone.replace(/\D/g, '').length < 7
        || !customerCity || customerAddress === null || customerNotes === null) {
        return jsonResponse({ error: 'Revisa tu nombre, correo, teléfono y ciudad.' }, 400);
    }
    if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 20) {
        return jsonResponse({ error: 'El carrito no es válido.' }, 400);
    }

    const validatedItems: {
        product_name: string;
        presentation: string;
        flavor: string;
        quantity: number;
        unit_price: number;
        line_total: number;
    }[] = [];
    let total = 0;
    for (const rawItem of payload.items as OrderLineInput[]) {
        if (!rawItem || typeof rawItem !== 'object'
            || !Number.isInteger(rawItem.quantity) || rawItem.quantity < 1 || rawItem.quantity > 50
            || typeof rawItem.name !== 'string' || typeof rawItem.presentation !== 'string') {
            return jsonResponse({ error: 'Uno de los productos del pedido no es válido.' }, 400);
        }

        const product = products[rawItem.name];
        const variant = product?.[rawItem.presentation];
        const flavor = typeof rawItem.flavor === 'string' ? rawItem.flavor : '';
        if (!variant || !variant.flavors.includes(flavor)) {
            return jsonResponse({ error: 'Un producto o presentación ya no está disponible.' }, 400);
        }

        const lineTotal = Math.round(variant.price * rawItem.quantity * 100) / 100;
        total = Math.round((total + lineTotal) * 100) / 100;
        validatedItems.push({
            product_name: rawItem.name,
            presentation: rawItem.presentation,
            flavor,
            quantity: rawItem.quantity,
            unit_price: variant.price,
            line_total: lineTotal,
        });
    }

    let userId: string | null = null;
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7);
        if (token !== anonKey) {
            const userClient = createClient(projectUrl, anonKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
            const { data, error } = await userClient.auth.getUser(token);
            if (error || !data.user) return jsonResponse({ error: 'La sesión ya no es válida. Inicia sesión de nuevo.' }, 401);
            userId = data.user.id;
        }
    }

    const adminClient = createClient(projectUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await adminClient.rpc('create_order_with_items', {
        p_user_id: userId,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_customer_phone: customerPhone,
        p_customer_city: customerCity,
        p_customer_address: customerAddress,
        p_customer_notes: customerNotes,
        p_items: validatedItems,
        p_total: total,
    });
    if (error) {
        console.error('No se pudo guardar el pedido:', error.message);
        return jsonResponse({ error: 'No se pudo guardar el pedido. Inténtalo de nuevo.' }, 500);
    }

    return jsonResponse({ order: data[0], items: validatedItems }, 201);
});
