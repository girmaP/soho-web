import Link from 'next/link';
import { Clock3, MapPin, ShoppingBag, UtensilsCrossed } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sobre nosotros | SOHO Cambados',
  description: 'Conoce SOHO Cambados: cocina urbana, pedidos online y recogida en local en Calle A Mariña, 3, Cambados.'
};

export default function SobreNosotrosPage() {
  return (
    <main className="bg-[#f8f4ee]">
      <section className="relative overflow-hidden bg-neutral-950 bg-[url('/soho-wall-logo.jpg')] bg-cover bg-center px-4 py-20 text-white md:bg-[center_44%]">
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/45" />
        <div className="relative mx-auto max-w-7xl">
          <p className="inline-flex rounded-full bg-[#049ca5] px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-cyan-950/25">
            Sobre SOHO Cambados
          </p>
          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Cocina urbana, servicio rápido y sabor de verdad en Cambados.
          </h1>
          <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-white/85">
            SOHO Cambados nace como un punto de encuentro para disfrutar hamburguesas, entrantes y platos preparados con una propuesta directa: buena comida, pedido sencillo y recogida cómoda en local.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-2xl bg-white px-7 py-4 font-black text-neutral-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-50">
              Ver carta
            </Link>
            <Link href="/#contacto" className="rounded-2xl bg-[#049ca5] px-7 py-4 font-black text-white shadow-xl shadow-cyan-950/25 transition hover:-translate-y-0.5 hover:bg-[#037f86]">
              Contactar
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 md:grid-cols-3">
        <article className="rounded-[2rem] border border-black/10 bg-white p-8 shadow-sm">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#049ca5] text-white shadow-lg shadow-cyan-950/20">
            <UtensilsCrossed size={27} />
          </span>
          <h2 className="mt-6 text-2xl font-black text-neutral-950">Comida con carácter</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-neutral-600">
            Trabajamos una carta pensada para disfrutar sin complicaciones: productos reconocibles, sabores potentes y opciones fáciles de pedir desde cualquier dispositivo.
          </p>
        </article>

        <article className="rounded-[2rem] border border-black/10 bg-white p-8 shadow-sm">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-lg shadow-neutral-950/20">
            <ShoppingBag size={27} />
          </span>
          <h2 className="mt-6 text-2xl font-black text-neutral-950">Pedido online claro</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-neutral-600">
            La web permite preparar el pedido, pagar online y seguir el estado para saber cuándo está aceptado, en preparación o listo para recoger.
          </p>
        </article>

        <article className="rounded-[2rem] border border-black/10 bg-white p-8 shadow-sm">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#049ca5] text-white shadow-lg shadow-cyan-950/20">
            <MapPin size={27} />
          </span>
          <h2 className="mt-6 text-2xl font-black text-neutral-950">En el centro de Cambados</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-neutral-600">
            Estamos en Calle A Mariña, 3, Cambados. Puedes pedir para recogida en local y, si prefieres domicilio, acceder al canal de reparto disponible desde la web.
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-sm md:grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="p-8 md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#049ca5]">Nuestra forma de trabajar</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-neutral-950">Rápido, sencillo y bien explicado.</h2>
            <p className="mt-4 text-base font-semibold leading-8 text-neutral-600">
              Queremos que pedir en SOHO sea tan fácil como elegir, pagar y recoger. Por eso el sistema muestra el estado del pedido y el tiempo estimado cuando el equipo lo confirma desde el panel interno.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-neutral-950 p-6 text-white">
                <Clock3 size={24} />
                <h3 className="mt-4 text-xl font-black">Tiempos estimados</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/75">El equipo puede indicar el tiempo de preparación para que tengas una referencia clara.</p>
              </div>
              <div className="rounded-3xl bg-[#049ca5] p-6 text-white">
                <ShoppingBag size={24} />
                <h3 className="mt-4 text-xl font-black">Seguimiento del pedido</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/85">Cada pedido tiene su página de seguimiento para consultar los cambios importantes.</p>
              </div>
            </div>
          </div>
          <div className="bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.35),transparent_32%),linear-gradient(160deg,#111214,#000)] p-8 text-white md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">SOHO Cambados</p>
            <h3 className="mt-4 text-3xl font-black leading-tight">Una experiencia pensada para el cliente y para el ritmo real de cocina.</h3>
            <p className="mt-5 text-sm font-semibold leading-7 text-white/75">
              Si tienes cualquier duda sobre carta, horarios, pedidos o recogida, puedes usar el formulario de contacto de la web y el equipo recibirá tu mensaje en el panel interno.
            </p>
            <Link href="/#contacto" className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-black text-neutral-950 transition hover:-translate-y-0.5 hover:bg-cyan-50">
              Enviar mensaje
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
