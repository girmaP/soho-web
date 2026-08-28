'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ProductCard } from '@/components/ProductCard';
import { CartBar } from '@/components/CartBar';
import { getCart, saveCart } from '@/lib/cartStorage';
import { Product } from '@/types/database';
import { BusinessSettings, businessHoursLabelFromSettings, defaultBusinessSettings, getBusinessSettings, isBusinessOpenFromSettings } from '@/lib/businessConfig';
import { extrasForCategory, ProductExtra, requiredChoicesFromName, SelectedExtra, selectedExtrasTotal } from '@/lib/productCustomization';
import { formatPrice } from '@/utils/formatPrice';
import { siteConfig } from '@/lib/siteConfig';
import { compareCatalogCategories, isHiddenCatalogCategory, resolvedProductImage } from '@/lib/catalogPresentation';

type ProductWithCategory = Product & { categories?: { name?: string | null; sort_order?: number | null } | null };

type CustomizationState = {
  product: ProductWithCategory;
  extras: ProductExtra[];
  requiredChoices: string[];
};

function newLineId(productId: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${productId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MenuPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [customizing, setCustomizing] = useState<CustomizationState | null>(null);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>({});
  const [customizationError, setCustomizationError] = useState('');
  const [cartNotice, setCartNotice] = useState('');

  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, { name: string; sort_order: number | null }>();
    for (const product of products) {
      const name = product.categories?.name || 'Otros';
      if (!uniqueCategories.has(name)) {
        uniqueCategories.set(name, { name, sort_order: product.categories?.sort_order ?? null });
      }
    }
    return ['Todos', ...Array.from(uniqueCategories.values()).sort(compareCatalogCategories).map((category) => category.name)];
  }, [products]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const categoryName = product.categories?.name || 'Otros';
      const matchesCategory = activeCategory === 'Todos' || categoryName === activeCategory;
      const matchesSearch = !query || product.name?.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, ProductWithCategory[]>();
    for (const product of visible) {
      const categoryName = product.categories?.name || 'Otros';
      const group = groups.get(categoryName) || [];
      group.push(product);
      groups.set(categoryName, group);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  }, [visible]);
  const recommended = products.find((product) => product.recommended);
  const recommendedDescription = (recommended?.description || '').trim();
  const showRecommendedDescription = recommendedDescription && !/^producto de la categor[ií]a/i.test(recommendedDescription);

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase.from('products').select('*, categories(name, sort_order)').eq('available', true).order('sort_order', { referencedTable: 'categories' }).order('name');
        if (error) throw error;
        const raw = ((data as ProductWithCategory[]) || []).filter((product) => !isHiddenCatalogCategory(product.categories?.name));
        const imageCounts = new Map<string, number>();
        for (const product of raw) {
          const key = String(product.image_url || '').trim();
          if (key) imageCounts.set(key, (imageCounts.get(key) || 0) + 1);
        }
        const cleaned = raw.map((product) => {
          const resolved = resolvedProductImage(product.image_url, product.categories?.name);
          const original = String(product.image_url || '').trim();
          const categoryFallback = resolvedProductImage('/soho-logo.png', product.categories?.name);
          const sharedPlaceholder = original && imageCounts.get(original)! >= 3 && categoryFallback !== '/soho-logo.png';
          return { ...product, image_url: sharedPlaceholder && resolved === product.image_url ? categoryFallback : resolved };
        }).sort((left, right) => {
          const categoryComparison = compareCatalogCategories(
            { name: left.categories?.name, sort_order: left.categories?.sort_order },
            { name: right.categories?.name, sort_order: right.categories?.sort_order }
          );
          return categoryComparison || String(left.name).localeCompare(String(right.name), 'es', { sensitivity: 'base' });
        });
        setProducts(cleaned);
      } catch (error) {
        console.error(error);
        setProductsError(true);
      } finally {
        setProductsLoading(false);
      }
    }
    loadProducts();
    getBusinessSettings().then(setSettings);
  }, []);

  function openProduct(product: ProductWithCategory) {
    const extras = extrasForCategory(product.categories?.name, product.name);
    const requiredChoices = requiredChoicesFromName(product.name);
    if (!extras.length && !requiredChoices.length) {
      addConfiguredProduct(product, null, []);
      return;
    }
    setSelectedChoice('');
    setExtraQuantities({});
    setCustomizationError('');
    setCustomizing({ product, extras, requiredChoices });
  }

  function addConfiguredProduct(product: ProductWithCategory, requiredChoice: string | null, selectedExtras: SelectedExtra[]) {
    const extrasTotal = selectedExtrasTotal(selectedExtras);
    const current = getCart();
    const signature = JSON.stringify({ productId: product.id, requiredChoice, selectedExtras });
    const existing = current.find((item) => JSON.stringify({ productId: item.product_id, requiredChoice: item.required_choice || null, selectedExtras: item.selected_extras || [] }) === signature);
    const unitPrice = Number((Number(product.price) + extrasTotal).toFixed(2));
    const next = existing
      ? current.map((item) => item.line_id === existing.line_id ? { ...item, quantity: item.quantity + 1, image_url: product.image_url || item.image_url || null } : item)
      : [...current, {
          line_id: newLineId(product.id),
          product_id: product.id,
          name: product.name,
          base_price: Number(product.price),
          price: unitPrice,
          quantity: 1,
          image_url: product.image_url || null,
          required_choice: requiredChoice,
          selected_extras: selectedExtras
        }];
    saveCart(next);
    setCartNotice(`${product.name} añadido al pedido.`);
  }

  function confirmCustomization() {
    if (!customizing) return;
    if (customizing.requiredChoices.length && !selectedChoice) {
      setCustomizationError(`Debes escoger ${customizing.requiredChoices.join(' o ')} antes de añadir este plato.`);
      return;
    }
    const selectedExtras = customizing.extras
      .map((extra) => ({ ...extra, quantity: Math.max(0, Number(extraQuantities[extra.name] || 0)) }))
      .filter((extra) => extra.quantity > 0);
    addConfiguredProduct(customizing.product, selectedChoice || null, selectedExtras);
    setCustomizing(null);
  }

  const customizationExtras = customizing?.extras
    .map((extra) => ({ ...extra, quantity: Number(extraQuantities[extra.name] || 0) }))
    .filter((extra) => extra.quantity > 0) || [];
  const customizationTotal = customizing ? Number(customizing.product.price) + selectedExtrasTotal(customizationExtras) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#049ca5]">Carta online</p>
          <h1 className="mt-1 text-4xl font-black">Elige tu pedido</h1>
          <p className="mt-2 max-w-2xl text-neutral-600">Añade productos al carrito y paga online para recoger. Para domicilio, usa el acceso directo a Caylu.</p>
        </div>
      </div>

      <div data-nosnippet className={`mt-5 rounded-3xl p-4 text-sm font-bold ${isBusinessOpenFromSettings(settings) ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
        {isBusinessOpenFromSettings(settings) ? 'Pedidos para recoger abiertos. ' : 'Pedidos para recoger cerrados. '}
        {businessHoursLabelFromSettings(settings)}
      </div>

      {recommended && (
        <div data-nosnippet className="mt-5 overflow-hidden rounded-[2rem] border bg-neutral-950 text-white shadow-xl shadow-cyan-200/30 md:grid md:grid-cols-[220px_1fr_auto] md:items-center">
          {recommended.image_url ? <img src={recommended.image_url} alt={recommended.name} className="h-48 w-full object-cover md:h-full" /> : <div className="flex h-48 items-center justify-center bg-[#049ca5] font-black md:h-full">SOHO</div>}
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">Producto recomendado del día</p>
            <h2 className="mt-2 text-3xl font-black">{recommended.name}</h2>
            {showRecommendedDescription && <p className="mt-2 text-white/70">{recommendedDescription}</p>}
            <strong className="mt-3 block text-2xl">{Number(recommended.price).toFixed(2)} €</strong>
          </div>
          <button onClick={() => openProduct(recommended)} className="m-5 rounded-2xl bg-[#049ca5] px-5 py-4 font-black text-white">Personalizar y añadir</button>
        </div>
      )}

      <div className="mt-5 rounded-3xl border bg-white p-4 shadow-sm md:flex md:items-center md:justify-between">
        <div><h2 className="text-xl font-black">¿Quieres entrega a domicilio?</h2><p className="text-sm text-neutral-600">El delivery se gestiona mediante Caylu, el canal de reparto externo.</p></div>
        <a href={siteConfig.cayluUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-2xl bg-[#049ca5] px-5 py-3 font-black text-white md:mt-0">Pedir a domicilio con Caylu</a>
      </div>

      {productsLoading && <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-5" aria-busy="true" aria-label="Cargando productos">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5" />)}</div>}

      <div className="mt-6 grid min-w-0 gap-3 overflow-hidden rounded-[2rem] border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <label className="grid min-w-0 gap-1.5 text-xs font-black text-neutral-600">
          <span>Buscar en la carta</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Producto, ingrediente o descripción..." className="min-h-12 w-full min-w-0 max-w-full box-border rounded-2xl border bg-white px-4 font-semibold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-black text-neutral-600">
          <span>Categoría</span>
          <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} className="min-h-12 w-full min-w-0 max-w-full box-border rounded-2xl border bg-white px-4 font-bold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-8 space-y-12">
        {groupedVisible.map((group) => (
          <section key={group.name} aria-labelledby={`categoria-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
            <div className="mb-4 flex items-end justify-between gap-4 border-b border-black/10 pb-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#049ca5]">Categoría</p>
                <h2 id={`categoria-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="mt-1 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">{group.name}</h2>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-5">
              {group.items.map((product) => {
                const extras = extrasForCategory(product.categories?.name, product.name);
                const choices = requiredChoicesFromName(product.name);
                return <ProductCard key={product.id} product={product} extras={extras} requiredChoices={choices} onAdd={() => openProduct(product)} />;
              })}
            </div>
          </section>
        ))}
      </div>
      {productsError && <p role="alert" className="mt-10 rounded-3xl bg-red-50 p-6 font-semibold text-red-800">No hemos podido cargar la carta. Comprueba tu conexión e inténtalo de nuevo en unos minutos.</p>}
      {!productsLoading && !productsError && !products.length && <p className="mt-10 rounded-3xl bg-white p-6">La carta no está disponible en este momento. Inténtalo de nuevo en unos minutos.</p>}
      {!!products.length && !visible.length && <p className="mt-10 rounded-3xl bg-white p-6">No hay productos que coincidan con esa búsqueda o categoría.</p>}
      <CartBar />
      <div className="pointer-events-none fixed left-1/2 top-24 z-[90] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2" aria-live="polite" aria-atomic="true">
        {cartNotice && <div className="animate-soho-notice rounded-2xl bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white shadow-xl" onAnimationEnd={() => setCartNotice('')}>{cartNotice}</div>}
      </div>

      {customizing && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-5" role="dialog" aria-modal="true" aria-labelledby="customization-title">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:rounded-[2rem] md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#049ca5]">Personaliza tu pedido</p><h2 id="customization-title" className="mt-1 text-2xl font-black">{customizing.product.name}</h2><p className="mt-1 text-sm text-neutral-500">Precio base: {formatPrice(Number(customizing.product.price))}</p></div>
              <button type="button" onClick={() => setCustomizing(null)} className="rounded-full border px-4 py-2 font-black" aria-label="Cerrar">×</button>
            </div>

            {customizing.requiredChoices.length > 0 && (
              <fieldset className="mt-6 rounded-3xl border-2 border-amber-300 bg-amber-50 p-4">
                <legend className="px-2 text-sm font-black text-amber-950">Elección obligatoria</legend>
                <p className="mb-3 text-sm text-amber-900">Debes escoger una opción para poder añadir este plato.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {customizing.requiredChoices.map((choice) => (
                    <label key={choice} className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-3 font-bold ${selectedChoice === choice ? 'border-[#049ca5] ring-2 ring-cyan-100' : 'border-black/10'}`}>
                      <input type="radio" name="required-choice" value={choice} checked={selectedChoice === choice} onChange={() => { setSelectedChoice(choice); setCustomizationError(''); }} />
                      {choice}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {customizing.extras.length > 0 && (
              <section className="mt-6">
                <h3 className="text-lg font-black">Extras opcionales</h3>
                <p className="text-sm text-neutral-500">Puedes añadir más de una unidad de cada extra.</p>
                <div className="mt-3 divide-y rounded-3xl border px-4">
                  {customizing.extras.map((extra) => {
                    const quantity = Number(extraQuantities[extra.name] || 0);
                    return (
                      <div key={extra.name} className="flex items-center justify-between gap-4 py-3">
                        <div><strong>{extra.name}</strong><p className="text-sm text-neutral-500">{extra.price === 0 ? 'Sin suplemento' : `+${formatPrice(extra.price)}`}</p></div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setExtraQuantities((current) => ({ ...current, [extra.name]: Math.max(0, quantity - 1) }))} className="h-10 w-10 rounded-xl border font-black">−</button>
                          <span className="w-6 text-center font-black">{quantity}</span>
                          <button type="button" onClick={() => setExtraQuantities((current) => ({ ...current, [extra.name]: Math.min(10, quantity + 1) }))} className="h-10 w-10 rounded-xl border font-black">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {customizationError && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{customizationError}</p>}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t bg-white pt-4">
              <button type="button" onClick={() => setCustomizing(null)} className="rounded-2xl border px-5 py-4 font-black">Cancelar</button>
              <button type="button" onClick={confirmCustomization} className="flex-1 rounded-2xl bg-[#049ca5] px-5 py-4 font-black text-white">Añadir · {formatPrice(customizationTotal)}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
