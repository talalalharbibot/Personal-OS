
export enum TaskStatus {
  Captured = 'captured',
  Clarified = 'clarified',
  Scheduled = 'scheduled',
  Active = 'active',
  Focused = 'focused',
  Completed = 'completed',
  Deferred = 'deferred',
  Stalled = 'stalled',
}

export enum TaskPriority {
  High = 3,
  Medium = 2,
  Low = 1,
}

export enum TaskEffort {
  High = 3,
  Medium = 2,
  Low = 1,
}

export interface Project {
  id?: number;
  uuid?: string; // Sync ID
  title: string;
  goal?: string;
  color: string;
  createdAt: Date;
  updatedAt?: Date;
  syncedAt?: number; // 0 if dirty, timestamp if synced
  deletedAt?: Date;
}

export interface Task {
  id?: number;
  uuid?: string; // Sync ID
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  effort: TaskEffort;
  executionDate?: Date; // Only Date part matters usually
  scheduledTime?: Date; // Specific time
  durationMinutes?: number;
  projectId?: number;
  rolloverCount: number;
  createdAt: Date;
  completedAt?: Date;
  type?: 'task' | 'appointment' | 'meeting'; 
  
  // New Reminder Fields
  reminderMinutes?: number; 
  isReminded?: boolean;

  // Sync Fields
  updatedAt?: Date;
  syncedAt?: number; // 0 if dirty, timestamp if synced
  deletedAt?: Date;
}

export interface Habit {
  id?: number;
  uuid?: string;
  title: string;
  frequency: 'daily' | 'weekdays' | 'custom';
  streakCount: number;
  lastCompletedDate?: Date;
  createdAt: Date;
  updatedAt?: Date;
  syncedAt?: number;
  deletedAt?: Date;
}

export interface Attachment {
  name: string;
  type: string; // mime type
  size: number;
  path?: string; // Cloud Storage Path (The Source of Truth)
  data?: Blob;   // Optional local cache (Legacy)
}

export interface Idea {
  id?: number;
  uuid?: string;
  content: string;
  isAudio: boolean;
  audioBlob?: Blob;
  attachment?: Attachment;
  createdAt: Date;
  type?: 'idea' | 'note'; 
  linkedTaskId?: number;
  
  // Sync Fields
  updatedAt?: Date;
  syncedAt?: number; // 0 if dirty, timestamp if synced
  deletedAt?: Date;
}
