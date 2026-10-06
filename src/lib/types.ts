export type CompanyRow = {
  id: string;
  name: string;
  logo_url: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  default_service_interval: number;
  created_at: string;
  updated_at: string;
};

export type CompanyMemberRow = {
  id: string;
  user_id: string;
  company_id: string;
  role: 'owner' | 'admin' | 'technician';
  created_at: string;
};

export type ProfileRow = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
};

export type SessionUser = {
  id: string;
  email: string | null;
};

export type Membership = {
  companyId: string;
  role: CompanyMemberRow['role'];
  company: CompanyRow;
};
