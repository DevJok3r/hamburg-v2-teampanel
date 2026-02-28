import { requireAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();
  return (
    <div className="min-h-screen bg-[#0f1117] flex">
      <Sidebar profile={profile} />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 p-4 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}