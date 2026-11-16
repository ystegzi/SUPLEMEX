function cargarCarrito() {
    try {
        const guardado = JSON.parse(localStorage.getItem('carrito') || '[]');
        if (!Array.isArray(guardado)) return [];

        return guardado
            .filter(item => item && typeof item.nombre === 'string' && item.nombre.trim())
            .map(item => ({
                nombre: item.nombre.trim(),
                sabor: typeof item.sabor === 'string' ? item.sabor.trim() : '',
                presentacion: typeof item.presentacion === 'string' ? item.presentacion.trim() : '',
                precio: Number(item.precio),
                cantidad: Number(item.cantidad)
            }))
            .filter(item => Number.isFinite(item.precio) && item.precio >= 0 && Number.isInteger(item.cantidad) && item.cantidad > 0);
    } catch {
        return [];
    }
}

let carrito = cargarCarrito();

function guardarCarrito() {
    try {
        localStorage.setItem('carrito', JSON.stringify(carrito));
    } catch {
        // El carrito sigue funcionando en memoria si el almacenamiento no está disponible.
    }
    actualizarContador();
}

function agregarAlCarrito(nombre, precio, sabor = '', presentacion = '') {
    const precioNumerico = Number(precio);
    const saborSeleccionado = typeof sabor === 'string' ? sabor.trim() : '';
    const presentacionSeleccionada = typeof presentacion === 'string' ? presentacion.trim() : '';
    if (typeof nombre !== 'string' || !nombre.trim() || !Number.isFinite(precioNumerico) || precioNumerico < 0) return;

    animarAlCarrito();
    const existente = carrito.find(item => item.nombre === nombre.trim()
        && (item.sabor || '') === saborSeleccionado
        && (item.presentacion || '') === presentacionSeleccionada);
    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({
            nombre: nombre.trim(),
            sabor: saborSeleccionado,
            presentacion: presentacionSeleccionada,
            precio: precioNumerico,
            cantidad: 1
        });
    }
    guardarCarrito();
    mostrarConfirmacion([nombre.trim(), presentacionSeleccionada, saborSeleccionado].filter(Boolean).join(' · '));
}

let temporizadorAviso;

function mostrarConfirmacion(nombre) {
    const aviso = document.getElementById('aviso-carrito');
    if (!aviso) return;

    aviso.querySelector('.aviso-carrito-mensaje').textContent = `${nombre} se agregó al carrito`;
    aviso.hidden = false;
    requestAnimationFrame(() => aviso.classList.add('aviso-visible'));

    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => {
        aviso.classList.remove('aviso-visible');
        setTimeout(() => {
            if (!aviso.classList.contains('aviso-visible')) aviso.hidden = true;
        }, 220);
    }, 3200);
}

function animarAlCarrito() {
    const carritoEnlace = document.querySelector('.carrito-enlace');
    if (!carritoEnlace) return;

    const carritoRect = carritoEnlace.getBoundingClientRect();
    const burbuja = document.createElement('div');
    burbuja.className = 'fly-producto';
    burbuja.textContent = '💊';
    burbuja.style.left = window.innerWidth / 2 + 'px';
    burbuja.style.top = window.innerHeight / 2 + 'px';
    document.body.appendChild(burbuja);

    requestAnimationFrame(() => {
        burbuja.style.left = (carritoRect.left + carritoRect.width / 2 - 25) + 'px';
        burbuja.style.top = (carritoRect.top + carritoRect.height / 2 - 25) + 'px';
        burbuja.style.transform = 'scale(0.3)';
    });

    setTimeout(() => burbuja.remove(), 900);
}

function actualizarContador() {
    const total = carrito.reduce((suma, item) => suma + item.cantidad, 0);
    const contador = document.getElementById('contador');
    if (contador) contador.textContent = total;
}

function cambiarCantidad(nombre, sabor, presentacion, cantidad) {
    const nuevaCantidad = Number(cantidad);
    if (!Number.isInteger(nuevaCantidad)) return;

    const item = carrito.find(producto => producto.nombre === nombre
        && (producto.sabor || '') === sabor
        && (producto.presentacion || '') === presentacion);
    if (!item) return;

    if (nuevaCantidad <= 0) {
        carrito = carrito.filter(producto => producto.nombre !== nombre
            || (producto.sabor || '') !== sabor
            || (producto.presentacion || '') !== presentacion);
    } else {
        item.cantidad = nuevaCantidad;
    }

    guardarCarrito();
    mostrarCarrito();
}

