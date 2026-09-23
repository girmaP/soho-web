export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-slate-100 p-5" aria-busy="true">
      <div className="mx-auto max-w-7xl">
        <div className="h-16 rounded-3xl soho-skeleton" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[240px_1fr]">
          <div className="h-[70vh] rounded-3xl bg-neutral-900 p-5">
            <div className="h-12 w-32 rounded-2xl bg-white/10 animate-pulse" />
            <div className="mt-8 grid gap-3">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-12 rounded-2xl bg-white/10 animate-pulse" />)}
            </div>
          </div>
          <div className="space-y-5">
            <div className="h-24 rounded-3xl soho-skeleton" />
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-3xl soho-skeleton" />)}
            </div>
            <div className="h-80 rounded-3xl soho-skeleton" />
          </div>
        </div>
      </div>
    </main>
  );
}
