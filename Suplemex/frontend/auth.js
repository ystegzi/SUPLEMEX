import {
    obtenerClienteSupabase,
    supabaseConfigurado as configurado,
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
} from './supabase-client.js';

const formulario = document.getElementById('auth-form');
const campoCorreo = document.getElementById('auth-email');
const campoContrasena = document.getElementById('auth-password');
const campoConfirmacion = document.getElementById('auth-confirm');
const formularioPerfil = document.getElementById('auth-profile-form');
const campoNombre = document.getElementById('auth-nombre');
const botonGuardarPerfil = document.getElementById('auth-guardar-perfil');
const formularioCorreo = document.getElementById('auth-email-form');
const campoNuevoCorreo = document.getElementById('auth-nuevo-correo');
const botonGuardarCorreo = document.getElementById('auth-guardar-correo');
const formularioPassword = document.getElementById('auth-password-form');
const campoNuevaPassword = document.getElementById('auth-nueva-password');
const campoConfirmarPassword = document.getElementById('auth-confirmar-password');
const botonGuardarPassword = document.getElementById('auth-guardar-password');
const botonEnviar = document.getElementById('auth-submit');
const botonCambiarModo = document.getElementById('auth-cambiar-modo');
const botonRecuperar = document.getElementById('auth-recuperar');
const botonReenviarConfirmacion = document.getElementById('auth-reenviar-confirmacion');
const botonCerrarSesion = document.getElementById('auth-cerrar-sesion');
const botonMostrarEliminar = document.getElementById('auth-mostrar-eliminar');
const formularioEliminar = document.getElementById('auth-eliminar-form');
const campoEliminarPassword = document.getElementById('auth-eliminar-password');
const campoEliminarConfirmacion = document.getElementById('auth-eliminar-confirmacion');
const botonConfirmarEliminar = document.getElementById('auth-confirmar-eliminar');
const botonCancelarEliminar = document.getElementById('auth-cancelar-eliminar');
const mensaje = document.getElementById('auth-mensaje');
const avisoConfiguracion = document.getElementById('auth-configuracion');
const sesion = document.getElementById('auth-sesion');
const panel = document.getElementById('auth-panel');
const cambioTexto = document.getElementById('auth-cambio-texto');
const etiquetaContrasena = document.getElementById('auth-password-label');
const etiquetaConfirmacion = document.getElementById('auth-confirm-label');
const descripcion = document.getElementById('auth-descripcion');
const titulo = document.getElementById('auth-titulo');
let modo = 'login';
let cliente = null;
let mostrarReenvioConfirmacion = false;
let sesionAnterior = false;

// --- Recuperación de contraseña ---
// El enlace del correo trae datos en la dirección (por ejemplo #type=recovery o un error).
// Se leen aquí, antes de que Supabase limpie la dirección.
const CLAVE_RECUPERACION = 'suplemex-recuperacion';

function leerMarcaRecuperacion() {
    try { return sessionStorage.getItem(CLAVE_RECUPERACION) === '1'; } catch { return false; }
}

function guardarMarcaRecuperacion() {
    try { sessionStorage.setItem(CLAVE_RECUPERACION, '1'); } catch { /* sin almacenamiento */ }
}

function borrarMarcaRecuperacion() {
    try { sessionStorage.removeItem(CLAVE_RECUPERACION); } catch { /* sin almacenamiento */ }
}

const datosEnlace = new URLSearchParams(`${window.location.hash.slice(1)}&${window.location.search.slice(1)}`);
const vieneDeEnlaceRecuperacion = datosEnlace.get('type') === 'recovery' || leerMarcaRecuperacion();
const errorEnlace = datosEnlace.get('error_code') || datosEnlace.get('error');

function mensajeErrorEnlace(codigo) {
    if (codigo === 'otp_expired') {
        return 'El enlace para cambiar la contraseña venció o ya se usó. Escribe tu correo y pide uno nuevo.';
    }
    return 'El enlace no es válido. Escribe tu correo y pide uno nuevo con "Olvidé mi contraseña".';
}

function mostrarMensaje(texto, tipo = 'info') {
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = `auth-mensaje auth-${tipo}`;
    mensaje.hidden = !texto;
}

