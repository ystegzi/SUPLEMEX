import { obtenerClienteSupabase, supabaseConfigurado as configurado, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-client.js';

const formulario = document.getElementById('checkout-form');
const dialogo = document.getElementById('dialogo-pedido');
const mensaje = document.getElementById('checkout-mensaje');
const botonEnviar = document.getElementById('checkout-submit');
const seccionExito = document.getElementById('checkout-exito');
const enlaceWhatsApp = document.getElementById('abrir-whatsapp-pedido');
let pedidoCreado = false;
let cliente = null;

function mostrarMensaje(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `auth-mensaje auth-${tipo}`;
    mensaje.hidden = !texto;
}

function leerProductosCarrito() {
    try {
        const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
        if (!Array.isArray(carrito)) return [];
        return carrito.map(item => ({
            name: item.nombre,
            presentation: item.presentacion,
            flavor: item.sabor || '',
            quantity: item.cantidad,
        }));
    } catch (error) {
        throw new Error('No se pudo leer el carrito. Recarga la página e inténtalo de nuevo.');
    }
}

function crearEnlaceWhatsApp(pedido, productos) {
    const lineas = [
        `Hola, acabo de registrar el pedido ${pedido.order_number}:`,
        ...productos.map(item => `- ${item.quantity} × ${item.product_name} (${item.presentation})${item.flavor ? `, sabor ${item.flavor}` : ''}`),
        `Total de productos: $${Number(pedido.total).toFixed(2)} USD`,
        'Por favor, confirmen disponibilidad, envío y forma de pago.',
    ];
    enlaceWhatsApp.href = `https://wa.me/593990848845?text=${encodeURIComponent(lineas.join('\n'))}`;
}

if (formulario) {
    if (configurado) {
        cliente = obtenerClienteSupabase();
        cliente.auth.getSession().then(({ data, error }) => {
            if (error) {
                mostrarMensaje(`No se pudo consultar la sesión: ${error.message}`);
                return;
            }
            const usuario = data.session?.user;
            if (usuario) {
                document.getElementById('checkout-nombre').value = usuario.user_metadata?.full_name || '';
                document.getElementById('checkout-correo').value = usuario.email || '';
            }
        }).catch(error => mostrarMensaje(`No se pudo consultar la sesión: ${error.message}`));
    }

    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (!configurado || !cliente) {
            mostrarMensaje('El servicio de pedidos todavía no está configurado.');
            return;
        }

        botonEnviar.disabled = true;
        mostrarMensaje('');
        try {
            const productos = leerProductosCarrito();
            if (productos.length === 0) throw new Error('Tu carrito está vacío. Agrega productos antes de enviar el pedido.');

            const { data: sessionData, error: sessionError } = await cliente.auth.getSession();
            if (sessionError) throw new Error(`No se pudo validar la sesión: ${sessionError.message}`);

            const respuesta = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    ...(sessionData.session?.access_token
                        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
                        : {}),
                },
                body: JSON.stringify({
                    customerName: document.getElementById('checkout-nombre').value,
                    customerEmail: document.getElementById('checkout-correo').value,
                    customerPhone: document.getElementById('checkout-telefono').value,
                    customerCity: document.getElementById('checkout-ciudad').value,
                    customerAddress: document.getElementById('checkout-direccion').value,
                    customerNotes: document.getElementById('checkout-notas').value,
                    website: document.getElementById('checkout-website').value,
                    items: productos,
                }),
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo registrar tu pedido.');

            document.getElementById('checkout-numero-pedido').textContent = resultado.order.order_number;
            crearEnlaceWhatsApp(resultado.order, resultado.items);
            formulario.hidden = true;
            seccionExito.hidden = false;
            mostrarMensaje('');
            pedidoCreado = true;
            localStorage.removeItem('carrito');
            const contador = document.getElementById('contador');
            if (contador) contador.textContent = '0';
            const estado = document.getElementById('estado-pedido');
            if (estado) estado.textContent = `Pedido ${resultado.order.order_number} registrado y pendiente de confirmación.`;
        } catch (error) {
            mostrarMensaje(error.message || 'Ocurrió un error al enviar tu pedido.');
        } finally {
            botonEnviar.disabled = false;
        }
    });

    enlaceWhatsApp.addEventListener('click', () => {
        if (dialogo.open) dialogo.close();
    });

    dialogo.addEventListener('close', () => {
        if (pedidoCreado) window.location.reload();
    });
}
