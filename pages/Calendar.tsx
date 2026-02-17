
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, addDays, isSameDay, isSameMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, Clock, Users, CheckSquare, CalendarClock, X } from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { TaskCard } from '../components/TaskCard';
import { RescheduleModal } from '../components/RescheduleModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import toast from 'react-hot-toast';
import { syncService } from '../services/syncService';

// Helper functions for calendar logic
const startOfMonth = (date: Date) => { const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d; };
const endOfMonth = (date: Date) => { const d = new Date(date); d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23, 59, 59, 999); return d; };
const startOfWeek = (date: Date, options: { weekStartsOn: number }) => { const d = new Date(date); d.setHours(0,0,0,0); const day = d.getDay(); const diff = (day < options.weekStartsOn ? 7 : 0) + day - options.weekStartsOn; d.setDate(d.getDate() - diff); return d; };
const endOfWeek = (date: Date, options: { weekStartsOn: number }) => { const d = startOfWeek(date, options); d.setDate(d.getDate() + 6); d.setHours(23, 59, 59, 999); return d; };
const eachDayOfInterval = ({ start, end }: { start: Date, end: Date }) => { const days = []; const current = new Date(start); current.setHours(0,0,0,0); const endUnix = end.getTime(); while (current.getTime() <= endUnix) { days.push(new Date(current)); current.setDate(current.getDate() + 1); } return days; };

