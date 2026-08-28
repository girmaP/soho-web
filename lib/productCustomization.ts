export type ProductExtra = {
  name: string;
  price: number;
};

export type SelectedExtra = ProductExtra & {
  quantity: number;
};

const GROUP_A: ProductExtra[] = [
  { name: 'Ali-oli', price: 0.5 },
  { name: 'Bacon', price: 0.5 },
  { name: 'Cebolla', price: 0.35 },
  { name: 'Huevo', price: 0.5 },
  { name: 'Ketchup', price: 0.1 },
  { name: 'Lechuga', price: 0.35 },
  { name: 'Lomo', price: 0.5 },
  { name: 'Mayonesa', price: 0.1 },
  { name: 'Mostaza', price: 0.1 },
  { name: 'Pan sin gluten', price: 0 },
  { name: 'Patatas', price: 4.55 },
  { name: 'Pechuga de pollo', price: 1 },
  { name: 'Queso', price: 0.5 },
  { name: 'Tomate natural', price: 0.35 },
  { name: 'York', price: 0.5 }
];

const GROUP_B = GROUP_A.filter((extra) => extra.name !== 'Ali-oli');
const GROUP_C: ProductExtra[] = [
  { name: 'Ketchup', price: 0.1 },
  { name: 'Mayonesa', price: 0.1 },
  { name: 'Mostaza', price: 0.1 },
  { name: 'Patatas', price: 4.55 }
];
const GROUP_D: ProductExtra[] = GROUP_C.filter((extra) => extra.name !== 'Patatas');
const GROUP_E: ProductExtra[] = [{ name: 'Aceite, vinagre y sal', price: 0.5 }];
const GROUP_F: ProductExtra[] = [
  { name: 'Ali-oli', price: 0.5 },
  ...GROUP_C
];
const GROUP_G: ProductExtra[] = [
  { name: 'Ali-oli', price: 0.5 },
  ...GROUP_D
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function extrasForCategory(categoryName?: string | null, productName?: string | null): ProductExtra[] {
  const category = normalize(categoryName || '');
  const product = normalize(productName || '');

  // En la carta actual, algún producto como CALAMARES puede conservar una
  // categoría antigua en base de datos. El nombre del producto corrige ese
  // caso sin modificar imágenes, precios ni contenido existente.
  if (!category.includes('platos combinados') && (product === 'calamares' || product === 'croquetas')) return GROUP_G;

  if (category.includes('bocadillos especiales')) return GROUP_B;
  if (category.includes('hamburguesas premium')) return GROUP_B;
  if (category.includes('sandwich')) return GROUP_B;
  if (category === 'bocadillos' || category.startsWith('bocadillos ')) return GROUP_A;
  if (category === 'hamburguesas' || category.startsWith('hamburguesas ')) return GROUP_A;
  if (category.includes('tostas')) return GROUP_C;
  if (category.includes('platos combinados') || category.includes('miro pereira')) return GROUP_D;
  if (category.includes('raciones de patatas')) return GROUP_D;
  if (category.includes('ensaladas')) return GROUP_E;
  if (category.includes('fingers') || category.includes('nuggets')) return GROUP_F;
  if (category.includes('croquetas') || category.includes('calamares')) return GROUP_G;

  return [];
}

function cleanChoice(value: string) {
  return value
    .replace(/^\s*(?:con|de)\s+/i, '')
    .replace(/[().,:;]+$/g, '')
    .trim();
}

/**
 * Detecta alternativas escritas en el nombre como “patatas o arroz”.
 * Se limita al segmento separado por +, coma, guion o paréntesis para no
 * convertir accidentalmente todo el nombre del plato en una opción.
 */
export function requiredChoicesFromName(productName: string): string[] {
  const segments = String(productName || '')
    .split(/[+,/|()–—-]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments.reverse()) {
    const parts = segment.split(/\s+o\s+/i).map(cleanChoice).filter(Boolean);
    if (parts.length === 2 && parts.every((part) => part.split(/\s+/).length <= 5)) {
      return parts;
    }
  }

  return [];
}

export function selectedExtrasTotal(extras: SelectedExtra[]) {
  return Number(extras.reduce((sum, extra) => sum + extra.price * extra.quantity, 0).toFixed(2));
}

export function customizationLabel(choice?: string | null, extras: SelectedExtra[] = []) {
  const parts: string[] = [];
  if (choice) parts.push(`Opción: ${choice}`);
  if (extras.length) {
    parts.push(`Extras: ${extras.map((extra) => `${extra.quantity > 1 ? `${extra.quantity}x ` : ''}${extra.name}`).join(', ')}`);
  }
  return parts.join(' · ');
}
