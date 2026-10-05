import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalEquipment: 0,
    dueSoon: 0,
    overdue: 0,
  });
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Get the current user's company
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get the user's company ID from profiles or company_members
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const companyId = profile.company_id;

      // Fetch stats
      const [
        customersRes,
        equipmentRes,
        dueSoonRes,
        overdueRes,
        upcomingRes,
      ] = await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId),
        supabase
          .from('equipment')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId),
        supabase
          .from('equipment')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .gte('next_service_date', new Date())
          .lte('next_service_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        supabase
          .from('equipment')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .lt('next_service_date', new Date()),
        supabase
          .from('equipment')
          .select(
            'id, customer_id, equipment_name, next_service_date, status'
          )
          .eq('company_id', companyId)
          .order('next_service_date', { ascending: true })
          .limit(5),
      ]);

      // Get customer names for upcoming services
      const upcomingWithCustomers = await Promise.all(
        upcomingRes.data?.map(async (equip) => {
          const { data: customer } = await supabase
            .from('customers')
            .select('first_name, last_name, phone, email')
            .eq('id', equip.customer_id)
            .single();
          return {
            ...equip,
            customer: customer
              ? `${customer.first_name} ${customer.last_name}`
              : 'Unknown',
            phone: customer?.phone || '',
            email: customer?.email || '',
          };
        }) || []
      );

      setStats({
        totalCustomers: customersRes.count || 0,
        totalEquipment: equipmentRes.count || 0,
        dueSoon: dueSoonRes.count || 0,
        overdue: overdueRes.count || 0,
      });
      setUpcomingServices(upcomingWithCustomers);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Total Customers</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Total Equipment</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalEquipment}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Due Next 30 Days</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.dueSoon}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Overdue</h3>
          <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Upcoming Services</h2>
        {upcomingServices.length === 0 ? (
          <p className="text-gray-500">No upcoming services.</p>
        ) : (
          <div className="space-y-4">
            {upcomingServices.map((service) => (
              <div key={service.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{service.customer}</h3>
                    <p className="text-sm text-gray-500">{service.equipment_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {new Date(service.next_service_date).toLocaleDateString()}
                    </p>
                    <span className={`px-2 py-1 text-xs rounded ${
                      new Date(service.next_service_date) < new Date()
                        ? 'bg-red-100 text-red-800'
                        : new Date(service.next_service_date) <
                          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                    >
                      {new Date(service.next_service_date) < new Date()
                        ? 'Overdue'
                        : new Date(service.next_service_date) <
                          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        ? 'Due Soon'
                        : 'Upcoming'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.996 1.884z" />
                  </svg>
                  {service.phone}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.056 3.056A2 2 0 015.27 3h13.46a2 2 0 011.966.748l1.418 1.418A2 2 0 0120 5.27v11.46a2 2 0 01-1.966 1.748l-1.418 1.418A2 2 0 0116.73 21H5.27a2 2 0 01-1.966-.748l-1.418-1.418A2 2 0 013 14.727V5.27a2 2 0 01.056-2.214z" />
                  </svg>
                  {service.email}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}