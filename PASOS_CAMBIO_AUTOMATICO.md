# Cambio automático de pedidos para SOHO

## Orden correcto de actualización

1. Abre **Supabase > SQL Editor**.
2. Ejecuta completo `supabase/20260831_TIEMPO_AUTOMATICO_PEDIDOS.sql`.
3. Comprueba que termina sin errores.
4. Ejecuta `npm install`, `npm run lint` y `npm run build`.
5. Sube el proyecto a GitHub y espera el despliegue de Vercel.
6. En Vercel, confirma que `NEXT_PUBLIC_SITE_URL` vale `https://www.sohocambados.es` en producción. El valor `http://localhost:3000` del archivo local es únicamente para probar en VS Code.
7. Realiza un único pedido de prueba con Stripe en modo de prueba.

## Flujo implementado

- Stripe cobra el pedido al finalizar Checkout.
- El pedido aparece inmediatamente como **Aceptado**.
- A los **2 minutos** desde la confirmación del pago pasa a **Preparando**.
- A los **10 minutos totales** desde la confirmación pasa a **Listo**. Este tiempo total puede cambiarse desde **Admin > Horario > Operación automática**.
- **Entregado**, cancelaciones y reembolsos se gestionan manualmente.
- La vuelta desde Stripe y el seguimiento reconcilian el pago como respaldo del webhook. Todas las vías son idempotentes y no vuelven a cobrar.
- El equipo conserva los controles manuales para marcar la entrega, corregir estados y reembolsar incidencias.
- El botón de WhatsApp abre la cuenta ya iniciada en el dispositivo y no requiere asociar un número a la web.
- Los clientes realizan pedidos sin registrarse.

## Pendientes de información del negocio

- **Impresora:** marca, modelo, conexión (red/Wi-Fi/USB/Bluetooth), IP si existe y fotografía de la configuración. No se activa una integración sin esos datos.
- **Extras:** se conserva el sistema existente. Los importes definitivos se actualizarán cuando Martín entregue la lista de caja.
- **Acceso administrador:** si las credenciales no funcionan, hay que restablecer el usuario existente en Supabase Auth. La recuperación solamente envía correo a una cuenta realmente registrada.

## Configuración obligatoria de recuperación de contraseña

En **Supabase > Authentication > URL Configuration** configura:

- **Site URL:** `https://www.sohocambados.es`
- **Redirect URLs:**
  - `https://www.sohocambados.es/admin/reset-password`
  - `http://localhost:3000/admin/reset-password`

El código también detecta enlaces antiguos que lleguen por error a la portada y los dirige al formulario correcto. Después de cambiar la contraseña se cierran las sesiones anteriores.
