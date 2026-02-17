
import { db } from '../db';
import { supabase } from './supabaseClient';
import { deleteAttachment } from './storage';

const TABLES = ['projects', 'tasks', 'ideas', 'habits'] as const;
const BATCH_SIZE = 50;
const MAX_RETRY = 3;

// --- Mappers ---
const toRemote = (entity: any, userId: string): any => {
  const { id, syncedAt, updatedAt, deletedAt, createdAt, ...rest } = entity;
  
  // Define payload first
  const payload: any = {
    uuid: entity.uuid,
    updated_at: new Date().toISOString(), // Always update timestamp on push
    user_id: userId
  };

  // Soft Delete Handling
  if (deletedAt) {
      payload.deleted_at = new Date(deletedAt).toISOString();
  } else {
      payload.deleted_at = null; // Ensure it's null if active
  }

  // Clean Attachment: Remove Blob Data, Keep Metadata & Path
  if (rest.attachment) {
     const { data, ...attRest } = rest.attachment;
     payload.attachment_info = attRest; 
     delete rest.attachment;
  }
  
  if (createdAt) payload.created_at = new Date(createdAt).toISOString();
  if (rest.executionDate) payload.execution_date = new Date(rest.executionDate).toISOString();
  if (rest.scheduledTime) payload.scheduled_time = new Date(rest.scheduledTime).toISOString();
  if (rest.completedAt) payload.completed_at = new Date(rest.completedAt).toISOString();
  if (rest.lastCompletedDate) payload.last_completed_date = new Date(rest.lastCompletedDate).toISOString();
  
  if (entity.attachment_info) payload.attachment_info = entity.attachment_info;

  for (const key in rest) {
    if (key === 'attachment') continue;
    if (key === 'uuid') continue; 
    
    const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    payload[snakeKey] = rest[key];
  }
  return payload;
};

const toLocal = (remote: any): any => {
  const local: any = {
    uuid: remote.uuid,
    updatedAt: new Date(remote.updated_at),
    syncedAt: Date.now(),
  };
  
  if (remote.deleted_at) local.deletedAt = new Date(remote.deleted_at);
  if (remote.created_at) local.createdAt = new Date(remote.created_at);
  if (remote.execution_date) local.executionDate = new Date(remote.execution_date);
  if (remote.scheduled_time) local.scheduledTime = new Date(remote.scheduled_time);
  if (remote.completed_at) local.completedAt = new Date(remote.completed_at);
  if (remote.last_completed_date) local.lastCompletedDate = new Date(remote.last_completed_date);
  
  if (remote.attachment_info) local.attachment = remote.attachment_info;

  Object.keys(remote).forEach(k => {
    if (!['uuid','updated_at','deleted_at','created_at','user_id', 'execution_date', 'scheduled_time', 'completed_at', 'last_completed_date', 'attachment_info'].includes(k)) {
      const camelKey = k.replace(/_([a-z])/g, g => g[1].toUpperCase());
      local[camelKey] = remote[k];
    }
  });
  return local;
};

class SyncEngine {
  private isRunning = false;
  private isOnline = navigator.onLine;
  private intervalId: any = null;

