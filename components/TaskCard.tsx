
import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus } from '../types';
import { Clock, CheckCircle2, ArrowRightCircle, PlayCircle, Calendar, Users, CheckSquare, ChevronDown, ChevronUp, StickyNote, Eye, Pencil, CalendarClock, Trash2, Edit } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';
import { LinkedContentModal } from './LinkedContentModal';

interface TaskCardProps {
  task: Task;
  linkedNotesCount?: number; // Receive count as prop instead of fetching internally
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: (id: number) => void;
  onComplete?: (id: number) => void;
  onDefer?: (task: Task) => void;
  onFocus?: (id: number) => void;
  onReschedule?: (task: Task) => void;
  onDelete?: (id: number) => void;
}

// Wrap in React.memo to prevent unnecessary re-renders during parent updates
export const TaskCard: React.FC<TaskCardProps> = React.memo(({ 
    task, 
    linkedNotesCount = 0,
    defaultExpanded = false, 
    isExpanded, 
    onToggle, 
    onComplete, 
    onDefer, 
    onFocus, 
    onReschedule, 
    onDelete 
}) => {
  // Local state for uncontrolled usage (fallback)
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const [showLinkedModal, setShowLinkedModal] = useState(false);
  
  // Determine effective state
  const isCardExpanded = isExpanded !== undefined ? isExpanded : localExpanded;

  const isScheduled = task.status === TaskStatus.Scheduled;
  const isCompleted = task.status === TaskStatus.Completed;
  const isMeeting = task.type === 'meeting';
  const isAppointment = task.type === 'appointment' || (isScheduled && !task.type);
  const isTask = !isMeeting && !isAppointment;

  // Configuration based on Type
  let config = {
      label: 'مهمة',
      icon: CheckSquare,
      colorClass: 'bg-blue-500 text-white shadow-blue-500/20',
      lightBg: 'bg-white dark:bg-gray-800', 
      border: 'border-gray-200 dark:border-gray-700', 
      badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
  };

  if (isMeeting) {
      config = {
          label: 'اجتماع',
          icon: Users,
          colorClass: 'bg-teal-500 text-white shadow-teal-500/20',
          lightBg: 'bg-white dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800'
      };
  } else if (isAppointment) {
      config = {
          label: 'موعد',
          icon: CalendarClock,
          colorClass: 'bg-purple-500 text-white shadow-purple-500/20',
          lightBg: 'bg-white dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
      };
  }

  if (isCompleted) {
      config = {
          ...config,
          label: 'منجزة',
          badgeStyle: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
          colorClass: 'bg-gray-400 text-white shadow-none grayscale', 
      };
  }
  
  let priorityColorClass = '';
  if (isTask && !isCompleted) {
      if (task.priority === TaskPriority.High) priorityColorClass = 'bg-red-500';
      else if (task.priority === TaskPriority.Medium) priorityColorClass = 'bg-amber-500';
      else priorityColorClass = 'bg-blue-300'; 
  } else if (isCompleted) {
      priorityColorClass = 'bg-green-500'; 
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = task.executionDate && isBefore(new Date(task.executionDate), today) && !isCompleted;
  
  const timeString = task.scheduledTime ? format(new Date(task.scheduledTime), 'hh:mm a', { locale: ar }) : '';
  const dateString = task.executionDate ? format(new Date(task.executionDate), 'd MMMM', { locale: ar }) : '';

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) return;
    if (onToggle && task.id) onToggle(task.id);
    else setLocalExpanded(!localExpanded);
  };

  return (
    <>
        <div className={`relative rounded-2xl p-2.5 mb-2 transition-all duration-300 border shadow-sm hover:shadow-md overflow-hidden
            ${config.lightBg} ${config.border} ${isCardExpanded ? 'ring-2 ring-primary-500/20' : ''}`}
        >
        {priorityColorClass && <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityColorClass}`} />}

        <div 
            className={`flex gap-3 transition-all ${isCardExpanded ? 'items-start' : 'items-center'} ${!isCompleted ? 'cursor-pointer' : ''}`} 
            onClick={toggleExpand}
        >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${config.colorClass}`}>
                {isCompleted ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <config.icon size={18} strokeWidth={2.5} />}
            </div>

            <div className={`flex-1 min-w-0 pl-1 ${isCardExpanded ? 'pt-0.5' : ''}`}>
                <h4 className={`font-bold text-gray-900 dark:text-gray-100 text-sm transition-all ${isCardExpanded ? 'whitespace-pre-wrap break-words leading-relaxed' : 'truncate leading-snug'} ${isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>
                    {task.title}
                </h4>
                
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                    {dateString && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                            <Calendar size={12} className="opacity-70" />
                            {dateString}
                        </span>
                    )}
                    
                    {timeString && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400" dir="ltr">
                            <Clock size={12} className="opacity-70" />
                            {timeString}
                        </span>
                    )}

                    {task.durationMinutes && (
                        <span className="bg-gray-100 border border-gray-200 dark:bg-gray-700/60 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            ( {task.durationMinutes} د )
                        </span>
                    )}

                    {task.rolloverCount > 0 && !isCompleted && (
                        <span className="text-orange-600 bg-orange-100 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-900 px-1 py-0.5 rounded text-[10px]">
                            مؤجلة
                        </span>
                    )}
                </div>
            </div>

            <div className={`flex items-center gap-2 ml-1 flex-shrink-0 ${isCardExpanded ? 'mt-1' : ''}`}>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${config.badgeStyle}`}>
                    {config.label}
                </span>

                {linkedNotesCount > 0 ? (
                    <div className="flex items-center justify-center bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                        <StickyNote size={12} />
                        <span className="text-[10px] font-bold mr-1">{linkedNotesCount}</span>
                    </div>
                ) : null}

                {!isCompleted && (
                    <button 
                        onClick={toggleExpand}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0
                            ${isCardExpanded 
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        {isCardExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                )}
            </div>
        </div>

        {isCardExpanded && !isCompleted && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 fade-in pl-1">
                    
                    {linkedNotesCount > 0 ? (
                        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-2.5 mb-3 flex items-center justify-between border border-amber-200 dark:border-amber-800/50">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-xs font-bold">
                                <StickyNote size={16} />
                                <span>يوجد {linkedNotesCount} أفكار وملاحظات مرتبطة</span>
                            </div>
                            <button 
                                onClick={() => setShowLinkedModal(true)}
                                className="bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-amber-100 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                            >
                                <Eye size={14} />
                                عرض
                            </button>
                        </div>
                    ) : null}

                    {onDelete ? (
                        <div className="grid grid-cols-2 gap-3">
                             <button 
                                onClick={() => onReschedule?.(task)}
                                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-bold text-xs"
                            >
                                <Pencil size={16} />
                                <span>تعديل</span>
                            </button>

                            <button 
                                onClick={() => onDelete(task.id!)}
                                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors font-bold text-xs"
                            >
                                <Trash2 size={16} />
                                <span>حذف</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {isTask && task.status !== TaskStatus.Focused && onFocus && (
                                <button 
                                    onClick={() => onFocus(task.id!)}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                                >
                                    <PlayCircle size={18} />
                                    <span className="text-[10px] font-bold">بدء التركيز</span>
                                </button>
                            )}

                            <button 
                                onClick={() => isScheduled && onReschedule ? onReschedule(task) : onDefer?.(task)}
                                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 transition-colors"
                            >
                                {isScheduled ? <Edit size={18} /> : <ArrowRightCircle size={18} />}
                                <span className="text-[10px] font-bold">{isScheduled ? 'تعديل' : 'تأجيل'}</span>
                            </button>

                            {onComplete && (
                                <button 
                                    onClick={() => onComplete(task.id!)}
                                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors
                                        ${!isTask ? 'col-span-2 bg-green-50 dark:bg-green-900/20' : 'bg-green-50 dark:bg-green-900/20'}
                                    `}
                                >
                                    <CheckCircle2 size={18} />
                                    <span className="text-[10px] font-bold">{isScheduled ? 'تم الحضور' : 'إنجاز'}</span>
                                </button>
                            )}
                        </div>
                    )}
            </div>
        )}
        </div>

        {showLinkedModal && (
            <LinkedContentModal 
                parentTaskId={task.id!} 
                parentTitle={task.title}
                onClose={() => setShowLinkedModal(false)} 
            />
        )}
    </>
  );
});
