import Dexie, { Table } from 'dexie';
import { Task, Project, Habit, Idea, TaskStatus } from './types';

export class POSDatabase extends Dexie {
  tasks!: Table<Task, number>;
  projects!: Table<Project, number>;
  habits!: Table<Habit, number>;
  ideas!: Table<Idea, number>;

  constructor() {
    super('NizamPOS');
    (this as any).version(1).stores({
      tasks: '++id, title, status, priority, executionDate, projectId, rolloverCount, type',
      projects: '++id, title',
      habits: '++id, title, lastCompletedDate',
      ideas: '++id, createdAt, linkedTaskId'
    });
  }
}

export const db = new POSDatabase();

// Helper to seed some initial data if empty
export const seedDatabase = async () => {
  const taskCount = await db.tasks.count();
  if (taskCount === 0) {
    await db.projects.bulkAdd([
      { title: 'مشروع العمل', color: '#3b82f6', createdAt: new Date() },
      { title: 'الصحة والرياضة', color: '#10b981', createdAt: new Date() },
      { title: 'تطوير الذات', color: '#f59e0b', createdAt: new Date() },
    ]);
    
    await db.tasks.bulkAdd([
      {
        title: 'مراجعة خطة المشروع',
        status: TaskStatus.Active,
        priority: 3,
        effort: 2,
        executionDate: new Date(),
        rolloverCount: 0,
        createdAt: new Date(),
        type: 'task'
      },
      {
        title: 'شراء مستلزمات المنزل',
        status: TaskStatus.Active,
        priority: 2,
        effort: 1,
        executionDate: new Date(),
        rolloverCount: 0,
        createdAt: new Date(),
        type: 'task'
      },
      {
        title: 'قراءة كتاب لمدة 30 دقيقة',
        status: TaskStatus.Scheduled,
        priority: 1,
        effort: 2,
        executionDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Tomorrow
        rolloverCount: 0,
        createdAt: new Date(),
        type: 'task'
      }
    ]);

    await db.habits.add({
      title: 'شرب 3 لتر ماء',
      frequency: 'daily',
      streakCount: 5,
      createdAt: new Date()
    });
  }
};