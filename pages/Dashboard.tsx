
import React, { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Task, TaskStatus } from '../types';
import { TaskCard } from '../components/TaskCard';
import { ActiveTaskCard } from '../components/ActiveTaskCard';
import { RescheduleModal } from '../components/RescheduleModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { TaskFSM } from '../services/fsm';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { AlertOctagon, ChevronDown, ChevronUp, CalendarClock, Users, CheckSquare, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { addDays, isAfter, differenceInMinutes, isSameDay } from 'date-fns';
import { syncService } from '../services/syncService';

const DashboardSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-48 mb-6"></div>
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
        </div>
    </div>
    <div className="flex gap-2 mb-4 overflow-hidden">
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
    <div className="space-y-2">
        {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"></div>
        ))}
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('');
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'task' | 'appointment' | 'meeting'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [modalTask, setModalTask] = useState<{task: Task, mode: 'default' | 'defer'} | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [changeSignal, setChangeSignal] = useState(0);
  
  const forceUpdate = () => setChangeSignal(c => c + 1);

  // Trigger Sync on Mount to ensure data freshness
  useEffect(() => {
    syncService.triggerSync();
    
    // Safety check: force update after 1s in case cold start sync happened too fast
    const t = setTimeout(() => {
        forceUpdate();
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const checkTimeAndRollover = async () => {
        setCurrentTime(new Date());
        const updatesMade = await TaskFSM.performRollover();
        if (updatesMade) forceUpdate();
    };
    checkTimeAndRollover();
    const timer = setInterval(checkTimeAndRollover, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleUpdate = () => forceUpdate();
    window.addEventListener('pos-update', handleUpdate);
    return () => window.removeEventListener('pos-update', handleUpdate);
  }, []);

  // --- EAGER LOADING STRATEGY ---
  const dashboardData = useLiveQuery(async () => {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

      // 1. Fetch relevant tasks (Indexed) - Filter Deleted
      const activeItems = await db.tasks
          .where('status')
          .anyOf([
              TaskStatus.Active, 
              TaskStatus.Captured, 
              TaskStatus.Scheduled, 
              TaskStatus.Focused, 
              TaskStatus.Deferred, 
              TaskStatus.Stalled
          ])
          .filter(t => !t.deletedAt)
          .toArray();

      const completedToday = await db.tasks
          .where('executionDate')
          .between(todayStart, todayEnd, true, true)
          .filter(t => t.status === TaskStatus.Completed && !t.deletedAt)
          .toArray();

      const allRelevantTasks = [...activeItems, ...completedToday];

      // 2. Fetch Idea Counts for these tasks (Eager Loading)
      const taskIds = allRelevantTasks.map(t => t.id!).filter(Boolean);
      
      let noteCounts: Record<number, number> = {};
      
      if (taskIds.length > 0) {
          const linkedIdeas = await db.ideas
              .where('linkedTaskId')
              .anyOf(taskIds)
              .filter(i => !i.deletedAt)
              .toArray();
          
          linkedIdeas.forEach(idea => {
              if (idea.linkedTaskId) {
                  noteCounts[idea.linkedTaskId] = (noteCounts[idea.linkedTaskId] || 0) + 1;
              }
          });
      }

      return { tasks: allRelevantTasks, noteCounts };
  }, [changeSignal]);

  const relevantTasks = dashboardData?.tasks;
  const noteCounts = dashboardData?.noteCounts || {};

  const isUrgent = (task: Task) => {
      if (!task.scheduledTime || task.status === TaskStatus.Completed) return false;
      const scheduled = new Date(task.scheduledTime);
      const diff = differenceInMinutes(scheduled, currentTime);
      return diff <= 5 && diff > -60; 
  };

  const todayStats = React.useMemo(() => {
    if (!relevantTasks) return {
        total: 0, completed: 0, percentage: 0,
        tasks: 0, meetings: 0, appointments: 0,
        statusColor: '', statusText: '', progressColor: ''
    };

    const today = new Date();
    const todaysItems = relevantTasks.filter(t => {
        if (!t.executionDate) return false;
        return isSameDay(new Date(t.executionDate), today);
    });

    const total = todaysItems.length;
    const completed = todaysItems.filter(t => t.status === TaskStatus.Completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    const tasks = todaysItems.filter(t => !t.type || t.type === 'task').length;
    const meetings = todaysItems.filter(t => t.type === 'meeting').length;
    const appointments = todaysItems.filter(t => t.type === 'appointment').length;

    let statusColor = 'text-gray-500';
    let statusText = 'بداية اليوم';
    let progressColor = '#e5e7eb';

    if (total > 0) {
        if (percentage === 100) {
            statusColor = 'text-yellow-600 dark:text-yellow-400';
            statusText = 'رائع! اكتمل اليوم 🏆';
            progressColor = '#eab308';
        } else if (percentage >= 75) {
            statusColor = 'text-green-700 dark:text-green-400';
            statusText = 'أداء ممتاز 🚀';
            progressColor = '#10b981';
        } else if (percentage >= 40) {
            statusColor = 'text-blue-700 dark:text-blue-400';
            statusText = 'تقدم جيد 👍';
            progressColor = '#3b82f6';
        } else {
            statusColor = 'text-gray-600 dark:text-gray-400';
            statusText = 'واصل العمل 💪';
            progressColor = '#f97316';
        }
    } else {
        statusText = 'يوم هادئ ☕';
    }

    return { total, completed, percentage, tasks, meetings, appointments, statusColor, statusText, progressColor };
  }, [relevantTasks, currentTime]);

  const pieData = [
    { name: 'Completed', value: todayStats.percentage, color: todayStats.progressColor },
    { name: 'Remaining', value: 100 - todayStats.percentage, color: '#f3f4f6' },
  ];
  if (document.documentElement.classList.contains('dark')) {
      pieData[1].color = '#374151'; 
  }

  const activeTasks = React.useMemo(() => {
    if (!relevantTasks) return [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const allowedStatuses = [TaskStatus.Active, TaskStatus.Captured, TaskStatus.Scheduled];

    return relevantTasks
      .filter(t => allowedStatuses.includes(t.status))
      .filter(t => {
          if (!t.executionDate) return true;
          return t.executionDate <= today;
      })
      .sort((a, b) => {
          const aUrgent = isUrgent(a);
          const bUrgent = isUrgent(b);
          if (aUrgent && !bUrgent) return -1;
          if (!aUrgent && bUrgent) return 1;

          if (a.scheduledTime && !b.scheduledTime) return -1;
          if (!a.scheduledTime && b.scheduledTime) return 1;
          if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.getTime() - b.scheduledTime.getTime();
          return b.priority - a.priority;
      });
  }, [relevantTasks, currentTime]);

  const filteredActiveTasks = useMemo(() => {
      if (filterType === 'all') return activeTasks;
      return activeTasks.filter(t => {
          if (filterType === 'task') return !t.type || t.type === 'task';
          return t.type === filterType;
      });
  }, [activeTasks, filterType]);
  
  const upcomingAppointments = React.useMemo(() => {
      if (!relevantTasks) return [];
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const lookaheadLimit = addDays(todayEnd, 3);

      return relevantTasks
        .filter(t => t.status === TaskStatus.Scheduled)
        .filter(t => !isUrgent(t)) 
        .filter(t => !!t.executionDate && isAfter(t.executionDate, todayEnd) && t.executionDate <= lookaheadLimit)
        .sort((a, b) => (a.scheduledTime?.getTime() || 0) - (b.scheduledTime?.getTime() || 0));
  }, [relevantTasks, currentTime]);
  
  const tomorrowTasks = React.useMemo(() => {
    if (!relevantTasks) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    const tomorrowEnd = addDays(tomorrow, 1);

    return relevantTasks.filter(t => {
        if (!t.executionDate) return false;
        return t.executionDate >= tomorrow && t.executionDate < tomorrowEnd;
    });
  }, [relevantTasks]);

  const focusedTask = useLiveQuery(() => 
    db.tasks.where('status').equals(TaskStatus.Focused).first()
  , [changeSignal]);

  useEffect(() => {
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
          // Use deleteRecord for Hard Delete
          await syncService.deleteRecord('tasks', taskToDelete.id);
          toast.success('تم الحذف');
          setTaskToDelete(null);
          forceUpdate();
      } catch (e) {
          toast.error('فشل الحذف');
      }
  };

  const handleDefer = (task: Task) => { setModalTask({ task, mode: 'defer' }); };
  const handleReschedule = (task: Task) => { setModalTask({ task, mode: 'default' }); };
  const handleFocus = async (id: number) => {
    try {
        await TaskFSM.transition(id, TaskStatus.Focused);
        navigate('/focus');
        forceUpdate();
    } catch (e: any) { toast.error(e.message); }
  };
  const handleTaskToggle = (id: number) => { setExpandedTaskId(prevId => prevId === id ? null : id); };

  const displayedUpcoming = showAllUpcoming ? upcomingAppointments : upcomingAppointments.slice(0, 3);
  const hiddenUpcomingCount = upcomingAppointments.length - 3;

  return (
    <div className="h-full overflow-y-auto pb-24">
        <div className="p-6 max-w-lg mx-auto space-y-6">
            
            {!dashboardData ? (
                <DashboardSkeleton />
            ) : (
                <div className="animate-in fade-in duration-300">
                    <header className="mb-2">
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">{greeting}</h1>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 relative flex-shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} innerRadius={24} outerRadius={32} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                                    {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                                    <Label value={`${todayStats.percentage}%`} position="center" className="font-bold text-xs dark:fill-white fill-gray-900" />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 font-medium mb-0.5">مؤشر الإنجاز اليومي</div>
                                        <div className={`text-lg font-extrabold ${todayStats.statusColor}`}>{todayStats.statusText}</div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <Trophy size={12} className={todayStats.percentage === 100 ? 'text-yellow-500' : 'text-gray-400'} />
                                            <span>تم إنجاز {todayStats.completed} من {todayStats.total}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-50 dark:bg-blue-900/10">
                                    <span className="text-xs text-blue-700 dark:text-blue-400 font-bold mb-1 flex items-center gap-1"><CheckSquare size={12} />مهام</span>
                                    <span className="text-lg font-extrabold text-blue-800 dark:text-blue-300">{todayStats.tasks}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-50 dark:bg-purple-900/10">
                                    <span className="text-xs text-purple-700 dark:text-purple-400 font-bold mb-1 flex items-center gap-1"><CalendarClock size={12} />مواعيد</span>
                                    <span className="text-lg font-extrabold text-purple-800 dark:text-purple-300">{todayStats.appointments}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-teal-50 dark:bg-teal-900/10">
                                    <span className="text-xs text-teal-700 dark:text-teal-400 font-bold mb-1 flex items-center gap-1"><Users size={12} />اجتماعات</span>
                                    <span className="text-lg font-extrabold text-teal-800 dark:text-teal-300">{todayStats.meetings}</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {focusedTask && (
                        <section className="bg-primary-600 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/20 relative overflow-hidden mb-6">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 text-primary-100 mb-2 text-sm font-bold uppercase tracking-wider">
                                    <AlertOctagon size={16} />
                                    قيد التركيز الآن
                                </div>
                                <h3 className="text-xl font-bold mb-4 leading-relaxed">{focusedTask.title}</h3>
                                <button onClick={() => navigate('/focus')} className="bg-white text-primary-700 px-6 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors w-full">متابعة العمل</button>
                            </div>
                        </section>
                    )}

                    <section>
                        <div className="flex justify-between items-end mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">جدول اليوم</h2>
                        </div>
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                            {[{id:'all',l:'الكل'},{id:'task',l:'مهام'},{id:'appointment',l:'مواعيد'},{id:'meeting',l:'اجتماعات'}].map(f => (
                                <button key={f.id} onClick={() => setFilterType(f.id as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center justify-center whitespace-nowrap ${filterType === f.id ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900 border-gray-800 dark:border-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{f.l}</button>
                            ))}
                        </div>
                        <div className="space-y-1">
                            {filteredActiveTasks?.length === 0 && !focusedTask ? (
                                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"><p className="text-gray-500">لا توجد عناصر لعرضها في هذا التصنيف. ☕</p></div>
                            ) : (
                                filteredActiveTasks?.map(task => {
                                    if (isUrgent(task)) return <ActiveTaskCard key={task.id} task={task} onFocus={handleFocus} onReschedule={handleReschedule} />;
                                    return <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        // Pass the pre-fetched count here
                                        linkedNotesCount={noteCounts[task.id!] || 0}
                                        onComplete={handleComplete} 
                                        onDefer={handleDefer} 
                                        onFocus={handleFocus} 
                                        onReschedule={handleReschedule} 
                                        isExpanded={expandedTaskId === task.id} 
                                        onToggle={handleTaskToggle} 
                                    />;
                                })
                            )}
                        </div>
                    </section>

                    {upcomingAppointments && upcomingAppointments.length > 0 && (
                        <section className="pt-6 border-t border-gray-100 dark:border-gray-800 mt-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400"><CalendarClock size={20} /><h2 className="text-lg font-bold">مواعيد قادمة</h2></div>
                            </div>
                            <div className="space-y-2">
                                {displayedUpcoming.map(apt => <TaskCard 
                                    key={apt.id} 
                                    task={apt} 
                                    linkedNotesCount={noteCounts[apt.id!] || 0}
                                    onDelete={() => setTaskToDelete(apt)} 
                                    onReschedule={handleReschedule} 
                                    isExpanded={expandedTaskId === apt.id} 
                                    onToggle={handleTaskToggle} 
                                />)}
                            </div>
                            {upcomingAppointments.length > 3 && (
                                <button onClick={() => setShowAllUpcoming(!showAllUpcoming)} className="w-full mt-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors flex items-center justify-center gap-1">
                                    {showAllUpcoming ? <><span>عرض أقل</span><ChevronUp size={14} /></> : <><span>عرض المزيد ({hiddenUpcomingCount})</span><ChevronDown size={14} /></>}
                                </button>
                            )}
                        </section>
                    )}

                    {tomorrowTasks && tomorrowTasks.length > 0 && (
                        <section className="pt-6 border-t dark:border-gray-800 mt-4">
                            <button onClick={() => setShowTomorrow(!showTomorrow)} className="flex items-center justify-between w-full text-gray-600 dark:text-gray-400 mb-4">
                                <span className="font-bold flex items-center gap-2">القادم غداً ({tomorrowTasks.length})</span>
                                {showTomorrow ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {showTomorrow && (
                                <div className="space-y-2 opacity-90 animate-in fade-in">
                                    {tomorrowTasks.map(task => (
                                        <div key={task.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-800 dark:text-gray-300 font-medium">{task.title}</span>
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-400">مجدول</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}

            {modalTask && <RescheduleModal task={modalTask.task} mode={modalTask.mode} onClose={() => setModalTask(null)} onSuccess={forceUpdate} />}
            <DeleteConfirmationModal isOpen={!!taskToDelete} onClose={() => setTaskToDelete(null)} onConfirm={handleDeleteTask} title="حذف الموعد؟" message={`هل أنت متأكد من حذف "${taskToDelete?.title}"؟`} />
        </div>
    </div>
  );
};
