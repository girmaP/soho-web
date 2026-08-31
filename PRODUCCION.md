# Checklist de producción · SOHO Cambados

- [ ] Ejecutar `supabase/SOHO_PRODUCCION_FINAL.sql`.
- [ ] `npm run preflight` sin errores.
- [ ] Variables LIVE configuradas en Vercel.
- [ ] Webhook Stripe LIVE activo en `/api/stripe/webhook`.
- [ ] Dominio `https://www.sohocambados.es` asignado al proyecto.
- [ ] Ejecutar `supabase/20260831_TIEMPO_AUTOMATICO_PEDIDOS.sql` una sola vez.
- [ ] Realizar un pedido controlado y verificar: cobro, aparición en admin como Preparando, correo, seguimiento y cambio automático a Listo.
- [ ] Verificar cancelación antes de captura y un reembolso controlado.
- [ ] Confirmar PDF e informe de actividad.

El archivo `.env.local` no se versiona y no debe subirse a GitHub.

## Flujo de pedidos y causa corregida

Los intentos se guardan inicialmente con `payment_status=pending`, pero no son
pedidos operativos: Admin y el seguimiento privado solo los muestran tras una
confirmación de pago de Stripe. El webhook valida estado, importe, moneda,
sesion y pedido antes de activar la fila.

La incidencia se producia porque `stripe_webhook_events` trataba un evento
fallido como duplicado en el siguiente intento. Stripe reintentaba, pero el
handler devolvia 200 sin reprocesarlo. La funcion SQL
`claim_stripe_webhook_event` reclama el evento de forma atomica y permite
reintentar solamente los que terminaron en `failed`.

Tras actualizar el codigo es obligatorio ejecutar de nuevo
`supabase/SOHO_PRODUCCION_FINAL.sql`. La migracion conserva catalogo y pedidos,
anade `delivered_at`, indices Stripe, el reclamo atomico y las publicaciones de
Realtime que usa Admin.

El endpoint LIVE debe suscribirse como minimo a:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.amount_capturable_updated`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `refund.created`
- `refund.updated`
- `charge.refunded`
