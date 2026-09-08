import { OfflineSyncService } from './offlineSyncService';
import { APP_VERSION } from '../constants';

export const exportUserDataAsJson = async (): Promise<string> => {
  const tables = [
    'workspaces',
    'projects',
    'tasks',
    'task_subtasks',
    'financial_records',
    'financial_payments',
    'vehicles',
    'vehicle_documents',
    'personal_documents',
    'family_entities',
    'people',
  ];

  const exportBundle: Record<string, any> = {
    appName: 'TASKER',
    exportDate: new Date().toISOString(),
    version: APP_VERSION,
    data: {},
  };

  for (const t of tables) {
    exportBundle.data[t] = OfflineSyncService.getLocalItems(t);
  }

  return JSON.stringify(exportBundle, null, 2);
};

export const maskSensitiveNumber = (num: string, visibleEndDigits: number = 4): string => {
  if (!num) return '';
  const clean = num.replace(/\s+/g, '');
  if (clean.length <= visibleEndDigits) return clean;
  const maskedLength = clean.length - visibleEndDigits;
  return 'X'.repeat(maskedLength) + clean.substring(maskedLength);
};
