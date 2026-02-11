
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TaskStatus, Task } from '../types';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { X, Play, Pause, CheckCircle, Music, Users, CalendarClock, MicOff, Mic, Video, PhoneOff, PlayCircle, ArrowRight } from 'lucide-react';
import { TaskFSM } from '../services/fsm';

export const FocusMode: React.FC = () => {
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  
  // Query the currently focused task
  const focusedTask = useLiveQuery(() => 
    db.tasks.where('status').equals(TaskStatus.Focused).first()
  );

  // Query active tasks for selection if needed
  const activeTasks = useLiveQuery(() => 
    db.tasks.where('status').equals(TaskStatus.Active).toArray()
  );

  // General State
  const [isActive, setIsActive] = useState(false); // Auto-start usually, but allow pause
  const [isDone, setIsDone] = useState(false);

  // Focus (Pomodoro) State
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes countdown

  // Meeting State
  const [elapsedTime, setElapsedTime] = useState(0); // Count up
  const [isMuted, setIsMuted] = useState(true); // Fake meeting control

  const isMeetingMode = focusedTask?.type === 'meeting' || focusedTask?.type === 'appointment';

  useEffect(() => {
    // Auto-start timer when component loads with a focused task
    if (focusedTask) setIsActive(true);
  }, [focusedTask]);

  useEffect(() => {
    let interval: any;
    if (isActive && !isDone) {
      interval = setInterval(() => {
        if (isMeetingMode) {
            // Count UP for meetings
            setElapsedTime(prev => prev + 1);
        } else {
            // Count DOWN for tasks
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    setIsActive(false);
                    return 0;
                }
                return prev - 1;
            });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isDone, isMeetingMode]);

  const toggleTimer = () => setIsActive(!isActive);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCompleteTask = async () => {
    if (!focusedTask) return;
    setIsDone(true);
    
    // Different delay/feedback based on mode
    const delay = isMeetingMode ? 1500 : 3000;
    
    setTimeout(async () => {
      await TaskFSM.transition(focusedTask.id!, TaskStatus.Completed);
      navigate('/');
    }, delay);
  };

  const handleExit = async () => {
    navigate('/');
  };

  const handleSelectTask = async (task: Task) => {
    try {
        await TaskFSM.transition(task.id!, TaskStatus.Focused);
        // UI will update automatically due to useLiveQuery
    } catch (e: any) {
        console.error(e);
    }
  };

  // ----------------------------------------------------------------
  // CASE 1: NO FOCUSED TASK (SELECTION SCREEN)
  // ----------------------------------------------------------------
  if (!focusedTask && !isDone) {
    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                    >
                        <ArrowRight size={20} />
                    </button>
                    <h1 className="text-2xl font-bold">وضع التركيز</h1>
                </div>
            </div>

            {/* Selection List */}
            <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
                <h2 className="text-xl text-gray-300 mb-6 font-bold">بم تريد أن تبدأ؟</h2>
                
                {activeTasks && activeTasks.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto pb-10">
                        {activeTasks.map(task => (
                            <button 
                                key={task.id}
                                onClick={() => handleSelectTask(task)}
                                className="w-full bg-gray-800 p-5 rounded-2xl text-right border border-gray-700 hover:border-primary-500 hover:bg-gray-750 transition-all group flex justify-between items-center active:scale-95"
                            >
                                <div>
                                    <span className="font-bold block text-lg mb-1">{task.title}</span>
                                    {task.priority === 3 && <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">عالية الأولوية</span>}
                                </div>
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                    <PlayCircle size={20} />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 opacity-60">
                        <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle size={40} />
                        </div>
                        <p>لا توجد مهام نشطة حالياً.</p>
                        <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-gray-800 rounded-full text-sm font-bold hover:bg-gray-700">
                            العودة للرئيسية
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // ----------------------------------------------------------------
  // CASE 2: MEETING MODE UI
  // ----------------------------------------------------------------
  if (isMeetingMode) {
      return (
        <div className="relative h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-between py-8 px-6 overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 z-0" />
            
            {/* Top Bar */}
            <div className="w-full flex justify-between items-center z-10">
                <div className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1 rounded-full animate-pulse border border-red-500/30">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {focusedTask?.type === 'meeting' ? 'اجتماع جاري' : 'موعد جاري'}
                    </span>
                </div>
                <button onClick={handleExit} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Center Content */}
            <div className="flex flex-col items-center z-10 text-center w-full max-w-md flex-1 justify-center">
                
                {/* Icon Visual */}
                <div className="mb-8 relative">
                    <div className="w-32 h-32 rounded-3xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-[0_0_40px_rgba(20,184,166,0.1)]">
                        {focusedTask?.type === 'meeting' ? (
                            <Users size={64} className="text-teal-400" />
                        ) : (
                            <CalendarClock size={64} className="text-purple-400" />
                        )}
                    </div>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-snug">{focusedTask?.title}</h2>
                
                {/* Duration Timer */}
                <div className="font-mono text-5xl font-bold tracking-wider text-slate-200 mb-8 tabular-nums">
                    {formatTime(elapsedTime)}
                </div>

                {/* Dummy Controls for "Meeting Feel" */}
                {focusedTask?.type === 'meeting' && (
                    <div className="flex gap-4 mb-8">
                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'}`}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>
                        <button className="p-4 rounded-full bg-slate-700 text-white opacity-50 cursor-not-allowed">
                            <Video size={24} />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Action */}
            <div className="w-full max-w-sm z-10 pb-8">
                <button 
                    onClick={handleCompleteTask}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 transition-transform active:scale-95"
                >
                    <PhoneOff size={24} />
                    {focusedTask?.type === 'meeting' ? 'إنهاء الاجتماع' : 'إنهاء الموعد'}
                </button>
            </div>
        </div>
      );
  }

  // ----------------------------------------------------------------
  // CASE 3: STANDARD FOCUS MODE UI (Pomodoro)
  // ----------------------------------------------------------------
  return (
    <div className="relative h-screen w-full bg-gray-900 text-white flex flex-col items-center justify-between py-12 px-6 overflow-hidden">
      {isDone && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}

      {/* Top Bar */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md cursor-pointer hover:bg-white/20 transition-colors">
            <Music size={16} />
            <span className="text-xs">Lo-Fi Beats</span>
        </div>
        <button onClick={handleExit} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
            <X size={24} />
        </button>
      </div>

      {/* Center Content */}
      <div className="flex flex-col items-center z-10 text-center max-w-md">
         <div className="mb-10 relative">
             {/* Progress Circle Visual */}
             <div className="w-64 h-64 rounded-full border-4 border-gray-700 flex items-center justify-center relative">
                 <div 
                    className={`absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent opacity-50 ${isActive ? 'animate-spin-slow' : ''}`} 
                    style={{ animationDuration: '3s' }}
                 />
                 <span className="text-6xl font-mono font-bold tracking-wider">{formatTime(timeLeft)}</span>
             </div>
             <button 
                onClick={toggleTimer}
                className="absolute bottom-0 right-10 bg-primary-600 p-4 rounded-full shadow-lg shadow-primary-500/40 hover:bg-primary-500 transition-transform active:scale-95"
             >
                 {isActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
             </button>
         </div>

         <h2 className="text-2xl font-bold mb-2 leading-relaxed">{focusedTask?.title}</h2>
         <p className="text-gray-400 text-sm">ركز فقط على هذه المهمة حتى يرن الجرس</p>
      </div>

      {/* Bottom Action */}
      <div className="w-full max-w-xs z-10">
         <button 
            onClick={handleCompleteTask}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-3 transition-transform active:scale-95"
         >
             <CheckCircle size={24} />
             تم إنجاز المهمة
         </button>
      </div>
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 z-0" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-900/20 rounded-full blur-3xl z-0" />
    </div>
  );
};
