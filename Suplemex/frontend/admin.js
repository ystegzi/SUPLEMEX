import { obtenerClienteSupabase, supabaseConfigurado as configurado, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-client.js';

const mensaje = document.getElementById('admin-mensaje');
const panel = document.getElementById('admin-panel');
const botonActualizar = document.getElementById('admin-actualizar');
const botonCerrarSesion = document.getElementById('admin-cerrar-sesion');
const filtroPedidos = document.getElementById('admin-filtro-pedidos');
const busquedaCuentas = document.getElementById('admin-buscar-cuentas');
const busquedaPedidos = document.getElementById('admin-buscar-pedidos');
const estadoEtiquetas = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    shipped: 'Enviado',
    cancelled: 'Cancelado',
};

let cliente = null;
let tokenSesion = '';
let adminId = '';
let pedidos = [];
let cuentas = [];

function mostrarMensaje(texto, tipo = 'info') {
    mensaje.textContent = texto;
    mensaje.className = `auth-mensaje auth-${tipo}`;
    mensaje.hidden = !texto;
}

function celda(texto, clase = '') {
    const elemento = document.createElement('td');
    elemento.textContent = texto;
    if (clase) elemento.className = clase;
    return elemento;
}

function formatearFecha(valor) {
    if (!valor) return '—';
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderizarPedidos() {
    const cuerpo = document.getElementById('admin-pedidos');
    const estadoSeleccionado = filtroPedidos.value;
    const codigoBuscado = busquedaPedidos.value.trim().toLowerCase();
    const visibles = pedidos.filter(pedido =>
        (estadoSeleccionado === 'all' || pedido.status === estadoSeleccionado)
        && String(pedido.order_number || '').toLowerCase().includes(codigoBuscado));
    cuerpo.replaceChildren();
    document.getElementById('admin-pedidos-vacios').hidden = visibles.length > 0;

    visibles.forEach(pedido => {
        const fila = document.createElement('tr');
        const numero = celda('', 'admin-numero-pedido');
        const codigo = document.createElement('strong');
        codigo.textContent = pedido.order_number;
        const fecha = document.createElement('span');
        fecha.textContent = formatearFecha(pedido.created_at);
        numero.append(codigo, fecha);
        const clienteInfo = document.createElement('td');
        const nombre = document.createElement('strong');
        nombre.textContent = pedido.customer_name;
        const contacto = document.createElement('span');
        contacto.textContent = `${pedido.customer_email} · ${pedido.customer_phone}`;
        const ubicacion = document.createElement('span');
        ubicacion.textContent = [pedido.customer_city, pedido.customer_address].filter(Boolean).join(' · ');
        clienteInfo.append(nombre, contacto, ubicacion);

        const productos = document.createElement('td');
        const listaProductos = document.createElement('ul');
        listaProductos.className = 'admin-productos';
        (pedido.order_items || []).forEach(item => {
            const linea = document.createElement('li');
            linea.textContent = `${item.quantity} × ${item.product_name} (${item.presentation})${item.flavor ? ` · ${item.flavor}` : ''}`;
            listaProductos.append(linea);
        });
        productos.append(listaProductos);

        const total = celda(`$${Number(pedido.total).toFixed(2)} USD`, 'admin-total');
        const estado = document.createElement('td');
        const etiqueta = document.createElement('span');
        etiqueta.className = `admin-estado admin-estado-${pedido.status}`;
        etiqueta.textContent = estadoEtiquetas[pedido.status] || pedido.status;
        estado.append(etiqueta);

        const acciones = document.createElement('td');
        const controles = document.createElement('div');
        controles.className = 'admin-acciones-pedido';
        const selector = document.createElement('select');
        selector.setAttribute('aria-label', `Nuevo estado de ${pedido.order_number}`);
        Object.entries(estadoEtiquetas).forEach(([valor, texto]) => {
            const opcion = document.createElement('option');
            opcion.value = valor;
            opcion.textContent = texto;
            opcion.selected = valor === pedido.status;
            selector.append(opcion);
        });
        const guardar = document.createElement('button');
        guardar.type = 'button';
        guardar.className = 'boton boton-principal';
        guardar.textContent = 'Guardar';
        guardar.addEventListener('click', () => actualizarPedido(pedido.id, selector.value, guardar));
        controles.append(selector, guardar);
        acciones.append(controles);
        fila.append(numero, clienteInfo, productos, total, estado, acciones);
        cuerpo.append(fila);
    });
}

function renderizarCuentas() {
    const cuerpo = document.getElementById('admin-lista-cuentas');
    const filtro = busquedaCuentas.value.trim().toLowerCase();
    const visibles = cuentas.filter(cuenta => `${cuenta.email} ${cuenta.name}`.toLowerCase().includes(filtro));
    cuerpo.replaceChildren();
    document.getElementById('admin-cuentas-vacias').hidden = visibles.length > 0;

    visibles.forEach(cuenta => {
        const fila = document.createElement('tr');
        const nombre = celda(cuenta.name || '—');
        const correo = celda(cuenta.email);
        const verificado = Boolean(cuenta.email_confirmed_at);
        const estado = celda(verificado ? 'Verificada' : 'Pendiente de verificación');
        estado.classList.add(verificado ? 'admin-cuenta-verificada' : 'admin-cuenta-pendiente');
        const acciones = document.createElement('td');
        const botonRestablecer = document.createElement('button');
        botonRestablecer.type = 'button';
        botonRestablecer.className = 'boton boton-secundario admin-restablecer-cuenta';
        botonRestablecer.textContent = 'Enviar cambio de contraseña';
        botonRestablecer.disabled = !verificado || cuenta.id === adminId;
        botonRestablecer.setAttribute(
            'aria-label',
            !verificado
                ? `El correo de ${cuenta.email} aún no está verificado`
                : cuenta.id === adminId
                    ? 'Usa Mi cuenta para cambiar la contraseña administradora'
                    : `Enviar restablecimiento de contraseña a ${cuenta.email}`,
        );
        if (!verificado) botonRestablecer.title = 'El usuario debe confirmar su correo antes de restablecer la contraseña.';
        if (cuenta.id === adminId) botonRestablecer.title = 'Usa la sección Mi cuenta para cambiar la contraseña administradora.';
        botonRestablecer.addEventListener('click', () => enviarRestablecimiento(cuenta, botonRestablecer));

        const botonEliminar = document.createElement('button');
        botonEliminar.type = 'button';
        botonEliminar.className = 'boton boton-peligro admin-eliminar-cuenta';
        botonEliminar.textContent = 'Eliminar';
        botonEliminar.disabled = cuenta.id === adminId;
        botonEliminar.setAttribute(
            'aria-label',
            cuenta.id === adminId ? 'No puedes eliminar tu cuenta administradora desde aquí' : `Eliminar la cuenta ${cuenta.email}`,
        );
        if (cuenta.id === adminId) botonEliminar.title = 'No puedes eliminar tu propia cuenta administradora desde aquí.';
        botonEliminar.addEventListener('click', () => eliminarCuenta(cuenta, botonEliminar));
        fila.append(
            nombre,
            correo,
            estado,
            celda(formatearFecha(cuenta.created_at)),
            celda(formatearFecha(cuenta.last_sign_in_at)),
            acciones,
        );
        acciones.append(botonRestablecer, botonEliminar);
        cuerpo.append(fila);
    });
}

function actualizarResumen() {
    document.getElementById('admin-pendientes').textContent = pedidos.filter(pedido => pedido.status === 'pending').length;
    document.getElementById('admin-confirmados').textContent = pedidos.filter(pedido => pedido.status === 'confirmed').length;
    document.getElementById('admin-cuentas').textContent = cuentas.length;
    document.getElementById('admin-no-confirmadas').textContent = cuentas.filter(cuenta => !cuenta.email_confirmed_at).length;
}

async function llamarAdminApi(payload) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
    return result;
}

