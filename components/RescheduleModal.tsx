
import React, { useState, useRef } from 'react';
import { X, Calendar, Clock, Save, Type, Flag, Folder, Bell } from 'lucide-react';
import { db } from '../db';
import { Task, TaskStatus, TaskPriority } from '../types';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { validateTimeSlot, ConflictResult } from '../services/scheduling';
import { ConflictAlertModal } from './ConflictAlertModal';

interface Props {
  task: Task;
  mode?: 'default' | 'defer'; // New prop to control modal behavior
  onClose: () => void;
  onSuccess?: () => void;
}

export const RescheduleModal: React.FC<Props> = ({ task, mode = 'default', onClose, onSuccess }) => {
  
  const isAppointmentStatus = task.status === TaskStatus.Scheduled;
  const isMeeting = task.type === 'meeting';
  // Check type explicitly for logic decisions
  const isTimeBound = task.type === 'appointment' || task.type === 'meeting';
  const isDeferMode = mode === 'defer';

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateStr = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Min Constraints
  const now = new Date();
  const todayStr = getLocalDateStr(now);
  const currentTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // State
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [projectId, setProjectId] = useState<number | undefined>(task.projectId);
  
  const [date, setDate] = useState<string>(
    task.executionDate ? getLocalDateStr(new Date(task.executionDate)) : todayStr
  );
  
  const [time, setTime] = useState<string>(
    task.scheduledTime 
        ? new Date(task.scheduledTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) 
        : '09:00'
  );

  const [duration, setDuration] = useState<number>(task.durationMinutes || 60);
  const [reminderMinutes, setReminderMinutes] = useState<number>(task.reminderMinutes || 10);

  // Conflict State
  const [conflictData, setConflictData] = useState<ConflictResult | null>(null);

  // Fetch Projects
  const projects = useLiveQuery(() => db.projects.toArray());

  // Picker Refs
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const durationOptions = [
      { value: 15, label: '15' },
      { value: 30, label: '30' },
      { value: 60, label: '60' },
      { value: 90, label: '90' },
      { value: 120, label: '120' },
      { value: 180, label: '180' },
      { value: 240, label: '240' },
  ];
  
  const reminderOptions = [
      { value: 0, label: 'بدون' },
      { value: 10, label: '10د' },
      { value: 30, label: '30د' },
      { value: 60, label: '1س' },
      { value: 120, label: '2س' },
  ];

  const handleSave = async () => {
    if (!title.trim() && !isDeferMode) {
        toast.error('العنوان مطلوب');
        return;
    }

    try {
        // Validate Conflict first (if we have time info and it's relevant to schedule)
        if (date && time) {
            const validation = await validateTimeSlot(date, time, duration, task.id);
            if (!validation.isValid) {
                setConflictData(validation);
                return; // Stop
            }
        }

        // Construct Local Date properly
        const [y, m, d] = date.split('-').map(Number);
        const newExecutionDate = new Date(y, m - 1, d);
        
        // Construct Scheduled Time
        const newScheduledTime = new Date(`${date}T${time}`);

        // Compare dates (ignoring time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isFutureDate = newExecutionDate > today;

        let newStatus = task.status;

        if (isDeferMode) {
            // Logic for Defer
            if (isTimeBound) {
                // Appointments/Meetings go to Scheduled (Upcoming List)
                newStatus = TaskStatus.Scheduled;
            } else {
                // Tasks go to Inbox (Captured)
                newStatus = TaskStatus.Captured;
            }
        } else {
             // Standard Edit Logic
             if (isFutureDate) {
                 if (isTimeBound) {
                     // Future Appointment -> Scheduled
                     newStatus = TaskStatus.Scheduled;
                 } else {
                     // Future Task -> Inbox
                     newStatus = TaskStatus.Captured;
                 }
             } else {
                 // If Today
                 if (task.status === TaskStatus.Captured) {
                     // Keep as captured if it was captured
                     newStatus = TaskStatus.Captured;
                 } else {
                     // Otherwise make Active (appointments/tasks for today)
                     newStatus = TaskStatus.Active;
                 }
             }
        }

        await db.tasks.update(task.id!, {
            // If in defer mode, don't update title/priority/project
            title: isDeferMode ? task.title : title,
            priority: isDeferMode ? task.priority : priority,
            projectId: isDeferMode ? task.projectId : projectId,
            
            executionDate: newExecutionDate,
            scheduledTime: newScheduledTime,
            durationMinutes: duration,
            reminderMinutes: reminderMinutes,
            // Reset reminder state if we reschedule!
            isReminded: false,
            
            status: newStatus,
            rolloverCount: 0 
        });

        const msg = isTimeBound 
            ? 'تم تحديث الموعد' 
            : (isDeferMode ? 'تم تأجيل المهمة لصندوق الوارد' : 'تم تحديث المهمة بنجاح');
            
        toast.success(msg);
        
        // Trigger global update event
        window.dispatchEvent(new Event('pos-update'));

        if (onSuccess) onSuccess();
        onClose();
    } catch (e) {
        toast.error('حدث خطأ أثناء التحديث');
    }
  };

  const triggerPicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
        try {
            ref.current.showPicker ? ref.current.showPicker() : ref.current.focus();
        } catch(e) { ref.current.focus(); }
    }
  };

  const getHeaderTitle = () => {
      if (isDeferMode) return isTimeBound ? 'تأجيل الموعد' : 'تأجيل المهمة';
      if (isMeeting) return 'تعديل موعد الاجتماع';
      if (isAppointmentStatus) return 'تعديل الموعد';
      return 'تعديل المهمة';
  };

  return (
    <>
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <style>{`
            .custom-picker-input::-webkit-calendar-picker-indicator {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 3rem;
                height: 100%;
                opacity: 0;
                cursor: pointer;
                z-index: 20;
            }
        `}</style>
        
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" dir="rtl">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {getHeaderTitle()}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X size={20} className="text-gray-500" />
            </button>
            </div>

            <div className="p-6 space-y-4">
                
                {/* Title Field - Hidden in Defer Mode */}
                {!isDeferMode && (
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">العنوان</label>
                        <div className="relative">
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-3 pl-10 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none font-bold"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Type size={18} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Date & Time Row - Always Visible */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">التاريخ الجديد</label>
                        <div className="relative">
                            <input 
                                ref={dateInputRef}
                                type="date" 
                                value={date}
                                min={todayStr} // Restrict past dates
                                onChange={(e) => setDate(e.target.value)}
                                onClick={() => triggerPicker(dateInputRef)}
                                className="custom-picker-input w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-3 pl-10 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer text-sm"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Calendar size={18} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">الوقت</label>
                        <div className="relative">
                            <input 
                                ref={timeInputRef}
                                type="time" 
                                value={time}
                                min={date === todayStr ? currentTimeStr : undefined} // Restrict past time if today
                                onChange={(e) => setTime(e.target.value)}
                                onClick={() => triggerPicker(timeInputRef)}
                                className="custom-picker-input w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-3 pl-10 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer text-sm"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Clock size={18} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reminder & Duration Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">تذكير قبل</label>
                        <div className="relative">
                            <select 
                                value={reminderMinutes}
                                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                                className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-10 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                            >
                                {reminderOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Bell size={16} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">المدة (بالدقيقة)</label>
                        <div className="relative">
                             <select 
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-3 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                            >
                                {durationOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Priority & Project Row - Hidden in Defer Mode */}
                {!isDeferMode && !isAppointmentStatus && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">الأولوية</label>
                            <div className="relative">
                                <select 
                                    value={priority}
                                    onChange={(e) => setPriority(Number(e.target.value))}
                                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-3 pl-10 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                                >
                                    <option value={3}>🔴 عالية</option>
                                    <option value={2}>🟡 متوسطة</option>
                                    <option value={1}>🔵 منخفضة</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                    <Flag size={18} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">المشروع</label>
                            <div className="relative">
                                <select
                                    value={projectId || ''}
                                    onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
                                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-3 pl-10 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                                >
                                    <option value="">بدون مشروع (Inbox)</option>
                                    {projects?.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                                <Folder size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                )}
                
                {isDeferMode && (
                    <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        {isTimeBound 
                            ? 'سيتم نقل الموعد إلى قائمة المواعيد القادمة في التاريخ المحدد.'
                            : 'سيتم نقل المهمة إلى صندوق الوارد (Inbox) حتى يحين تاريخ التنفيذ الجديد.'
                        }
                    </div>
                )}

            </div>

            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
                >
                    <Save size={18} />
                    {isDeferMode ? 'تأكيد التأجيل' : 'حفظ التغييرات'}
                </button>
            </div>
        </div>
        </div>
        
        {/* Alert Modal */}
        <ConflictAlertModal 
            isOpen={!!conflictData}
            onClose={() => setConflictData(null)}
            reason={conflictData?.reason || ''}
            suggestion={conflictData?.suggestion}
        />
    </>
  );
};
