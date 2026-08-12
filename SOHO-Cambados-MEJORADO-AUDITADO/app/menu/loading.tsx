export default function MenuLoading() {
  return <main className="mx-auto max-w-6xl px-4 py-8" aria-busy="true"><div className="animate-pulse"><div className="h-10 w-72 rounded-xl bg-neutral-200"/><div className="mt-3 h-5 w-full max-w-xl rounded bg-neutral-200"/><div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-5">{Array.from({length:9}).map((_,i)=><div key={i} className="h-72 rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5"/>)}</div></div></main>;
}
