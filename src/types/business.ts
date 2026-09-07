export type PersonType = 'client' | 'vendor' | 'contractor' | 'staff' | 'family_member' | 'other';

export interface PersonContact {
  id: string;
  workspace_id: string;
  name: string;
  person_type: PersonType;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  gstin?: string | null;
  upi_id?: string | null;
  address?: string | null;
  notes?: string | null;
  balance_amount?: number;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}
