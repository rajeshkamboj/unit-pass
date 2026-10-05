import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UnitPass',
  description: 'Turn Every HVAC Installation Into Repeat Service Revenue.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-6">
        <div className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 19.5c-5.416 0-9.75-4.334-9.75-9.75S6.584 2.25 12 2.25s9.75 4.334 9.75 9.75-4.334 9.75-9.75 9.75z" />
          </svg>
        </div>
        <div className="w-full space-y-4">{children}</div>
      </div>
    </div>
  );
}