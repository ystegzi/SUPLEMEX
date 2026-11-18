// Punto de entrada del chatbot. Se compila con `npm run build:chatbot` y genera chatbot-widget.js.
// El código del widget está organizado en la carpeta ./chatbot:
//   - Chatbot.jsx  → componente React (botón flotante, ventana, historial, envío)
//   - api.js       → conexión con el backend seguro: servidor Node.js (/api/chatbot) o, de respaldo, Supabase
//   - formato.jsx  → formato seguro de las respuestas de la IA (negritas, listas, enlaces)
import { createRoot } from 'react-dom/client';
import { Chatbot } from './chatbot/Chatbot.jsx';

function montarChatbot() {
    let rootElement = document.getElementById('chatbot-root');
    if (!rootElement) {
        rootElement = document.createElement('div');
        rootElement.id = 'chatbot-root';
        document.body.append(rootElement);
    }
    createRoot(rootElement).render(<Chatbot />);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montarChatbot);
} else {
    montarChatbot();
}
