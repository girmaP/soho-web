import tls from 'node:tls';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { siteConfig } from '@/lib/siteConfig';
import { formatPrice } from '@/utils/formatPrice';

type EmailKind = 'received' | 'accepted' | 'preparing' | 'ready' | 'cancelled' | 'refunded';

function htmlEscape(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
}

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
}

async function reserveDelivery(orderId: string, kind: EmailKind, recipient: string) {
  const { data: existing } = await supabaseAdmin.from('order_email_deliveries').select('id,status,updated_at').eq('order_id', orderId).eq('email_kind', kind).maybeSingle();
  const staleSending = existing?.status === 'sending' && Date.now() - new Date(existing.updated_at).getTime() > 5 * 60 * 1000;
  if (existing?.status === 'sent' || (existing?.status === 'sending' && !staleSending)) return null;
  if (existing?.status === 'failed' || staleSending) {
    const { data, error } = await supabaseAdmin.from('order_email_deliveries').update({ status: 'sending', recipient, error_message: null, updated_at: new Date().toISOString() }).eq('id', existing.id).select('id').single();
    if (error) throw error;
    return data.id as string;
  }
  const { data, error } = await supabaseAdmin.from('order_email_deliveries').insert({ order_id: orderId, email_kind: kind, recipient, status: 'sending' }).select('id').single();
  if (!error) return data.id as string;
  if ((error as any).code === '23505') return null;
  throw error;
}

async function markDelivery(id: string, status: 'sent' | 'failed', errorMessage?: string) {
  await supabaseAdmin.from('order_email_deliveries').update({
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    error_message: errorMessage || null,
    updated_at: new Date().toISOString()
  }).eq('id', id);
}

function emailCopy(kind: EmailKind, order: any) {
  const copies: Record<EmailKind, { subject: string; title: string; intro: string }> = {
    received: { subject: `Pedido recibido · ${order.reference || order.id.slice(0, 8).toUpperCase()}`, title: 'Hemos recibido tu pedido', intro: 'El pago se está confirmando de forma segura. Te avisaremos en cuanto el pedido entre en preparación.' },
    accepted: { subject: 'Tu pedido ha sido aceptado', title: 'Pedido aceptado', intro: `SOHO ha aceptado tu pedido${order.estimated_time ? ` y estima unos ${order.estimated_time} minutos` : ''}.` },
    preparing: { subject: 'Tu pedido está en preparación', title: 'Estamos preparando tu pedido', intro: 'El cobro ha sido confirmado y el equipo de SOHO ya está preparando tu pedido.' },
    ready: { subject: 'Tu pedido está listo para recoger', title: 'Ya puedes pasar a recogerlo', intro: `Te esperamos en ${siteConfig.shortAddress}.` },
    cancelled: { subject: 'Actualización de tu pedido: cancelado', title: 'El pedido no ha podido gestionarse', intro: order.cancellation_reason || 'SOHO ha cancelado el pedido. Si ya estaba cobrado, el equipo gestionará el reembolso correspondiente.' },
    refunded: { subject: 'Reembolso de tu pedido', title: 'Reembolso tramitado', intro: 'La devolución ha sido tramitada. El plazo para verla reflejada depende de tu banco.' }
  };
  return copies[kind];
}

