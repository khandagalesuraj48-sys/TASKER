export type PersonalDocType = 
  | 'aadhaar' 
  | 'pan' 
  | 'passport' 
  | 'voter_id' 
  | 'ration_card' 
  | 'driving_license' 
  | 'property' 
  | 'agreement' 
  | 'tax' 
  | 'medical' 
  | 'other';

export interface PersonalDocument {
  id: string;
  workspace_id: string;
  title: string;
  doc_type: PersonalDocType;
  holder_name: string;
  document_number_masked?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  reminder_days_before?: number;
  category?: string | null;
  tags?: string[];
  file_path?: string | null;
  notes?: string | null;
  task_id?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}
