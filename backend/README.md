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

## 3. Probar

1. Confirma la cuenta `ystegz2009@gmail.com` desde su correo e inicia sesión en la tienda.
2. Abre `frontend/admin.html` desde el mismo servidor local. El enlace **Administración** también aparecerá en el menú al iniciar sesión con ese correo.
3. Envía un pedido desde el carrito como invitado o con una cuenta; aparecerá como **Pendiente**.
4. En Administración puedes confirmar, marcar como enviado o cancelar pedidos, ver las cuentas con su estado de verificación, enviar un enlace para cambiar la contraseña y eliminar cuentas no administradoras confirmando el correo exacto. Los pedidos históricos se conservan y se desvinculan de la cuenta.

Los precios y presentaciones de los pedidos se validan en `create-order`; no se confía en el precio enviado por el navegador. Los pedidos no procesan pagos ni generan facturas automáticamente.
