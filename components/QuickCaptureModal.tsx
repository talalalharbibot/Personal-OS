
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Mic, Calendar, Clock, Save, PlusCircle, Folder, Link as LinkIcon, CheckSquare, Users, CalendarClock, Timer, Paperclip, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { db } from '../db';
import { TaskStatus, TaskPriority, TaskEffort, Idea, Attachment } from '../types';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { validateTimeSlot, ConflictResult } from '../services/scheduling';
import { ConflictAlertModal } from './ConflictAlertModal';

interface QuickCaptureModalProps {
  onClose: () => void;
  defaultProjectId?: number;
  onSuccess?: () => void;
  editItem?: Idea; // New prop to enable editing mode
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({ onClose, defaultProjectId, onSuccess, editItem }) => {
  const isEditing = !!editItem;

  // Helper for current Local Date/Time strings
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const [text, setText] = useState('');
  const [type, setType] = useState<'task' | 'appointment' | 'meeting' | 'idea' | 'note'>('task');
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!!defaultProjectId);

  // Progressive fields
  const [priority, setPriority] = useState(TaskPriority.Medium);
  const [date, setDate] = useState<string>(todayStr);
  const [time, setTime] = useState<string>(currentTimeStr);
  const [duration, setDuration] = useState<number>(60);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(defaultProjectId);

  // Linking fields for Ideas/Notes
  const [linkContext, setLinkContext] = useState<'none' | 'task' | 'appointment' | 'meeting'>('none');
  const [linkedTaskId, setLinkedTaskId] = useState<number | undefined>(undefined);

