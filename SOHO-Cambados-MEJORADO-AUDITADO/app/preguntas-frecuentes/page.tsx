import Link from 'next/link';
import {
  HelpCircle,
  Mail,
  ShoppingBag
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Preguntas frecuentes',
  description:
    'Resuelve dudas sobre pedidos online, recogida, pago, seguimiento y contacto con SOHO Cambados.',
  alternates: {
    canonical: '/preguntas-frecuentes'
  }
};

const faqs = [
  {
    question: '¿Cómo hago un pedido para recoger en local?',
    answer:
      'Entra en la carta, añade los productos al carrito y confirma el pedido con tus datos. Después del pago, recibirás una página de seguimiento donde podrás ver si el pedido está pendiente, aceptado, en preparación, listo o cancelado.'
  },
  {
    question: '¿Dónde recojo mi pedido?',
    answer:
      'Los pedidos para recogida se preparan en SOHO Cambados, en Calle A Mariña, 3, Cambados. Cuando el pedido aparezca como listo, puedes acercarte al local para recogerlo.'
  },
  {
    question: '¿Cómo sé cuánto tarda mi pedido?',
    answer:
      'Cuando el equipo acepta el pedido, puede indicar un tiempo estimado de preparación. Ese tiempo aparece en la página de seguimiento para que tengas una referencia clara antes de venir.'
  },
  {
    question: '¿Puedo pedir a domicilio?',
    answer:
      'Para reparto a domicilio, la web te dirige al canal de delivery disponible de SOHO. Desde la navegación puedes acceder a Caylu y realizar el pedido según las condiciones de esa plataforma.'
  },
  {
    question: '¿Qué pasa si mi pedido se cancela?',
    answer:
      'Si el pedido se cancela, en la página de seguimiento verás el estado cancelado y el motivo indicado por SOHO. Puede deberse a producto no disponible, cocina cerrada, alta demanda, necesidad de confirmar datos u otra incidencia concreta.'
  },
  {
    question: '¿Puedo modificar un pedido ya enviado?',
    answer:
      'Si necesitas cambiar algo, contacta con SOHO cuanto antes. Si el pedido ya está en preparación, puede que no sea posible modificarlo, pero el equipo intentará ayudarte según el estado del pedido.'
  },
  {
    question: '¿El pago online es seguro?',
    answer:
      'Sí. El pago se realiza mediante Stripe, una pasarela segura de pago con tarjeta. SOHO no guarda los datos completos de tu tarjeta en la web.'
  },
  {
    question: 'No encuentro mi pedido, ¿qué hago?',
    answer:
      'Revisa que estés usando el enlace de seguimiento correcto. Si sigues teniendo problemas, envía un mensaje desde contacto indicando tu nombre, teléfono y cualquier dato del pedido para que SOHO pueda revisarlo.'
  }
];

export default function PreguntasFrecuentesPage() {
  return (
    <main className="bg-[#f8f4ee]">
      <section className="relative overflow-hidden bg-neutral-950 px-4 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.38),transparent_34%),linear-gradient(135deg,#050505,#151515_55%,#2b1205)]" />

        <div className="relative mx-auto max-w-7xl">
          <p className="inline-flex rounded-full bg-[#049ca5] px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-cyan-950/25">
            Ayuda SOHO
          </p>

          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Preguntas frecuentes sobre pedidos y recogida.
          </h1>

          <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-white/85">
            Aquí tienes las respuestas más importantes para pedir online, seguir
            tu pedido y contactar con SOHO Cambados si necesitas ayuda.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-black text-neutral-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-50"
            >
              <ShoppingBag size={19} />
              Ver carta
            </Link>

            <Link
              href="/#contacto"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#049ca5] px-7 py-4 font-black text-white shadow-xl shadow-cyan-950/25 transition hover:-translate-y-0.5 hover:bg-[#037f86]"
            >
              <Mail size={19} />
              Contactar o enviar mensaje
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-4">
          {faqs.map((item, index) => (
            <article
              key={item.question}
              className="rounded-[1.75rem] border border-black/10 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#049ca5] text-white shadow-md shadow-cyan-950/15">
                  <HelpCircle size={22} />
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#049ca5]">
                    Pregunta {index + 1}
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                    {item.question}
                  </h2>

                  <p className="mt-3 text-base font-semibold leading-8 text-neutral-600">
                    {item.answer}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-[2rem] bg-neutral-950 p-8 text-white shadow-xl md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              ¿Sigues con dudas?
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Envía un mensaje a SOHO.
            </h2>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              Usa el formulario de contacto para consultar horarios, pedidos,
              incidencias o cualquier pregunta concreta. Tu mensaje llegará
              directamente al equipo de SOHO.
            </p>
          </div>

          <Link
            href="/#contacto"
            className="mt-6 inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#049ca5] px-7 py-4 font-black text-white shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-[#037f86] md:mt-0"
          >
            <Mail size={19} />
            Contactar o enviar mensaje
          </Link>
        </div>
      </section>
    </main>
  );
}