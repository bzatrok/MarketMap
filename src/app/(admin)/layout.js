import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/AdminShell';

export const metadata = {
  title: 'Admin — Weekmarkten Nederland',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
