# Checklist de producción · SOHO Cambados

- [ ] Ejecutar `supabase/SOHO_PRODUCCION_FINAL.sql`.
- [ ] `npm run preflight` sin errores.
- [ ] Variables LIVE configuradas en Vercel.
- [ ] Webhook Stripe LIVE activo en `/api/stripe/webhook`.
- [ ] Dominio `https://www.sohocambados.es` asignado al proyecto.
- [ ] Realizar un pedido real controlado y verificar: autorización, aparición en admin, correo, seguimiento, captura al preparar y cambio a listo.
- [ ] Verificar cancelación antes de captura y un reembolso controlado.
- [ ] Confirmar PDF e informe de actividad.

El archivo `.env.local` no se versiona y no debe subirse a GitHub.
