# SOHO Cambados — versión endurecida para producción

## Cambios incluidos

- Pedidos y líneas dejan de ser consultables por usuarios anónimos.
- Seguimiento privado mediante API server-side que exige `id + order_token`.
- Eliminadas las credenciales administrativas del SQL y la creación directa de usuarios Auth.
- Stripe usa autorización con captura manual.
- El cobro se captura al pasar el pedido a `preparing`.
- Rechazar antes de capturar libera la autorización.
- Cancelar después de cobrar inicia un reembolso automático.
- Webhook Stripe idempotente mediante `stripe_webhook_events`.
- Historial append-only básico en `order_events`.
- Eliminado el borrado irreversible de pedidos desde el panel.
- Las transiciones sensibles se realizan en API server-side autenticada.
- WhatsApp exige sesión de administrador y usa plantillas cerradas.
- Correo del cliente añadido al checkout y al pedido.
- Dependencias principales actualizadas a Next.js 16, React 19, Supabase y Stripe actuales.
- Cabeceras básicas de seguridad y dominios de imágenes restringidos.
- Esquema de producción separado del seed demo.

## Instalación sobre la base existente

1. Hacer copia de seguridad de Supabase.
2. Ejecutar `supabase/migrations/20260715_production_hardening.sql` en SQL Editor.
3. Cambiar inmediatamente la contraseña del antiguo usuario administrador e invalidar sesiones si se llegó a usar la contraseña incluida en versiones anteriores.
4. Crear o verificar el usuario desde Supabase Auth.
5. Insertar su UUID en `public.admin_users`:

```sql
insert into public.admin_users(user_id)
values ('UUID_DEL_USUARIO_ADMIN')
on conflict (user_id) do nothing;
```

6. Configurar en Vercel las variables descritas en `.env.example`.
7. Crear el webhook de Stripe apuntando a `/api/stripe/webhook` y escuchar como mínimo:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `refund.created`
   - `refund.updated`
8. Probar todo primero con claves `test` de Stripe.

## Pruebas obligatorias antes de activar pagos reales

- Pedido autorizado y rechazado antes de preparar: no existe cargo definitivo.
- Pedido autorizado y pasado a preparación: captura correcta y estado `paid`.
- Tarjeta cuyo cobro/captura falla: el pedido no pasa a preparación.
- Cancelación posterior al cobro: reembolso y estado `refunded` o `refund_pending`.
- Reenvío del mismo webhook: no duplica eventos ni acciones.
- Seguimiento sin token o con token incorrecto: 404/400 y ningún dato expuesto.
- Usuario autenticado no incluido en `admin_users`: acceso denegado.

## Límites pendientes

Esta versión no implementa todavía GFactu/VeriFactu, factura simplificada, PDF fiscal, email de factura ni rectificativa fiscal. El código deja preparado el punto de integración tras la captura y tras el reembolso, pero no debe anunciarse esa función hasta disponer de una API estable de GFactu y completar pruebas reales.

Los datos reales de Soho —teléfono, correo, dirección, redes, horarios, carta, textos legales y fotografías— siguen pendientes del material del cliente.


## Pruebas locales con Stripe

Para que los pedidos de prueba guarden la autorización de pago, deben permanecer abiertas dos terminales:

```powershell
npm run dev
```

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copia el secreto `whsec_...` mostrado por Stripe CLI en `STRIPE_WEBHOOK_SECRET` dentro de `.env.local` y reinicia `npm run dev`. En producción no se usa Stripe CLI: el webhook debe apuntar a `https://TU-DOMINIO/api/stripe/webhook`.
