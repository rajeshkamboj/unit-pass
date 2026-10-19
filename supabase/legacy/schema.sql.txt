-- Supabase schema for UnitPass
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  company_id uuid references companies,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Companies table
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  contact_name text,
  phone text,
  email text,
  website text,
  address text,
  default_service_interval integer default 12,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Company members (to manage roles and access)
create table company_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade,
  company_id uuid references companies on delete cascade,
  role text check (role in ('owner', 'admin', 'technician')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, company_id)
);

-- Customers table
create table customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Equipment types enum
create type equipment_type as enum (
  'Air Conditioner',
  'Furnace',
  'Heat Pump',
  'Mini Split',
  'Boiler',
  'Air Handler',
  'Other'
);

-- Equipment status enum
create type equipment_status as enum (
  'Active',
  'Inactive',
  'Replaced'
);

-- Equipment table
create table equipment (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies on delete cascade not null,
  customer_id uuid references customers on delete cascade not null,
  equipment_name text not null,
  equipment_type equipment_type not null,
  manufacturer text,
  model_number text,
  serial_number text,
  installation_date date,
  warranty_expiration_date date,
  warranty_notes text,
  next_service_date date,
  service_interval integer, -- in months
  installer_notes text, -- private
  public_notes text,
  equipment_photo_url text,
  status equipment_status default 'Active',
  public_token uuid default uuid_generate_v4() unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Service types enum
create type service_type as enum (
  'Installation',
  'Maintenance',
  'Repair',
  'Inspection',
  'Warranty Service',
  'Other'
);

-- Service records table
create table service_records (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid references equipment on delete cascade not null,
  service_date date not null,
  service_type service_type not null,
  technician_name text,
  public_notes text,
  private_notes text,
  next_service_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Document types enum
create type document_type as enum (
  'Warranty',
  'User Manual',
  'Installation Invoice',
  'Service Report',
  'Other'
);

-- Document visibility enum
create type document_visibility as enum (
  'Public',
  'Private'
);

-- Documents table
create table documents (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid references equipment on delete cascade not null,
  name text not null,
  type document_type not null,
  file_url text not null,
  visibility document_visibility not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Reminder types enum
create type reminder_type as enum (
  'Service Due',
  'Service Overdue'
);

-- Reminder status enum
create type reminder_status as enum (
  'Pending',
  'Sent',
  'Failed'
);

-- Reminders table
create table reminders (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies on delete cascade not null,
  equipment_id uuid references equipment on delete cascade not null,
  reminder_type reminder_type not null,
  sent_at timestamp with time zone,
  status reminder_status default 'Pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Subscription plans enum
create type subscription_plan as enum (
  'Starter',
  'Growth',
  'Pro'
);

-- Subscription status enum
create type subscription_status as enum (
  'Active',
  'Past Due',
  'Canceled',
  'Incomplete',
  'Incomplete Expired',
  'Trialing'
);

-- Subscriptions table
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies on delete cascade not null,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan subscription_plan not null,
  status subscription_status not null,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Policies
-- We'll enable RLS on each table and create policies

-- Profiles: users can only see their own profile
alter table profiles enable row level security;
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Companies: users can only see their company if they are a member
alter table companies enable row level security;
create policy "Members can view their company"
  on companies for select
  using (
    exists (
      select 1 from company_members
      where company_members.company_id = companies.id
      and company_members.user_id = auth.uid()
    )
  );
create policy "Members can update their company"
  on companies for update
  using (
    exists (
      select 1 from company_members
      where company_members.company_id = companies.id
      and company_members.user_id = auth.uid()
      and company_members.role in ('owner', 'admin')
    )
  );
-- Insert policy for companies: only authenticated users can insert, and they must be creating a company (we'll handle in the backend)
-- For simplicity, we'll allow insert if the user is authenticated (we'll check in the frontend that they are creating a company on signup)
create policy "Authenticated users can insert companies"
  on companies for insert
  with check (auth.role() = 'authenticated');

-- Company members: users can only see members of their own company
alter table company_members enable row level security;
create policy "Members can view company members of their company"
  on company_members for select
  using (
    exists (
      select 1 from company_members as cm
      where cm.company_id = company_members.company_id
      and cm.user_id = auth.uid()
    )
  );
create policy "Members can insert company members for their company (if owner/admin)"
  on company_members for insert
  with check (
    exists (
      select 1 from company_members as cm
      where cm.company_id = company_members.company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
    )
  );
create policy "Members can update company members for their company (if owner/admin)"
  on company_members for update
  using (
    exists (
      select 1 from company_members as cm
      where cm.company_id = company_members.company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
    )
  );
create policy "Members can delete company members for their company (if owner/admin)"
  on company_members for delete
  using (
    exists (
      select 1 from company_members as cm
      where cm.company_id = company_members.company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
    )
  );

-- Customers: users can only see customers of their company
alter table customers enable row level security;
create policy "Members can view customers of their company"
  on customers for select
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can insert customers for their company"
  on customers for insert
  with check (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can update customers of their company"
  on customers for update
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can delete customers of their company"
  on customers for delete
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

-- Equipment: users can only see equipment of their company
alter table equipment enable row level security;
create policy "Members can view equipment of their company"
  on equipment for select
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can insert equipment for their company"
  on equipment for insert
  with check (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can update equipment of their company"
  on equipment for update
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can delete equipment of their company"
  on equipment for delete
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

-- Service records: users can only see service records for equipment of their company
alter table service_records enable row level security;
create policy "Members can view service records for their company's equipment"
  on service_records for select
  using (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );
create policy "Members can insert service records for their company's equipment"
  on service_records for insert
  with check (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );
create policy "Members can update service records for their company's equipment"
  on service_records for update
  using (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );
create policy "Members can delete service records for their company's equipment"
  on service_records for delete
  using (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );

-- Documents: users can only see documents for equipment of their company
alter table documents enable row level security;
create policy "Members can view documents for their company's equipment"
  on documents for select
  using (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );
create policy "Members can insert documents for their company's equipment"
  on documents for insert
  with check (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );
create policy "Members can update documents for their company's equipment"
  on documents for update
  using (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );
create policy "Members can delete documents for their company's equipment"
  on documents for delete
  using (
    equipment_id in (
      select id from equipment where company_id in (
        select company_id from company_members where user_id = auth.uid()
      )
    )
  );

-- Reminders: users can only see reminders for their company
alter table reminders enable row level security;
create policy "Members can view reminders for their company"
  on reminders for select
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can insert reminders for their company"
  on reminders for insert
  with check (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can update reminders for their company"
  on reminders for update
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can delete reminders for their company"
  on reminders for delete
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

-- Subscriptions: users can only see subscription for their company
alter table subscriptions enable row level security;
create policy "Members can view subscription for their company"
  on subscriptions for select
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can insert subscription for their company"
  on subscriptions for insert
  with check (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can update subscription for their company"
  on subscriptions for update
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
create policy "Members can delete subscription for their company"
  on subscriptions for delete
  using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

-- Storage: We'll create a bucket for documents and set up storage policies
-- We'll do this via the Supabase dashboard or via SQL, but for now we'll note that we need a bucket called 'documents'
-- We'll leave the storage setup to the user via the dashboard, but we can also create it via SQL if we have the service role.
-- Since we are not using the service role in the client, we'll assume the bucket is created.

-- However, we can create the bucket using SQL if we have the service role in a migration script.
-- For the MVP, we'll note in the README to create a public bucket called 'documents' with appropriate policies.

-- For now, we'll just note that we need to set up storage.