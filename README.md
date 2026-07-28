# SOHO Cambados — Versión final para entrega

Proyecto Next.js + Supabase para gestionar pedidos online de recogida en SOHO Cambados, con enlace externo a delivery mediante Caylu.

## Qué incluye

- Carta online con productos, categorías, precios y fotos.
- Carrito con imagen de producto.
- Pedidos reales guardados en Supabase.
- Enlace privado de seguimiento de pedido con token.
- Actualización en tiempo real entre cliente y administrador.
- Panel administrador con login.
- Gestión de pedidos con estado y tiempo estimado mediante desplegables.
- Contadores por estado en el panel de pedidos.
- Resumen del día por fecha.
- Historial de últimos 15 días.
- Exportación CSV compatible con Excel.
- Edición de productos existentes: nombre, descripción, precio, foto, categoría, disponibilidad y producto recomendado.
- Horario editable desde admin: apertura, cierre, pausa manual y días cerrados.
- Bloqueo de pedidos para recoger si el local está cerrado o pausado.
- Delivery mediante enlace externo a Caylu.
- Footer y textos finales.
- Sin enlace visible al panel admin en la web pública.

## Instalación local

1. Descomprime el ZIP.
2. Copia tu `.env.local` del proyecto anterior en la raíz.
3. Comprueba que contiene:

```env
NEXT_PUBLIC_SUPABASE_URL=TU_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
```

4. Instala dependencias:

```bash
npm install
```

5. Ejecuta:

```bash
npm run dev
```

6. Abre:

```txt
http://localhost:3000
http://localhost:3000/menu
http://localhost:3000/admin
```

## Supabase

Antes de probar esta versión, abre Supabase y ejecuta el archivo:

```txt
supabase/schema.sql
```

Esto añade o actualiza:

- `business_settings`
- columnas de token y tiempo aceptado
- realtime
- función de limpieza de pedidos antiguos
- políticas RLS necesarias

## Usuario admin

Crea o usa un usuario en:

```txt
Supabase → Authentication → Users
```

Después entra en:

```txt
/admin
```

## Revisión final recomendada

1. Entra en `/admin`.
2. Configura horario abierto.
3. Entra en `/menu` y añade productos.
4. Envía un pedido para recoger.
5. Abre el enlace privado del pedido.
6. En admin cambia estado y tiempo.
7. Comprueba que el cliente se actualiza sin recargar.
8. Marca pedido como `delivered`.
9. Comprueba mensaje de gracias y botón `Seguir comprando`.
10. Revisa resumen del día y exportación CSV.
11. Entra en productos y confirma que el selector de categorías carga correctamente.

## WhatsApp automático

La ruta `/api/whatsapp` está preparada para WhatsApp Cloud API.
Para activarla añade variables en Vercel o `.env.local`:

```env
WHATSAPP_CLOUD_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

Si no están configuradas, la web sigue funcionando y solo se registra aviso en consola.

## Nota de producción

La app usa un token privado en el enlace de seguimiento del pedido y filtra por `id + order_token`. Para una producción con requisitos de seguridad más estrictos, se recomienda mover la lectura de pedidos a una API server-side con validación adicional del token.


## Pruebas locales con Stripe

Para que los pedidos de prueba guarden la autorización de pago, deben permanecer abiertas dos terminales:

```powershell
npm run dev
```

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copia el secreto `whsec_...` mostrado por Stripe CLI en `STRIPE_WEBHOOK_SECRET` dentro de `.env.local` y reinicia `npm run dev`. En producción no se usa Stripe CLI: el webhook debe apuntar a `https://TU-DOMINIO/api/stripe/webhook`.
