import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carta online',
  description:
    'Consulta la carta de SOHO Cambados, personaliza tus platos y realiza tu pedido online para recoger en el local.',
  alternates: {
    canonical: '/menu'
  }
};

export default function MenuLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}