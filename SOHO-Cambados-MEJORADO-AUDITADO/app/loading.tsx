export default function Loading() {
  return (
    <main className="grid min-h-[65vh] place-items-center px-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <img src="/soho-logo-green.png" alt="SOHO Cambados" className="h-auto w-44 object-contain" />
        <div className="mt-6 h-2 w-44 overflow-hidden rounded-full bg-neutral-200">
          <span className="block h-full w-1/2 animate-[soho-loading_1.1s_ease-in-out_infinite] rounded-full bg-[#049ca5]" />
        </div>
        <p className="mt-4 text-sm font-bold text-neutral-600">Cargando SOHO Cambados…</p>
      </div>
    </main>
  );
}
