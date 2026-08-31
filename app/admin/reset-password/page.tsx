'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session?.user) {
        setValidSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setValidSession(Boolean(data.session?.user) && !error);
      setChecking(false);
    }).catch(() => {
      if (!active) return;
      setValidSession(false);
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (password.length < 8) return setMsg('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return setMsg('Las dos contraseñas no coinciden.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMsg(error.message);
        return;
      }
      await supabase.auth.signOut({ scope: 'global' });
      window.history.replaceState(null, '', '/admin/reset-password');
      setCompleted(true);
      setValidSession(false);
      setMsg('Contraseña actualizada correctamente. Ya puedes iniciar sesión con la nueva contraseña.');
    } catch (err: any) {
      console.error('Error actualizando contraseña:', err);
      setMsg(err?.message || 'No se pudo conectar en este momento. Inténtalo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] p-6">
      <form onSubmit={submit} className="mx-auto mt-20 max-w-md rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-black uppercase text-[#047f86]">Área privada</p>
        <h1 className="mt-3 text-3xl font-black">Nueva contraseña</h1>
        {checking && <p className="mt-5 rounded-2xl bg-cyan-50 p-4 text-sm font-semibold text-cyan-900">Validando el enlace de recuperación…</p>}
        {!checking && !validSession && !completed && (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Este enlace no es válido o ha caducado. Solicita un nuevo correo de recuperación.
          </div>
        )}
        {validSession && !completed && (
          <>
            <p className="mt-2 text-sm text-neutral-600">Escribe la nueva contraseña dos veces. Al guardarla se cerrarán las sesiones anteriores por seguridad.</p>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="mt-6 w-full rounded-2xl border p-4" placeholder="Nueva contraseña" type="password" minLength={8} autoComplete="new-password" required />
            <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-3 w-full rounded-2xl border p-4" placeholder="Repetir nueva contraseña" type="password" minLength={8} autoComplete="new-password" required />
          </>
        )}
        {msg && <p className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900">{msg}</p>}
        {validSession && !completed && <button disabled={loading} className="mt-5 w-full rounded-2xl bg-black p-4 font-black text-white disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>}
        {!checking && !validSession && !completed && <a href="/admin/forgot-password" className="mt-5 block rounded-2xl bg-black p-4 text-center font-black text-white">Solicitar otro enlace</a>}
        <a href="/admin" className="mt-4 block text-center text-sm font-bold text-[#047f86]">Ir al login</a>
      </form>
    </main>
  );
}
