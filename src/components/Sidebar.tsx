import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/auth';

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="flex items-center px-4 py-6">
        <Link href="/dashboard" className="flex items-center space-x-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 19.5c-5.416 0-9.75-4.334-9.75-9.75S6.584 2.25 12 2.25s9.75 4.334 9.75 9.75-4.334 9.75-9.75 9.75z" />
          </svg>
          <span className="font-semibold text-lg">UnitPass</span>
        </Link>
      </div>
      <nav className="mt-6 space-y-1">
        <Link
          href="/dashboard"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 7.586V3a1 1 0 10-2 0v4.586l-.293-.293z" clipRule="evenodd" />
          </svg>
          Dashboard
        </Link>
        <Link
          href="/dashboard/customers"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard/customers') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Customers
        </Link>
        <Link
          href="/dashboard/equipment"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard/equipment') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 4a1 1 0 100 2v2.586l-2.293 2.293a1 1 0 001.415 1.415L12 10.414V16a1 1 0 102 0v-4a1 1 0 00-.586-1.415l-.707-.707A1 1 0 0010 7.586V4a1 1 0 100-2zM5 4a1 1 0 100 2H3a1 1 0 000-2h2z" clipRule="evenodd" />
          </svg>
          Equipment
        </Link>
        <Link
          href="/dashboard/services"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard/services') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 7a3 3 0 100-6 3 3 0 000 6zm4 8a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Services
        </Link>
        <Link
          href="/dashboard/documents"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard/documents') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v5.172l2 2V4a2 2 0 012-2h2zm4 0a2 2 0 00-2 2v5.172l2 2V4a2 2 0 012-2h2zm4 0a2 2 0 00-2 2v5.172l2 2V4a2 2 0 012-2h2zm-4 9a2 2 0 00-2 2v2H6v-2a2 2 0 00-2-2 2 2 0 002-2h2a2 2 0 002 2v2h2a2 2 0 002-2v-2a2 2 0 00-2-2z" clipRule="evenodd" />
          </svg>
          Documents
        </Link>
        <Link
          href="/dashboard/billing"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard/billing') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2 3a1 1 0 011-1h2.586l1.293-1.293a1 1 0 111.414 1.414L9.414 7H18a1 1 0 010 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414L4 8.586V18a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" clipRule="evenodd" />
          </svg>
          Billing
        </Link>
        <Link
          href="/dashboard/settings"
          className={`flex items-center px-4 py-3 text-sm font-medium ${isActive('/dashboard/settings') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.764 17.764a1 1 0 01-1.414-1.414l1.414-1.414A3 3 0 019 12v1a3 3 0 00-5.236 2.236zm10.472-8.472a3 3 0 00-5.236-2.236 1 1 0 01-1.414-1.414l1.414-1.414A1 1 0 015 5.757V4a1 1 0 012 0v1.757a1 1 0 01.586.807l1.06-1.06a1 1 0 111.414 1.414l1.224 1.224a3 3 0 004.242-4.242zm-3.536 5.036a1 1 0 01-1.414 1.414l-1.414 1.414a1 1 0 01-1.414-1.414l1.414-1.414a1 1 0 011.414 1.414zM9 18a1 1 0 01-1.414-1.414l1.414-1.414A3 3 0 009 15v3a3 3 0 002.598-.732l1.06-1.06a1 1 0 011.414 1.414l1.224 1.224a3 3 0 00-4.242 4.242z" clipRule="evenodd" />
          </svg>
          Settings
        </Link>
      </nav>
      <div className="mt-auto px-4 py-4 border-t border-gray-200">
        <button
          onClick={signOut}
          className="w-full flex items-center px-3 py-2 text-left text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a1 1 0 112 0v1h10a1 1 0 110 2H7v1h9a1 1 0 110 2H4v1a1 1 0 11-2 0V4z" clipRule="evenodd" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}