function actualizarNavegacion(usuario) {
    document.querySelectorAll('a[href="login.html"]').forEach(enlace => {
        enlace.textContent = usuario ? 'Mi cuenta' : 'Ingresar';
        enlace.setAttribute('aria-label', usuario ? 'Mi cuenta' : 'Iniciar sesión');
    });
    const esAdmin = usuario?.email?.toLowerCase() === 'ystegz2009@gmail.com';
    document.querySelectorAll('.menu').forEach(menu => {
        let enlaceAdmin = menu.querySelector('a[href="admin.html"]');
        if (!enlaceAdmin) {
            enlaceAdmin = document.createElement('a');
            enlaceAdmin.href = 'admin.html';
            enlaceAdmin.textContent = 'Administración';
            menu.append(enlaceAdmin);
        }
        enlaceAdmin.hidden = !esAdmin;
    });
}

function actualizarModo() {
    const esRegistro = modo === 'registro';
    const esRecuperacion = modo === 'recuperacion';
    const requiereConfirmacion = esRegistro || esRecuperacion;
    titulo.textContent = esRecuperacion ? 'Crea una nueva contraseña' : esRegistro ? 'Crear cuenta' : 'Inicia sesión';
    descripcion.textContent = esRecuperacion
        ? 'Elige una contraseña nueva para tu cuenta.'
        : esRegistro
            ? 'Regístrate con tu correo y una contraseña segura.'
            : 'Accede con tu correo y contraseña.';
    etiquetaContrasena.textContent = esRecuperacion ? 'Nueva contraseña' : 'Contraseña';
    campoContrasena.autocomplete = esRecuperacion || esRegistro ? 'new-password' : 'current-password';
    campoContrasena.minLength = esRegistro || esRecuperacion ? 8 : 0;
    campoConfirmacion.hidden = !requiereConfirmacion;
    campoConfirmacion.required = requiereConfirmacion;
    campoConfirmacion.minLength = requiereConfirmacion ? 8 : 0;
    etiquetaConfirmacion.textContent = esRecuperacion ? 'Confirmar nueva contraseña' : 'Confirmar contraseña';
    etiquetaConfirmacion.hidden = !requiereConfirmacion;
    botonEnviar.textContent = esRecuperacion ? 'Guardar contraseña' : esRegistro ? 'Crear cuenta' : 'Iniciar sesión';
    botonCambiarModo.hidden = esRecuperacion;
    cambioTexto.hidden = esRecuperacion;
    botonRecuperar.hidden = esRegistro || esRecuperacion;
    botonReenviarConfirmacion.hidden = !mostrarReenvioConfirmacion || esRegistro || esRecuperacion;
    campoCorreo.hidden = esRecuperacion;
    campoCorreo.disabled = esRecuperacion;
    campoCorreo.required = !esRecuperacion;
    document.getElementById('auth-email-label').hidden = esRecuperacion;
}

function actualizarSesion(usuario) {
    const autenticado = Boolean(usuario);
    const inicioSesion = autenticado && !sesionAnterior;
    sesionAnterior = autenticado;
    actualizarNavegacion(usuario);
    if (!formulario) return;

    formulario.hidden = autenticado;
    panel.classList.toggle('auth-panel-cuenta', autenticado);
    document.querySelector('.auth-cambio-modo').hidden = autenticado;
    botonRecuperar.hidden = autenticado || modo !== 'login';
    sesion.hidden = !autenticado;
    const correo = usuario?.email || '';
    const nombre = usuario?.user_metadata?.full_name || '';
    document.getElementById('auth-usuario').textContent = correo;
    document.getElementById('auth-nombre-resumen').textContent = nombre || 'Mi cuenta';
    document.getElementById('auth-avatar').textContent = (nombre || correo || 'S').trim().charAt(0).toUpperCase();
    document.getElementById('auth-estado-cuenta').textContent = usuario?.email_confirmed_at
        ? 'Correo verificado'
        : 'Correo pendiente';
    document.getElementById('auth-estado-cuenta').classList.toggle('auth-estado-verificado', Boolean(usuario?.email_confirmed_at));
    document.getElementById('auth-correo-actual').textContent = correo;
    if (document.activeElement !== campoNombre) campoNombre.value = nombre;
    if (autenticado) {
        titulo.textContent = 'Configuración';
        descripcion.textContent = 'Administra tu perfil, acceso y seguridad desde un solo lugar.';
        document.title = 'Configuración de cuenta | SUPLEMEX';
        if (inicioSesion) mostrarMensaje('Sesión iniciada correctamente.', 'exito');
    } else {
        actualizarModo();
        document.title = 'Iniciar sesión | SUPLEMEX';
    }
}

