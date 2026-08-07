import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { assertStripeConfiguration, stripe } from '@/lib/stripe';
import { isBusinessOpenFromSettings, defaultBusinessSettings } from '@/lib/businessConfig';
import { appendOrderEvent } from '@/lib/server/orderEvents';
import { isHiddenCatalogCategory, resolvedProductImage } from '@/lib/catalogPresentation';
import { customizationLabel, extrasForCategory, requiredChoicesFromName, selectedExtrasTotal } from '@/lib/productCustomization';

const selectedExtraSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().min(0).max(100),
  quantity: z.number().int().min(1).max(10)
});

const itemSchema = z.object({
  line_id: z.string().trim().min(1).max(120).optional(),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  required_choice: z.string().trim().max(120).nullable().optional(),
  selected_extras: z.array(selectedExtraSchema).max(30).optional().default([])
});

const requestSchema = z.object({
  checkoutAttemptId: z.string().uuid('Identificador de intento no válido.'),
  customerName: z.string().trim().min(2, 'Introduce tu nombre.').max(120),
  customerPhone: z.string().trim().min(6, 'Introduce tu teléfono.').max(30),
  customerEmail: z.string().trim().email('Introduce un correo válido.').max(180),
  notes: z.string().trim().max(500).optional().default(''),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la política de privacidad.' }) }),
  honeypot: z.string().max(0).optional().default(''),
  items: z.array(itemSchema).min(1, 'El carrito está vacío.').max(80)
});

function siteUrlFromRequest(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const origin = request.headers.get('origin');
  return (origin || new URL(request.url).origin).replace(/\/$/, '');
}

function sameText(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;
}

