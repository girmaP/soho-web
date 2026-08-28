function normalize(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const BEVERAGE_CATEGORY_PATTERN = /\b(bebida|bebidas|refresco|refrescos|cerveza|cervezas|vino|vinos|agua|aguas|zumo|zumos|caf[eé]|caf[eé]s|infusi[oó]n|infusiones|licor|licores|copa|copas)\b/;

export function isBeverageCategory(categoryName?: string | null) {
  return BEVERAGE_CATEGORY_PATTERN.test(normalize(categoryName));
}

export function compareCatalogCategories(
  left: { name?: string | null; sort_order?: number | null },
  right: { name?: string | null; sort_order?: number | null }
) {
  const leftIsBeverage = isBeverageCategory(left.name);
  const rightIsBeverage = isBeverageCategory(right.name);
  if (leftIsBeverage !== rightIsBeverage) return leftIsBeverage ? 1 : -1;

  const leftOrder = Number.isFinite(Number(left.sort_order)) ? Number(left.sort_order) : Number.MAX_SAFE_INTEGER;
  const rightOrder = Number.isFinite(Number(right.sort_order)) ? Number(right.sort_order) : Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  return String(left.name || 'Otros').localeCompare(String(right.name || 'Otros'), 'es', {
    sensitivity: 'base'
  });
}

const HIDDEN_CATEGORY_NAMES = new Set([
  'prepara tu combi desayuno'
]);

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  'hamburguesas premium': '/category-placeholders/hamburguesas-premium.webp',
  'hamburguesas': '/category-placeholders/hamburguesas.webp',
  'nuggets y fingers': '/category-placeholders/nuggets-y-fingers.webp',
  'fingers y nuggets': '/category-placeholders/nuggets-y-fingers.webp',
  'pastas': '/category-placeholders/pastas.webp',
  'platos combinados estilo miro pereira': '/category-placeholders/platos-combinados.webp',
  'platos combinados': '/category-placeholders/platos-combinados.webp',
  'tostas': '/category-placeholders/tostas.webp',
  'bocadillos especiales en pan blando': '/category-placeholders/bocadillos-especiales.webp',
  'bocadillos especiales': '/category-placeholders/bocadillos-especiales.webp',
  'bocadillos': '/category-placeholders/bocadillos.webp',
  'ensaladas': '/category-placeholders/ensaladas.webp'
};

export function isHiddenCatalogCategory(categoryName?: string | null) {
  return HIDDEN_CATEGORY_NAMES.has(normalize(categoryName));
}

export function categoryPlaceholderImage(categoryName?: string | null) {
  return CATEGORY_PLACEHOLDERS[normalize(categoryName)] || null;
}

export function isSohoLogoImage(imageUrl?: string | null) {
  const value = String(imageUrl || '').trim().toLowerCase();
  if (!value) return false;

  const knownLocal = [
    '/soho-logo.png',
    '/soho-logo-green.png',
    '/soho-logo-report.jpg',
    '/soho-wall-logo.jpg'
  ];
  if (knownLocal.some((path) => value === path || value.endsWith(path))) return true;

  try {
    const pathname = new URL(value, 'https://sohocambados.es').pathname.toLowerCase();
    const filename = pathname.split('/').pop() || '';
    return (
      /soho[-_ ]?logo/.test(filename) ||
      /logo[-_ ]?soho/.test(filename) ||
      /soho[-_ ]?wall[-_ ]?logo/.test(filename) ||
      /logotipo[-_ ]?soho/.test(filename) ||
      /logo[-_ ]?de[-_ ]?restaurante.*soho/.test(filename) ||
      /soho.*burger.*restaurant/.test(filename)
    );
  } catch {
    return /soho[-_ ]?logo|logo[-_ ]?soho|logotipo[-_ ]?soho|logo[-_ ]?de[-_ ]?restaurante.*soho|soho.*burger.*restaurant/.test(value);
  }
}

export function resolvedProductImage(imageUrl?: string | null, categoryName?: string | null) {
  const placeholder = categoryPlaceholderImage(categoryName);
  return placeholder && isSohoLogoImage(imageUrl) ? placeholder : (imageUrl || null);
}
