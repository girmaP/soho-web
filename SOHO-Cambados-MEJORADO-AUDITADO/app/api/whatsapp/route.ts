import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const schema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['accepted', 'ready']),
  estimatedTime: z.number().int().min(5).max(180).nullable().optional()
});

function cleanPhone(phone: string) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('34')) return cleaned;
  return cleaned.length === 9 ? `34${cleaned}` : cleaned;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Solicitud no válida.' }, { status: 400 });

    const { data: order, error } = await supabaseAdmin.from('orders').select('customer_phone,customer_name').eq('id', parsed.data.orderId).maybeSingle();
    if (error || !order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado.' }, { status: 404 });

    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) return NextResponse.json({ ok: true, skipped: true, reason: 'WhatsApp no configurado.' });

    const message = parsed.data.status === 'ready'
      ? `Hola ${order.customer_name}, tu pedido en SOHO Cambados ya está listo para recoger. Gracias.`
      : `Hola ${order.customer_name}, tu pedido en SOHO Cambados ha sido aceptado.${parsed.data.estimatedTime ? ` Tiempo estimado: ${parsed.data.estimatedTime} min.` : ''} Gracias.`;

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: cleanPhone(order.customer_phone), type: 'text', text: { body: message } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: 'WhatsApp rechazó el envío.' }, { status: response.status });
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ ok: false, error: status === 500 ? 'No se pudo enviar el mensaje.' : 'No autorizado.' }, { status });
  }
}
