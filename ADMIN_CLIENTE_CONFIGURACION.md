# Configuración final del panel de SOHO Cambados

## Acceso del cliente

1. En Supabase abre **Authentication > Users**.
2. Crea la cuenta del responsable con su correo real y una contraseña temporal segura.
3. Copia el UUID del usuario.
4. En **SQL Editor** ejecuta, sustituyendo el valor:

```sql
insert into public.admin_users (user_id)
values ('UUID_DEL_USUARIO')
on conflict (user_id) do nothing;
```

El panel está disponible en `/admin`. Solo las cuentas presentes en `admin_users` pueden acceder.

## Recuperación de contraseña

La opción **¿Olvidaste tu contraseña?** envía un enlace al correo de la cuenta. En Supabase debe estar añadida la URL pública del sitio en **Authentication > URL Configuration**, incluyendo:

- `https://TU-DOMINIO/admin/reset-password`
- Para pruebas locales: `http://localhost:3000/admin/reset-password`

## Imágenes de productos

El panel admite dos métodos:

- Pegar un enlace público `https://...` y pulsar **Guardar**.
- Elegir una imagen JPG, PNG, WEBP o AVIF desde el dispositivo, hasta 8 MB.

Los archivos se guardan en el bucket público `product-images` de Supabase Storage y la URL queda asociada automáticamente al producto.

## Seguridad

- No incluyas `.env.local` en entregas ni repositorios.
- No compartas la clave `SUPABASE_SERVICE_ROLE_KEY`.
- Usa una cuenta individual por responsable y elimina su fila de `admin_users` cuando deje de necesitar acceso.
