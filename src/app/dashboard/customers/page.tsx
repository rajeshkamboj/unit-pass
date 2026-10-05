import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      setLoading(true);
      // Get the current user's company
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCustomers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;

    supabase.from('customers').delete().eq('id', id).then(() => {
      setCustomers(customers.filter((c) => c.id !== id));
    });
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-6">
          {error}
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">Failed to load customers.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <button
          onClick={() => router.push('/dashboard/customers/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">You haven't added any customers yet.</p>
          <button
            onClick={() => router.push('/dashboard/customers/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Your First Customer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => (
            <div key={customer.id} className="bg-white p-4 rounded-lg shadow border">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">
                    {customer.first_name} {customer.last_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {customer.email || 'No email'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {customer.phone || 'No phone'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {customer.address}, {customer.city}, {customer.state}
                    {customer.postal_code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      router.push(`/dashboard/customers/${customer.id}/edit`)
                    }
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}