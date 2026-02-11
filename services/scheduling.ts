
import { db } from '../db';
import { Task, TaskStatus } from '../types';
import { addMinutes, areIntervalsOverlapping, setHours, setMinutes, format, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ScheduleSettings {
  workHoursEnabled: boolean;
  workStart: string; // "09:00"
  workEnd: string;   // "17:00"
  bufferEnabled: boolean;
  bufferMinutes: number;
}

export const getScheduleSettings = (): ScheduleSettings => {
  return {
    workHoursEnabled: localStorage.getItem('sched_workHoursEnabled') === 'true',
    workStart: localStorage.getItem('sched_workStart') || '09:00',
    workEnd: localStorage.getItem('sched_workEnd') || '17:00',
    bufferEnabled: localStorage.getItem('sched_bufferEnabled') === 'true',
    bufferMinutes: Number(localStorage.getItem('sched_bufferMinutes')) || 15,
  };
};

export const saveScheduleSettings = (settings: ScheduleSettings) => {
  localStorage.setItem('sched_workHoursEnabled', String(settings.workHoursEnabled));
  localStorage.setItem('sched_workStart', settings.workStart);
  localStorage.setItem('sched_workEnd', settings.workEnd);
  localStorage.setItem('sched_bufferEnabled', String(settings.bufferEnabled));
  localStorage.setItem('sched_bufferMinutes', String(settings.bufferMinutes));
};

export interface ConflictResult {
  isValid: boolean;
  reason?: string;
  conflictingTask?: Task;
  suggestion?: string;
}

export const validateTimeSlot = async (
  dateStr: string, // YYYY-MM-DD
  timeStr: string, // HH:MM
  durationMinutes: number,
  excludeTaskId?: number
): Promise<ConflictResult> => {
  const settings = getScheduleSettings();
  
  // 1. Construct Date Objects
  const startDateTime = new Date(`${dateStr}T${timeStr}`);
  const endDateTime = addMinutes(startDateTime, durationMinutes);

  // 2. Check Past Time
  const now = new Date();
  // Allow 1 minute grace period for entry time to avoid instant validation errors
  const nowWithGrace = new Date(now.getTime() - 60000);

  if (isBefore(startDateTime, nowWithGrace)) {
    return {
      isValid: false,
      reason: 'عفواً، لا يمكن إضافة أو تعديل مهمة/موعد في وقت سابق.',
      suggestion: 'تأكد من اختيار تاريخ ووقت مستقبلي.'
    };
  }

  // 3. Check Work Hours (if enabled)
  if (settings.workHoursEnabled) {
    const [startH, startM] = settings.workStart.split(':').map(Number);
    const [endH, endM] = settings.workEnd.split(':').map(Number);

    const workStart = setMinutes(setHours(new Date(startDateTime), startH), startM);
    const workEnd = setMinutes(setHours(new Date(startDateTime), endH), endM);

    if (startDateTime < workStart || endDateTime > workEnd) {
      return {
        isValid: false,
        reason: `الوقت المختار خارج ساعات العمل المحددة (${settings.workStart} - ${settings.workEnd}).`,
        suggestion: `حاول الجدولة بين ${settings.workStart} و ${settings.workEnd}`
      };
    }
  }

  // 4. Check Conflicts with Existing Tasks
  // Fetch tasks for this day that are NOT Completed and NOT the current task being edited
  const dayStart = new Date(dateStr);
  dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(dateStr);
  dayEnd.setHours(23,59,59,999);

  const existingTasks = await db.tasks
    .where('executionDate')
    .between(dayStart, dayEnd, true, true)
    .filter(t => 
      t.id !== excludeTaskId && 
      t.status !== TaskStatus.Completed && 
      !!t.scheduledTime
    )
    .toArray();

  const buffer = settings.bufferEnabled ? settings.bufferMinutes : 0;
  
  const newStart = startDateTime;
  const newEnd = addMinutes(endDateTime, buffer); 

  for (const task of existingTasks) {
    if (!task.scheduledTime) continue;

    const taskStart = new Date(task.scheduledTime);
    const taskDuration = task.durationMinutes || 60;
    const taskEndReal = addMinutes(taskStart, taskDuration);
    const taskEndWithBuffer = addMinutes(taskEndReal, buffer);

    const isOverlapping = areIntervalsOverlapping(
      { start: newStart, end: newEnd },
      { start: taskStart, end: taskEndWithBuffer }
    );

    if (isOverlapping) {
      const formattedEnd = format(taskEndWithBuffer, 'hh:mm a', { locale: ar });
      return {
        isValid: false,
        reason: `يوجد تعارض مع "${task.title}".`,
        conflictingTask: task,
        suggestion: settings.bufferEnabled 
            ? `مشغول حتى ${formattedEnd} (شامل فترة الراحة)` 
            : `مشغول حتى ${format(taskEndReal, 'hh:mm a', { locale: ar })}`
      };
    }
  }

  return { isValid: true };
};
