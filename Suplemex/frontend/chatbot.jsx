import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const greeting = {
    role: 'assistant',
    content: '¡Hola! Puedo ayudarte con nuestros productos y con cómo comprar. ¿Qué te gustaría saber?',
};

function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([greeting]);
    const [history, setHistory] = useState([greeting]);
    const [error, setError] = useState('');
    const [isSending, setIsSending] = useState(false);
    const inputRef = useRef(null);
    const openButtonRef = useRef(null);
    const messagesRef = useRef(null);
    const sendingRef = useRef(false);

    useEffect(() => {
        if (!isOpen) return undefined;

        inputRef.current?.focus();
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                setIsOpen(false);
                openButtonRef.current?.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages, error, isSending]);

    async function handleSubmit(event) {
        event.preventDefault();
        const content = draft.trim();
        if (!content || sendingRef.current) return;

        sendingRef.current = true;
        setIsSending(true);
        setDraft('');
        setError('');

        const nextHistory = [...history, { role: 'user', content }];
        setMessages(current => [...current, { role: 'user', content }]);

        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ messages: nextHistory.slice(-10) }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.error || 'No se pudo obtener una respuesta.');
            }
            if (typeof result.reply !== 'string' || !result.reply.trim()) {
                throw new Error('El asistente no devolvió una respuesta. Inténtalo de nuevo.');
            }

            const reply = result.reply.trim();
            const assistantMessage = { role: 'assistant', content: reply };
            setHistory([...nextHistory, assistantMessage]);
            setMessages(current => [...current, assistantMessage]);
        } catch (requestError) {
            setError(requestError instanceof Error
                ? requestError.message
                : 'No se pudo conectar con el asistente.');
        } finally {
            sendingRef.current = false;
            setIsSending(false);
            inputRef.current?.focus();
        }
    }

    return (
        <section className="chatbot" aria-label="Asistente virtual de SUPLEMEX">
            {isOpen && (
                <div id="chatbot-panel" className="chatbot-panel">
                    <div className="chatbot-encabezado">
                        <div>
                            <strong>Asistente SUPLEMEX</strong>
                            <span>Respuestas sobre la tienda</span>
                        </div>
                        <button
                            className="chatbot-cerrar"
                            type="button"
                            aria-label="Cerrar chat"
                            onClick={() => {
                                setIsOpen(false);
                                openButtonRef.current?.focus();
                            }}
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
                            <p
                                className={`chatbot-mensaje chatbot-mensaje-${message.role === 'user' ? 'usuario' : 'asistente'}`}
                                key={`${index}-${message.role}`}
                            >
                                {message.content}
                            </p>
                        ))}
                        {isSending && (
                            <p className="chatbot-mensaje chatbot-mensaje-asistente chatbot-cargando" aria-label="El asistente está escribiendo">
                                Escribiendo...
                            </p>
                        )}
                        {error && (
                            <p className="chatbot-mensaje chatbot-mensaje-asistente" role="status">
                                {error}
                            </p>
                        )}
                    </div>
                    <form className="chatbot-formulario" onSubmit={handleSubmit}>
                        <label className="sr-only" htmlFor="chatbot-entrada">Escribe tu pregunta</label>
                        <input
                            ref={inputRef}
                            id="chatbot-entrada"
                            name="message"
                            type="text"
                            maxLength={1000}
                            placeholder="Escribe tu pregunta..."
                            autoComplete="off"
                            value={draft}
                            onChange={event => setDraft(event.target.value)}
                            disabled={isSending}
                            required
                        />
                        <button className="chatbot-enviar" type="submit" disabled={isSending || !draft.trim()}>
                            Enviar
                        </button>
                    </form>
                    <p className="chatbot-nota">No ofrece recomendaciones médicas. Consulta a un profesional de salud.</p>
                </div>
            )}
            <button
                ref={openButtonRef}
                className="chatbot-abrir"
                type="button"
                aria-controls="chatbot-panel"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(open => !open)}
            >
                <span aria-hidden="true">✦</span> ¿Necesitas ayuda?
            </button>
        </section>
    );
}

const rootElement = document.getElementById('chatbot-root');
if (rootElement) createRoot(rootElement).render(<Chatbot />);
