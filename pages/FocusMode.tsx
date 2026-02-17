
import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TaskStatus, Task } from '../types';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { X, Play, Pause, CheckCircle, Music, Users, CalendarClock, MicOff, Mic, Video, PhoneOff, PlayCircle, ArrowRight, AlertOctagon, VideoOff } from 'lucide-react';
import { TaskFSM } from '../services/fsm';
import toast from 'react-hot-toast';

export const FocusMode: React.FC = () => {
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  
  // Query the currently focused task - Filter deletedAt
  const focusedTask = useLiveQuery(() => 
    db.tasks.where('status').equals(TaskStatus.Focused).filter(t => !t.deletedAt).first()
  );

  // Query active tasks for selection - Filter deletedAt
  const activeTasks = useLiveQuery(() => 
    db.tasks.where('status').equals(TaskStatus.Active).filter(t => !t.deletedAt).toArray()
  );

  // View State
  const [viewMode, setViewMode] = useState<'selection' | 'timer'>('selection');

  // Timer State
  const [isActive, setIsActive] = useState(false); 
  const [isDone, setIsDone] = useState(false);
  
  // Ref to track start/end times accurately without drift
  const timerEndRef = useRef<number | null>(null);
  const timerStartRef = useRef<number | null>(null); // For counting up
  
  // Display State
  const [timeLeft, setTimeLeft] = useState(25 * 60); // Seconds remaining
  const [elapsedTime, setElapsedTime] = useState(0); // Seconds elapsed (for meetings)

  // Meeting State
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);

  const isMeetingMode = focusedTask?.type === 'meeting' || focusedTask?.type === 'appointment';

  // --- TIMER LOGIC (Drift-Free) ---
  useEffect(() => {
      let animationFrameId: number;

      const tick = () => {
          if (!isActive) return;

          const now = Date.now();

          if (isMeetingMode) {
              // Count UP
              if (!timerStartRef.current) timerStartRef.current = now - (elapsedTime * 1000);
              const diff = Math.floor((now - timerStartRef.current) / 1000);
              setElapsedTime(diff);
          } else {
              // Count DOWN (Pomodoro)
              if (!timerEndRef.current) {
                   // Init: Current Time + Remaining Seconds
                   timerEndRef.current = now + (timeLeft * 1000);
              }

              const remaining = Math.ceil((timerEndRef.current - now) / 1000);
              
              if (remaining <= 0) {
                  setTimeLeft(0);
                  setIsActive(false);
                  timerEndRef.current = null;
                  // Optional: Play sound here
              } else {
                  setTimeLeft(remaining);
              }
          }
          
          animationFrameId = requestAnimationFrame(tick);
      };

      if (isActive) {
          animationFrameId = requestAnimationFrame(tick);
      } else {
          // Paused: Clear refs so they reset relative to current time on resume
          // But we must preserve the visual TimeLeft/ElapsedTime in state
          timerEndRef.current = null;
          timerStartRef.current = null;
      }

      return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, isMeetingMode, timeLeft, elapsedTime]);


  // Auto-start when switching to timer view
  useEffect(() => {
      if (viewMode === 'timer') {
          setIsActive(true);
      }
  }, [viewMode]);

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
    setIsActive(false); // Stop timer
    
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
    if (focusedTask && focusedTask.id !== task.id) {
        toast.error('يوجد مهمة أخرى قيد التركيز حالياً. قم بإنهائها أولاً.');
        return;
    }

    try {
        await TaskFSM.transition(task.id!, TaskStatus.Focused);
        setViewMode('timer');
    } catch (e: any) {
        toast.error(e.message);
    }
  };

  const handleResumeFocus = () => {
      setViewMode('timer');
  };

  // ----------------------------------------------------------------
  // VIEW 1: SELECTION HUB (DEFAULT)
  // ----------------------------------------------------------------
  if (viewMode === 'selection') {
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

            <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
                
                {/* ACTIVE FOCUS BANNER */}
                {focusedTask && (
                    <div className="mb-8 animate-in slide-in-from-top-4">
                        <div className="bg-primary-600 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/20 relative overflow-hidden">
                            {/* Background Effects */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                            
                            <div className="relative z-10 text-center">
                                <div className="flex items-center justify-center gap-2 text-primary-100 mb-3 text-sm font-bold uppercase tracking-wider">
                                    <AlertOctagon size={18} />
                                    <span>قيد التركيز الآن</span>
                                </div>
                                
                                <h3 className="text-2xl font-bold mb-6 leading-relaxed">{focusedTask.title}</h3>
                                
                                <button 
                                    onClick={handleResumeFocus}
                                    className="bg-white text-primary-700 px-8 py-3 rounded-xl font-bold text-base hover:bg-gray-50 transition-colors w-full shadow-lg active:scale-95"
                                >
                                    متابعة العمل
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <h2 className="text-xl text-gray-300 mb-4 font-bold">
                    {focusedTask ? 'مهام أخرى (مشغولة)' : 'بم تريد أن تبدأ؟'}
                </h2>
                
                {activeTasks && activeTasks.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto pb-10">
                        {activeTasks.map(task => {
                            const isThisFocused = focusedTask?.id === task.id;
                            if (isThisFocused) return null; // Don't show currently focused task in the list again

                            return (
                                <button 
                                    key={task.id}
                                    onClick={() => handleSelectTask(task)}
                                    className={`w-full p-5 rounded-2xl text-right border transition-all group flex justify-between items-center active:scale-95
                                        ${focusedTask 
                                            ? 'bg-gray-800/50 border-gray-800 text-gray-500 cursor-not-allowed' 
                                            : 'bg-gray-800 border-gray-700 hover:border-primary-500 hover:bg-gray-750 text-white cursor-pointer'
                                        }`}
                                >
                                    <div>
                                        <span className="font-bold block text-lg mb-1">{task.title}</span>
                                        {task.priority === 3 && <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">عالية الأولوية</span>}
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                                        ${focusedTask ? 'bg-gray-800 text-gray-600' : 'bg-gray-700 group-hover:bg-primary-600 group-hover:text-white'}
                                    `}>
                                        <PlayCircle size={20} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    !focusedTask && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 opacity-60">
                            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={40} />
                            </div>
                            <p>لا توجد مهام نشطة حالياً.</p>
                            <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-gray-800 rounded-full text-sm font-bold hover:bg-gray-700">
                                العودة للرئيسية
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
  }

  // ----------------------------------------------------------------
  // VIEW 2: TIMER UI (Meeting Mode)
  // ----------------------------------------------------------------
  if (viewMode === 'timer' && isMeetingMode) {
      return (
        <div className="relative h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-between py-8 px-6 overflow-hidden animate-in zoom-in-95 duration-300">
            {isDone && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}
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

                {/* Dummy Controls */}
                {focusedTask?.type === 'meeting' && (
                    <div className="flex gap-4 mb-8">
                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'}`}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>
                        <button 
                            onClick={() => setIsVideoOn(!isVideoOn)}
                            className={`p-4 rounded-full transition-all ${!isVideoOn ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'}`}
                        >
                            {!isVideoOn ? <VideoOff size={24} /> : <Video size={24} />}
                        </button>
                    </div>
                )}

                {/* Complete Button */}
                <button
                    onClick={handleCompleteTask}
                    disabled={isDone}
                    className="group relative flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PhoneOff size={24} fill="currentColor" />
                    <span>{isDone ? 'تم الانتهاء' : 'إنهاء الاجتماع'}</span>
                </button>
            </div>
        </div>
      );
  }

  // ----------------------------------------------------------------
  // VIEW 3: TIMER UI (Focus/Pomodoro Mode)
  // ----------------------------------------------------------------
  // Default for Tasks
  const percentage = (timeLeft / (25 * 60)) * 100;
  
  return (
    <div className="relative h-screen w-full bg-gray-900 text-white flex flex-col items-center justify-between py-8 px-6 overflow-hidden animate-in zoom-in-95 duration-300">
        {isDone && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}
        
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 z-0" />

        {/* Top Bar */}
        <div className="w-full flex justify-between items-center z-10">
            <div className="flex items-center gap-2 text-gray-400">
                <Music size={20} />
                <span className="text-xs font-bold">صوت الخلفية: مطر خفيف</span>
            </div>
            <button onClick={handleExit} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Center Content */}
        <div className="flex flex-col items-center z-10 text-center w-full max-w-md flex-1 justify-center">
            
            {/* Timer Circle */}
            <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                {/* SVG Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="4" />
                    <circle 
                        cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="4" 
                        strokeDasharray="283" 
                        strokeDashoffset={283 - (283 * percentage) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear"
                    />
                </svg>
                
                <div className="text-center">
                    <div className="font-mono text-5xl font-bold tracking-wider text-white mb-2 tabular-nums">
                        {formatTime(timeLeft)}
                    </div>
                    <div className="text-blue-400 text-sm font-bold uppercase tracking-widest">
                        {isActive ? 'جاري التركيز' : 'مؤقت'}
                    </div>
                </div>
            </div>

            <h2 className="text-xl md:text-2xl font-bold mb-8 leading-snug max-w-sm line-clamp-3">
                {focusedTask?.title}
            </h2>

            {/* Controls */}
            <div className="flex items-center gap-6">
                <button 
                    onClick={toggleTimer}
                    className="w-16 h-16 bg-white text-gray-900 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-white/10"
                >
                    {isActive ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </button>
                
                <button 
                    onClick={handleCompleteTask}
                    disabled={isDone}
                    className="h-16 px-8 bg-green-500 hover:bg-green-600 text-white rounded-full font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <CheckCircle size={24} />
                    <span>{isDone ? 'أحسنت!' : 'إنجاز المهمة'}</span>
                </button>
            </div>
        </div>

        {/* Tip Footer */}
        <div className="z-10 text-center opacity-50 text-xs max-w-xs leading-relaxed">
            "التركيز هو فن معرفة ما يجب تجاهله."
        </div>
    </div>
  );
};
