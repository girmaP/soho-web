export type ProductExtra = { name: string; price: number };
export type SelectedExtra = ProductExtra & { quantity: number };
export type ExtraProfileId = 'sandwiches' | 'bocatas' | 'burgers' | 'platos' | 'ensaladas';

const SANDWICHES: ProductExtra[] = [
  ['Jamón York', .7], ['Queso', .7], ['Huevo', .5], ['Lechuga', .2], ['Tomate', .2], ['Cebolla', .2],
  ['Bacon', .8], ['Jamón serrano', 1], ['Lomo', .7], ['Pechuga de pollo', 2], ['Pechuga rebozada', 2.5],
  ['Atún', 1.5], ['Alioli', 1], ['Cebolla crujiente', .5], ['Cebolla caramelizada', .5],
  ['Queso cheddar', 1.5], ['Queso tetilla', 2], ['Salsa César', 1], ['Pimientos', 1], ['Hamburguesa', 1.5],
  ['Maíz', .5], ['Extra rebozado', 1], ['Tortilla francesa', 1.5], ['Salchichas', 1.5], ['Salsa brava', 1]
].map(([name, price]) => ({ name: String(name), price: Number(price) }));

const BOCATAS: ProductExtra[] = [
  ['Jamón York', 1], ['Queso', 1], ['Huevo', 1], ['Lechuga', .2], ['Tomate', .2], ['Cebolla', .2],
  ['Bacon', 1], ['Jamón serrano', 1.5], ['Lomo', 1], ['Pechuga de pollo', 2], ['Pechuga rebozada', 2.5],
  ['Atún', 1.5], ['Alioli', 1], ['Cebolla caramelizada', .5], ['Queso cheddar', 1.5], ['Queso tetilla', 2],
  ['Salsa César', 1], ['Pimientos', 1], ['Hamburguesa', 1.5], ['Zorza', 2], ['Pinchos', 2.5],
  ['Extra rebozado', 1], ['Tortilla francesa', 1.5], ['Salchichas', 1.5], ['Salsa brava', 1]
].map(([name, price]) => ({ name: String(name), price: Number(price) }));

const BURGERS: ProductExtra[] = [
  ['Jamón York', .7], ['Queso', .7], ['Huevo', .5], ['Lechuga', .2], ['Tomate', .2], ['Cebolla', .2],
  ['Bacon', .8], ['Jamón serrano', 1.5], ['Lomo', .7], ['Pechuga de pollo', 1.5], ['Pechuga rebozada', 2],
  ['Atún', 1], ['Alioli', 1], ['Cebolla caramelizada', .5], ['Queso cheddar', 1.2], ['Queso tetilla', 1.5],
  ['Salsa César', 1], ['Pimientos', 1], ['Hamburguesa', 1.5], ['Extra rebozado', 1],
  ['Tortilla francesa', 1.5], ['Salchichas', 1.5], ['Salsa brava', 1]
].map(([name, price]) => ({ name: String(name), price: Number(price) }));

const PLATOS: ProductExtra[] = [
  ['Jamón York', 2], ['Queso', 2], ['Huevo', 1.5], ['Lechuga', 1], ['Tomate', 1], ['Cebolla', 1],
  ['Bacon', 2], ['Jamón serrano', 2], ['Lomo', 2], ['Pechuga de pollo', 3], ['Pechuga rebozada', 3.5],
  ['Atún', 2], ['Alioli', 1], ['Cebolla caramelizada', 1.5], ['Queso cheddar', 2], ['Queso tetilla', 2],
  ['Salsa César', 1], ['Pimientos', 2], ['Hamburguesa', 2], ['Maíz', 1.5], ['Zorza', 3.5], ['Pinchos', 3],
  ['Extra rebozado', 2], ['Arroz', 2], ['Tortilla francesa', 2.5], ['Salchichas', 2.5], ['Salsa brava', 1]
].map(([name, price]) => ({ name: String(name), price: Number(price) }));

const ENSALADAS: ProductExtra[] = [
  ['Jamón York', 1.2], ['Queso', 1.2], ['Huevo', 1.5], ['Lechuga', 1.5], ['Tomate', 1.2], ['Cebolla', .6],
  ['Bacon', 2], ['Jamón serrano', 2], ['Lomo', 2], ['Pechuga de pollo', 2], ['Pechuga rebozada', 2.5],
  ['Atún', 1.5], ['Alioli', 1], ['Cebolla crujiente', .5], ['Cebolla caramelizada', .5],
  ['Queso cheddar', 1.5], ['Queso tetilla', 2], ['Salsa César', 1], ['Pimientos', 1], ['Hamburguesa', 1.5],
  ['Maíz', .5], ['Zorza', 2], ['Pinchos', 2], ['Extra rebozado', 1], ['Arroz', 1.5],
  ['Tortilla francesa', 1.5], ['Salchichas', 1.5], ['Salsa brava', 1]
].map(([name, price]) => ({ name: String(name), price: Number(price) }));

const PROFILE_EXTRAS: Record<ExtraProfileId, ProductExtra[]> = {
  sandwiches: SANDWICHES, bocatas: BOCATAS, burgers: BURGERS, platos: PLATOS, ensaladas: ENSALADAS
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extraProfileForCategory(categoryName?: string | null, productName?: string | null): ExtraProfileId | null {
  const category = normalize(categoryName || '');
  const product = normalize(productName || '');
  if (category.includes('sandwich')) return 'sandwiches';
  if (category.includes('bocadill') || category.includes('bocata') || category.includes('tosta')) return 'bocatas';
  if (category.includes('hamburgues') || category.includes('burger')) return 'burgers';
  if (category.includes('ensalada')) return 'ensaladas';
  if (category.includes('plato') || category.includes('miro pereira') || category.includes('pasta') || category.includes('nugget') || category.includes('finger') || category.includes('patata')) return 'platos';
  // Corrección defensiva para productos históricos mal categorizados.
  if (/^(pasta|nugget|finger|patata)/.test(product)) return 'platos';
  return null;
}

export function extrasForCategory(categoryName?: string | null, productName?: string | null): ProductExtra[] {
  const profile = extraProfileForCategory(categoryName, productName);
  return profile ? PROFILE_EXTRAS[profile].map((extra) => ({ ...extra })) : [];
}

function cleanChoice(value: string) {
  return value.replace(/^\s*(?:con|de)\s+/i, '').replace(/[().,:;]+$/g, '').trim();
}

export function requiredChoicesFromName(productName: string): string[] {
  const segments = String(productName || '').split(/[+,/|()–—-]/).map((segment) => segment.trim()).filter(Boolean);
  for (const segment of segments.reverse()) {
    const parts = segment.split(/\s+o\s+/i).map(cleanChoice).filter(Boolean);
    if (parts.length === 2 && parts.every((part) => part.split(/\s+/).length <= 5)) return parts;
  }
  return [];
}

export function selectedExtrasTotal(extras: SelectedExtra[]) {
  return Number(extras.reduce((sum, extra) => sum + extra.price * extra.quantity, 0).toFixed(2));
}

export function customizationLabel(choice?: string | null, extras: SelectedExtra[] = []) {
  const parts: string[] = [];
  if (choice) parts.push(`Opción: ${choice}`);
  if (extras.length) parts.push(`Extras: ${extras.map((extra) => `${extra.quantity > 1 ? `${extra.quantity}x ` : ''}${extra.name}`).join(', ')}`);
  return parts.join(' · ');
}
