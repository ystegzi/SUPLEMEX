# Configuración del panel de administración y pedidos

El sitio incluye una tienda con checkout para invitados, un panel de pedidos y un listado de cuentas. La clave `service_role` solo se usa como variable del entorno de Supabase Edge Functions; nunca debe copiarse a `frontend/supabase-config.js` ni al navegador.

## 1. Crear las tablas

En Supabase abre **SQL Editor → New query**, pega y ejecuta el contenido de [`supabase/migrations/20261108000000_orders_admin.sql`](./supabase/migrations/20261108000000_orders_admin.sql). Las tablas quedan protegidas con RLS y sin acceso directo desde las claves públicas.

## 2. Publicar las funciones seguras

Instala el [Supabase CLI](https://supabase.com/docs/guides/cli). Desde la raíz del proyecto, entra a `backend`, donde está la configuración de Supabase:

```powershell
cd backend
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set ADMIN_EMAILS=ystegz2009@gmail.com
supabase functions deploy create-order
supabase functions deploy admin-api
```

El `PROJECT_REF` es la parte anterior a `.supabase.co` en la URL de tu proyecto. Supabase proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` a las funciones. `ADMIN_EMAILS` es la lista de correos autorizados, separada por comas. Las funciones verifican la sesión y el correo permitido en el servidor.

Al cambiar una Edge Function, vuelve a desplegarla desde `backend`. Después de agregar las opciones de gestión de cuentas, ejecuta `npx.cmd supabase functions deploy admin-api` desde esa carpeta.

## 3. Configurar el asistente con Gemini

1. Crea una clave gratuita en Google AI Studio: https://aistudio.google.com/apikey. No la pongas en archivos del frontend ni la compartas públicamente.
2. Abre una terminal nueva en la raíz del proyecto, instala las dependencias y compila el widget React para la página estática:

```powershell
npm.cmd install
npm.cmd run build:chatbot
```

3. Desde `backend`, guarda la clave como secreto de Supabase y publica la función:

```powershell
cd backend
npx.cmd supabase secrets set GEMINI_API_KEY=TU_CLAVE_DE_GEMINI
npx.cmd supabase functions deploy chatbot
```

Opcional: para usar otro modelo de Gemini sin cambiar código, ejecuta `npx.cmd supabase secrets set GEMINI_MODEL=nombre-del-modelo` (por defecto usa `gemini-3.5-flash-lite`).

Reemplaza `TU_CLAVE_DE_GEMINI` en la terminal por tu clave; no la agregues a Git ni a `frontend`. El nivel gratuito tiene límites de solicitudes que pueden variar por país y modelo. La función limita el tamaño del historial y el tiempo de espera.

### Estructura del chatbot

| Archivo | Función |
| --- | --- |
| `Suplemex/frontend/chatbot.jsx` | Punto de entrada: monta el widget en `#chatbot-root` (lo crea si la página no lo tiene). |
| `Suplemex/frontend/chatbot/Chatbot.jsx` | Componente React: botón flotante, ventana, bienvenida, sugerencias, indicador de escritura, errores y reintento. |
| `Suplemex/frontend/chatbot/api.js` | Llamada a la Edge Function `chatbot` (solo usa la clave pública de Supabase). |
| `Suplemex/frontend/chatbot/formato.jsx` | Muestra negritas, listas y enlaces seguros a la tienda o WhatsApp en las respuestas. |
| `Suplemex/frontend/chatbot-widget.js` | Archivo compilado que cargan `index.html`, `producto.html` y `carrito.html`. No se edita a mano. |
| `backend/supabase/functions/chatbot/index.ts` | Backend seguro: catálogo (productos, precios y sabores), instrucciones del asistente, preguntas frecuentes de compra y llamada a Gemini con la clave secreta. |

Después de cambiar cualquier archivo de `Suplemex/frontend/chatbot*`, ejecuta `npm.cmd run build:chatbot` y publica `chatbot-widget.js`. Después de cambiar algo en `backend/supabase/functions`, vuelve a desplegar la función `chatbot`.

**Al agregar o cambiar un producto o precio**, actualízalo en `productosCatalogo` (`Suplemex/frontend/script.js`), en el `catalogo` de `functions/chatbot/index.ts` (para el asistente) y en `create-order/index.ts` (para validar pedidos), y despliega las funciones. Para cambiar el tono o las respuestas sobre compras, edita el texto `storeContext` en `functions/chatbot/index.ts`.

## 4. Probar

1. Confirma la cuenta `ystegz2009@gmail.com` desde su correo e inicia sesión en la tienda.
2. Configura `OPENAI_API_KEY`, compila el widget React y publica `chatbot` siguiendo la sección anterior. Abre `Suplemex/frontend/index.html` desde el mismo servidor local y prueba una pregunta sobre el catálogo.
3. Abre `Suplemex/frontend/admin.html` desde ese servidor. El enlace **Administración** también aparecerá en el menú al iniciar sesión con el correo autorizado.
4. Envía un pedido desde el carrito como invitado o con una cuenta; aparecerá como **Pendiente**.
5. En Administración puedes confirmar, marcar como enviado o cancelar pedidos, ver las cuentas con su estado de verificación, enviar un enlace para cambiar la contraseña y eliminar cuentas no administradoras confirmando el correo exacto. Los pedidos históricos se conservan y se desvinculan de la cuenta.

Los precios y presentaciones de los pedidos se validan en `create-order`; no se confía en el precio enviado por el navegador. Los pedidos no procesan pagos ni generan facturas automáticamente.

## Recuperación de contraseña

En Supabase abre **Authentication → URL Configuration** y agrega la URL pública exacta de `login.html` a **Redirect URLs** (por ejemplo, `https://tu-dominio/login.html`; durante desarrollo agrega también la URL local del servidor). En la página de inicio de sesión, escribe el correo y selecciona **Olvidé mi contraseña**. El enlace del correo devuelve a `login.html`, donde se pueden escribir y confirmar la nueva contraseña.

La entrega del correo depende de la configuración SMTP de Supabase. Para producción, configura un proveedor SMTP y define límites de envío; el servicio de correo de prueba puede tener restricciones.