function extractEmail(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

async function sendWithGmail(args: { to: string; subject: string; html: string }) {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  const from = process.env.ORDER_EMAIL_FROM?.trim() || (user ? `SOHO Cambados <${user}>` : '');
  if (!user || !appPassword || !from) return null;

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('Tiempo de espera agotado conectando con Gmail SMTP.')), 20000);

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { socket.end(); } catch {}
      if (error) reject(error); else resolve();
    }

    function readResponse(): Promise<string> {
      return new Promise((res, rej) => {
        const onData = (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\r\n');
          if (lines.length < 2) return;
          let consumed = 0;
          for (let i = 0; i < lines.length - 1; i++) {
            consumed += Buffer.byteLength(lines[i] + '\r\n');
            if (/^\d{3} /.test(lines[i])) {
              const response = lines.slice(0, i + 1).join('\r\n');
              buffer = Buffer.from(buffer, 'utf8').subarray(consumed).toString('utf8');
              socket.off('data', onData);
              res(response);
              return;
            }
          }
        };
        socket.on('data', onData);
        socket.once('error', rej);
      });
    }

    async function command(text: string, expected: number[]) {
      socket.write(`${text}\r\n`);
      const response = await readResponse();
      const code = Number(response.slice(0, 3));
      if (!expected.includes(code)) throw new Error(`Gmail SMTP rechazó el envío (${response.replace(/\r\n/g, ' | ').slice(0, 300)}).`);
    }

    socket.once('error', (error) => finish(error));
    socket.once('secureConnect', async () => {
      try {
        let response = await readResponse();
        if (Number(response.slice(0, 3)) !== 220) throw new Error(`Gmail SMTP no está disponible (${response}).`);
        await command('EHLO soho-cambados.local', [250]);
        await command('AUTH LOGIN', [334]);
        await command(Buffer.from(user).toString('base64'), [334]);
        await command(Buffer.from(appPassword).toString('base64'), [235]);
        await command(`MAIL FROM:<${extractEmail(from)}>`, [250]);
        await command(`RCPT TO:<${args.to}>`, [250, 251]);
        await command('DATA', [354]);

        const replyTo = process.env.ORDER_EMAIL_REPLY_TO?.trim() || user;
        const message = [
          `From: ${from}`,
          `To: ${args.to}`,
          `Reply-To: ${replyTo}`,
          `Subject: ${encodeHeader(args.subject)}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          `Date: ${new Date().toUTCString()}`,
          '',
          Buffer.from(args.html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
          '.'
        ].join('\r\n');
        socket.write(`${message}\r\n`);
        response = await readResponse();
        if (Number(response.slice(0, 3)) !== 250) throw new Error(`Gmail SMTP no aceptó el mensaje (${response}).`);
        await command('QUIT', [221]);
        finish();
      } catch (error: any) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });

  return { provider: 'gmail', id: 'smtp' };
}

export async function sendOrderEmail(orderId: string, kind: EmailKind) {
  const gmailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  if (!gmailConfigured) {
    console.warn('order_email_not_configured', { orderId, kind, missing: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'] });
    return { ok: false, skipped: true };
  }

  const { data: order, error } = await supabaseAdmin.from('orders').select('*,order_items(*)').eq('id', orderId).single();
  if (error || !order?.customer_email) throw error || new Error('Pedido sin correo.');
  const deliveryId = await reserveDelivery(order.id, kind, order.customer_email);
  if (!deliveryId) return { ok: true, duplicate: true };

  const copy = emailCopy(kind, order);
  const baseUrl = publicBaseUrl();
  const trackingUrl = baseUrl ? `${baseUrl}/pedido/${encodeURIComponent(order.id)}?token=${encodeURIComponent(order.order_token)}` : '';
  const rows = (order.order_items || []).map((item: any) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${item.quantity} × ${htmlEscape(item.product_name)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${formatPrice(Number(item.total_price))}</td></tr>`).join('');
  const reference = order.reference || `WEB-${String(order.id).slice(0, 8).toUpperCase()}`;
  const logoUrl = baseUrl ? `${baseUrl}${siteConfig.logoPath}` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ef;font-family:Arial,sans-serif;color:#171717"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border-radius:24px;padding:28px">${logoUrl ? `<img src="${logoUrl}" alt="SOHO" style="max-width:180px;height:auto">` : '<div style="font-size:28px;font-weight:900">SOHO Cambados</div>'}<h1 style="margin:28px 0 8px;font-size:28px">${htmlEscape(copy.title)}</h1><p style="line-height:1.6;color:#525252">Hola ${htmlEscape(order.customer_name)}, ${htmlEscape(copy.intro)}</p><p><strong>Referencia:</strong> ${htmlEscape(reference)}<br><strong>Método:</strong> Recogida en SOHO<br><strong>Estado:</strong> ${htmlEscape(order.status)}</p><table style="width:100%;border-collapse:collapse;margin:20px 0">${rows}<tr><td style="padding-top:14px;font-weight:bold">Total</td><td style="padding-top:14px;text-align:right;font-weight:bold">${formatPrice(Number(order.total_price))}</td></tr></table>${trackingUrl ? `<a href="${trackingUrl}" style="display:block;text-align:center;background:#049ca5;color:#fff;text-decoration:none;font-weight:bold;padding:15px;border-radius:14px">Seguir mi pedido</a>` : ''}<p style="font-size:12px;color:#737373;margin-top:24px">Este enlace es privado. No lo compartas con otras personas.</p></div></div></body></html>`;

  try {
    const result = await sendWithGmail({ to: order.customer_email, subject: copy.subject, html });
    if (!result) throw new Error('No hay proveedor de correo configurado.');
    await markDelivery(deliveryId, 'sent');
    console.info('order_email_sent', { orderId, kind, provider: result.provider });
    return { ok: true, provider: result.provider };
  } catch (emailError: any) {
    await markDelivery(deliveryId, 'failed', emailError?.message || 'Error desconocido');
    console.error('order_email_failed', { orderId, kind, error: emailError?.message });
    return { ok: false, error: emailError?.message };
  }
}