  // Attachment State
  const [attachment, setAttachment] = useState<File | null>(null); // For NEW attachments
  const [existingAttachment, setExistingAttachment] = useState<Attachment | undefined>(undefined); // For EXISTING attachments in edit mode
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conflict State
  const [conflictData, setConflictData] = useState<ConflictResult | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray());
  const allTasks = useLiveQuery(() => db.tasks.toArray());

  // Speech Recognition Ref
  const recognitionRef = useRef<any>(null);

  // Refs to manually trigger pickers
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // --- Hydrate State for Editing ---
  useEffect(() => {
      if (editItem) {
          setText(editItem.content);
          setType(editItem.type || 'idea');
          setIsExpanded(false);
          setExistingAttachment(editItem.attachment);
          
          if (editItem.linkedTaskId && allTasks) {
             const linkedTask = allTasks.find(t => t.id === editItem.linkedTaskId);
             if (linkedTask) {
                 if (linkedTask.type === 'meeting') setLinkContext('meeting');
                 else if (linkedTask.type === 'appointment') setLinkContext('appointment');
                 else setLinkContext('task');
                 setLinkedTaskId(editItem.linkedTaskId);
             }
          }
      }
  }, [editItem, allTasks]);

  // Filter tasks based on selected context
  const contextOptions = useMemo(() => {
      if (!allTasks) return [];
      if (linkContext === 'task') return allTasks.filter(t => !t.type || t.type === 'task');
      if (linkContext === 'appointment') return allTasks.filter(t => t.type === 'appointment');
      if (linkContext === 'meeting') return allTasks.filter(t => t.type === 'meeting');
      return [];
  }, [allTasks, linkContext]);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'ar-SA';

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                setText(prev => {
                    const spacer = prev && !prev.endsWith(' ') ? ' ' : '';
                    return prev + spacer + finalTranscript;
                });
            }
        };

        recognition.onerror = (event: any) => {
             // Handle errors silently or via toast
             setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
      if (!recognitionRef.current) {
          toast.error('المتصفح لا يدعم تحويل الصوت إلى نص');
          return;
      }
      if (isRecording) {
          recognitionRef.current.stop();
      } else {
          try {
              recognitionRef.current.start();
              setIsRecording(true);
              toast('تحدث الآن...', { icon: '🎙️' });
          } catch (e) {
              setIsRecording(false);
          }
      }
  };

  // Smart Morph: heuristic (Only in Creation Mode)
  useEffect(() => {
    if (isEditing) return; // Disable auto-morph when editing
    
    if (text.length < 10) {
        if (text.startsWith('فكرة') || text.startsWith('idea')) setType('idea');
        else if (text.startsWith('ملاحظة') || text.startsWith('note')) setType('note');
        else if (text.includes('اجتماع') || text.includes('meeting')) setType('meeting');
        else if (text.includes('موعد') || text.match(/\d{1,2}:\d{2}/)) setType('appointment');
    }
  }, [text, isEditing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          
          if (file.size > 5 * 1024 * 1024) {
              toast.error('حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت.');
              return;
          }

          const allowedTypes = [
              'image/jpeg', 'image/png', 'image/gif', 'image/webp',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ];
          
          if (!allowedTypes.includes(file.type)) {
              toast.error('نوع الملف غير مدعوم.');
              return;
          }

          setAttachment(file);
          // If we upload a new file, we clear the reference to the old one so it gets replaced
          setExistingAttachment(undefined);
          toast.success('تم إرفاق الملف');
      }
  };

  const handleAttachmentClick = () => {
      if (['task', 'appointment', 'meeting'].includes(type) && !isEditing) {
          setType('note');
          setIsExpanded(false);
          toast('تم التحويل إلى ملاحظة لإرفاق ملف', { icon: '📎' });
      }
      fileInputRef.current?.click();
  };

  const removeAttachment = () => {
      setAttachment(null);
      setExistingAttachment(undefined);
  };

  const saveToDb = async () => {
     if (!text.trim()) return false;

     try {
        // --- CASE A: TASKS / APPOINTMENTS / MEETINGS ---
        if (['task', 'appointment', 'meeting'].includes(type) && !isEditing) {
          const isTimeBound = type === 'appointment' || type === 'meeting';
          
          if ((isTimeBound || isExpanded) && date && time) {
              const validation = await validateTimeSlot(date, time, duration);
              if (!validation.isValid) {
                  setConflictData(validation);
                  return false; 
              }
          }

          const scheduledDateTime = new Date(`${date}T${time}`);
          const executionDate = new Date(date);
          
          let status = TaskStatus.Captured;
          if (isTimeBound) {
             status = TaskStatus.Scheduled;
          } else {
             const today = new Date();
             today.setHours(0,0,0,0);
             const targetDate = new Date(executionDate);
             targetDate.setHours(0,0,0,0);
             if (targetDate <= today) status = TaskStatus.Active;
          }

          await db.tasks.add({
            title: text,
            status, 
            priority,
            effort: TaskEffort.Medium,
            executionDate: executionDate,
            scheduledTime: scheduledDateTime, 
            durationMinutes: duration,
            projectId: selectedProjectId,
            rolloverCount: 0,
            createdAt: new Date(),
            type: type as 'task' | 'appointment' | 'meeting'
          });
          toast.success(type === 'meeting' ? 'تم حفظ الاجتماع' : isTimeBound ? 'تم جدولة الموعد' : 'تم إضافة المهمة');

        } else {
          // --- CASE B: IDEAS / NOTES (Create or Update) ---
          
          // Determine the final attachment object
          let finalAttachment: Attachment | undefined = undefined;

          if (attachment) {
              // New file uploaded
              finalAttachment = {
                  name: attachment.name,
                  type: attachment.type,
                  size: attachment.size,
                  data: attachment
              };
          } else if (existingAttachment) {
              // Keep existing
              finalAttachment = existingAttachment;
          }

          if (isEditing && editItem) {
              // UPDATE EXISTING IDEA
              await db.ideas.update(editItem.id!, {
                  content: text,
                  type: type as 'idea' | 'note',
                  linkedTaskId: linkContext !== 'none' ? linkedTaskId : undefined,
                  attachment: finalAttachment
              });
              toast.success('تم تحديث المحتوى بنجاح');
          } else {
              // CREATE NEW IDEA
              await db.ideas.add({
                content: text,
                isAudio: false,
                createdAt: new Date(),
                type: type as 'idea' | 'note',
                linkedTaskId: linkContext !== 'none' ? linkedTaskId : undefined,
                attachment: finalAttachment
              });
              toast.success(type === 'idea' ? 'تم حفظ الفكرة' : 'تم حفظ الملاحظة');
          }
        }
        return true;
     } catch (e) {
         console.error(e);
         toast.error('حدث خطأ أثناء الحفظ');
         return false;
     }
  };

  const handleSave = async () => {
    const success = await saveToDb();
    if (success) {
        window.dispatchEvent(new Event('pos-update'));
        if (onSuccess) onSuccess();
        onClose();
    }
  };

  const handleSaveAndAddAnother = async () => {
      const success = await saveToDb();
      if (success) {
          window.dispatchEvent(new Event('pos-update'));
          if (onSuccess) onSuccess();
          if (isEditing) {
              onClose(); // Close if we were editing, "Add Another" makes less sense here
          } else {
            setText('');
            setAttachment(null);
            setLinkedTaskId(undefined); 
            toast('يمكنك إضافة المزيد', { icon: '✍️' });
          }
      }
  };

  const triggerPicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
      try {
        ref.current.showPicker ? ref.current.showPicker() : ref.current.focus();
      } catch (e) { ref.current.focus(); }
    }
  };

  const typeOptions = [
      { id: 'task', label: 'مهمة' },
      { id: 'appointment', label: 'موعد' },
      { id: 'meeting', label: 'اجتماع' },
      { id: 'idea', label: 'فكرة' },
      { id: 'note', label: 'ملاحظة' },
  ];

  const editTypeOptions = [
      { id: 'idea', label: 'فكرة' },
      { id: 'note', label: 'ملاحظة' },
  ];

  const durationOptions = [
      { value: 15, label: '15' },
      { value: 30, label: '30' },
      { value: 60, label: '60' },
      { value: 90, label: '90' },
      { value: 120, label: '120' },
      { value: 180, label: '180' },
      { value: 240, label: '240' },
  ];

  const isTimeBound = type === 'appointment' || type === 'meeting';
  const isTask = type === 'task';
  const isThought = type === 'idea' || type === 'note';

  const showTaskDetails = !isEditing && (isExpanded || isTimeBound || defaultProjectId) && (isTask || isTimeBound);
  const showLinkDetails = isThought;

  // Active Attachment to display (New or Existing)
  const activeAttachment = attachment 
      ? { name: attachment.name, size: attachment.size, type: attachment.type } 
      : existingAttachment;

  return (
    <>
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        
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
            .custom-picker-input::-webkit-inner-spin-button {
                display: none;
            }
        `}</style>

        <div 
            className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300"
            dir="rtl"
        >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {isEditing ? 'تعديل المحتوى' : (defaultProjectId ? 'إضافة مهمة للمشروع' : 'التقاط سريع')}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X size={20} className="text-gray-500" />
            </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
            <div className="relative">
                <textarea
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        if(!isEditing && (e.target.value.length > 5 || isTimeBound) && !isThought) setIsExpanded(true);
                    }}
                    placeholder={isTimeBound ? "عنوان الموعد..." : isThought ? "اكتب فكرتك أو ملاحظتك..." : "ما الذي يدور في ذهنك؟"}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 pb-14 text-lg focus:ring-2 focus:ring-primary-500 resize-none h-32 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                    autoFocus
                />
                
                {/* Voice Record Button */}
                <button 
                    className={`absolute bottom-3 left-3 p-2 rounded-full transition-all z-10 ${isRecording ? 'bg-red-100 text-red-600 animate-pulse scale-110' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    onClick={toggleRecording}
                >
                    <Mic size={20} />
                </button>

                {/* Attachment Button - ONLY FOR IDEAS/NOTES */}
                {isThought && (
                    <>
                        <button 
                            className={`absolute bottom-3 right-3 p-2 rounded-full transition-all z-10 ${activeAttachment ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                            onClick={handleAttachmentClick}
                            title="إرفاق ملف"
                        >
                            <Paperclip size={20} />
                        </button>
                        
                        <input 
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,application/pdf,.doc,.docx"
                            onChange={handleFileChange}
                        />
                    </>
                )}
            </div>

            {/* Selected File Indicator - Only show if thought mode */}
            {isThought && activeAttachment && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-2.5 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="bg-blue-200 dark:bg-blue-800 p-1.5 rounded-lg text-blue-700 dark:text-blue-300">
                             {activeAttachment.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{activeAttachment.name}</span>
                            <span className="text-[10px] text-gray-500">{(activeAttachment.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                    </div>
                    <button 
                        onClick={removeAttachment}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            {/* Type Selector */}
            {!defaultProjectId && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {/* If editing, limit types to idea/note to prevent complex table migration */}
                    {(isEditing ? editTypeOptions : typeOptions).map((t) => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setType(t.id as any);
                                if (!isEditing) {
                                    if (t.id === 'appointment' || t.id === 'meeting') setIsExpanded(true);
                                    if (t.id === 'idea' || t.id === 'note') setIsExpanded(false);
                                }
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
                                type === t.id 
                                ? 'bg-primary-100 border-primary-500 text-primary-700 dark:bg-primary-600 dark:text-white dark:border-primary-500' 
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Linking Section */}
            {showLinkDetails && (
                <div className="animate-in fade-in slide-in-from-top-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">
                        <LinkIcon size={16} />
                        <span>ربط بـ (اختياري)</span>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setLinkContext('none'); setLinkedTaskId(undefined); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'none' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-700 dark:text-gray-300' : 'border-transparent text-gray-400 hover:bg-white/50'}`}
                        >
                            لا يوجد
                        </button>
                        <button 
                            onClick={() => { setLinkContext('task'); setLinkedTaskId(undefined); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'task' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700' : 'border-transparent text-gray-400 hover:bg-white/50'}`}
                        >
                            مهمة
                        </button>
                        <button 
                            onClick={() => { setLinkContext('appointment'); setLinkedTaskId(undefined); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'appointment' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' : 'border-transparent text-gray-400 hover:bg-white/50'}`}
                        >
                            موعد
                        </button>
                        <button 
                            onClick={() => { setLinkContext('meeting'); setLinkedTaskId(undefined); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'meeting' ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700' : 'border-transparent text-gray-400 hover:bg-white/50'}`}
                        >
                            اجتماع
                        </button>
                    </div>

                    {linkContext !== 'none' && (
                        <div className="relative animate-in fade-in">
                            <select 
                                value={linkedTaskId || ''}
                                onChange={(e) => setLinkedTaskId(e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 pl-8 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                            >
                                <option value="">-- اختر {linkContext === 'task' ? 'المهمة' : linkContext === 'meeting' ? 'الاجتماع' : 'الموعد'} --</option>
                                {contextOptions.map(item => (
                                    <option key={item.id} value={item.id}>{item.title}</option>
                                ))}
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                {linkContext === 'task' ? <CheckSquare size={16} /> : linkContext === 'meeting' ? <Users size={16} /> : <CalendarClock size={16} />}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Task Details (Only when creating Tasks/Appointments) */}
            {showTaskDetails && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">التاريخ</label>
                            <div className="relative">
                                <input 
                                    ref={dateInputRef}
                                    type="date" 
                                    value={date}
                                    min={todayStr}
                                    onChange={(e) => setDate(e.target.value)}
                                    onClick={() => triggerPicker(dateInputRef)}
                                    className="custom-picker-input w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-10 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                    <Calendar size={16} />
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">الوقت</label>
                            <div className="relative">
                                <input 
                                    ref={timeInputRef}
                                    type="time" 
                                    value={time}
                                    min={date === todayStr ? currentTimeStr : undefined}
                                    onChange={(e) => setTime(e.target.value)}
                                    onClick={() => triggerPicker(timeInputRef)}
                                    className="custom-picker-input w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-10 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                    <Clock size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">المدة المتوقعة (بالدقيقة)</label>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {durationOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setDuration(opt.value)}
                                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                        duration === opt.value
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-500/20'
                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isTask && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">الأولوية</label>
                                <select 
                                    value={priority}
                                    onChange={(e) => setPriority(Number(e.target.value))}
                                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none"
                                >
                                    <option value={3}>🔴 عالية</option>
                                    <option value={2}>🟡 متوسطة</option>
                                    <option value={1}>🔵 منخفضة</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">المشروع</label>
                                <div className="relative">
                                    <select
                                        value={selectedProjectId || ''}
                                        onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : undefined)}
                                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-8 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                                    >
                                        <option value="">بدون مشروع (Inbox)</option>
                                        {projects?.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                    <Folder size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
            {!isEditing && (
                <button 
                        onClick={handleSaveAndAddAnother}
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-3 rounded-xl font-bold transition-all"
                >
                    <PlusCircle size={18} />
                    حفظ وآخر
                </button>
            )}
            <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
                <Save size={18} />
                {isEditing ? 'تحديث' : 'حفظ'}
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
