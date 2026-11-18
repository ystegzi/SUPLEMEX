// Limita cuántas solicitudes puede hacer cada visitante (por IP) en una ventana de tiempo.
// Protege la clave de la IA contra abusos y consumo excesivo.
function crearLimitador({ maximo, ventanaMs, mensaje }) {
    const visitas = new Map();

    // Limpia periódicamente los registros vencidos para no acumular memoria.
    setInterval(() => {
        const ahora = Date.now();
        for (const [ip, registro] of visitas) {
            if (registro.reinicio <= ahora) visitas.delete(ip);
        }
    }, ventanaMs).unref();

    return function limitador(req, res, next) {
        const ahora = Date.now();
        const ip = req.ip || 'desconocida';
        let registro = visitas.get(ip);
        if (!registro || registro.reinicio <= ahora) {
            registro = { cantidad: 0, reinicio: ahora + ventanaMs };
            visitas.set(ip, registro);
        }

        registro.cantidad += 1;
        if (registro.cantidad > maximo) {
            res.set('Retry-After', String(Math.ceil((registro.reinicio - ahora) / 1000)));
            return res.status(429).json({ error: mensaje });
        }
        next();
    };
}

module.exports = { crearLimitador };
