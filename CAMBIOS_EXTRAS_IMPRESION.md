# Extras Fast-food e impresión de cocina

## Perfiles aplicados

Los precios se han transcrito de las fotografías de BDP facilitadas por SOHO. La web valida siempre el perfil y el precio en el servidor antes de crear el pedido en Stripe.

- **Sándwiches:** categorías de sándwiches.
- **Bocatas:** bocadillos, bocadillos especiales y tostas.
- **Burgers:** hamburguesas y hamburguesas premium.
- **Platos combinados:** platos combinados, pastas, nuggets, fingers y patatas.
- **Ensaladas:** ensaladas.

El carrito conserva una instantánea del nombre, cantidad y precio de cada extra. Esa información llega al checkout, al pedido, al panel, al seguimiento, al correo y al ticket de cocina.

## Activación en Supabase

Ejecutar en el SQL Editor del proyecto de producción:

```text
supabase/20260903_EXTRAS_E_IMPRESION.sql
```

La migración crea una cola privada con un trabajo único por pedido. Solo el backend con `service_role` puede leerla o modificarla.

## Activación en Vercel

Crear `PRINT_BRIDGE_TOKEN` en Production, Preview y Development. Debe ser un valor aleatorio de al menos 32 caracteres y coincidir con el configurado posteriormente en el ordenador de SOHO.

Después de guardar la variable, volver a desplegar el último commit.

## Conexión física pendiente

Las instrucciones y el conector están en `printer-bridge/`. En el local será necesario confirmar la IP de la Approx appPOS80WIFI+LAN y probar el puerto TCP/ESC-POS antes de dejar el conector iniciado automáticamente con Windows.