async function cargarDatos() {
    botonActualizar.disabled = true;
    mostrarMensaje('Cargando pedidos y cuentas…');
    try {
        const data = await llamarAdminApi({ action: 'dashboard' });
        pedidos = data.orders;
        cuentas = data.users;
        actualizarResumen();
        renderizarPedidos();
        renderizarCuentas();
        mostrarMensaje('Datos actualizados.', 'exito');
        return true;
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudieron cargar los datos.', 'error');
        panel.hidden = true;
        return false;
    } finally {
        botonActualizar.disabled = false;
    }
}

async function actualizarPedido(orderId, status, boton) {
    boton.disabled = true;
    try {
        await llamarAdminApi({ action: 'update-order', orderId, status });
        await cargarDatos();
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudo actualizar el pedido.', 'error');
        boton.disabled = false;
    }
}

async function eliminarCuenta(cuenta, boton) {
    const confirmacion = window.prompt(
        `Esta acción es permanente y no se puede deshacer.\n\nLa cuenta se eliminará, pero sus pedidos se conservarán sin asociarse a ella.\n\nEscribe el correo exacto para continuar:\n${cuenta.email}`,
    );
    if (confirmacion === null) return;
    if (confirmacion.trim().toLowerCase() !== cuenta.email.toLowerCase()) {
        mostrarMensaje('El correo no coincide. No se eliminó ninguna cuenta.', 'error');
        return;
    }

    boton.disabled = true;
    try {
        await llamarAdminApi({ action: 'admin-delete-account', userId: cuenta.id });
        mostrarMensaje(`La cuenta ${cuenta.email} fue eliminada.`, 'exito');
        await cargarDatos();
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudo eliminar la cuenta.', 'error');
        boton.disabled = false;
    }
}

