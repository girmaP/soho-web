# Auditoría final — 28 de agosto de 2026

## Cambios realizados

- Carta agrupada en secciones visibles por categoría.
- Orden de categorías respetando `sort_order`, con todas las categorías de bebidas al final.
- Buscador, selector, personalización, carrito y producto recomendado conservados.
- Estado de error de catálogo para evitar una carga infinita cuando falla la conexión.
- Metadatos locales reforzados para búsquedas de SOHO, cafetería, hamburguesería y recogida en Cambados.
- Datos estructurados `Restaurant` y `Menu` ampliados.
- Los estados temporales de apertura y producto recomendado se excluyen de los fragmentos de Google.
- Favicon cuadrado de 192 × 192 y Apple Touch Icon de 180 × 180.
- Imagen social Open Graph real de 1200 × 630.
- Fecha estable en el sitemap para no comunicar cambios falsos en cada solicitud.
- Next.js y ESLint actualizados a 16.3.3 para eliminar tres vulnerabilidades altas detectadas por `npm audit`.

## Validación

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- `npm audit --omit=dev`: 0 vulnerabilidades.

## Acción externa recomendada

La ficha de Google del negocio debe enlazar a `https://www.sohocambados.es/` en lugar de `menuyvinos.com`. Este cambio no puede realizarse desde el código de la web y es importante para consolidar la autoridad local del dominio oficial.
