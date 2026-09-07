import { FamilyEntity, FamilyEntityType } from '../types/family';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

export const getFamilyEntities = async (
  workspaceId: string,
  type?: FamilyEntityType
): Promise<FamilyEntity[]> => {
  return await OfflineSyncService.getItems<FamilyEntity>(
    'family_entities',
    (e) => e.workspace_id === workspaceId && (!type || e.entity_type === type)
  );
};

export const createFamilyEntity = async (
  input: Omit<FamilyEntity, 'id' | 'created_at' | 'updated_at'>
): Promise<FamilyEntity> => {
  const { data: userData } = await supabase.auth.getUser();
  const entity: FamilyEntity = {
    ...input,
    id: 'fam_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    user_id: userData?.user?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('family_entities', entity);
};

export const updateFamilyEntity = async (
  id: string,
  patch: Partial<FamilyEntity>
): Promise<FamilyEntity | null> => {
  return await OfflineSyncService.updateItem<FamilyEntity>('family_entities', id, patch);
};

export const deleteFamilyEntity = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<FamilyEntity>('family_entities', id);
};