  constructor() {
    window.addEventListener('online', () => { this.isOnline = true; this.triggerSync(); });
    window.addEventListener('offline', () => { this.isOnline = false; });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.triggerSync(); });
  }

  public startAutoSync() {
    if (this.intervalId) return; 
    this.triggerSync();
    this.intervalId = setInterval(() => this.triggerSync(), 30000);
  }

  public stopAutoSync() {
      if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
      this.isRunning = false;
  }

  async triggerSync() {
    if (this.isRunning || !this.isOnline) return;
    if ((db as any).isOpen && !(db as any).isOpen()) return;

    this.isRunning = true;
    try {
      await this.drainLoop();
    } catch (e: any) {
      if (e.message && e.message.includes('Failed to fetch')) {
          console.warn('Sync Connection Lost');
          this.isRunning = false;
          return;
      }
      console.error('Sync Error:', e);
    } finally {
      this.isRunning = false;
    }
  }

  private async drainLoop() {
    while (true) {
      if (!this.isRunning) break;
      if ((db as any).isOpen && !(db as any).isOpen()) break;

      let totalDirty = 0;
      for (const table of TABLES) {
        if (!this.isRunning) break;
        const dirty = await (db as any)[table].where('syncedAt').equals(0).limit(BATCH_SIZE).toArray();
        totalDirty += dirty.length;
        if (dirty.length > 0) await this.pushBatch(table, dirty);
      }
      if (totalDirty === 0) break;
    }

    let hasUpdates = false;
    for (const table of TABLES) {
      if (!this.isRunning) break;
      if ((db as any).isOpen && !(db as any).isOpen()) break;
      const pulled = await this.pullTable(table);
      if (pulled) hasUpdates = true;
    }
    if (hasUpdates) window.dispatchEvent(new Event('pos-update'));
  }

  private async pushBatch(table: string, records: any[]) {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    for (const record of records) {
      if (!this.isRunning) return;
      await this.retry(async () => {
        try {
            // CRITICAL FIX: Always UPSERT.
            // Even if deletedAt is present, we send it to Supabase as a Soft Delete.
            // Supabase will store `deleted_at`, allowing other clients to see it and delete locally.
            
            const payload = toRemote(record, userId);
            
            // Upsert to Supabase
            const { error } = await supabase.from(table).upsert(payload, { onConflict: 'uuid' });
            if (error) throw error;
            
            // If local record was marked as deleted, and now it's pushed, 
            // we can safely HARD delete it locally to save space.
            if (record.deletedAt) {
                await (db as any)[table].delete(record.id);
            } else {
                // Otherwise mark as synced
                await (db as any)[table].update(record.id, { syncedAt: Date.now() });
            }

        } catch (upsertError: any) {
            throw upsertError;
        }
      });
    }
  }

  private async pullTable(table: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return false;

    const meta = await db.metadata.where({ tableName: table, key: 'cursor' }).first();
    let cursor = meta?.value ?? new Date(0).toISOString();
    let dataUpdated = false;

    while (true) {
      if (!this.isRunning) return dataUpdated;
      const data = await this.retry(async () => {
          const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).gt('updated_at', cursor).order('updated_at', { ascending: true }).limit(BATCH_SIZE);
          if (error) throw error;
          return data || [];
      });

      if (!data || data.length === 0) break;

      db.isPulling = true;
      try {
          await (db as any).transaction('rw', (db as any)[table], async () => {
            for (const remote of data) {
              const local = await (db as any)[table].where('uuid').equals(remote.uuid).first();
              
              // CRITICAL FIX: Handle incoming Soft Deletes
              if (remote.deleted_at) {
                  if (local) {
                      // Remote says delete -> Hard delete locally
                      await (db as any)[table].delete(local.id);
                      dataUpdated = true;
                  }
                  // Update cursor even if we didn't have it
                  cursor = remote.updated_at;
                  continue; 
              }

              // Normal Update/Insert
              const transformed = toLocal(remote);
              if (local) {
                  // Only update if remote is newer or we are just syncing up
                  await (db as any)[table].update(local.id, transformed);
              } else {
                  await (db as any)[table].add(transformed);
              }
              cursor = remote.updated_at;
              dataUpdated = true;
            }
          });
          if (dataUpdated) window.dispatchEvent(new Event('pos-update'));
      } finally {
          db.isPulling = false;
      }
    }
    if (meta) await db.metadata.update(meta.id!, { value: cursor });
    else await db.metadata.add({ tableName: table, key: 'cursor', value: cursor });
    return dataUpdated;
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      if (!this.isRunning) throw new Error('SyncStopped');
      try {
        if ((db as any).isOpen && !(db as any).isOpen()) throw new Error('DatabaseClosedError');
        return await fn();
      } catch (err: any) {
        if (err.message && err.message.includes('SyncStopped')) throw err;
        const isNetworkError = err.message && err.message.includes('Failed to fetch');
        if (!isNetworkError && err.code && (err.code.startsWith('42') || err.code.startsWith('23'))) throw err;
        attempt++;
        if (attempt >= MAX_RETRY) { if (isNetworkError) throw new Error('Failed to fetch'); throw err; }
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }

  // Unified Delete: Mark as soft delete locally to trigger sync
  async deleteRecord(tableName: string, id: number) {
      const table = (db as any)[tableName];
      const item = await table.get(id);
      if (!item) return;

      // 1. Delete Attachment from Storage (Side effect, can remain direct)
      if (tableName === 'ideas' && item.attachment?.path) {
          try {
             if (navigator.onLine) await deleteAttachment(item.attachment.path);
          } catch(e) { console.warn('Failed to delete attachment', e); }
      }

      // 2. Mark for deletion locally. 
      // The `pushBatch` loop will pick this up, send `deleted_at` to cloud, and then hard delete locally.
      await table.update(id, { 
          deletedAt: new Date(), 
          updatedAt: new Date(), 
          syncedAt: 0 
      });

      // Trigger sync immediately if online
      if (this.isOnline) {
          this.triggerSync();
      }
  }
}

export const syncService = new SyncEngine();
