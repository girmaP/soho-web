import type { Metadata } from 'next';
import { AdminKitchenScheduleInline } from '@/components/AdminKitchenScheduleInline';

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
      <AdminKitchenScheduleInline />
    </>
  );
}
