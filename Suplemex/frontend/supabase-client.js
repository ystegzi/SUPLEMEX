import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

export const supabaseConfigurado = SUPABASE_URL.startsWith('https://')
    && !SUPABASE_URL.includes('TU-PROYECTO')
    && SUPABASE_ANON_KEY.length > 20
    && !SUPABASE_ANON_KEY.includes('PEGA_AQUI');

let cliente;

export function obtenerClienteSupabase() {
    if (!supabaseConfigurado) return null;
    if (!cliente) {
        cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
        });
    }
    return cliente;
}

export { SUPABASE_ANON_KEY, SUPABASE_URL };