if (formulario) {
    if (errorEnlace) {
        borrarMarcaRecuperacion();
        history.replaceState(null, '', window.location.pathname);
    } else if (vieneDeEnlaceRecuperacion) {
        modo = 'recuperacion';
    }
    actualizarModo();
    if (errorEnlace) mostrarMensaje(mensajeErrorEnlace(errorEnlace), 'error');
    document.querySelectorAll('.auth-nav-enlace').forEach(enlace => {
        enlace.addEventListener('click', () => {
            document.querySelectorAll('.auth-nav-enlace').forEach(item => item.classList.remove('auth-nav-activo'));
            enlace.classList.add('auth-nav-activo');
        });
    });

    botonCambiarModo.addEventListener('click', () => {
        modo = modo === 'registro' ? 'login' : 'registro';
        mostrarReenvioConfirmacion = false;
        cambioTexto.textContent = modo === 'registro' ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
        botonCambiarModo.textContent = modo === 'registro' ? 'Iniciar sesión' : 'Crear cuenta';
        campoContrasena.value = '';
        campoConfirmacion.value = '';
        mostrarMensaje('');
        actualizarModo();
    });

    if (!configurado) {
        avisoConfiguracion.hidden = false;
        botonEnviar.disabled = true;
        botonRecuperar.disabled = true;
    }
}

if (configurado) {
    try {
        cliente = obtenerClienteSupabase();
    } catch (error) {
        if (avisoConfiguracion) avisoConfiguracion.hidden = false;
        if (botonEnviar) botonEnviar.disabled = true;
        if (botonRecuperar) botonRecuperar.disabled = true;
        mostrarMensaje(`No se pudo configurar el acceso: ${error.message}`, 'error');
    }
}

