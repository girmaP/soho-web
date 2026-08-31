# SOHO Cambados · Producción

Aplicación de pedidos online de SOHO Cambados. Incluye carta, carrito, cobro seguro con Stripe, aceptación y estados automáticos, seguimiento privado, panel administrativo, alertas, correo transaccional mediante Gmail, estadísticas e informe PDF.

## Puesta en producción

1. Ejecutar `supabase/SOHO_PRODUCCION_FINAL.sql` una sola vez en el proyecto Supabase actual. El script es idempotente y no vacía productos, imágenes ni pedidos existentes.
2. Configurar en Vercel las mismas variables de entorno de producción incluidas en `.env.local`. `.env.local` está ignorado por Git.
3. Confirmar que el webhook LIVE de Stripe apunta a `https://www.sohocambados.es/api/stripe/webhook`.
4. Ejecutar `npm run preflight`, `npm run typecheck`, `npm run lint` y `npm run build` antes del despliegue.

## Flujo de pago

Stripe cobra el importe al completar Checkout. El pedido aparece como **Aceptado**, pasa a **Preparando** al minuto 2 y a **Listo** al minuto 10 desde el pago (el tiempo total es configurable). **Entregado**, cancelaciones y reembolsos son manuales. Existe reconciliación segura desde el retorno de Stripe y el seguimiento si el webhook se retrasa.

## Seguridad

No subir `.env.local` a GitHub. Las credenciales privadas deben existir únicamente en el entorno local seguro y en las variables de Vercel.
