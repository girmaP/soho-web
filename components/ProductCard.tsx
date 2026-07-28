'use client';

import { formatPrice } from '@/utils/formatPrice';
import { Product } from '@/types/database';
import { ProductExtra } from '@/lib/productCustomization';

function cleanDescription(value?: string | null) {
  const description = (value || '').trim();
  if (!description) return '';
  if (/^producto de la categor[ií]a/i.test(description)) return '';
  if (/para retirar ingredientes/i.test(description)) return '';
  return description;
}

export function ProductCard({
  product,
  extras,
  requiredChoices,
  onAdd
}: {
  product: Product;
  extras: ProductExtra[];
  requiredChoices: string[];
  onAdd: () => void;
}) {
  const description = cleanDescription(product.description);
  return (
    <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="relative h-40 bg-neutral-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">Sin foto</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold">{product.name}</h3>
          <strong className="whitespace-nowrap">{formatPrice(Number(product.price))}</strong>
        </div>
        {description && <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>}
        {requiredChoices.length > 0 && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            Elección obligatoria: {requiredChoices.join(' o ')}.
          </p>
        )}
        {extras.length > 0 && (
          <p className="mt-3 text-xs leading-5 text-neutral-500">
            <strong className="text-neutral-700">Extras disponibles:</strong>{' '}
            {extras.map((extra) => `${extra.name} (${extra.price === 0 ? 'sin suplemento' : `+${formatPrice(extra.price)}`})`).join(', ')}.
          </p>
        )}
        <button onClick={onAdd} className="mt-4 w-full rounded-2xl bg-[#049ca5] px-4 py-3 font-bold text-white transition hover:bg-[#037f86]">
          {extras.length || requiredChoices.length ? 'Personalizar y añadir' : 'Añadir al pedido'}
        </button>
      </div>
    </article>
  );
}
