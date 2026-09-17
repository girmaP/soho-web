import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Administración',
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Link
        href="/admin/cocina"
        className="fixed bottom-4 right-4 z-[120] rounded-2xl bg-[#049ca5] px-4 py-3 text-sm font-black text-white shadow-xl shadow-black/20 transition hover:bg-[#037f86]"
      >
        Horario de cocina
      </Link>
    </>
  );
}
