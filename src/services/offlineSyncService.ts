import { supabase } from '../lib/supabase';

export interface SyncQueueItem {
  id: string;
  tableName: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

const STORAGE_PREFIX = 'tasker_store_';
const QUEUE_KEY = 'tasker_sync_queue';

export class OfflineSyncService {
  private static getStorageKey(tableName: string): string {
    return `${STORAGE_PREFIX}${tableName}`;
  }

  static getLocalItems<T>(tableName: string): T[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey(tableName));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static setLocalItems<T>(tableName: string, items: T[]): void {
    try {
      localStorage.setItem(this.getStorageKey(tableName), JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }

  static async getItems<T extends { id: string }>(
    tableName: string,
    filterFn?: (item: T) => boolean
  ): Promise<T[]> {
    try {
      const { data, error } = await supabase.from(tableName as any).select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        this.setLocalItems(tableName, data as unknown as T[]);
        return filterFn ? (data as unknown as T[]).filter(filterFn) : (data as unknown as T[]);
      }
    } catch (err) {
      console.info(`Using local cache for ${tableName}`);
    }

    const localItems = this.getLocalItems<T>(tableName);
    return filterFn ? localItems.filter(filterFn) : localItems;
  }

  static async saveItem<T extends { id: string }>(
    tableName: string,
    item: T
  ): Promise<T> {
    const localItems = this.getLocalItems<T>(tableName);
    const existingIndex = localItems.findIndex((x) => x.id === item.id);
    if (existingIndex >= 0) {
      localItems[existingIndex] = item;
    } else {
      localItems.unshift(item);
    }
    this.setLocalItems(tableName, localItems);

    try {
      const { error } = await supabase.from(tableName as any).upsert(item as any);
      if (error) {
        this.enqueueSync({
          id: item.id,
          tableName,
          action: existingIndex >= 0 ? 'update' : 'insert',
          data: item,
          timestamp: Date.now(),
        });
      }
    } catch {
      this.enqueueSync({
        id: item.id,
        tableName,
        action: existingIndex >= 0 ? 'update' : 'insert',
        data: item,
        timestamp: Date.now(),
      });
    }

    return item;
  }

  static async updateItem<T extends { id: string }>(
    tableName: string,
    id: string,
    patch: Partial<T>
  ): Promise<T | null> {
    const localItems = this.getLocalItems<T>(tableName);
    const index = localItems.findIndex((x) => x.id === id);
    if (index === -1) return null;

    const updated = { ...localItems[index], ...patch, updated_at: new Date().toISOString() };
    localItems[index] = updated;
    this.setLocalItems(tableName, localItems);

    try {
      const { error } = await supabase.from(tableName as any).update(patch as any).eq('id', id);
      if (error) {
        this.enqueueSync({
          id,
          tableName,
          action: 'update',
          data: patch,
          timestamp: Date.now(),
        });
      }
    } catch {
      this.enqueueSync({
        id,
        tableName,
        action: 'update',
        data: patch,
        timestamp: Date.now(),
      });
    }

    return updated;
  }

  static async deleteItem<T extends { id: string }>(
    tableName: string,
    id: string
  ): Promise<boolean> {
    const localItems = this.getLocalItems<T>(tableName);
    const filtered = localItems.filter((x) => x.id !== id);
    this.setLocalItems(tableName, filtered);

    try {
      const { error } = await supabase.from(tableName as any).delete().eq('id', id);
      if (error) {
        this.enqueueSync({
          id,
          tableName,
          action: 'delete',
          data: { id },
          timestamp: Date.now(),
        });
      }
    } catch {
      this.enqueueSync({
        id,
        tableName,
        action: 'delete',
        data: { id },
        timestamp: Date.now(),
      });
    }

    return true;
  }

  private static enqueueSync(item: SyncQueueItem): void {
    try {
      const queueRaw = localStorage.getItem(QUEUE_KEY);
      const queue: SyncQueueItem[] = queueRaw ? JSON.parse(queueRaw) : [];
      queue.push(item);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to enqueue sync mutation:', e);
    }
  }

  static getQueueLength(): number {
    try {
      const queueRaw = localStorage.getItem(QUEUE_KEY);
      return queueRaw ? JSON.parse(queueRaw).length : 0;
    } catch {
      return 0;
    }
  }
}
