import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carta online: hamburguesas y bocadillos',
  description:
    'Consulta la carta de SOHO Cambados: hamburguesas, bocadillos, tostas, pasta, platos combinados y bebidas. Pide online para recoger en el local.',
  alternates: {
    canonical: '/menu'
  }
};

const menuStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Menu',
  name: 'Carta de SOHO Cambados',
  url: 'https://www.sohocambados.es/menu',
  inLanguage: 'es',
  hasMenuSection: [
    'Hamburguesas',
    'Hamburguesas premium',
    'Bocadillos',
    'Bocadillos especiales',
    'Tostas',
    'Pastas',
    'Platos combinados',
    'Ensaladas',
    'Nuggets y fingers',
    'Bebidas'
  ].map((name) => ({ '@type': 'MenuSection', name }))
};

export default function MenuLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuStructuredData) }}
      />
      {children}
    </>
  );
}