function formatearPrecio(valor) {
    return '$' + new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(valor);
}

function crearBotonCantidad(texto, accion, nombre, sabor, presentacion, etiqueta) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = texto;
    boton.dataset.accion = accion;
    boton.dataset.nombre = nombre;
    boton.dataset.sabor = sabor || '';
    boton.dataset.presentacion = presentacion || '';
    boton.setAttribute('aria-label', etiqueta);
    return boton;
}

function crearFilaCarrito(item) {
    const fila = document.createElement('div');
    fila.className = 'carrito-item';

    const informacion = document.createElement('div');
    informacion.className = 'item-info';

    const nombre = document.createElement('h4');
    nombre.textContent = item.nombre;

    const precioUnitario = document.createElement('p');
    precioUnitario.className = 'precio-unitario';
    precioUnitario.textContent = `${formatearPrecio(item.precio)} c/u`;
    informacion.append(nombre);
    if (item.sabor) {
        const sabor = document.createElement('p');
        sabor.className = 'sabor-producto';
        sabor.textContent = `Sabor: ${item.sabor}`;
        informacion.append(sabor);
    }
    if (item.presentacion) {
        const presentacion = document.createElement('p');
        presentacion.className = 'sabor-producto';
        presentacion.textContent = `Presentación: ${item.presentacion}`;
        informacion.append(presentacion);
    }
    informacion.append(precioUnitario);

    const controles = document.createElement('div');
    controles.className = 'cantidad-control';
    const nombreProducto = [item.nombre, item.presentacion, item.sabor].filter(Boolean).join(' ');
    controles.append(
        crearBotonCantidad('−', 'restar', item.nombre, item.sabor, item.presentacion, `Restar ${nombreProducto}`)
    );

    const cantidad = document.createElement('span');
    cantidad.textContent = item.cantidad;
    cantidad.setAttribute('aria-label', `Cantidad: ${item.cantidad}`);
    controles.append(cantidad);
    controles.append(
        crearBotonCantidad('+', 'sumar', item.nombre, item.sabor, item.presentacion, `Sumar ${nombreProducto}`)
    );

    const subtotal = document.createElement('p');
    subtotal.className = 'precio subtotal';
    subtotal.textContent = formatearPrecio(item.precio * item.cantidad);

    const quitar = crearBotonCantidad('×', 'quitar', item.nombre, item.sabor, item.presentacion, `Quitar ${nombreProducto} del carrito`);
    quitar.className = 'boton-quitar';

    fila.append(informacion, controles, subtotal, quitar);
    return fila;
}

function mostrarCarrito() {
    const lista = document.getElementById('lista-carrito');
    const vacio = document.getElementById('carrito-vacio');
    const contenido = document.getElementById('carrito-contenido');
    if (!lista || !vacio || !contenido) return;

    const estaVacio = carrito.length === 0;
    vacio.style.display = estaVacio ? 'block' : 'none';
    contenido.style.display = estaVacio ? 'none' : 'block';
    if (estaVacio) {
        lista.replaceChildren();
        return;
    }

    lista.replaceChildren(...carrito.map(crearFilaCarrito));
    const total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    const totalElemento = document.getElementById('total');
    if (totalElemento) totalElemento.textContent = formatearPrecio(total);
}

function pedirPorWhatsApp() {
    if (carrito.length === 0) return;

    const resumen = document.getElementById('resumen-pedido');
    const dialogo = document.getElementById('dialogo-pedido');
    if (!resumen || !dialogo) return;

    const lineas = carrito.map(item => {
        const linea = document.createElement('p');
        linea.textContent = `${item.cantidad} × ${item.nombre}${item.presentacion ? ` (${item.presentacion})` : ''}${item.sabor ? ` · ${item.sabor}` : ''} · ${formatearPrecio(item.precio * item.cantidad)} USD`;
        return linea;
    });
    const total = document.createElement('p');
    total.className = 'resumen-pedido-total';
    total.textContent = `Total: ${formatearPrecio(carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0))} USD`;
    resumen.replaceChildren(...lineas, total);
    const formulario = document.getElementById('checkout-form');
    const exito = document.getElementById('checkout-exito');
    if (formulario) formulario.hidden = false;
    if (exito) exito.hidden = true;
    const mensaje = document.getElementById('checkout-mensaje');
    if (mensaje) mensaje.hidden = true;
    dialogo.showModal();
}

