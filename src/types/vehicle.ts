export type VehicleType = 'two_wheeler' | 'four_wheeler' | 'commercial' | 'other';
export type VehicleDocType = 'puc' | 'insurance' | 'fitness' | 'rc' | 'service' | 'permit' | 'other';

export interface Vehicle {
  id: string;
  workspace_id: string;
  name: string;
  registration_number: string;
  vehicle_type: VehicleType;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  fuel_type?: 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid' | null;
  color?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  documents?: VehicleDocument[];
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  doc_type: VehicleDocType;
  document_number?: string | null;
  provider_name?: string | null;
  issue_date?: string | null;
  expiry_date: string;
  file_url?: string | null;
  notes?: string | null;
  task_id?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}
