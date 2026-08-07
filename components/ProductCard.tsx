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
  const customizable = extras.length > 0 || requiredChoices.length > 0;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
      <div className="aspect-[4/3] bg-neutral-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-bold text-neutral-400 sm:text-xs">Sin foto</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-4">
        <div className="min-w-0">
          <h3 className="break-words text-[11px] font-black leading-[1.25] text-neutral-950 sm:text-base">{product.name}</h3>
          <strong className="mt-1 block text-[11px] font-black text-[#047f86] sm:text-sm">{formatPrice(Number(product.price))}</strong>
        </div>
        {description && <p className="mt-2 hidden text-sm leading-5 text-neutral-600 sm:line-clamp-3 sm:block">{description}</p>}
        {requiredChoices.length > 0 && (
          <p className="mt-2 hidden rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 sm:block">
            Elección obligatoria: {requiredChoices.join(' o ')}.
          </p>
        )}
        {extras.length > 0 && (
          <p className="mt-2 hidden text-xs leading-5 text-neutral-500 lg:block">
            <strong className="text-neutral-700">Extras disponibles:</strong>{' '}
            {extras.map((extra) => `${extra.name} (${extra.price === 0 ? 'sin suplemento' : `+${formatPrice(extra.price)}`})`).join(', ')}.
          </p>
        )}
        <button onClick={onAdd} className="mt-auto pt-3">
          <span className="flex min-h-9 w-full items-center justify-center rounded-xl bg-[#049ca5] px-2 text-[10px] font-black leading-tight text-white transition hover:bg-[#037f86] sm:min-h-11 sm:rounded-2xl sm:px-3 sm:text-sm">
            <span className="sm:hidden">{customizable ? 'Elegir' : 'Añadir'}</span>
            <span className="hidden sm:inline">{customizable ? 'Personalizar y añadir' : 'Añadir al pedido'}</span>
          </span>
        </button>
      </div>
    </article>
  );
}
