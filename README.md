# SUPLEMEX

Tienda online de suplementos deportivos con asistente virtual con inteligencia artificial.

## Tecnologías

| Tecnología | Uso |
| --- | --- |
| **HTML** | Páginas de la tienda (`Suplemex/frontend/*.html`) |
| **CSS** | Diseño, animaciones y versión para celular (`Suplemex/frontend/style.css`) |
| **JavaScript** | Catálogo, carrito, inicio de sesión y pedidos (`Suplemex/frontend/*.js`) |
| **React** | Chatbot con IA (`Suplemex/frontend/chatbot.jsx` y `Suplemex/frontend/chatbot/`) |
| **Node.js + Express** | Servidor web y API del chatbot (`server/`) |
| **Supabase** | Base de datos, cuentas de usuario y pedidos (`backend/`) |
| **Google Gemini** | Modelo de inteligencia artificial del asistente |

## Estructura

```
Suplemex/
├── server/                 Servidor Node.js + Express
│   ├── server.js           Arranque: sirve la tienda y la API
│   ├── config.js           Lee la configuración y las claves de .env
│   ├── catalogo.js         Lee los productos de Suplemex/frontend/script.js
│   ├── asistente.js        Instrucciones de la IA y conexión con Gemini
│   ├── limitador.js        Límite de mensajes por visitante
│   └── rutas/api.js        Rutas /api/salud, /api/productos y /api/chatbot
├── Suplemex/frontend/      La tienda (HTML, CSS, JavaScript y React)
├── backend/                Supabase: funciones, base de datos y su guía (backend/README.md)
├── .env.example            Plantilla de configuración del servidor
└── package.json            Dependencias y comandos de npm
```

## Cómo ejecutar el servidor

1. Instala las dependencias (solo la primera vez):
   ```powershell
   npm.cmd install
   ```
2. Copia `.env.example` como `.env` y escribe tu clave de Gemini (https://aistudio.google.com/apikey):
   ```
   GEMINI_API_KEY=tu_clave
   ```
   El archivo `.env` está en `.gitignore`: nunca se sube a Git ni se publica en el navegador.
3. Inicia el servidor:
   ```powershell
   npm.cmd start
   ```
   Abre http://localhost:3000. Mientras programas, `npm.cmd run dev` reinicia el servidor solo al guardar cambios.

Si cambias archivos de `Suplemex/frontend/chatbot*`, vuelve a compilar el widget con `npm.cmd run build:chatbot`.

## Publicación en GitHub Pages

La tienda está publicada en **https://ystegzi.github.io/SUPLEMEX/**.

El workflow `.github/workflows/pages.yml` publica la carpeta `Suplemex/frontend` cada vez que se sube un cambio a `main`. GitHub Pages solo sirve archivos estáticos (no ejecuta Node), así que el chatbot usa la función `chatbot` de Supabase, y las cuentas y los pedidos funcionan igual con Supabase.

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/salud` | Estado del servidor y si el asistente tiene clave configurada |
| GET | `/api/productos` | Catálogo de productos con presentaciones, precios y sabores |
| POST | `/api/chatbot` | Envía `{ "messages": [{ "role": "user", "content": "..." }], "producto": "creatina" }` y responde `{ "reply": "..." }` |

## Cómo responde el chatbot

- Si la tienda se abre desde el servidor Node (`npm start`), el chat usa `/api/chatbot`.
- Si la tienda se publica en un hosting sin Node, o el servidor no tiene `GEMINI_API_KEY`, el chat usa automáticamente la función `chatbot` de Supabase como respaldo (ver `backend/README.md`).

En ambos casos la clave de la IA está solo en el servidor.

## Productos y precios

Los precios están en tres lugares; al cambiar uno, actualiza los tres:

1. `productosCatalogo` en `Suplemex/frontend/script.js`: la tienda y el servidor Node lo leen de aquí.
2. `catalogo` en `backend/supabase/functions/chatbot/index.ts`: asistente de respaldo en Supabase.
3. `products` en `backend/supabase/functions/create-order/index.ts`: validación de pedidos.
