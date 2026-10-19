// Leer el carrito guardado, o empezar vacío
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

// Guardar el carrito en localStorage
function guardarCarrito() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarContador();
}

function agregarAlCarrito(nombre, precio) {
    // 1. Animar el producto volando al carrito
    animarAlCarrito();

    // 2. Agregar el producto al carrito
    const existente = carrito.find(item => item.nombre === nombre);
    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({ nombre, precio, cantidad: 1 });
    }
    guardarCarrito();
}

function animarAlCarrito() {
    // Encontrar el botón del carrito en el menú
    const carritoEnlace = document.querySelector('.carrito-enlace');
    if (!carritoEnlace) return;   

    // Posición del carrito en la pantalla
    const carritoRect = carritoEnlace.getBoundingClientRect();

    // Crear la burbuja que vuela
    const burbuja = document.createElement('div');
    burbuja.className = 'fly-producto';
    burbuja.textContent = '💊';

    // Empezar desde el centro de la pantalla
    burbuja.style.left = window.innerWidth / 2 + 'px';
    burbuja.style.top = window.innerHeight / 2 + 'px';

    document.body.appendChild(burbuja);

    // Volar hasta el carrito
    requestAnimationFrame(() => {
        burbuja.style.left = (carritoRect.left + carritoRect.width / 2 - 25) + 'px';
        burbuja.style.top = (carritoRect.top + carritoRect.height / 2 - 25) + 'px';
        burbuja.style.transform = 'scale(0.3)';
    });

    // Eliminar la burbuja cuando termine
    setTimeout(() => {
        burbuja.remove();
    }, 900);
}

// Actualizar el contador del menú
function actualizarContador() {
    const total = carrito.reduce((suma, item) => suma + item.cantidad, 0);
    const contador = document.getElementById('contador');
    if (contador) contador.textContent = total;
}

// Cambiar la cantidad de un producto
function cambiarCantidad(nombre, cantidad) {
    const item = carrito.find(i => i.nombre === nombre);
    if (item) {
        item.cantidad = cantidad;
        if (item.cantidad <= 0) {
            carrito = carrito.filter(i => i.nombre !== nombre);
        }
    }
    guardarCarrito();
    mostrarCarrito();
}

// Mostrar el carrito en la página del carrito
function mostrarCarrito() {
    const lista = document.getElementById('lista-carrito');
    const vacio = document.getElementById('carrito-vacio');
    const contenido = document.getElementById('carrito-contenido');

    if (!lista) return;

    if (carrito.length === 0) {
        vacio.style.display = 'block';
        contenido.style.display = 'none';
        return;
    }

    vacio.style.display = 'none';
    contenido.style.display = 'block';

    lista.innerHTML = carrito.map(item => `
        <div class="carrito-item">
            <div>
                <h4>${item.nombre}</h4>
                <p>$${item.precio} c/u</p>
            </div>
            <div class="cantidad-control">
                <button onclick="cambiarCantidad('${item.nombre}', ${item.cantidad - 1})">−</button>
                <span>${item.cantidad}</span>
                <button onclick="cambiarCantidad('${item.nombre}', ${item.cantidad + 1})">+</button>
            </div>
            <p class="precio">$${item.precio * item.cantidad}</p>
        </div>
    `).join('');

    const total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    document.getElementById('total').textContent = '$' + total;
}

// Enviar el pedido por WhatsApp
function pedirPorWhatsApp() {
    let mensaje = 'Hola! Quiero pedir:%0A';
    carrito.forEach(item => {
        mensaje += `- ${item.nombre} x${item.cantidad} = $${item.precio * item.cantidad}%0A`;
    });
    const total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    mensaje += `TOTAL: $${total}`;
    window.open('https://wa.me/593990848845?text=' + mensaje, '_blank');
}

// Al cargar la página, mostrar el carrito y el contador
mostrarCarrito();
actualizarContador();

 