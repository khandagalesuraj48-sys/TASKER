import { Vehicle, VehicleDocument } from '../types/vehicle';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

export const getVehicles = async (workspaceId: string): Promise<Vehicle[]> => {
  const vehicles = await OfflineSyncService.getItems<Vehicle>(
    'vehicles',
    (v) => v.workspace_id === workspaceId
  );
  const docs = await OfflineSyncService.getItems<VehicleDocument>('vehicle_documents');

  return vehicles.map((v) => ({
    ...v,
    documents: docs.filter((d) => d.vehicle_id === v.id),
  }));
};

export const createVehicle = async (
  input: Omit<Vehicle, 'id' | 'created_at' | 'updated_at' | 'documents'>
): Promise<Vehicle> => {
  const { data: userData } = await supabase.auth.getUser();
  const vehicle: Vehicle = {
    ...input,
    id: 'veh_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    user_id: userData?.user?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    documents: [],
  };

  return await OfflineSyncService.saveItem('vehicles', vehicle);
};

export const updateVehicle = async (id: string, patch: Partial<Vehicle>): Promise<Vehicle | null> => {
  return await OfflineSyncService.updateItem<Vehicle>('vehicles', id, patch);
};

export const deleteVehicle = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<Vehicle>('vehicles', id);
};

export const addVehicleDocument = async (
  doc: Omit<VehicleDocument, 'id' | 'created_at' | 'updated_at'>
): Promise<VehicleDocument> => {
  const newDoc: VehicleDocument = {
    ...doc,
    id: 'vdoc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('vehicle_documents', newDoc);
};

export const deleteVehicleDocument = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<VehicleDocument>('vehicle_documents', id);
};
