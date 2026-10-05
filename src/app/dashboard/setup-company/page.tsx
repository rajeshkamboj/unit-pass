import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SetupCompanyPage() {
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    contactName: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    defaultServiceInterval: 12,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const router = useRouter();

  // Check if the user already has a company and redirect to dashboard if so
  useEffect(() => {
    async function checkCompany() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/sign-in');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (profile?.company_id) {
          router.push('/dashboard');
        }
      } catch (err) {
        // If there's an error, we'll let the user try to set up a company
        console.error('Error checking company:', err);
      }
    }

    checkCompany();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First, create the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            name: formData.name,
            logo_url: formData.logo || undefined,
            contact_name: formData.contactName,
            phone: formData.phone,
            email: formData.email,
            website: formData.website || undefined,
            address: formData.address,
            default_service_interval: formData.defaultServiceInterval,
          },
        ])
        .select()
        .single();

      if (companyError) throw companyError;

      // Then, create a profile for the user linked to the company
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          company_id: company.id,
          full_name: formData.contactName,
        });

      if (profileError) throw profileError;

      // Finally, create a company member record (owner role)
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          user_id: user.id,
          company_id: company.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      setSuccess(true);
      setLoading(false);
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4">Company Created!</h2>
          <p className="text-gray-600 mb-6">
            Your company has been successfully created. You're now ready to
            start adding equipment and generating QR codes.
          </p>
          <div className="flex justify-center">
            <a
              href="/dashboard"
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 p-8 bg-white rounded-lg shadow">
        <div className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 19.5c-5.416 0-9.75-4.334-9.75-9.75S6.584 2.25 12 2.25s9.75 4.334 9.75 9.75-4.334 9.75-9.75 9.75z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-center mb-4">Create Your Company Profile</h2>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1">
              Logo URL (optional)
            </label>
            <input
              id="logo"
              type="text"
              value={formData.logo}
              onChange={(e) => setFormData((prev) => ({ ...prev, logo: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
              Contact Name
            </label>
            <input
              id="contactName"
              type="text"
              required
              value={formData.contactName}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
              Website (optional)
            </label>
            <input
              id="website"
              type="text"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              id="address"
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="defaultServiceInterval" className="block text-sm font-medium text-gray-700 mb-1">
              Default Service Interval (months)
            </label>
            <input
              id="defaultServiceInterval"
              type="number"
              min="1"
              value={formData.defaultServiceInterval}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                defaultServiceInterval: parseInt(e.target.value) || 12,
              }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating Company...' : 'Create Company'}
        </button>
      </form>
    </div>
  );
}