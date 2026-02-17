
import { Task, TaskStatus } from '../types';
import { db } from '../db';
import { getScheduleSettings } from './scheduling';

export class TaskFSM {
  
  static async canTransition(task: Task, to: TaskStatus): Promise<boolean> {
    const from = task.status;

    // Terminal state check
    if (from === TaskStatus.Completed) return false;

    // Focus Invariant: Only one focused task allowed
    if (to === TaskStatus.Focused) {
      const currentFocused = await db.tasks.where('status').equals(TaskStatus.Focused).first();
      if (currentFocused && currentFocused.id !== task.id) {
        throw new Error('يوجد مهمة أخرى قيد التركيز حالياً. قم بإنهائها أولاً.');
      }
      // ALLOW captured, scheduled, and active to go to focused
      if (![TaskStatus.Active, TaskStatus.Scheduled, TaskStatus.Captured].includes(from)) return false;
    }

    // Logic Matrix (updated for flexibility)
    switch (from) {
      case TaskStatus.Captured:
        // Allow Clarifying, Activating, Deferring, Completion, OR Focus (Quick Win)
        return [TaskStatus.Clarified, TaskStatus.Active, TaskStatus.Deferred, TaskStatus.Completed, TaskStatus.Focused].includes(to);
      
      case TaskStatus.Clarified:
        return [TaskStatus.Scheduled, TaskStatus.Active, TaskStatus.Deferred, TaskStatus.Completed].includes(to);
      
      case TaskStatus.Scheduled:
        // Add Focused (for starting meetings/appointments immediately)
        return [TaskStatus.Active, TaskStatus.Deferred, TaskStatus.Completed, TaskStatus.Focused].includes(to);
      
      case TaskStatus.Active:
        return [TaskStatus.Focused, TaskStatus.Completed, TaskStatus.Deferred].includes(to);
      
      case TaskStatus.Focused:
        return [TaskStatus.Completed, TaskStatus.Active, TaskStatus.Deferred].includes(to); // Added Deferred to allow rollover from Focused
      
      case TaskStatus.Deferred:
        return [TaskStatus.Active, TaskStatus.Scheduled, TaskStatus.Completed].includes(to);
      
      case TaskStatus.Stalled:
        return [TaskStatus.Active, TaskStatus.Deferred, TaskStatus.Completed].includes(to);
      
      default:
        return false;
    }
  }

  static async transition(taskId: number, to: TaskStatus) {
    const task = await db.tasks.get(taskId);
    if (!task) throw new Error('المهمة غير موجودة');

    // Fix: Idempotency check to prevent errors on double-click or redundant transitions
    if (task.status === to) return;

    const allowed = await this.canTransition(task, to);
    if (!allowed) {
      // Changed from console.warn to throw so the UI stops execution
      throw new Error(`Transition from ${task.status} to ${to} is not allowed`);
    }

    const updates: Partial<Task> = { status: to };
    if (to === TaskStatus.Completed) {
      updates.completedAt = new Date();
    }

    await db.tasks.update(taskId, updates);
  }

  // Midnight Rollover & Inbox Activation Logic
  static async performRollover() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const settings = getScheduleSettings();

    // 1. Rollover: Handle Overdue Tasks (Active, Scheduled, OR Focused)
    // We fetch ALL tasks that are meant to be done but aren't completed yet.
    // This includes Focused tasks (if work day ended, focus is broken)
    const candidates = await db.tasks
      .where('status')
      .anyOf([TaskStatus.Active, TaskStatus.Scheduled, TaskStatus.Focused, TaskStatus.Captured])
      .toArray();

    let updatesMade = false;

    for (const task of candidates) {
      if (task.executionDate) {
         const tDate = new Date(task.executionDate);
         tDate.setHours(0,0,0,0);
         
         let shouldDefer = false;

         // Condition A: Date is strictly in the past (Yesterday or before)
         if (tDate < today) {
             shouldDefer = true;
         }
         // Condition B: It is TODAY, but Work Hours are Enabled and Passed
         else if (settings.workHoursEnabled && tDate.getTime() === today.getTime()) {
             const [endH, endM] = settings.workEnd.split(':').map(Number);
             const workEndTime = new Date();
             workEndTime.setHours(endH, endM, 0, 0);
             
             // If current time is strictly past work end time
             if (now > workEndTime) {
                 shouldDefer = true;
             }
         }

         if (shouldDefer) {
            const newRolloverCount = task.rolloverCount + 1;
            const newStatus = newRolloverCount >= 3 ? TaskStatus.Stalled : TaskStatus.Deferred;
            
            // If it was Focused, we log a console warning or just move it.
            // Moving a Focused task to Deferred essentially "stops" the focus session implicitly.
            
            await db.tasks.update(task.id!, {
              status: newStatus,
              rolloverCount: newRolloverCount
            });
            updatesMade = true;
         }
      }
    }

    // 2. Activation: Handle Due Inbox Tasks
    // Captured tasks scheduled for today (or past) become Active/Scheduled
    const capturedTasks = await db.tasks
      .where('status')
      .equals(TaskStatus.Captured)
      .toArray();

    for (const task of capturedTasks) {
        if (task.executionDate) {
            const tDate = new Date(task.executionDate);
            tDate.setHours(0,0,0,0);

            // If the execution date has arrived (and we are NOT past work hours for today tasks)
            // Note: If we are past work hours, the loop above will catch them immediately after this update
            // effectively moving Captured -> Active -> Deferred in one cycle if strictly implemented,
            // or we prevent activation if work hours are done.
            
            // Let's check work hours here too to prevent "Flashing" active
            let isWorkDayOver = false;
            if (settings.workHoursEnabled && tDate.getTime() === today.getTime()) {
                const [endH, endM] = settings.workEnd.split(':').map(Number);
                const workEndTime = new Date();
                workEndTime.setHours(endH, endM, 0, 0);
                if (now > workEndTime) isWorkDayOver = true;
            }

            if (tDate <= today && !isWorkDayOver) {
                // Determine target status based on type
                const isTimeBound = task.type === 'appointment' || task.type === 'meeting';
                const newStatus = isTimeBound ? TaskStatus.Scheduled : TaskStatus.Active;

                await db.tasks.update(task.id!, {
                    status: newStatus
                });
                updatesMade = true;
            }
        }
    }

    return updatesMade;
  }
}
