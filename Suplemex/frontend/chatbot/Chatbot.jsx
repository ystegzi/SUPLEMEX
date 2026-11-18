import { useCallback, useEffect, useRef, useState } from 'react';
import { pedirRespuesta } from './api.js';
import { ContenidoMensaje } from './formato.jsx';

const CLAVE_HISTORIAL = 'suplemex-chatbot-historial';
const MAX_HISTORIAL_GUARDADO = 40;
const DURACION_CIERRE_MS = 200;

const BIENVENIDA = {
    role: 'assistant',
    content: '¡Hola! 👋 Soy **Rex**, el asistente virtual de SUPLEMEX.\n\nPuedo ayudarte a elegir suplementos, explicarte para qué sirve cada uno, darte precios y presentaciones, o guiarte con tu pedido. ¿En qué te ayudo hoy?',
};

const SUGERENCIAS_GENERALES = [
    '¿Para qué sirve la creatina?',
    'Quiero ganar masa muscular, ¿qué me recomiendas?',
    '¿Qué diferencia hay entre las proteínas?',
    '¿Cómo hago un pedido?',
];

const SUGERENCIAS_PRODUCTO = [
    '¿Para qué sirve este producto?',
    '¿Qué presentaciones y precios tiene?',
    '¿Cómo se toma?',
    '¿Cómo hago un pedido?',
];

function obtenerProductoActual() {
    if (!/producto\.html$/.test(window.location.pathname)) return null;
    const slug = new URLSearchParams(window.location.search).get('producto');
    return slug && /^[a-z0-9-]{1,60}$/.test(slug) ? slug : null;
}

// El historial se guarda en sessionStorage para no perder la conversación
// al pasar de una página de la tienda a otra; se borra al cerrar la pestaña.
function cargarHistorial() {
    try {
        const guardado = JSON.parse(sessionStorage.getItem(CLAVE_HISTORIAL) || 'null');
        if (Array.isArray(guardado) && guardado.length > 0 && guardado.every(m =>
            m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')) {
            return guardado;
        }
    } catch {
        // Si el almacenamiento no está disponible, el chat funciona solo en memoria.
    }
    return [BIENVENIDA];
}

function guardarHistorial(mensajes) {
    try {
        sessionStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(mensajes.slice(-MAX_HISTORIAL_GUARDADO)));
    } catch {
        // Ignorado: ver cargarHistorial.
    }
}

function IconoChat() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path
                fill="currentColor"
                d="M12 3C6.48 3 2 6.92 2 11.75c0 2.47 1.18 4.7 3.08 6.28L4.3 21.4a.6.6 0 0 0 .86.67l3.86-2.03c.95.24 1.95.37 2.98.37 5.52 0 10-3.92 10-8.66S17.52 3 12 3Zm-4.5 9.9a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Zm4.5 0a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Zm4.5 0a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Z"
            />
        </svg>
    );
}

function IconoEnviar() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M3.4 20.4 21.85 12.5a.55.55 0 0 0 0-1L3.4 3.6a.5.5 0 0 0-.7.6L5 11l9 1-9 1-2.3 6.8a.5.5 0 0 0 .7.6Z" />
        </svg>
    );
}

