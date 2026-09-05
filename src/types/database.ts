export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          person_name: string | null;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          status: 'pending' | 'in_progress' | 'partial' | 'completed' | 'cancelled';
          created_at: string;
          due_date: string | null;
          started_at: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_by: string;
          updated_at: string;
          pending_since: string;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          person_name?: string | null;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          status?: 'pending' | 'in_progress' | 'partial' | 'completed' | 'cancelled';
          created_at?: string;
          due_date?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_by?: string;
          updated_at?: string;
          pending_since?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          person_name?: string | null;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          status?: 'pending' | 'in_progress' | 'partial' | 'completed' | 'cancelled';
          created_at?: string;
          due_date?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_by?: string;
          updated_at?: string;
          pending_since?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
      };
      task_status_history: {
        Row: {
          id: string;
          task_id: string;
          old_status: string | null;
          new_status: string;
          changed_by: string;
          changed_at: string;
          remarks: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          old_status?: string | null;
          new_status: string;
          changed_by?: string;
          changed_at?: string;
          remarks?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          old_status?: string | null;
          new_status?: string;
          changed_by?: string;
          changed_at?: string;
          remarks?: string | null;
        };
      };
      task_notes: {
        Row: {
          id: string;
          task_id: string;
          note: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          note: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          note?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      task_attachments: {
        Row: {
          id: string;
          task_id: string;
          file_name: string;
          storage_path: string;
          file_type: string | null;
          file_size: number | null;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          file_name: string;
          storage_path: string;
          file_type?: string | null;
          file_size?: number | null;
          uploaded_by?: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          file_name?: string;
          storage_path?: string;
          file_type?: string | null;
          file_size?: number | null;
          uploaded_by?: string;
          uploaded_at?: string;
        };
      };
    };
  };
}