export const Calendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | '3day' | '7day' | 'month'>('day');
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [changeSignal, setChangeSignal] = useState(0);
  const forceUpdate = () => setChangeSignal(c => c + 1);

  // Trigger Sync on Mount to ensure data freshness
  useEffect(() => {
    syncService.triggerSync();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    if (viewMode !== 'month' && scrollRef.current) {
        const minutes = new Date().getHours() * 60;
        scrollRef.current.scrollTop = Math.max(0, (minutes * 2) - 100); 
    }
    return () => clearInterval(timer);
  }, [viewMode]);

  useEffect(() => {
    const handleUpdate = () => forceUpdate();
    window.addEventListener('pos-update', handleUpdate);
    return () => window.removeEventListener('pos-update', handleUpdate);
  }, []);

  const dates = useMemo(() => {
    if (viewMode === 'month') {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 6 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 6 });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }
    const daysToShow = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : 7;
    return Array.from({ length: daysToShow }, (_, i) => addDays(selectedDate, i));
  }, [selectedDate, viewMode]);

  // --- OPTIMIZED QUERY ---
  // Only fetch tasks within the visible range of the calendar and NOT deleted
  const tasks = useLiveQuery(async () => {
    if (dates.length === 0) return [];
    
    // Ensure accurate range
    const startRange = new Date(dates[0]); 
    startRange.setHours(0,0,0,0);
    const endRange = new Date(dates[dates.length - 1]); 
    endRange.setHours(23,59,59,999);

    return db.tasks
        .where('executionDate')
        .between(startRange, endRange, true, true)
        .filter(t => !t.deletedAt)
        .toArray();
  }, [dates, changeSignal]);

  const changeDate = (amount: number) => {
    if (viewMode === 'month') {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + amount);
        setSelectedDate(newDate);
    } else {
        const daysToJump = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : 7;
        setSelectedDate(addDays(selectedDate, amount * daysToJump));
    }
  };

  const handleEditClick = (task: Task) => { setSelectedTask(null); setTaskToEdit(task); };
  const handleDeleteClick = (id: number) => { const task = tasks?.find(t => t.id === id); if (task) { setSelectedTask(null); setTaskToDelete(task); } };
  
  const handleDeleteConfirm = async () => {
      if (taskToDelete?.id) {
          try { 
              // Use deleteRecord for Hard Delete
              await syncService.deleteRecord('tasks', taskToDelete.id); 
              toast.success('تم الحذف بنجاح'); 
              forceUpdate(); 
          } catch (e) { 
              toast.error('حدث خطأ أثناء الحذف'); 
          }
      }
      setTaskToDelete(null);
  };

  const getTaskStyles = (task: Task) => {
      const isCompleted = task.status === TaskStatus.Completed;
      if (isCompleted) return 'bg-gray-200 border-gray-400 text-gray-500 line-through opacity-70 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500';
      if (task.type === 'meeting') return 'bg-teal-50 border-teal-500 text-teal-900 dark:bg-teal-900/30 dark:border-teal-500 dark:text-teal-100';
      if (task.type === 'appointment') return 'bg-purple-50 border-purple-500 text-purple-900 dark:bg-purple-900/30 dark:border-purple-500 dark:text-purple-100';
      return 'bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-100';
  };
  const getTaskIcon = (task: Task) => {
      if (task.type === 'meeting') return <Users size={12} />;
      if (task.type === 'appointment') return <CalendarClock size={12} />;
      return <CheckSquare size={12} />;
  };
  const getTaskPosition = (task: Task) => {
    if (!task.scheduledTime) return { top: 0, height: 60 };
    const date = new Date(task.scheduledTime);
    const startMinutes = date.getHours() * 60 + date.getMinutes();
    const duration = task.durationMinutes || 60;
    return { top: startMinutes * 2, height: duration * 2 };
  };
  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return minutes * 2;
  };

  const renderMonthView = () => (
      <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-y-auto pb-24">
          <div className="grid grid-cols-7 border-b dark:border-gray-800 bg-white dark:bg-gray-800 sticky top-0 z-10">
              {['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'].map(d => (
                  <div key={d} className="p-2 text-center text-xs font-bold text-gray-700 dark:text-gray-400">{d}</div>
              ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr gap-px bg-gray-200 dark:bg-gray-700">
              {dates.map((date) => {
                  const isCurrentMonth = isSameMonth(date, selectedDate);
                  const isToday = isSameDay(date, new Date());
                  const dayTasks = tasks?.filter(t => t.executionDate && isSameDay(new Date(t.executionDate), date)) || [];
                  return (
                      <div key={date.toISOString()} className={`min-h-[100px] p-1 bg-white dark:bg-gray-900 flex flex-col ${!isCurrentMonth ? 'opacity-50 bg-gray-50 dark:bg-gray-900/50' : ''}`}>
                          <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary-600 text-white' : 'text-gray-800 dark:text-gray-300'}`}>{format(date, 'd')}</div>
                          <div className="flex-1 space-y-1 overflow-y-auto max-h-[120px] scrollbar-hide">
                              {dayTasks.map(task => (
                                  <div key={task.id} onClick={() => setSelectedTask(task)} className={`text-[10px] p-1 rounded border-r-2 truncate flex items-center gap-1 cursor-pointer hover:brightness-95 active:scale-95 transition-all ${getTaskStyles(task)}`}>
                                      {task.scheduledTime && <span className="opacity-70 font-mono">{format(task.scheduledTime, 'HH:mm')}</span>}
                                      <span>{task.title}</span>
                                      {task.durationMinutes && <span className="text-[9px] opacity-70">({task.durationMinutes} د)</span>}
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
  );

  const renderTimelineView = () => (
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <div className="flex-1 overflow-auto relative" ref={scrollRef}>
            <div className="min-w-fit flex flex-col">
                <div className="sticky top-0 z-30 flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-full">
                     <div className="w-14 flex-shrink-0 sticky right-0 z-40 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800"></div>
                     <div className="flex flex-1">
                        {dates.map(date => (
                            <div key={date.toISOString()} className="flex-1 min-w-[100px] text-center py-3 border-l border-gray-200 dark:border-gray-800 last:border-l-0">
                                <span className={`text-xs font-bold block ${isSameDay(date, new Date()) ? 'text-primary-600' : 'text-gray-700 dark:text-gray-400'}`}>{format(date, 'EEEE', { locale: ar })}</span>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1 text-sm font-bold ${isSameDay(date, new Date()) ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' : 'text-gray-800 dark:text-gray-200'}`}>{format(date, 'd')}</div>
                            </div>
                        ))}
                     </div>
                </div>
                <div className="flex relative min-h-[2880px]">
                    <div className="w-14 flex-shrink-0 sticky right-0 z-20 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
                         {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={hour} className="h-[120px] text-[10px] font-medium text-gray-500 text-center pt-2 relative border-b border-gray-200 dark:border-gray-800/50">{format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}</div>
                        ))}
                    </div>
                     <div className="flex flex-1 relative">
                        <div className="absolute inset-0 z-0 pointer-events-none min-w-full">
                            {Array.from({ length: 24 }).map((_, hour) => (
                                <div key={hour} className="h-[120px] border-b border-gray-200 dark:border-gray-800/50 w-full" />
                            ))}
                        </div>
                        {dates.some(d => isSameDay(d, new Date())) && (
                            <div className="absolute w-full z-10 flex items-center pointer-events-none" style={{ top: `${getCurrentTimePosition()}px` }}>
                                <div className="w-full h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                            </div>
                        )}
                        {dates.map((date) => {
                            const dayTasks = tasks?.filter(t => t.executionDate && isSameDay(new Date(t.executionDate), date)) || [];
                            const isToday = isSameDay(date, new Date());
                            return (
                                <div key={date.toISOString()} className={`flex-1 min-w-[100px] relative border-l border-gray-200 dark:border-gray-800 last:border-l-0 h-full ${isToday ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                                    {dayTasks.map(task => {
                                        const pos = getTaskPosition(task);
                                        return (
                                            <div key={task.id} onClick={() => setSelectedTask(task)} className={`absolute left-1 right-1 rounded-lg p-1.5 text-xs border-r-4 shadow-sm overflow-hidden hover:z-30 transition-all cursor-pointer group hover:brightness-95 active:scale-95 ${getTaskStyles(task)}`} style={{ top: `${pos.top}px`, height: `${pos.height}px`, minHeight: '36px' }}>
                                                <div className="flex items-center gap-1 font-bold truncate">{getTaskIcon(task)}<span className="truncate">{task.title}</span></div>
                                                <div className="opacity-80 truncate text-[10px] mt-0.5 flex items-center gap-1"><Clock size={10} />{task.scheduledTime && format(task.scheduledTime, 'hh:mm a')}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                     </div>
                </div>
            </div>
        </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3 bg-white dark:bg-gray-900 z-30 shadow-sm">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <button onClick={() => changeDate(-1)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ChevronRight size={20} /></button>
                <button onClick={() => changeDate(1)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ChevronLeft size={20} /></button>
            </div>
            <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2" dir="rtl">
                {viewMode === 'month' ? format(selectedDate, 'MMMM yyyy', { locale: ar }) : `${format(dates[0], 'd MMM', { locale: ar })} - ${format(dates[dates.length-1], 'd MMM', { locale: ar })}`}
            </h2>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto scrollbar-hide">
            {[{id:'day',l:'يوم'},{id:'3day',l:'3 أيام'},{id:'7day',l:'7 أيام'},{id:'month',l:'شهر'}].map(mode => (
                <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`flex-1 min-w-[60px] px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${viewMode === mode.id ? 'bg-white dark:bg-gray-700 shadow text-primary-600 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:hover:text-gray-300'}`}>{mode.l}</button>
            ))}
        </div>
      </div>
      {viewMode === 'month' ? renderMonthView() : renderTimelineView()}
      {selectedTask && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedTask(null)}><div className="w-full max-w-sm" onClick={e => e.stopPropagation()}><div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-1 animate-in zoom-in-95 duration-200"><TaskCard task={selectedTask} defaultExpanded={true} onReschedule={handleEditClick} onDelete={handleDeleteClick} /></div></div></div>}
      {taskToEdit && <RescheduleModal task={taskToEdit} onClose={() => setTaskToEdit(null)} onSuccess={forceUpdate} />}
      <DeleteConfirmationModal isOpen={!!taskToDelete} onClose={() => setTaskToDelete(null)} onConfirm={handleDeleteConfirm} title="حذف العنصر؟" message={`هل أنت متأكد من حذف "${taskToDelete?.title}"؟`} />
    </div>
  );
};
