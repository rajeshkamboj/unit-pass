export type CompanyRow = {
  id: string;
  name: string;
  logo_url: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  service_booking_url: string | null;
  default_service_interval: number;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerListRow = Pick<
  CustomerRow,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'city' | 'state' | 'archived_at' | 'created_at' | 'updated_at'
>;

export type CustomerFormRow = Pick<
  CustomerRow,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'postal_code' | 'country'
>;

/** Enum labels mirror the database types exactly (legacy spellings, no new ones). */
export const EQUIPMENT_TYPES = [
  'Air Conditioner',
  'Furnace',
  'Heat Pump',
  'Mini Split',
  'Boiler',
  'Air Handler',
  'Other',
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const EQUIPMENT_STATUSES = ['Active', 'Inactive', 'Replaced'] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export type EquipmentRow = {
  id: string;
  company_id: string;
  customer_id: string;
  equipment_name: string;
  equipment_type: EquipmentType;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  installation_date: string | null;
  warranty_expiration_date: string | null;
  warranty_notes: string | null;
  next_service_date: string | null;
  service_interval: number | null;
  installer_notes: string | null;
  public_notes: string | null;
  equipment_photo_path: string | null;
  status: EquipmentStatus;
  public_token: string;
  created_at: string;
  updated_at: string;
};

export type EquipmentCustomerSummary = {
  first_name: string;
  last_name: string;
};

export type EquipmentListRow = Pick<
  EquipmentRow,
  | 'id'
  | 'customer_id'
  | 'equipment_name'
  | 'equipment_type'
  | 'manufacturer'
  | 'model_number'
  | 'serial_number'
  | 'next_service_date'
  | 'status'
  | 'public_token'
  | 'created_at'
  | 'updated_at'
> & {
  customers: EquipmentCustomerSummary | EquipmentCustomerSummary[] | null;
};

export type EquipmentFormRow = Pick<
  EquipmentRow,
  | 'id'
  | 'customer_id'
  | 'equipment_name'
  | 'equipment_type'
  | 'manufacturer'
  | 'model_number'
  | 'serial_number'
  | 'installation_date'
  | 'warranty_expiration_date'
  | 'warranty_notes'
  | 'next_service_date'
  | 'service_interval'
  | 'installer_notes'
  | 'public_notes'
  | 'status'
>;

export type EquipmentDetailRow = EquipmentFormRow & {
  public_token: string;
  created_at: string;
  updated_at: string;
  customers: EquipmentCustomerSummary | EquipmentCustomerSummary[] | null;
};

export type CustomerOption = {
  id: string;
  first_name: string;
  last_name: string;
};

/**
 * The exact payload of `public.get_public_unitpass(uuid)`.
 * Deliberately contains no internal ids, no installer notes and no customer PII.
 */
export type PublicUnitPass = {
  company: {
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    service_booking_url: string | null;
    logo_url: string | null;
  };
  equipment: {
    name: string;
    type: EquipmentType;
    manufacturer: string | null;
    model_number: string | null;
    serial_number: string | null;
    installation_date: string | null;
    warranty_expiration_date: string | null;
    warranty_notes: string | null;
    public_notes: string | null;
    status: EquipmentStatus;
    photo_path: string | null;
  };
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
