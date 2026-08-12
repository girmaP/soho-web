# SOHO Cambados · Producción

Aplicación de pedidos online de SOHO Cambados. Incluye carta, carrito, checkout Stripe con autorización y captura manual, seguimiento privado, panel administrativo, alertas de nuevos pedidos, correo transaccional mediante Gmail, estadísticas e informe PDF.

## Puesta en producción

1. Ejecutar `supabase/SOHO_PRODUCCION_FINAL.sql` una sola vez en el proyecto Supabase actual. El script es idempotente y no vacía productos, imágenes ni pedidos existentes.
2. Configurar en Vercel las mismas variables de entorno de producción incluidas en `.env.local`. `.env.local` está ignorado por Git.
3. Confirmar que el webhook LIVE de Stripe apunta a `https://www.sohocambados.es/api/stripe/webhook`.
4. Ejecutar `npm run preflight`, `npm run typecheck`, `npm run lint` y `npm run build` antes del despliegue.

## Flujo de pago

Stripe autoriza el importe al completar Checkout. El pedido solo se muestra al equipo una vez autorizada la operación. Al pasar el pedido a **En preparación**, la aplicación captura el importe. Si se cancela antes de la captura, se libera la autorización.

## Seguridad

No subir `.env.local` a GitHub. Las credenciales privadas deben existir únicamente en el entorno local seguro y en las variables de Vercel.
