# Revisión final consolidada

## Incluido

- Identidad visual adaptada al logotipo turquesa.
- Logo circular con marco turquesa en el pie de página.
- Iconos reales de Instagram y Facebook.
- Descripciones vacías ocultas y bloqueo de textos genéricos antiguos.
- Categoría Bebidas incluida en el seed de la carta.
- Imágenes de producto por enlace público o archivo desde el dispositivo.
- Validación de formato y tamaño de imágenes (JPG, PNG, WEBP y AVIF, máximo 8 MB).
- Bucket y políticas de Supabase Storage incluidos en una migración idempotente.
- Checkout compatible con imágenes locales y URLs públicas; Stripe solo recibe URLs absolutas válidas.
- Acceso administrativo restringido a usuarios autorizados.
- Recuperación de contraseña sin correos de ejemplo preintroducidos.
- Mensajes públicos sin instrucciones técnicas ni textos de demostración.
- SQL corregido con alias explícitos para evitar columnas ambiguas.

## Comprobación local obligatoria

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
```

Para probar pagos en local, mantener abiertas dos terminales:

```powershell
npm run dev
```

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
