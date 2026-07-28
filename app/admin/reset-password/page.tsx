'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      setMsg(error ? error.message : 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
    } catch (err: any) {
      console.error('Error actualizando contraseña:', err);
      setMsg(err?.message || 'No se pudo conectar con Supabase. Revisa .env.local.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] p-6">
      <form onSubmit={submit} className="mx-auto mt-20 max-w-md rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-black uppercase text-[#047f86]">Área privada</p>
        <h1 className="mt-3 text-3xl font-black">Nueva contraseña</h1>
        <input value={password} onChange={(e) => setPassword(e.target.value)} className="mt-6 w-full rounded-2xl border p-4" placeholder="Nueva contraseña" type="password" minLength={6} required />
        {msg && <p className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900">{msg}</p>}
        <button disabled={loading} className="mt-5 w-full rounded-2xl bg-black p-4 font-black text-white disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
        <a href="/admin" className="mt-4 block text-center text-sm font-bold text-[#047f86]">Ir al login</a>
      </form>
    </main>
  );
}