const listaCarrito = document.getElementById('lista-carrito');
if (listaCarrito) {
    listaCarrito.addEventListener('click', event => {
        const boton = event.target.closest('button[data-accion]');
        if (!boton) return;

        const sabor = boton.dataset.sabor || '';
        const presentacion = boton.dataset.presentacion || '';
        const item = carrito.find(producto => producto.nombre === boton.dataset.nombre
            && (producto.sabor || '') === sabor
            && (producto.presentacion || '') === presentacion);
        if (!item) return;
        const cantidad = boton.dataset.accion === 'quitar'
            ? 0
            : boton.dataset.accion === 'sumar'
                ? item.cantidad + 1
                : item.cantidad - 1;
        cambiarCantidad(item.nombre, sabor, presentacion, cantidad);
    });
}

const productosCatalogo = {
    proteina: {
        nombre: 'Proteína Whey',
        categoria: 'PROTEÍNAS',
        descripcion: 'Ideal para complementar tu alimentación y apoyar la recuperación muscular.',
        imagen: 'https://www.optimumnutrition.com/cdn/shop/files/US_GSW_5LB_EXTMILKCHOC_Main_Image.png?v=1777475681&width=2500',
        presentaciones: [
            { nombre: '0,91 kg', precio: 80 },
            { nombre: '2,27 kg', precio: 150 }
        ],
        sabores: ['Vainilla', 'Chocolate', 'Cookies and Cream']
    },
    creatina: {
        nombre: 'Creatina',
        categoria: 'RENDIMIENTO',
        descripcion: 'Para apoyar el rendimiento deportivo en entrenamientos de alta intensidad.',
        imagen: 'https://www.optimumnutrition.com/cdn/shop/files/on-1153060_Image_01.png?v=1785779148&width=2000',
        presentaciones: [
            { nombre: '300 g', precio: 22 },
            { nombre: '500 g', precio: 40 },
            { nombre: '1 kg', precio: 60 }
        ]
    },
    bcaa: {
        nombre: 'BCAA',
        categoria: 'AMINOÁCIDOS',
        descripcion: 'Aminoácidos esenciales para reducir la fatiga durante el ejercicio.',
        imagen: 'https://www.optimumnutrition.com/cdn/shop/files/on-1031737_Image_01.png?v=1755796109&width=600',
        presentaciones: [
            { nombre: '60 cápsulas', precio: 28 },
            { nombre: '100 cápsulas', precio: 40 }
        ]
    },
    'red-rex-big-whey': {
        nombre: 'Red Rex Big Whey',
        categoria: 'PROTEÍNAS',
        descripcion: 'Proteína de suero concentrada, aislada e hidrolizada. Aporta 24 g de proteína por scoop y aminoácidos completos. Baja en calorías, carbohidratos y grasas, sin azúcar añadida; ayuda a promover la recuperación y el crecimiento muscular magro.',
        imagen: 'images/red-rex-big-whey.png',
        imagenAlejada: true,
        presentaciones: [
            { nombre: '4.5 Lbs', precio: 79.80 }
        ],
        sabores: ['Vainilla']
    },
    'cbum-essential-pre': {
        nombre: 'CBUM Essential Pre',
        categoria: 'PRE ENTRENAMIENTO',
        descripcion: 'Preentreno esencial de la serie CBUM, adecuado para principiantes y avanzados. Contiene dosis definidas de L-citrulina, beta alanina y cafeína para apoyar la energía, concentración, circulación, bombeo muscular, resistencia y reducir la fatiga. Modo de empleo: tomar 1 servida 30 minutos antes del entrenamiento físico.',
        imagen: 'images/cbum-essential-pre.png',
        imagenAlejada: true,
        presentaciones: [
            { nombre: '30 servicios', precio: 36 }
        ],
        sabores: ['Champion Mentality – Citrus Slush']
    },
    'saxofit-colageno': {
        nombre: 'Saxofit Colágeno',
        categoria: 'COLÁGENO',
        descripcion: 'Colágeno hidrolizado en polvo de rápida absorción, sin sabor ni componentes adicionales. Promueve la elasticidad de la piel, fortalece uñas y cabello y da soporte a huesos y articulaciones. Elaborado con materia prima española. Modo de empleo: tomar 1 servida completa una vez al día.',
        imagen: 'images/saxofit-colageno.png',
        imagenAlejada: true,
        presentaciones: [
            { nombre: '300 g · 30 servicios', precio: 23 }
        ]
    }
};

