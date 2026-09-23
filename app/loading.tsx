export default function Loading() {
  return (
    <main className="grid min-h-[65vh] place-items-center overflow-hidden px-4" aria-busy="true" aria-live="polite">
      <div className="relative flex flex-col items-center text-center">
        <span className="absolute -inset-16 -z-10 rounded-full bg-cyan-300/20 blur-3xl animate-pulse" />
        <img src="/soho-logo-green.png" alt="SOHO Cambados" className="soho-float h-auto w-44 object-contain drop-shadow-xl" />
        <div className="mt-7 h-2.5 w-48 overflow-hidden rounded-full bg-neutral-200 shadow-inner">
          <span className="block h-full w-1/2 animate-[soho-loading_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#049ca5] to-cyan-300 shadow-[0_0_18px_rgba(4,156,165,.45)]" />
        </div>
        <p className="mt-4 animate-pulse text-sm font-black text-neutral-600">Cargando SOHO Cambados…</p>
      </div>
    </main>
  );
}