export function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState(cargarHistorial);
    const [error, setError] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [producto] = useState(obtenerProductoActual);
    const inputRef = useRef(null);
    const openButtonRef = useRef(null);
    const messagesRef = useRef(null);
    const sendingRef = useRef(false);
    const closeTimerRef = useRef(null);

    const isVisible = isOpen || isClosing;
    const sugerencias = producto ? SUGERENCIAS_PRODUCTO : SUGERENCIAS_GENERALES;
    const mostrarSugerencias = messages.length === 1 && !isSending;

    useEffect(() => guardarHistorial(messages), [messages]);
    useEffect(() => () => clearTimeout(closeTimerRef.current), []);

    const abrir = useCallback(() => {
        clearTimeout(closeTimerRef.current);
        setIsClosing(false);
        setIsOpen(true);
    }, []);

    const cerrar = useCallback(() => {
        setIsOpen(false);
        setIsClosing(true);
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => setIsClosing(false), DURACION_CIERRE_MS);
        openButtonRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;

        inputRef.current?.focus();
        function handleKeyDown(event) {
            if (event.key === 'Escape') cerrar();
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cerrar]);

    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages, error, isSending, isVisible]);

    // Ajusta la altura del cuadro de texto al contenido (hasta un máximo definido en CSS).
    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    }, [draft, isVisible]);

    async function solicitarRespuesta(conversacion) {
        sendingRef.current = true;
        setIsSending(true);
        setError('');
        try {
            const reply = await pedirRespuesta(conversacion, { producto });
            setMessages(current => [...current, { role: 'assistant', content: reply }]);
        } catch (requestError) {
            setError(requestError instanceof Error && requestError.message
                ? requestError.message
                : 'No se pudo conectar con el asistente.');
        } finally {
            sendingRef.current = false;
            setIsSending(false);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }

    function enviar(texto) {
        const content = texto.trim().slice(0, 1000);
        if (!content || sendingRef.current) return;

        const conversacion = [...messages, { role: 'user', content }];
        setMessages(conversacion);
        setDraft('');
        solicitarRespuesta(conversacion);
    }

    function reintentar() {
        if (sendingRef.current || messages[messages.length - 1]?.role !== 'user') return;
        solicitarRespuesta(messages);
    }

    function reiniciar() {
        if (sendingRef.current) return;
        setMessages([BIENVENIDA]);
        setError('');
        setDraft('');
        inputRef.current?.focus();
    }

    function handleSubmit(event) {
        event.preventDefault();
        enviar(draft);
    }

    function handleKeyDown(event) {
        // Enter envía; Shift + Enter agrega un salto de línea.
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            enviar(draft);
        }
    }

    const puedeReintentar = Boolean(error) && messages[messages.length - 1]?.role === 'user';

    return (
        <section
            className={`chatbot${isOpen ? ' chatbot-abierto' : ''}`}
            aria-label="Asistente virtual de SUPLEMEX"
        >
            {isVisible && (
                <div
                    id="chatbot-panel"
                    className={`chatbot-panel${isClosing ? ' chatbot-panel-cerrando' : ''}`}
                    role="dialog"
                    aria-labelledby="chatbot-titulo"
                >
                    <div className="chatbot-encabezado">
                        <div className="chatbot-avatar" aria-hidden="true">R</div>
                        <div className="chatbot-titulo">
                            <strong id="chatbot-titulo">Rex · Asistente SUPLEMEX</strong>
                            <span className="chatbot-estado">
                                <span className="chatbot-estado-punto" aria-hidden="true" />
                                {isSending ? 'Escribiendo…' : 'En línea · Asistente con IA'}
                            </span>
                        </div>
                        <button
                            className="chatbot-icono-boton"
                            type="button"
                            title="Nueva conversación"
                            aria-label="Empezar una nueva conversación"
                            onClick={reiniciar}
                            disabled={isSending || messages.length === 1}
                        >
                            ↻
                        </button>
                        <button
                            className="chatbot-icono-boton chatbot-cerrar"
                            type="button"
                            aria-label="Cerrar chat"
                            onClick={cerrar}
                        >
                            ×
                        </button>
                    </div>

                    <div
                        ref={messagesRef}
                        className="chatbot-mensajes"
                        role="log"
                        aria-live="polite"
                        aria-relevant="additions"
                    >
                        {messages.map((message, index) => (
                            <div
                                className={`chatbot-mensaje chatbot-mensaje-${message.role === 'user' ? 'usuario' : 'asistente'}`}
                                key={`${index}-${message.role}`}
                            >
                                {message.role === 'user'
                                    ? <p>{message.content}</p>
                                    : <ContenidoMensaje texto={message.content} />}
                            </div>
                        ))}

                        {mostrarSugerencias && (
                            <div className="chatbot-sugerencias" aria-label="Preguntas sugeridas">
                                {sugerencias.map(sugerencia => (
                                    <button key={sugerencia} type="button" onClick={() => enviar(sugerencia)}>
                                        {sugerencia}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isSending && (
                            <div className="chatbot-mensaje chatbot-mensaje-asistente chatbot-escribiendo" role="status">
                                <span className="sr-only">El asistente está escribiendo</span>
                                <span className="chatbot-punto" aria-hidden="true" />
                                <span className="chatbot-punto" aria-hidden="true" />
                                <span className="chatbot-punto" aria-hidden="true" />
                            </div>
                        )}

                        {error && (
                            <div className="chatbot-error" role="alert">
                                <p>⚠️ {error}</p>
                                {puedeReintentar && (
                                    <button type="button" onClick={reintentar}>Reintentar</button>
                                )}
                            </div>
                        )}
                    </div>

                    <form className="chatbot-formulario" onSubmit={handleSubmit}>
                        <label className="sr-only" htmlFor="chatbot-entrada">Escribe tu pregunta</label>
                        <textarea
                            ref={inputRef}
                            id="chatbot-entrada"
                            name="message"
                            rows={1}
                            maxLength={1000}
                            placeholder="Escribe tu pregunta…"
                            autoComplete="off"
                            value={draft}
                            onChange={event => setDraft(event.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            className="chatbot-enviar"
                            type="submit"
                            aria-label="Enviar mensaje"
                            disabled={isSending || !draft.trim()}
                        >
                            <IconoEnviar />
                        </button>
                    </form>
                    <p className="chatbot-nota">Información general, no consejo médico. Consulta a un profesional de salud.</p>
                </div>
            )}

            <button
                ref={openButtonRef}
                className="chatbot-abrir"
                type="button"
                aria-controls="chatbot-panel"
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Cerrar asistente virtual' : 'Abrir asistente virtual'}
                onClick={() => (isOpen ? cerrar() : abrir())}
            >
                <span className="chatbot-abrir-icono" aria-hidden="true">
                    {isOpen ? <span className="chatbot-abrir-x">×</span> : <IconoChat />}
                </span>
                <span className="chatbot-abrir-texto">¿Necesitas ayuda?</span>
            </button>
        </section>
    );
}
