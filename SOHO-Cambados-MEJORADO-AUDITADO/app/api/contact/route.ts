import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Introduce tu nombre.'),
  email: z.string().trim().email('Introduce un correo válido.'),
  phone: z.string().trim().min(6, 'Introduce un teléfono válido.'),
  message: z.string().trim().min(5, 'Escribe un mensaje.').max(1200, 'El mensaje es demasiado largo.'),
  honeypot: z.string().optional().default('')
});

export async function POST(request: Request) {
  try {
    const parsed = contactSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos no válidos.' }, { status: 400 });
    }

    const body = parsed.data;
    if (body.honeypot) {
      return NextResponse.json({ ok: false, error: 'Mensaje bloqueado por seguridad.' }, { status: 400 });
    }

    // Primero usamos una función SQL estable para evitar errores de schema cache de PostgREST
    // cuando se añaden columnas nuevas a contact_messages.
    const rpcResult = await supabaseAdmin.rpc('submit_contact_message', {
      p_name: body.name,
      p_email: body.email,
      p_phone: body.phone,
      p_message: body.message
    });

    if (rpcResult.error) {
      console.warn('RPC submit_contact_message falló, intento insert compatible:', rpcResult.error.message);

      // Fallback compatible con tablas antiguas/caché antigua: usa solo columnas base
      // y conserva email/teléfono dentro del mensaje para que nunca se pierda el contacto.
      const fallbackMessage = `Correo: ${body.email}\nTeléfono: ${body.phone}\n\n${body.message}`;
      const { error: insertError } = await supabaseAdmin.from('contact_messages').insert({
        name: body.name,
        message: fallbackMessage
      });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error guardando mensaje de contacto:', error);
    return NextResponse.json({ ok: false, error: error.message || 'No se pudo guardar el mensaje.' }, { status: 500 });
  }
}
