
import React, { useEffect, useState } from 'react';
import { Task } from '../types';
import { PlayCircle, AlertOctagon, Clock, Calendar, Users, CheckSquare, CalendarClock, Timer } from 'lucide-react';
import { differenceInSeconds } from 'date-fns';

interface ActiveTaskCardProps {
  task: Task;
  onFocus: (id: number) => void;
  onReschedule: (task: Task) => void;
}

export const ActiveTaskCard: React.FC<ActiveTaskCardProps> = ({ task, onFocus, onReschedule }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
        if (!task.scheduledTime) return;
        
        const now = new Date();
        const scheduled = new Date(task.scheduledTime);
        const diffInSeconds = differenceInSeconds(scheduled, now);

        if (diffInSeconds > 0) {
            // Countdown phase (within 5 mins)
            const m = Math.floor(diffInSeconds / 60);
            const s = diffInSeconds % 60;
            setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
            
            // Customize message based on type
            if (task.type === 'meeting') {
                setStatusMessage('استعد! يبدأ الاجتماع خلال');
            } else {
                setStatusMessage('استعد! يبدأ الموعد خلال');
            }
            
            setIsOverdue(false);
        } else {
            // Started phase
            const absDiff = Math.abs(diffInSeconds);
            const m = Math.floor(absDiff / 60);
            setTimeLeft(`${m} دقيقة`);
            
            // Customize message based on type
            if (task.type === 'meeting') {
                setStatusMessage('بدأ الاجتماع منذ');
            } else {
                setStatusMessage('بدأ الموعد منذ');
            }

            setIsOverdue(true);
        }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [task.scheduledTime, task.type]);

  const getTypeLabel = () => {
      if (task.type === 'meeting') return 'اجتماع';
      if (task.type === 'appointment') return 'موعد';
      return 'مهمة';
  };

  const getTypeIcon = () => {
      if (task.type === 'meeting') return <Users size={16} />;
      if (task.type === 'appointment') return <Calendar size={16} />;
      return <CheckSquare size={16} />;
  };

  return (
    <div className="bg-primary-600 rounded-2xl p-5 mb-4 shadow-xl shadow-primary-600/30 text-white relative overflow-hidden animate-in zoom-in-95 duration-300">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
      
      {/* Header: Alert & Type */}
      <div className="relative z-10 flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold">
                {getTypeIcon()}
                <span>{getTypeLabel()}</span>
            </div>
            
            {/* Duration Pill (Separate) */}
            {task.durationMinutes && (
                <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-white/90">
                    ( {task.durationMinutes} د )
                </div>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 text-primary-100 animate-pulse">
              <AlertOctagon size={18} />
              <span className="text-xs font-bold">حان الوقت تقريباً</span>
          </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center py-2">
          <h3 className="text-xl font-bold mb-1 leading-snug">{task.title}</h3>
          
          <div className="flex items-center justify-center gap-2 text-primary-100 text-sm font-medium opacity-90 mt-2">
              <Clock size={16} />
              <span>{statusMessage} <span className="font-mono font-bold text-white bg-white/20 px-2 py-0.5 rounded text-xs">{timeLeft}</span></span>
          </div>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 mt-4 flex gap-3">
          <button 
            onClick={() => onFocus(task.id!)}
            className="flex-1 bg-white text-primary-600 hover:bg-gray-50 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
          >
              <PlayCircle size={20} fill="currentColor" className="text-primary-600" />
              <span>{task.type === 'meeting' ? 'الانضمام للاجتماع' : 'بدء التركيز الآن'}</span>
          </button>

          <button 
             onClick={() => onReschedule(task)}
             className="w-14 bg-white/20 hover:bg-white/30 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm"
             title="تأجيل / تعديل الوقت"
          >
              <CalendarClock size={20} />
          </button>
      </div>
    </div>
  );
};
