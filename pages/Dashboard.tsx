
import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from '../db';
import { Task, TaskStatus, Habit } from '../types';
import { TaskCard } from '../components/TaskCard';
import { ActiveTaskCard } from '../components/ActiveTaskCard';
import { RescheduleModal } from '../components/RescheduleModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { TaskFSM } from '../services/fsm';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Sun, Moon, Flame, AlertOctagon, ChevronDown, ChevronUp, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { addDays, isAfter, differenceInMinutes } from 'date-fns';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('');
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Track expanded task ID for Accordion behavior
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // Reschedule Modal State (Combined for Edit and Defer)
  const [modalTask, setModalTask] = useState<{task: Task, mode: 'default' | 'defer'} | null>(null);
  
  // Delete State
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Manual trigger to force re-query on actions
  const [changeSignal, setChangeSignal] = useState(0);
  const forceUpdate = () => setChangeSignal(c => c + 1);

  // Update current time AND CHECK ROLLOVER every 30 seconds
  useEffect(() => {
    const checkTimeAndRollover = async () => {
        setCurrentTime(new Date());
        // Run rollover logic periodically to auto-defer tasks when work hours end
        const updatesMade = await TaskFSM.performRollover();
        if (updatesMade) {
            forceUpdate();
        }
    };

    checkTimeAndRollover(); // Run immediately
    const timer = setInterval(checkTimeAndRollover, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, []);

  // Listen for global update events (from Quick Capture Modal)
  useEffect(() => {
    const handleUpdate = () => forceUpdate();
    window.addEventListener('pos-update', handleUpdate);
    return () => window.removeEventListener('pos-update', handleUpdate);
  }, []);

  // Broad query to ensure reactivity with force update signal
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [changeSignal]);
  
  // Logic to determine if a task should be in "Urgent/Active Card" mode
  // Criteria: Scheduled time exists AND (Now is within 5 mins before OR Now is after scheduled time)
  const isUrgent = (task: Task) => {
      if (!task.scheduledTime || task.status === TaskStatus.Completed) return false;
      const scheduled = new Date(task.scheduledTime);
      const diff = differenceInMinutes(scheduled, currentTime);
      // diff <= 5 (starts in 5 mins or less)
      // diff > -60 (started less than an hour ago - assuming 1h duration default for visibility)
      return diff <= 5 && diff > -60; 
  };

  // Derived State from the broad query
  const activeTasks = React.useMemo(() => {
    if (!allTasks) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const allowedStatuses = [TaskStatus.Active, TaskStatus.Captured, TaskStatus.Scheduled];

    return allTasks
      .filter(t => allowedStatuses.includes(t.status))
      .filter(t => {
          if (!t.executionDate) return true; // Show Inbox items
          return t.executionDate <= today;
      })
      .sort((a, b) => {
          // Urgent tasks float to top
          const aUrgent = isUrgent(a);
          const bUrgent = isUrgent(b);
          if (aUrgent && !bUrgent) return -1;
          if (!aUrgent && bUrgent) return 1;

          // Appointments first, then Priority
          if (a.scheduledTime && !b.scheduledTime) return -1;
          if (!a.scheduledTime && b.scheduledTime) return 1;
          if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.getTime() - b.scheduledTime.getTime();
          return b.priority - a.priority;
      });
  }, [allTasks, currentTime]); // Re-sort when time changes
  
  // Future Appointments (Exclude urgent ones so they don't appear twice if logic overlaps)
  // Logic Updated: Show appointments for the next 10 DAYS
  const upcomingAppointments = React.useMemo(() => {
      if (!allTasks) return [];
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      // Update: 10 Days Lookahead
      const lookaheadLimit = addDays(todayEnd, 10);

      return allTasks
        .filter(t => t.status === TaskStatus.Scheduled)
        .filter(t => !isUrgent(t)) // Don't show if it's currently urgent (shown in main list)
        .filter(t => !!t.executionDate && isAfter(t.executionDate, todayEnd) && t.executionDate <= lookaheadLimit)
        .sort((a, b) => (a.scheduledTime?.getTime() || 0) - (b.scheduledTime?.getTime() || 0));
  }, [allTasks, currentTime]);
  
  const tomorrowTasks = React.useMemo(() => {
    if (!allTasks) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    const tomorrowEnd = addDays(tomorrow, 1);

    return allTasks.filter(t => {
        if (!t.executionDate) return false;
        return t.executionDate >= tomorrow && t.executionDate < tomorrowEnd;
    });
  }, [allTasks]);

  const focusedTask = useLiveQuery(() => 
    db.tasks.where('status').equals(TaskStatus.Focused).first()
  , [changeSignal]);

  const habits = useLiveQuery(() => db.habits.toArray(), [changeSignal]);

  useEffect(() => {
    seedDatabase();
    
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير ☀️');
    else if (hour < 18) setGreeting('مساء الخير 🌤️');
    else setGreeting('مساء الخير 🌙');
  }, []);

  const handleComplete = async (id: number) => {
    try {
        await TaskFSM.transition(id, TaskStatus.Completed);
        toast.success('تم الإنجاز! 🎉');
        forceUpdate();
    } catch(e: any) {
        toast.error(e.message);
    }
  };

  const handleDeleteTask = async () => {
      if (!taskToDelete || !taskToDelete.id) return;
      try {
          await db.tasks.delete(taskToDelete.id);
          toast.success('تم الحذف');
          setTaskToDelete(null);
          forceUpdate();
      } catch (e) {
          toast.error('فشل الحذف');
      }
  };

  const handleDefer = (task: Task) => {
    setModalTask({ task, mode: 'defer' });
  };

  const handleReschedule = (task: Task) => {
    setModalTask({ task, mode: 'default' });
  };

  const handleFocus = async (id: number) => {
    try {
        await TaskFSM.transition(id, TaskStatus.Focused);
        navigate('/focus');
        forceUpdate();
    } catch (e: any) {
        toast.error(e.message);
    }
  };

  const toggleHabit = async (habit: Habit) => {
      await db.habits.update(habit.id!, {
          streakCount: habit.streakCount + 1,
          lastCompletedDate: new Date()
      });
      toast.success(`أحسنت! ${habit.title}`);
      forceUpdate();
  };
  
  // Handler for Accordion Toggle
  const handleTaskToggle = (id: number) => {
    setExpandedTaskId(prevId => prevId === id ? null : id);
  };

  // Stats Data
  const statsData = [
    { name: 'Active', value: activeTasks?.length || 0, color: '#3b82f6' },
    { name: 'Done', value: 5, color: '#10b981' }, 
  ];

  return (
    <div className="h-full overflow-y-auto pb-24">
        <div className="p-6 max-w-lg mx-auto space-y-8 animate-in fade-in">
            
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{greeting}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">لديك {activeTasks?.length || 0} مهام ومواعيد اليوم</p>
                </div>
                <div className="w-16 h-16">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                        <Pie
                            data={statsData}
                            innerRadius={20}
                            outerRadius={30}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {statsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </header>

            {/* Habit Strip */}
            <section className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                <div className="flex gap-4">
                    {habits?.map(habit => (
                        <div 
                            key={habit.id}
                            onClick={() => toggleHabit(habit)}
                            className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                        >
                            <div className="w-14 h-14 rounded-full bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-primary-500 group-hover:bg-primary-50 transition-all">
                                <Flame size={20} className="text-orange-500" />
                            </div>
                            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 text-center truncate w-full">{habit.title}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Focused Task Banner */}
            {focusedTask && (
                <section className="bg-primary-600 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-primary-100 mb-2 text-sm font-bold uppercase tracking-wider">
                            <AlertOctagon size={16} />
                            قيد التركيز الآن
                        </div>
                        <h3 className="text-xl font-bold mb-4 leading-relaxed">{focusedTask.title}</h3>
                        <button 
                            onClick={() => navigate('/focus')}
                            className="bg-white text-primary-700 px-6 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors w-full"
                        >
                            متابعة العمل
                        </button>
                    </div>
                </section>
            )}

            {/* Upcoming Appointments Section (10 Days) */}
            {upcomingAppointments && upcomingAppointments.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
                        <CalendarClock size={20} />
                        <h2 className="text-lg font-bold">مواعيد واجتماعات قادمة (10 أيام)</h2>
                    </div>
                    <div className="space-y-2">
                        {upcomingAppointments.map(apt => (
                            <TaskCard 
                                key={apt.id}
                                task={apt}
                                // Passing onDelete puts the card in "Management Mode" (Edit/Delete buttons only)
                                onDelete={() => setTaskToDelete(apt)}
                                onReschedule={handleReschedule}
                                // Controlled Expansion
                                isExpanded={expandedTaskId === apt.id}
                                onToggle={handleTaskToggle}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Today's Tasks List */}
            <section>
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">جدول اليوم</h2>
                </div>

                <div className="space-y-1">
                    {activeTasks?.length === 0 && !focusedTask ? (
                        <div className="text-center py-10 text-gray-400">
                            <p>لا توجد مهام نشطة، وقت الراحة! ☕</p>
                        </div>
                    ) : (
                        activeTasks?.map(task => {
                            // Check if this task needs the special "Active" card
                            if (isUrgent(task)) {
                                return (
                                    <ActiveTaskCard 
                                        key={task.id}
                                        task={task}
                                        onFocus={handleFocus}
                                        onReschedule={handleReschedule}
                                    />
                                );
                            }
                            return (
                                <TaskCard 
                                    key={task.id} 
                                    task={task} 
                                    onComplete={handleComplete}
                                    onDefer={handleDefer}
                                    onFocus={handleFocus}
                                    onReschedule={handleReschedule}
                                    // Controlled Expansion
                                    isExpanded={expandedTaskId === task.id}
                                    onToggle={handleTaskToggle}
                                />
                            );
                        })
                    )}
                </div>
            </section>

            {/* Tomorrow's Tasks (Collapsible) */}
            {tomorrowTasks && tomorrowTasks.length > 0 && (
                <section className="pt-6 border-t dark:border-gray-800">
                    <button 
                        onClick={() => setShowTomorrow(!showTomorrow)}
                        className="flex items-center justify-between w-full text-gray-500 dark:text-gray-400 mb-4"
                    >
                        <span className="font-bold flex items-center gap-2">
                            القادم غداً ({tomorrowTasks.length})
                        </span>
                        {showTomorrow ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    
                    {showTomorrow && (
                        <div className="space-y-2 opacity-75">
                            {tomorrowTasks.map(task => (
                                <div key={task.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl flex justify-between items-center">
                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{task.title}</span>
                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">مجدول</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Modals */}
            {modalTask && (
                <RescheduleModal 
                    task={modalTask.task}
                    mode={modalTask.mode}
                    onClose={() => setModalTask(null)} 
                    onSuccess={forceUpdate}
                />
            )}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={!!taskToDelete}
                onClose={() => setTaskToDelete(null)}
                onConfirm={handleDeleteTask}
                title="حذف الموعد؟"
                message={`هل أنت متأكد من حذف "${taskToDelete?.title}"؟`}
            />
        </div>
    </div>
  );
};