export async function POST(request: Request) {
  let createdOrderId: string | null = null;
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos no válidos.' }, { status: 400 });
    const body = parsed.data;

    const { data: existingOrder } = await supabaseAdmin.from('orders').select('id,order_token,stripe_session_id,status,payment_status').eq('checkout_attempt_id', body.checkoutAttemptId).maybeSingle();
    if (existingOrder) {
      if (existingOrder.stripe_session_id) {
        const existingSession = await stripe.checkout.sessions.retrieve(existingOrder.stripe_session_id);
        if (existingSession.url && existingSession.status === 'open' && existingOrder.status !== 'cancelled' && existingOrder.payment_status !== 'failed') {
          return NextResponse.json({ ok: true, url: existingSession.url, orderId: existingOrder.id, reused: true });
        }
        if (existingSession.status === 'complete' || existingOrder.payment_status === 'authorized' || existingOrder.payment_status === 'paid') {
          return NextResponse.json({
            ok: false,
            code: 'CHECKOUT_ATTEMPT_COMPLETED',
            error: 'El intento anterior ya terminó. Se iniciará un pedido nuevo.'
          }, { status: 409 });
        }
      }

      return NextResponse.json({
        ok: false,
        code: 'CHECKOUT_ATTEMPT_RENEWABLE',
        error: 'El intento anterior ya no está activo. Se iniciará uno nuevo.'
      }, { status: 409 });
    }

    const { data: settings } = await supabaseAdmin.from('business_settings').select('*').eq('id', 'main').maybeSingle();
    if (!isBusinessOpenFromSettings({ ...defaultBusinessSettings, ...(settings || {}) } as any)) {
      return NextResponse.json({ ok: false, error: 'SOHO no acepta pedidos online en este momento.' }, { status: 409 });
    }

    const ids = [...new Set(body.items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products').select('id,name,price,image_url,available,vat_rate,categories(name)').in('id', ids);
    if (productsError) throw productsError;

    const productMap = new Map((products || []).map((p: any) => [p.id, p]));
    const orderItems = body.items.map((item) => {
      const product: any = productMap.get(item.product_id);
      if (!product || !product.available) throw new Error('Algún producto ya no está disponible. Actualiza la carta.');

      const categoryName = product.categories?.name || '';
      if (isHiddenCatalogCategory(categoryName)) throw new Error('Este producto ya no está disponible en la carta.');
      const allowedExtras = extrasForCategory(categoryName, product.name);
      const requiredChoices = requiredChoicesFromName(product.name);
      const selectedChoice = (item.required_choice || '').trim();

      if (requiredChoices.length && !requiredChoices.some((choice) => sameText(choice, selectedChoice))) {
        throw new Error(`Debes escoger ${requiredChoices.join(' o ')} para “${product.name}” antes de pagar.`);
      }
      if (!requiredChoices.length && selectedChoice) {
        throw new Error(`La opción seleccionada para “${product.name}” no es válida.`);
      }

      const selectedExtras = item.selected_extras.map((selected) => {
        const allowed = allowedExtras.find((extra) => sameText(extra.name, selected.name));
        if (!allowed || Math.abs(Number(allowed.price) - Number(selected.price)) > 0.001) {
          throw new Error(`Uno de los extras seleccionados para “${product.name}” ya no es válido. Vuelve a personalizar el producto.`);
        }
        return { name: allowed.name, price: allowed.price, quantity: selected.quantity };
      });

      const basePrice = Number(product.price);
      const extrasTotal = selectedExtrasTotal(selectedExtras);
      const unitPrice = Number((basePrice + extrasTotal).toFixed(2));
      const customizations = {
        required_choice: requiredChoices.length ? selectedChoice : null,
        selected_extras: selectedExtras,
        base_price: basePrice,
        extras_total: extrasTotal
      };
      const detail = customizationLabel(customizations.required_choice, selectedExtras);
      const productName = detail ? `${product.name} · ${detail}` : product.name;

      return {
        product_id: product.id,
        product_name: productName,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: Number((unitPrice * item.quantity).toFixed(2)),
        image_url: resolvedProductImage(product.image_url, categoryName),
        vat_rate: Number(product.vat_rate || 10),
        customizations
      };
    });

    const total = Number(orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2));
    const siteUrl = siteUrlFromRequest(request);

    const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert({
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      customer_email: body.customerEmail.toLowerCase(),
      order_type: 'pickup',
      notes: body.notes || null,
      total_price: total,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'stripe',
      checkout_attempt_id: body.checkoutAttemptId
    }).select('id,order_token').single();
    if (orderError) throw orderError;
    createdOrderId = order.id;

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      vat_rate: item.vat_rate,
      customizations: item.customizations
    })));
    if (itemsError) throw itemsError;

    await assertStripeConfiguration();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: body.customerEmail.toLowerCase(),
      phone_number_collection: { enabled: false },
      payment_intent_data: {
        capture_method: 'manual',
        receipt_email: body.customerEmail.toLowerCase(),
        metadata: { order_id: order.id }
      },
      line_items: orderItems.map((item) => {
        const rawImage = typeof item.image_url === 'string' ? item.image_url.trim() : '';
        const imageUrl = rawImage
          ? (/^https?:\/\//i.test(rawImage) ? rawImage : `${siteUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`)
          : undefined;
        return {
          quantity: item.quantity,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(item.unit_price * 100),
            product_data: { name: item.product_name.slice(0, 127), images: imageUrl ? [imageUrl] : undefined }
          }
        };
      }),
      metadata: { order_id: order.id, order_token: order.order_token },
      success_url: `${siteUrl}/checkout/success?order=${order.id}&token=${order.order_token}`,
      cancel_url: `${siteUrl}/checkout/cancel?order=${order.id}&token=${order.order_token}`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60
    }, { idempotencyKey: `checkout-order-${order.id}` });

    const { error: updateError } = await supabaseAdmin.from('orders').update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (updateError) throw updateError;
    await appendOrderEvent({ orderId: order.id, eventType: 'checkout.created', actorType: 'customer', metadata: { stripeSessionId: session.id } });

    return NextResponse.json({ ok: true, url: session.url, orderId: order.id });
  } catch (error: any) {
    if (createdOrderId) {
      await supabaseAdmin.from('orders').update({ status: 'cancelled', payment_status: 'failed', cancellation_reason: 'No se pudo iniciar el pago.', updated_at: new Date().toISOString() }).eq('id', createdOrderId);
    }
    console.error('checkout_session_create_failed', { orderId: createdOrderId, error: error?.message });
    return NextResponse.json({ ok: false, error: error?.message || 'No se pudo iniciar el pago.' }, { status: 500 });
  }
}
