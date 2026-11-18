// Rutas de la API de SUPLEMEX (todas empiezan con /api).
const express = require('express');
const { leerCatalogo } = require('../catalogo');
const { validarMensajes, responder, ErrorAsistente } = require('../asistente');
const { crearLimitador } = require('../limitador');
const { geminiApiKey } = require('../config');

const router = express.Router();

const limitadorChat = crearLimitador({
    maximo: 20,
    ventanaMs: 60 * 1000,
    mensaje: 'Has enviado muchos mensajes seguidos. Espera un minuto e inténtalo de nuevo.',
});

// GET /api/salud → comprueba que el servidor funciona.
router.get('/salud', (req, res) => {
    res.json({ estado: 'ok', asistenteConfigurado: Boolean(geminiApiKey) });
});

// GET /api/productos → catálogo de la tienda (mismos datos que script.js).
router.get('/productos', (req, res, next) => {
    try {
        res.json({ productos: leerCatalogo() });
    } catch (error) {
        next(error);
    }
});

// POST /api/chatbot → recibe la conversación y devuelve la respuesta de la IA.
// Cuerpo: { messages: [{ role: 'user' | 'assistant', content }], producto?: slug }
router.post('/chatbot', limitadorChat, async (req, res) => {
    const mensajes = validarMensajes(req.body?.messages);
    if (!mensajes) {
        return res.status(400).json({ error: 'El mensaje no es válido o es demasiado largo.' });
    }

    try {
        const reply = await responder(mensajes, req.body.producto);
        res.json({ reply });
    } catch (error) {
        if (error instanceof ErrorAsistente) {
            return res.status(error.estado).json({ error: error.message });
        }
        console.error('Error inesperado en el chatbot:', error);
        res.status(500).json({ error: 'Ocurrió un error inesperado. Inténtalo de nuevo.' });
    }
});

// Cualquier otra ruta /api que no exista.
router.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
});

module.exports = router;
