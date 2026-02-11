

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
  title: string;
  goal?: string;
  color: string;
  createdAt: Date;
}

export interface Task {
  id?: number;
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
  type?: 'task' | 'appointment' | 'meeting'; // Added to distinguish specific types
}

export interface Habit {
  id?: number;
  title: string;
  frequency: 'daily' | 'weekdays' | 'custom';
  streakCount: number;
  lastCompletedDate?: Date;
  createdAt: Date;
}

export interface Attachment {
  name: string;
  type: string; // mime type
  data: Blob;
  size: number;
}

export interface Idea {
  id?: number;
  content: string;
  isAudio: boolean;
  audioBlob?: Blob;
  attachment?: Attachment; // New field for file attachments
  createdAt: Date;
  type?: 'idea' | 'note'; // Added to distinguish specific types
  linkedTaskId?: number; // Optional link to a parent task/appointment/meeting
}
