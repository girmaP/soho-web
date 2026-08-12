export const metadata = {
  title: 'Condiciones de pedido',
  description:
    'Consulta las condiciones de los pedidos online, pagos, preparación, recogida y cancelaciones de SOHO Cambados.',
  alternates: {
    canonical: '/condiciones'
  }
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#049ca5]">
          Pedidos
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Condiciones de pedido
        </h1>

        <h2 className="mt-6 text-xl font-black">
          Cómo funciona
        </h2>

        <p className="mt-2 text-neutral-700">
          Elige tus productos, revisa el pedido y completa el pago online.
          Después podrás seguir su estado en tiempo real desde el enlace privado
          de seguimiento.
        </p>

        <h2 className="mt-6 text-xl font-black">
          Pago y preparación
        </h2>

        <p className="mt-2 text-neutral-700">
          Stripe realizará una autorización temporal. El cobro se completa
          cuando SOHO marca el pedido como “En preparación”. Si el pedido se
          rechaza antes de ese momento, la autorización se libera sin cargo
          definitivo.
        </p>

        <h2 className="mt-6 text-xl font-black">
          Seguimiento y recogida
        </h2>

        <p className="mt-2 text-neutral-700">
          Mantén abierta la página de seguimiento para consultar el tiempo
          estimado y recibir las actualizaciones. Te avisaremos cuando el pedido
          esté listo para recoger. Los tiempos son orientativos y pueden variar
          según la carga de trabajo.
        </p>

        <h2 className="mt-6 text-xl font-black">
          Cancelaciones y devoluciones
        </h2>

        <p className="mt-2 text-neutral-700">
          Una vez iniciada la preparación, el pedido no puede cancelarse
          automáticamente. En casos excepcionales, SOHO podrá tramitar un
          reembolso; el plazo para verlo reflejado depende de la entidad
          bancaria.
        </p>
      </section>
    </main>
  );
}