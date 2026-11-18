// Lee el catálogo directamente de `productosCatalogo` en Suplemex/frontend/script.js.
// Así la tienda y el servidor usan los mismos productos y precios sin copiarlos.
// Si cambias script.js, el servidor toma los cambios sin reiniciarse.
const fs = require('node:fs');
const vm = require('node:vm');
const { archivoCatalogo } = require('./config');

let cache = { modificado: 0, productos: [] };

function leerCatalogo() {
    const { mtimeMs } = fs.statSync(archivoCatalogo);
    if (mtimeMs === cache.modificado) return cache.productos;

    const codigo = fs.readFileSync(archivoCatalogo, 'utf8');
    const coincidencia = codigo.match(/const productosCatalogo = (\{[\s\S]*?\r?\n\});/);
    if (!coincidencia) throw new Error('No se encontró productosCatalogo en script.js');

    // El objeto es solo datos (textos, números y listas); se evalúa aislado y con tiempo límite.
    const objeto = vm.runInNewContext(`(${coincidencia[1]})`, Object.create(null), { timeout: 100 });
    const productos = Object.entries(objeto).map(([slug, p]) => ({
        slug,
        nombre: String(p.nombre),
        categoria: String(p.categoria),
        descripcion: String(p.descripcion),
        imagen: String(p.imagen),
        presentaciones: p.presentaciones.map(pr => ({ nombre: String(pr.nombre), precio: Number(pr.precio) })),
        sabores: Array.isArray(p.sabores) ? p.sabores.map(String) : [],
    }));

    cache = { modificado: mtimeMs, productos };
    return productos;
}

function buscarProducto(slug) {
    return typeof slug === 'string' ? leerCatalogo().find(p => p.slug === slug) : undefined;
}

function formatearPrecio(precio) {
    return `$${Number.isInteger(precio) ? precio : precio.toFixed(2)} USD`;
}

function describirCatalogo() {
    return leerCatalogo().map(p => [
        `- ${p.nombre} (${p.categoria})`,
        `  Ficha: producto.html?producto=${p.slug}`,
        `  Presentaciones y precios: ${p.presentaciones.map(pr => `${pr.nombre}: ${formatearPrecio(pr.precio)}`).join('; ')}`,
        `  Sabores: ${p.sabores.length ? p.sabores.join(', ') : 'sin sabores para elegir'}`,
        `  Descripción: ${p.descripcion}`,
    ].join('\n')).join('\n');
}

module.exports = { leerCatalogo, buscarProducto, describirCatalogo };
