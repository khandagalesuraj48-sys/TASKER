import { PersonalDocument } from '../types/document';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

export const getDocuments = async (workspaceId: string): Promise<PersonalDocument[]> => {
  return await OfflineSyncService.getItems<PersonalDocument>(
    'personal_documents',
    (d) => d.workspace_id === workspaceId
  );
};

export const createDocument = async (
  input: Omit<PersonalDocument, 'id' | 'created_at' | 'updated_at'>
): Promise<PersonalDocument> => {
  const { data: userData } = await supabase.auth.getUser();
  const doc: PersonalDocument = {
    ...input,
    id: 'doc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    user_id: userData?.user?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('personal_documents', doc);
};

export const updateDocument = async (
  id: string,
  patch: Partial<PersonalDocument>
): Promise<PersonalDocument | null> => {
  return await OfflineSyncService.updateItem<PersonalDocument>('personal_documents', id, patch);
};

export const deleteDocument = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<PersonalDocument>('personal_documents', id);
};
