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

## 3. Configurar el asistente con IA

1. Crea una clave de API en tu cuenta de OpenAI. No la pongas en archivos del frontend ni la compartas públicamente.
2. Abre una terminal nueva en la raíz del proyecto, instala las dependencias y compila el widget React para la página estática:

```powershell
npm.cmd install
npm.cmd run build:chatbot
```

3. Desde `backend`, guarda la clave como secreto de Supabase y publica la función:

```powershell
cd backend
supabase secrets set OPENAI_API_KEY=TU_CLAVE_DE_OPENAI
supabase functions deploy chatbot
```

El código React está en `Suplemex/frontend/chatbot.jsx` y `npm run build:chatbot` genera `Suplemex/frontend/chatbot-widget.js`, que carga la tienda estática. Repite el build después de cambiar el JSX y publica ese archivo junto con el frontend.

Reemplaza `TU_CLAVE_DE_OPENAI` en la terminal por tu clave; no la agregues a Git ni a `frontend`. El asistente usa `gpt-4o-mini`. Las llamadas a OpenAI pueden generar cargos según tu cuenta y uso. La función limita el tamaño del historial y el tiempo de espera, pero antes de publicarla para uso amplio configura límites de consumo en tu proyecto de OpenAI y considera agregar controles contra abuso.

## 4. Probar

1. Confirma la cuenta `ystegz2009@gmail.com` desde su correo e inicia sesión en la tienda.
2. Configura `OPENAI_API_KEY`, compila el widget React y publica `chatbot` siguiendo la sección anterior. Abre `Suplemex/frontend/index.html` desde el mismo servidor local y prueba una pregunta sobre el catálogo.
3. Abre `Suplemex/frontend/admin.html` desde ese servidor. El enlace **Administración** también aparecerá en el menú al iniciar sesión con el correo autorizado.
4. Envía un pedido desde el carrito como invitado o con una cuenta; aparecerá como **Pendiente**.
5. En Administración puedes confirmar, marcar como enviado o cancelar pedidos, ver las cuentas con su estado de verificación, enviar un enlace para cambiar la contraseña y eliminar cuentas no administradoras confirmando el correo exacto. Los pedidos históricos se conservan y se desvinculan de la cuenta.

Los precios y presentaciones de los pedidos se validan en `create-order`; no se confía en el precio enviado por el navegador. Los pedidos no procesan pagos ni generan facturas automáticamente.
