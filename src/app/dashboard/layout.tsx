import { Sidebar } from '@/components/Sidebar';
import { useAuthStatus } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UnitPass Dashboard',
  description: 'Manage your HVAC equipment and service reminders.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuthStatus();
  const router = useRouter();

  // If the user is not authenticated, redirect to sign-in
  if (status !== 'authenticated') {
    router.push('/auth/sign-in');
    return null; // Prevent rendering while redirecting
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <div className="flex items-center gap-3">
                <button className="text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors">
                  Profile
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="container mx-auto px-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}