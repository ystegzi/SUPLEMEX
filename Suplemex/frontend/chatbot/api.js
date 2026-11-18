import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase-config.js';

// El chat puede responder desde dos backends seguros (la clave de la IA nunca está aquí):
//   1. El servidor Node.js + Express del proyecto (server/), en /api/chatbot.
//   2. La Edge Function `chatbot` de Supabase, como respaldo cuando la página
//      no se abre desde el servidor Node (por ejemplo, en un hosting estático).
const RUTA_SERVIDOR_NODE = '/api/chatbot';

// Límites alineados con ambos backends.
const MAX_MENSAJES = 16;
const MAX_CARACTERES = 7000;
const TIEMPO_ESPERA_MS = 30000;

// 'probar' → aún no se sabe si hay servidor Node; 'si' / 'no' → ya se comprobó.
let servidorNode = /^https?:$/.test(window.location.protocol) ? 'probar' : 'no';

// Prepara el historial que se envía a la IA: une turnos consecutivos del mismo rol
// (por ejemplo, tras un error) y recorta los mensajes más antiguos si es demasiado largo.
function prepararHistorial(mensajes) {
    const unidos = [];
    for (const { role, content } of mensajes) {
        const anterior = unidos[unidos.length - 1];
        if (anterior && anterior.role === role) {
            anterior.content = `${anterior.content}\n\n${content}`;
        } else {
            unidos.push({ role, content });
        }
    }

    const historial = [];
    let total = 0;
    for (let i = unidos.length - 1; i >= 0 && historial.length < MAX_MENSAJES; i -= 1) {
        const contenido = unidos[i].content.slice(0, 4000);
        if (total + contenido.length > MAX_CARACTERES && historial.length > 0) break;
        total += contenido.length;
        historial.unshift({ role: unidos[i].role, content: contenido });
    }
    return historial;
}

async function solicitar(url, headers, cuerpo) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_MS);
    try {
        return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: cuerpo,
            signal: controlador.signal,
        });
    } finally {
        clearTimeout(temporizador);
    }
}

async function leerRespuesta(respuesta) {
    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        throw new Error(resultado.error || 'No se pudo obtener una respuesta. Inténtalo de nuevo.');
    }
    if (typeof resultado.reply !== 'string' || !resultado.reply.trim()) {
        throw new Error('El asistente no devolvió una respuesta. Inténtalo de nuevo.');
    }
    return resultado.reply.trim();
}

function errorDeConexion(error) {
    if (error?.name === 'AbortError') {
        return new Error('El asistente tardó demasiado en responder. Inténtalo de nuevo.');
    }
    return new Error(navigator.onLine === false
        ? 'Parece que no tienes conexión a internet. Revisa tu conexión e inténtalo de nuevo.'
        : 'No se pudo conectar con el asistente. Inténtalo de nuevo.');
}

export async function pedirRespuesta(mensajes, { producto } = {}) {
    const cuerpo = JSON.stringify({
        messages: prepararHistorial(mensajes),
        ...(producto ? { producto } : {}),
    });

    // 1. Servidor Node.js + Express.
    if (servidorNode !== 'no') {
        try {
            const respuesta = await solicitar(RUTA_SERVIDOR_NODE, {}, cuerpo);
            // 404/405/501: no hay servidor Node (hosting estático). 503: Node sin clave de IA.
            const esJson = (respuesta.headers.get('content-type') || '').includes('application/json');
            if ([404, 405, 501, 503].includes(respuesta.status) || !esJson) {
                servidorNode = 'no';
            } else {
                servidorNode = 'si';
                return await leerRespuesta(respuesta);
            }
        } catch (error) {
            if (error?.name === 'AbortError') throw errorDeConexion(error);
            if (servidorNode === 'si' && !(error instanceof TypeError)) throw error;
            // Error de red: se intenta con Supabase.
        }
    }

    // 2. Respaldo: Edge Function de Supabase.
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('El asistente todavía no está configurado.');
    }
    let respuesta;
    try {
        respuesta = await solicitar(`${SUPABASE_URL}/functions/v1/chatbot`, {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        }, cuerpo);
    } catch (error) {
        throw errorDeConexion(error);
    }
    return leerRespuesta(respuesta);
}