function iniciarPaginaProducto() {
    const pagina = document.getElementById('pagina-producto');
    if (!pagina) return;

    const producto = productosCatalogo[new URLSearchParams(window.location.search).get('producto')];
    const noEncontrado = document.getElementById('producto-no-encontrado');
    if (!producto) {
        pagina.hidden = true;
        if (noEncontrado) noEncontrado.hidden = false;
        return;
    }

    document.title = `${producto.nombre} | SUPLEMEX`;
    document.getElementById('categoria-detalle').textContent = producto.categoria;
    document.getElementById('nombre-detalle').textContent = producto.nombre;
    document.getElementById('descripcion-detalle').textContent = producto.descripcion;
    const imagen = document.getElementById('imagen-detalle');
    imagen.src = producto.imagen;
    imagen.alt = producto.nombre;
    imagen.classList.toggle('imagen-producto-alejada', Boolean(producto.imagenAlejada));

    const opciones = document.getElementById('presentaciones-detalle');
    const precio = document.getElementById('precio-detalle');
    const selectorSabor = document.getElementById('sabor-detalle');
    const selectorSaborContenedor = document.getElementById('selector-sabor-contenedor');
    const botonAgregar = document.getElementById('agregar-detalle');

    producto.presentaciones.forEach((presentacion, indice) => {
        const etiqueta = document.createElement('label');
        etiqueta.className = 'presentacion-opcion';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'presentacion';
        radio.value = presentacion.nombre;
        radio.dataset.precio = presentacion.precio;
        radio.id = `presentacion-${indice}`;

        const texto = document.createElement('span');
        texto.textContent = `${presentacion.nombre} · ${formatearPrecio(presentacion.precio)} USD`;
        etiqueta.htmlFor = radio.id;
        etiqueta.append(radio, texto);
        opciones.append(etiqueta);
    });

    if (producto.sabores) {
        selectorSaborContenedor.hidden = false;
        producto.sabores.forEach(sabor => {
            const opcion = document.createElement('option');
            opcion.value = sabor;
            opcion.textContent = sabor;
            selectorSabor.append(opcion);
        });
    }

    function actualizarSeleccion() {
        const seleccion = opciones.querySelector('input:checked');
        const saborRequerido = Boolean(producto.sabores);
        const saborElegido = !saborRequerido || Boolean(selectorSabor.value);
        precio.textContent = seleccion
            ? `${formatearPrecio(Number(seleccion.dataset.precio))} USD`
            : 'Selecciona una presentación';
        botonAgregar.disabled = !seleccion || !saborElegido;
    }

    opciones.addEventListener('change', actualizarSeleccion);
    selectorSabor.addEventListener('change', actualizarSeleccion);
    botonAgregar.addEventListener('click', () => {
        const seleccion = opciones.querySelector('input:checked');
        if (!seleccion || (producto.sabores && !selectorSabor.value)) return;
        agregarAlCarrito(producto.nombre, seleccion.dataset.precio, selectorSabor.value, seleccion.value);
    });
}

const dialogoPedido = document.getElementById('dialogo-pedido');
const cerrarDialogoPedido = document.getElementById('cerrar-dialogo-pedido');
if (dialogoPedido && cerrarDialogoPedido) {
    cerrarDialogoPedido.addEventListener('click', () => dialogoPedido.close());
}

iniciarPaginaProducto();
mostrarCarrito();
actualizarContador();

 