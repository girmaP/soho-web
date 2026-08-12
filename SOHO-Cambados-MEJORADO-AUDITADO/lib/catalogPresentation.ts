function normalize(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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
