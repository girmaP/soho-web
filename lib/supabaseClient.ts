import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function readSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  }

  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no es una URL válida. Debe tener formato https://xxxxx.supabase.co');
  }

  return { supabaseUrl, supabaseAnonKey };
}

function getSupabaseClient() {
  if (browserClient) return browserClient;

  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv();

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: async (input, init) => {
        try {
          return await fetch(input, init);
        } catch (error) {
          console.error('No se pudo conectar con Supabase:', error);
          throw new Error('No se pudo conectar con Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y que el proyecto no esté pausado.');
        }
      }
    }
  });

  return browserClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (prop === 'then' || prop === 'toJSON' || prop === Symbol.toStringTag || prop === Symbol.for('nodejs.util.inspect.custom')) return undefined;
    const client = getSupabaseClient() as any;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