async function enviarRestablecimiento(cuenta, boton) {
    const confirmado = window.confirm(
        `Se enviará un enlace para cambiar la contraseña a:\n\n${cuenta.email}\n\n¿Quieres continuar?`,
    );
    if (!confirmado) return;

    boton.disabled = true;
    try {
        await llamarAdminApi({
            action: 'admin-send-password-reset',
            userId: cuenta.id,
            redirectTo: new URL('login.html', window.location.href).href,
        });
        mostrarMensaje(`Se envió un enlace de restablecimiento a ${cuenta.email}.`, 'exito');
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudo enviar el enlace de restablecimiento.', 'error');
    } finally {
        boton.disabled = false;
    }
}

async function iniciarPanel() {
    if (!configurado) {
        mostrarMensaje('Configura primero la URL y la clave pública de Supabase.', 'error');
        return;
    }

    cliente = obtenerClienteSupabase();
    if (!cliente) {
        mostrarMensaje('No se pudo inicializar Supabase.', 'error');
        return;
    }
    try {
        const { data, error } = await cliente.auth.getSession();
        if (error) throw error;
        if (!data.session) {
            mostrarMensaje('Inicia sesión con la cuenta administradora para continuar.', 'error');
            return;
        }
        tokenSesion = data.session.access_token;
        const { data: userData, error: userError } = await cliente.auth.getUser();
        if (userError) throw userError;
        adminId = userData.user.id;
        if (userData.user.email?.toLowerCase() === 'ystegz2009@gmail.com') {
            botonCerrarSesion.hidden = false;
            botonActualizar.hidden = false;
        }
        panel.hidden = false;
        await cargarDatos();
    } catch (error) {
        mostrarMensaje(`No se pudo verificar el acceso: ${error.message}`, 'error');
    }
}

filtroPedidos.addEventListener('change', renderizarPedidos);
busquedaPedidos.addEventListener('input', renderizarPedidos);
busquedaCuentas.addEventListener('input', renderizarCuentas);
botonActualizar.addEventListener('click', cargarDatos);
botonCerrarSesion.addEventListener('click', async () => {
    botonCerrarSesion.disabled = true;
    try {
        const { error } = await cliente.auth.signOut({ scope: 'local' });
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (error) {
        mostrarMensaje(`No se pudo cerrar la sesión: ${error.message}`, 'error');
        botonCerrarSesion.disabled = false;
    }
});

iniciarPanel();
