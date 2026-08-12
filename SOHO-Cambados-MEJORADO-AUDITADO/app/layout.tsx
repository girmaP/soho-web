import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/siteConfig';
import {
  Facebook,
  Instagram,
  MapPin,
  Phone,
  Mail,
  MessageCircle
} from 'lucide-react';

const siteUrl = 'https://www.sohocambados.es';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'SOHO Cambados | Pedidos online',
    template: '%s | SOHO Cambados'
  },

  description:
    'Carta online de SOHO Cambados, pedidos para recoger y acceso al reparto a domicilio.',

  alternates: {
    canonical: '/'
  },

  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'SOHO Cambados',
    title: 'SOHO Cambados | Pedidos online',
    description:
      'Consulta la carta, pide online y recoge en el local de Cambados.',
    url: siteUrl,
    images: [
      {
        url: '/soho-logo-green.png',
        width: 1200,
        height: 400,
        alt: 'Logo de SOHO Cambados'
      }
    ]
  },

  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: siteConfig.name,
    url: siteUrl,
    image: new URL(siteConfig.logoPath, siteUrl).toString(),
    telephone: siteConfig.phoneDisplay,
    email: siteConfig.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Calle A Mariña, 3',
      postalCode: '36630',
      addressLocality: 'Cambados',
      addressRegion: 'Pontevedra',
      addressCountry: 'ES'
    },
    sameAs: [
      siteConfig.instagramUrl,
      siteConfig.facebookUrl
    ],
    servesCuisine: [
      'Hamburguesas',
      'Bocadillos',
      'Cocina informal'
    ]
  };

  return (
    <html lang="es">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData)
          }}
        />

        <header className="sticky top-0 z-40 h-[72px] overflow-visible border-b border-black/5 bg-white/95 backdrop-blur-xl">
          <nav
            className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4"
            aria-label="Navegación principal"
          >
            <Link
              href="/"
              className="relative z-10 flex h-full min-w-[150px] items-center"
              aria-label="Inicio de SOHO Cambados"
            >
              <img
                src={siteConfig.logoPath}
                alt="SOHO Cambados"
                className="h-auto w-36 object-contain sm:w-44"
              />
            </Link>

            <div className="flex items-center gap-3 text-sm font-bold sm:gap-5">
              <Link href="/menu">Carta</Link>
              <Link href="/checkout">Carrito</Link>
              <a
                href={siteConfig.cayluUrl}
                target="_blank"
                rel="noreferrer"
              >
                Domicilio
              </a>
            </div>
          </nav>
        </header>

        {children}

        <footer className="bg-[#111214] text-white">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <div className="grid gap-8 border-b border-white/15 pb-8 md:grid-cols-5">
              <div>
                <div className="inline-grid h-28 w-28 place-items-center rounded-full bg-[#049ca5] p-[3px] shadow-lg shadow-black/25">
                  <img
                    src={siteConfig.compactLogoPath}
                    alt="SOHO Cambados"
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>

                <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-white/70">
                  Carta online, pago seguro y recogida cómoda en el local.
                </p>

                <div className="mt-5 flex gap-3 text-white/80">
                  <a
                    href={siteConfig.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram de SOHO Cambados"
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/20 transition hover:border-[#049ca5] hover:bg-[#049ca5] hover:text-white"
                  >
                    <Instagram size={19} aria-hidden="true" />
                  </a>

                  <a
                    href={siteConfig.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook de SOHO Cambados"
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/20 transition hover:border-[#049ca5] hover:bg-[#049ca5] hover:text-white"
                  >
                    <Facebook size={19} aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black">Navegación</h3>

                <div className="mt-4 grid gap-3 text-sm text-white/70">
                  <Link href="/menu">Carta</Link>
                  <Link href="/checkout">Carrito</Link>
                  <a
                    href={siteConfig.cayluUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reparto a domicilio
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black">Información</h3>

                <div className="mt-4 grid gap-3 text-sm text-white/70">
                  <Link href="/sobre-nosotros">Sobre nosotros</Link>
                  <Link href="/#contacto">Contacto</Link>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black">Ayuda</h3>

                <div className="mt-4 grid gap-3 text-sm text-white/70">
                  <Link href="/preguntas-frecuentes">
                    Preguntas frecuentes
                  </Link>
                  <Link href="/condiciones">
                    Condiciones de pedido
                  </Link>
                  <Link href="/cookies">
                    Política de cookies
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black">Contacto</h3>

                <div className="mt-4 grid gap-3 text-sm text-white/70">
                  <a
                    className="flex items-center gap-2"
                    href={siteConfig.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={16} aria-hidden="true" />
                    {siteConfig.shortAddress}
                  </a>

                  <a
                    className="flex items-center gap-2"
                    href={`tel:${siteConfig.phoneHref}`}
                  >
                    <Phone size={16} aria-hidden="true" />
                    {siteConfig.phoneDisplay}
                  </a>

                  <a
                    className="flex items-center gap-2"
                    href={`mailto:${siteConfig.email}`}
                  >
                    <Mail size={16} aria-hidden="true" />
                    {siteConfig.email}
                  </a>

                  <a
                    className="flex items-center gap-2"
                    href={`https://wa.me/${siteConfig.whatsappHref}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-6 text-xs text-white/50">
              <Link href="/legal">Aviso legal</Link>
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/condiciones">
                Condiciones de pedido
              </Link>
              <Link href="/cookies">Cookies</Link>

              <span className="hidden h-4 w-px bg-white/20 sm:block" />

              <p>
                © 2026 SOHO Cambados. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}