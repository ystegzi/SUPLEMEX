// Servidor de SUPLEMEX con Node.js + Express.
//   - Sirve la tienda (Suplemex/frontend): HTML, CSS, JavaScript, imágenes y el widget React.
//   - Expone la API en /api (catálogo y chatbot con IA). La clave de la IA vive solo aquí, en .env.
// Iniciar: npm start  (o npm run dev para reiniciar solo al guardar cambios)
const express = require('express');
const { puerto, carpetaFrontend, geminiApiKey, geminiModelo } = require('./config');
const rutasApi = require('./rutas/api');

const app = express();
app.disable('x-powered-by');

// Cabeceras de seguridad básicas.
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    next();
});

// API: acepta JSON pequeño (el historial del chat) y responde en JSON.
app.use('/api', express.json({ limit: '32kb' }), rutasApi);

// Archivos de la tienda. Solo se publica la carpeta frontend (nunca .env, server/ ni node_modules).
// Sin caché larga: al recompilar el chat o cambiar el CSS se ve al recargar la página.
app.use(express.static(carpetaFrontend, { extensions: ['html'] }));

// Página no encontrada.
app.use((req, res) => {
    res.status(404).type('html').send(
        '<!doctype html><meta charset="utf-8"><title>No encontrado | SUPLEMEX</title>'
        + '<body style="background:#090b09;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:60px 16px">'
        + '<h1>Página no encontrada</h1><p><a href="/" style="color:#b6ff3b">Volver a SUPLEMEX</a></p></body>',
    );
});

// Errores inesperados (incluye JSON mal formado en /api).
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const estado = error.status || error.statusCode || 500;
    if (estado >= 500) console.error(error);
    if (req.path.startsWith('/api')) {
        return res.status(estado).json({
            error: estado === 400 ? 'El cuerpo de la solicitud no es JSON válido.' : 'Error interno del servidor.',
        });
    }
    res.status(estado).send('Error interno del servidor.');
});

app.listen(puerto, () => {
    console.log(`SUPLEMEX funcionando en http://localhost:${puerto}`);
    console.log(geminiApiKey
        ? `Asistente con IA activo (modelo ${geminiModelo}).`
        : 'Aviso: falta GEMINI_API_KEY en .env; el chat usará la función de Supabase como respaldo.');
});
