export default function MenuLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
      <div className="h-10 w-72 rounded-xl soho-skeleton" />
      <div className="mt-3 h-5 w-full max-w-xl rounded soho-skeleton" />
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5">
            <div className="aspect-[4/3] soho-skeleton" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-3/4 rounded soho-skeleton" />
              <div className="h-4 w-1/3 rounded soho-skeleton" />
              <div className="h-10 rounded-2xl soho-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
