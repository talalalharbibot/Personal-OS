
import Dexie, { Table } from 'dexie';
import { Task, Project, Habit, Idea } from './types';

// Helper to generate UUID
export function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export interface MetadataRecord {
  id?: number;
  tableName: string;
  key: string; // 'cursor', etc.
  value: any;
}

// --- Hooks Implementation ---
export function addSyncHooks(table: Table<any, any>, dbInstance: POSDatabase) {
  table.hook('creating', (primKey, obj) => {
    if (dbInstance.isPulling) return; // SKIP if pulling from remote

    // 1. Ensure basic fields
    obj.updatedAt = new Date();
    obj.syncedAt = 0; // Mark as dirty
    if (!obj.uuid) obj.uuid = generateUUID();
  });

  table.hook('updating', (mods: any, primKey, obj) => {
    if (dbInstance.isPulling) return; // SKIP if pulling from remote

    // If update is NOT from SyncService (i.e. does not contain syncedAt), mark as dirty
    if (!Object.prototype.hasOwnProperty.call(mods, 'syncedAt')) {
        return { updatedAt: new Date(), syncedAt: 0 };
    }
  });
}

export class POSDatabase extends Dexie {
  tasks!: Table<Task, number>;
  projects!: Table<Project, number>;
  habits!: Table<Habit, number>;
  ideas!: Table<Idea, number>;
  metadata!: Table<MetadataRecord, number>;

  // Flag to prevent recursive sync loops
  public isPulling = false;

  constructor() {
    super('NizamPOS');
    
    // Schema definition
    (this as any).version(6).stores({
      tasks: '++id, uuid, status, executionDate, projectId, syncedAt, updatedAt, deletedAt',
      projects: '++id, uuid, title, syncedAt, updatedAt, deletedAt',
      habits: '++id, uuid, title, lastCompletedDate, syncedAt, updatedAt, deletedAt',
      ideas: '++id, uuid, createdAt, linkedTaskId, syncedAt, updatedAt, deletedAt',
      metadata: '++id, [tableName+key]'
    });

    this.applyHooks();
  }

  applyHooks() {
    // Pass 'this' to hooks to access isPulling
    const tables = [this.tasks, this.projects, this.habits, this.ideas];
    tables.forEach(table => addSyncHooks(table, this));
  }
}

export const db = new POSDatabase();
