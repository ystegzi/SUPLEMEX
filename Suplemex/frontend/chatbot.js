import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-client.js';

const panel = document.getElementById('chatbot-panel');
const openButton = document.getElementById('chatbot-abrir');
const closeButton = document.getElementById('chatbot-cerrar');
const form = document.getElementById('chatbot-formulario');
const input = document.getElementById('chatbot-entrada');
const sendButton = document.getElementById('chatbot-enviar');
const messagesElement = document.getElementById('chatbot-mensajes');

if (panel && openButton && closeButton && form && input && sendButton && messagesElement) {
    const messages = [{
        role: 'assistant',
        content: '¡Hola! Puedo ayudarte con nuestros productos y con cómo comprar. ¿Qué te gustaría saber?',
    }];
    let sending = false;

    function addMessage(role, content) {
        const message = document.createElement('p');
        message.className = `chatbot-mensaje chatbot-mensaje-${role}`;
        message.textContent = content;
        messagesElement.append(message);
        messagesElement.scrollTop = messagesElement.scrollHeight;
    }

    function setOpen(isOpen) {
        panel.hidden = !isOpen;
        openButton.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) input.focus();
        else openButton.focus();
    }

    openButton.addEventListener('click', () => setOpen(panel.hidden));
    closeButton.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const content = input.value.trim();
        if (!content || sending) return;

        sending = true;
        input.value = '';
        input.disabled = true;
        sendButton.disabled = true;
        addMessage('usuario', content);
        messages.push({ role: 'user', content });

        const loadingMessage = document.createElement('p');
        loadingMessage.className = 'chatbot-mensaje chatbot-mensaje-asistente chatbot-cargando';
        loadingMessage.textContent = 'Escribiendo...';
        loadingMessage.setAttribute('aria-label', 'El asistente está escribiendo');
        messagesElement.append(loadingMessage);
        messagesElement.scrollTop = messagesElement.scrollHeight;

        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ messages: messages.slice(-10) }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'No se pudo obtener una respuesta.');
            if (typeof result.reply !== 'string' || !result.reply.trim()) {
                throw new Error('El asistente no devolvió una respuesta. Inténtalo de nuevo.');
            }

            const reply = result.reply.trim();
            messages.push({ role: 'assistant', content: reply });
            loadingMessage.remove();
            addMessage('asistente', reply);
        } catch (error) {
            loadingMessage.remove();
            const message = error instanceof Error ? error.message : 'No se pudo conectar con el asistente.';
            addMessage('asistente', message);
        } finally {
            sending = false;
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
        }
    });
}
