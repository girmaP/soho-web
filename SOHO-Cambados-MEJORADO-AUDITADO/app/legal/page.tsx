export const metadata = {
  title: 'Aviso legal',
  description:
    'Consulta la información legal, las condiciones del servicio y la gestión de pedidos online de SOHO Cambados.',
  alternates: {
    canonical: '/legal'
  }
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#049ca5]">
          Información legal
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Aviso legal
        </h1>

        <p className="mt-4 text-neutral-700">
          Esta web permite consultar la carta de SOHO Cambados, preparar un
          pedido para recoger, pagarlo online y seguir su estado hasta que esté
          listo.
        </p>

        <p className="mt-4 text-neutral-700">
          SOHO podrá aceptar o rechazar el pedido según disponibilidad, horario,
          volumen de trabajo o incidencias. Los precios y condiciones mostrados
          durante la compra son los aplicables al pedido confirmado.
        </p>

        <p className="mt-4 text-neutral-700">
          Para cualquier consulta sobre un pedido, disponibilidad o condiciones
          del servicio, puedes contactar con el equipo de SOHO a través de los
          datos publicados en esta web.
        </p>
      </section>
    </main>
  );
}