if (cliente) {
    cliente.auth.getSession()
        .then(({ data, error }) => {
            if (error) mostrarMensaje(error.message, 'error');
            if (modo === 'recuperacion' && !data?.session) {
                // El enlace no inició la sesión de recuperación (venció o ya se usó).
                borrarMarcaRecuperacion();
                modo = 'login';
                actualizarModo();
                mostrarMensaje(mensajeErrorEnlace('otp_expired'), 'error');
            } else if (modo === 'recuperacion') {
                mostrarMensaje('Escribe tu nueva contraseña.', 'info');
            }
            actualizarSesion(modo === 'recuperacion' ? null : data?.session?.user);
        })
        .catch(error => mostrarMensaje(`No se pudo consultar la sesión: ${error.message}`, 'error'));

    cliente.auth.onAuthStateChange((evento, sessionActual) => {
        if (evento === 'PASSWORD_RECOVERY' && !formulario) {
            // Supabase mandó el enlace a otra página (por ejemplo index.html):
            // se lleva al usuario a login.html para que elija su nueva contraseña.
            guardarMarcaRecuperacion();
            window.location.replace('login.html');
        } else if (evento === 'PASSWORD_RECOVERY' && formulario) {
            guardarMarcaRecuperacion();
            modo = 'recuperacion';
            actualizarModo();
            actualizarSesion(null);
            mostrarMensaje('Escribe tu nueva contraseña.', 'info');
        } else if (modo === 'recuperacion' && evento !== 'USER_UPDATED') {
            actualizarSesion(null);
        } else {
            actualizarSesion(sessionActual?.user);
        }
    });

    if (formulario) {
        formulario.addEventListener('submit', async evento => {
            evento.preventDefault();
            mostrarMensaje('');
            botonEnviar.disabled = true;

            try {
                const correo = campoCorreo.value.trim();
                const contrasena = campoContrasena.value;
                let resultado;

                if (modo === 'registro' || modo === 'recuperacion') {
                    if (contrasena !== campoConfirmacion.value) {
                        mostrarMensaje('Las contraseñas no coinciden.', 'error');
                        campoConfirmacion.focus();
                        return;
                    }
                }

                if (modo === 'registro') {
                    resultado = await cliente.auth.signUp({
                        email: correo,
                        password: contrasena,
                        options: { emailRedirectTo: new URL('index.html', window.location.href).href }
                    });
                    if (!resultado.error && !resultado.data.session) {
                        mostrarReenvioConfirmacion = true;
                        actualizarModo();
                        mostrarMensaje('Cuenta creada. Revisa tu correo para confirmar el registro.', 'exito');
                    }
                } else if (modo === 'recuperacion') {
                    resultado = await cliente.auth.updateUser({ password: contrasena });
                    if (!resultado.error) {
                        borrarMarcaRecuperacion();
                        modo = 'login';
                        actualizarModo();
                        campoContrasena.value = '';
                        campoConfirmacion.value = '';
                        mostrarMensaje('Contraseña actualizada correctamente. La próxima vez inicia sesión con tu contraseña nueva.', 'exito');
                    }
                } else {
                    resultado = await cliente.auth.signInWithPassword({ email: correo, password: contrasena });
                }

                if (resultado?.error) {
                    if (resultado.error.code === 'email_not_confirmed') {
                        mostrarReenvioConfirmacion = true;
                        actualizarModo();
                    }
                    mostrarMensaje(resultado.error.message, 'error');
                }
            } catch (error) {
                mostrarMensaje(`No se pudo completar la solicitud: ${error.message}`, 'error');
            } finally {
                botonEnviar.disabled = false;
            }
        });

        formularioPerfil.addEventListener('submit', async evento => {
            evento.preventDefault();
            botonGuardarPerfil.disabled = true;
            try {
                const { data, error } = await cliente.auth.updateUser({
                    data: { full_name: campoNombre.value.trim() }
                });
                if (error) {
                    mostrarMensaje(error.message, 'error');
                } else {
                    actualizarSesion(data.user);
                    mostrarMensaje('Tu perfil se actualizó correctamente.', 'exito');
                }
            } catch (error) {
                mostrarMensaje(`No se pudo actualizar el perfil: ${error.message}`, 'error');
            } finally {
                botonGuardarPerfil.disabled = false;
            }
        });

        formularioCorreo.addEventListener('submit', async evento => {
            evento.preventDefault();
            const nuevoCorreo = campoNuevoCorreo.value.trim();
            if (nuevoCorreo.toLowerCase() === document.getElementById('auth-correo-actual').textContent.toLowerCase()) {
                mostrarMensaje('Escribe una dirección distinta a tu correo actual.', 'error');
                campoNuevoCorreo.focus();
                return;
            }

            botonGuardarCorreo.disabled = true;
            try {
                const { error } = await cliente.auth.updateUser({ email: nuevoCorreo });
                if (error) {
                    mostrarMensaje(error.message, 'error');
                } else {
                    formularioCorreo.reset();
                    mostrarMensaje('Te enviamos un correo para confirmar el cambio de dirección.', 'exito');
                }
            } catch (error) {
                mostrarMensaje(`No se pudo actualizar el correo: ${error.message}`, 'error');
            } finally {
                botonGuardarCorreo.disabled = false;
            }
        });

        formularioPassword.addEventListener('submit', async evento => {
            evento.preventDefault();
            if (campoNuevaPassword.value !== campoConfirmarPassword.value) {
                mostrarMensaje('Las contraseñas no coinciden.', 'error');
                campoConfirmarPassword.focus();
                return;
            }

            botonGuardarPassword.disabled = true;
            try {
                const { error } = await cliente.auth.updateUser({ password: campoNuevaPassword.value });
                if (error) {
                    mostrarMensaje(error.message, 'error');
                } else {
                    formularioPassword.reset();
                    mostrarMensaje('Contraseña actualizada correctamente.', 'exito');
                }
            } catch (error) {
                mostrarMensaje(`No se pudo actualizar la contraseña: ${error.message}`, 'error');
            } finally {
                botonGuardarPassword.disabled = false;
            }
        });

        botonRecuperar.addEventListener('click', async () => {
            const correo = campoCorreo.value.trim();
            if (!correo) {
                campoCorreo.focus();
                mostrarMensaje('Escribe tu correo para enviarte el enlace de recuperación.', 'error');
                return;
            }
            if (campoCorreo.validity.typeMismatch) {
                campoCorreo.focus();
                mostrarMensaje('Escribe un correo electrónico válido.', 'error');
                return;
            }

            botonRecuperar.disabled = true;
            try {
                const redirectTo = new URL('login.html', window.location.href).href;
                const { error } = await cliente.auth.resetPasswordForEmail(correo, { redirectTo });
                mostrarMensaje(error ? error.message : 'Si el correo está registrado, recibirás un enlace para cambiar tu contraseña.', error ? 'error' : 'exito');
            } catch (error) {
                mostrarMensaje(`No se pudo enviar el enlace: ${error.message}`, 'error');
            } finally {
                botonRecuperar.disabled = false;
            }
        });

        botonReenviarConfirmacion.addEventListener('click', async () => {
            const correo = campoCorreo.value.trim();
            if (!correo) {
                campoCorreo.focus();
                mostrarMensaje('Escribe tu correo para reenviar el enlace de verificación.', 'error');
                return;
            }

            botonReenviarConfirmacion.disabled = true;
            try {
                const { error } = await cliente.auth.resend({
                    type: 'signup',
                    email: correo,
                    options: { emailRedirectTo: new URL('index.html', window.location.href).href }
                });
                mostrarMensaje(error ? error.message : 'Te enviamos un nuevo enlace de verificación. Revisa tu correo y la carpeta de spam.', error ? 'error' : 'exito');
            } catch (error) {
                mostrarMensaje(`No se pudo reenviar el enlace: ${error.message}`, 'error');
            } finally {
                botonReenviarConfirmacion.disabled = false;
            }
        });

        botonCerrarSesion.addEventListener('click', async () => {
            botonCerrarSesion.disabled = true;
            try {
                const { error } = await cliente.auth.signOut({ scope: 'local' });
                mostrarMensaje(error ? error.message : 'Sesión cerrada.', error ? 'error' : 'info');
            } catch (error) {
                mostrarMensaje(`No se pudo cerrar la sesión: ${error.message}`, 'error');
            } finally {
                botonCerrarSesion.disabled = false;
            }
        });

        botonMostrarEliminar.addEventListener('click', () => {
            formularioEliminar.hidden = false;
            botonMostrarEliminar.hidden = true;
            campoEliminarPassword.focus();
        });

        botonCancelarEliminar.addEventListener('click', () => {
            formularioEliminar.reset();
            formularioEliminar.hidden = true;
            botonMostrarEliminar.hidden = false;
            mostrarMensaje('');
        });

        formularioEliminar.addEventListener('submit', async evento => {
            evento.preventDefault();
            if (campoEliminarConfirmacion.value.trim() !== 'ELIMINAR') {
                mostrarMensaje('Escribe ELIMINAR tal como aparece para confirmar.', 'error');
                campoEliminarConfirmacion.focus();
                return;
            }

            botonConfirmarEliminar.disabled = true;
            try {
                const { data: sessionData, error: sessionError } = await cliente.auth.getSession();
                if (sessionError) throw sessionError;
                if (!sessionData.session) throw new Error('Tu sesión expiró. Inicia sesión de nuevo antes de eliminar la cuenta.');

                const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${sessionData.session.access_token}`,
                    },
                    body: JSON.stringify({
                        action: 'delete-account',
                        password: campoEliminarPassword.value,
                        confirmation: campoEliminarConfirmacion.value.trim(),
                    }),
                });
                const resultado = await response.json();
                if (!response.ok) throw new Error(resultado.error || 'No se pudo eliminar la cuenta.');

                mostrarMensaje('Cuenta eliminada. Cerrando sesión…', 'exito');
                const { error: logoutError } = await cliente.auth.signOut({ scope: 'local' });
                if (logoutError) throw new Error(`La cuenta se eliminó, pero no se pudo limpiar la sesión local: ${logoutError.message}`);
                window.location.replace('index.html?cuenta=eliminada');
            } catch (error) {
                mostrarMensaje(error.message || 'No se pudo eliminar la cuenta.', 'error');
            } finally {
                botonConfirmarEliminar.disabled = false;
            }
        });
    }
} else {
    actualizarNavegacion(null);
}
