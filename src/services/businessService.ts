import { PersonContact, PersonType } from '../types/business';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

export const getPeople = async (
  workspaceId: string,
  type?: PersonType
): Promise<PersonContact[]> => {
  return await OfflineSyncService.getItems<PersonContact>(
    'people',
    (p) => p.workspace_id === workspaceId && (!type || p.person_type === type)
  );
};

export const createPerson = async (
  input: Omit<PersonContact, 'id' | 'created_at' | 'updated_at'>
): Promise<PersonContact> => {
  const { data: userData } = await supabase.auth.getUser();
  const person: PersonContact = {
    ...input,
    id: 'per_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    user_id: userData?.user?.id || null,
    balance_amount: input.balance_amount || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('people', person);
};

export const updatePerson = async (
  id: string,
  patch: Partial<PersonContact>
): Promise<PersonContact | null> => {
  return await OfflineSyncService.updateItem<PersonContact>('people', id, patch);
};

export const deletePerson = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<PersonContact>('people', id);
};
