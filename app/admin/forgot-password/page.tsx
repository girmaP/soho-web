'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`
      });
      setMsg(error ? error.message : 'Correo de recuperación enviado.');
    } catch (err: any) {
      console.error('Error enviando recuperación:', err);
      setMsg(err?.message || 'No se pudo conectar con Supabase. Revisa .env.local.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] p-6">
      <form onSubmit={submit} className="mx-auto mt-20 max-w-md rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-black uppercase text-[#047f86]">Área privada</p>
        <h1 className="mt-3 text-3xl font-black">Recuperar contraseña</h1>
        <p className="mt-2 text-neutral-600">Recibirás un enlace para crear una nueva contraseña.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-6 w-full rounded-2xl border p-4" placeholder="Email" type="email" required />
        {msg && <p className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900">{msg}</p>}
        <button disabled={loading} className="mt-5 w-full rounded-2xl bg-black p-4 font-black text-white disabled:opacity-50">{loading ? 'Enviando...' : 'Enviar enlace'}</button>
        <a href="/admin" className="mt-4 block text-center text-sm font-bold text-[#047f86]">Volver al login</a>
      </form>
    </main>
  );
}
