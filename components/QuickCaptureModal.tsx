
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Mic, Calendar, Clock, Save, PlusCircle, Folder, Link as LinkIcon, CheckSquare, Users, CalendarClock, Timer, Paperclip, FileText, Image as ImageIcon, Trash2, Bell, AlertCircle, Loader2, CloudUpload } from 'lucide-react';
import { db } from '../db';
import { TaskStatus, TaskPriority, TaskEffort, Idea, Attachment } from '../types';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { validateTimeSlot, ConflictResult } from '../services/scheduling';
import { ConflictAlertModal } from './ConflictAlertModal';
import { uploadAttachment } from '../services/storage';

interface QuickCaptureModalProps {
  onClose: () => void;
  defaultProjectId?: number;
  onSuccess?: () => void;
  editItem?: Idea;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({ onClose, defaultProjectId, onSuccess, editItem }) => {
  const isEditing = !!editItem;

  // Helper for current Local Date/Time strings
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const [text, setText] = useState('');
  const [showError, setShowError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [type, setType] = useState<'task' | 'appointment' | 'meeting' | 'idea' | 'note'>('task');
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!!defaultProjectId);

  // Progressive fields
  const [priority, setPriority] = useState(TaskPriority.Medium);
  const [date, setDate] = useState<string>(todayStr);
  const [time, setTime] = useState<string>(currentTimeStr);
  const [duration, setDuration] = useState<number>(60);
  const [reminderMinutes, setReminderMinutes] = useState<number>(10);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(defaultProjectId);

  // Linking fields
  const [linkContext, setLinkContext] = useState<'none' | 'task' | 'appointment' | 'meeting'>('none');
  const [linkedTaskId, setLinkedTaskId] = useState<number | undefined>(undefined);

  // Attachment State
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null); 
  const [existingAttachment, setExistingAttachment] = useState<Attachment | undefined>(undefined);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [conflictData, setConflictData] = useState<ConflictResult | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray());
  const allTasks = useLiveQuery(() => db.tasks.toArray());
  const recognitionRef = useRef<any>(null);
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

  const contextOptions = useMemo(() => {
      if (!allTasks) return [];
      if (linkContext === 'task') return allTasks.filter(t => !t.type || t.type === 'task');
      if (linkContext === 'appointment') return allTasks.filter(t => t.type === 'appointment');
      if (linkContext === 'meeting') return allTasks.filter(t => t.type === 'meeting');
      return [];
  }, [allTasks, linkContext]);

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
                setShowError(false);
            }
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
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

  useEffect(() => {
    if (isEditing) return;
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
          if (file.size > 10 * 1024 * 1024) {
              toast.error('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.');
              return;
          }
          setAttachmentFile(file);
          setExistingAttachment(undefined);
          toast.success('تم اختيار الملف. سيتم الرفع عند الحفظ.');
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
      setAttachmentFile(null);
      setExistingAttachment(undefined);
  };

  const saveToDb = async () => {
     if (!text.trim()) {
         setShowError(true);
         toast.error('المحتوى مطلوب');
         return false;
     }

     try {
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
             const today = new Date(); today.setHours(0,0,0,0);
             const targetDate = new Date(executionDate); targetDate.setHours(0,0,0,0);
             if (targetDate <= today) status = TaskStatus.Active;
          }

          await db.tasks.add({
            title: text, status, priority, effort: TaskEffort.Medium, executionDate, scheduledTime: scheduledDateTime, durationMinutes: duration, projectId: selectedProjectId, rolloverCount: 0, createdAt: new Date(), type: type as any, reminderMinutes, isReminded: false
          });
          toast.success('تم الحفظ');

        } else {
          // --- HANDLING ATTACHMENTS FOR IDEAS/NOTES ---
          let finalAttachment: Attachment | undefined = existingAttachment;

          // If new file is selected, upload it DIRECTLY to Cloud Storage first
          if (attachmentFile) {
              if (!navigator.onLine) {
                  toast.error('يجب أن تكون متصلاً بالإنترنت لرفع الملفات');
                  return false;
              }

              setIsUploading(true);
              const path = await uploadAttachment(attachmentFile);
              setIsUploading(false);

              if (!path) {
                  toast.error('فشل رفع الملف للسحابة');
                  return false;
              }

              // Create Attachment object with PATH (no blob data stored in DB)
              finalAttachment = {
                  name: attachmentFile.name,
                  type: attachmentFile.type,
                  size: attachmentFile.size,
                  path: path
              };
          }

          if (isEditing && editItem) {
              await db.ideas.update(editItem.id!, {
                  content: text,
                  type: type as 'idea' | 'note',
                  linkedTaskId: linkContext !== 'none' ? linkedTaskId : undefined,
                  attachment: finalAttachment
              });
              toast.success('تم التحديث');
          } else {
              await db.ideas.add({
                content: text,
                isAudio: false,
                createdAt: new Date(),
                type: type as 'idea' | 'note',
                linkedTaskId: linkContext !== 'none' ? linkedTaskId : undefined,
                attachment: finalAttachment
              });
              toast.success('تم الحفظ');
          }
        }
        return true;
     } catch (e) {
         console.error(e);
         setIsUploading(false);
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
          if (isEditing) onClose();
          else {
            setText(''); setAttachmentFile(null); setLinkedTaskId(undefined); setExistingAttachment(undefined);
            toast('يمكنك إضافة المزيد', { icon: '✍️' });
          }
      }
  };

  const triggerPicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
      try { ref.current.showPicker ? ref.current.showPicker() : ref.current.focus(); } catch (e) { ref.current.focus(); }
    }
  };

  const activeAttachment = attachmentFile 
      ? { name: attachmentFile.name, size: attachmentFile.size, type: attachmentFile.type } 
      : existingAttachment;

  // Options Definitions...
  const typeOptions = [{ id: 'task', label: 'مهمة' }, { id: 'appointment', label: 'موعد' }, { id: 'meeting', label: 'اجتماع' }, { id: 'idea', label: 'فكرة' }, { id: 'note', label: 'ملاحظة' }];
  const editTypeOptions = [{ id: 'idea', label: 'فكرة' }, { id: 'note', label: 'ملاحظة' }];
  const durationOptions = [15, 30, 60, 90, 120, 180];
  const reminderOptions = [{v:0,l:'بدون'}, {v:10,l:'10د'}, {v:30,l:'30د'}, {v:60,l:'1س'}, {v:120,l:'2س'}];

  const isTimeBound = type === 'appointment' || type === 'meeting';
  const isTask = type === 'task';
  const isThought = type === 'idea' || type === 'note';
  const showTaskDetails = !isEditing && (isExpanded || isTimeBound || defaultProjectId) && (isTask || isTimeBound);

  return (
    <>
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <style>{`.custom-picker-input::-webkit-calendar-picker-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 3rem; height: 100%; opacity: 0; cursor: pointer; z-index: 20; }`}</style>

        <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300" dir="rtl">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'تعديل المحتوى' : 'التقاط سريع'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20} className="text-gray-500" /></button>
            </div>

            <div className="p-5 space-y-4">
            <div className="relative">
                <textarea
                    value={text}
                    onChange={(e) => { setText(e.target.value); if(e.target.value.trim()) setShowError(false); if(!isEditing && (e.target.value.length > 5 || isTimeBound) && !isThought) setIsExpanded(true); }}
                    placeholder={isTimeBound ? "عنوان الموعد..." : isThought ? "اكتب فكرتك أو ملاحظتك..." : "ما الذي يدور في ذهنك؟"}
                    className={`w-full bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 pb-14 text-lg resize-none h-32 text-gray-900 dark:text-white transition-all placeholder:text-gray-400 ${showError ? 'border-2 border-red-500 bg-red-50' : 'border-none focus:ring-2 focus:ring-primary-500'}`}
                    autoFocus
                />
                <button className={`absolute bottom-3 left-3 p-2 rounded-full transition-all z-10 ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`} onClick={toggleRecording}><Mic size={20} /></button>
                {isThought && (
                    <>
                        <button className={`absolute bottom-3 right-3 p-2 rounded-full transition-all z-10 ${activeAttachment ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`} onClick={handleAttachmentClick} title="إرفاق ملف"><Paperclip size={20} /></button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf,.doc,.docx" onChange={handleFileChange} />
                    </>
                )}
            </div>

            {activeAttachment && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-2.5 rounded-xl animate-in fade-in">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="bg-blue-200 dark:bg-blue-800 p-1.5 rounded-lg text-blue-700 dark:text-blue-300">
                             {activeAttachment.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{activeAttachment.name}</span>
                            <span className="text-[10px] text-gray-500">{(activeAttachment.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                    </div>
                    {attachmentFile && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1"><CloudUpload size={10} /> جاهز للرفع</span>
                            <button onClick={removeAttachment} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                    )}
                    {!attachmentFile && existingAttachment && (
                        <button onClick={removeAttachment} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                    )}
                </div>
            )}

            {!defaultProjectId && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {(isEditing ? editTypeOptions : typeOptions).map((t) => (
                        <button key={t.id} onClick={() => { setType(t.id as any); if (!isEditing) { if(t.id === 'appointment' || t.id === 'meeting') setIsExpanded(true); if(t.id === 'idea' || t.id === 'note') setIsExpanded(false); }}} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${type === t.id ? 'bg-primary-100 border-primary-500 text-primary-700 dark:bg-primary-600 dark:text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{t.label}</button>
                    ))}
                </div>
            )}

            {isThought && (
                <div className="animate-in fade-in bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-bold mb-1"><LinkIcon size={16} /><span>ربط بـ (اختياري)</span></div>
                    <div className="flex gap-2">
                        <button onClick={() => { setLinkContext('none'); setLinkedTaskId(undefined); }} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'none' ? 'bg-white dark:bg-gray-800 border-gray-300' : 'border-transparent text-gray-400'}`}>لا يوجد</button>
                        <button onClick={() => { setLinkContext('task'); setLinkedTaskId(undefined); }} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'task' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'border-transparent text-gray-400'}`}>مهمة</button>
                        <button onClick={() => { setLinkContext('appointment'); setLinkedTaskId(undefined); }} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'appointment' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'border-transparent text-gray-400'}`}>موعد</button>
                        <button onClick={() => { setLinkContext('meeting'); setLinkedTaskId(undefined); }} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${linkContext === 'meeting' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'border-transparent text-gray-400'}`}>اجتماع</button>
                    </div>
                    {linkContext !== 'none' && (
                        <div className="relative animate-in fade-in">
                            <select value={linkedTaskId || ''} onChange={(e) => setLinkedTaskId(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 pl-8 text-sm outline-none">
                                <option value="">-- اختر --</option>
                                {contextOptions.map(item => (<option key={item.id} value={item.id}>{item.title}</option>))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {showTaskDetails && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-gray-500 mb-1 block">التاريخ</label><div className="relative"><input ref={dateInputRef} type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} onClick={() => triggerPicker(dateInputRef)} className="custom-picker-input w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-10 text-sm outline-none cursor-pointer" /><Calendar size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" /></div></div>
                        <div><label className="text-xs text-gray-500 mb-1 block">الوقت</label><div className="relative"><input ref={timeInputRef} type="time" value={time} min={date === todayStr ? currentTimeStr : undefined} onChange={(e) => setTime(e.target.value)} onClick={() => triggerPicker(timeInputRef)} className="custom-picker-input w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-10 text-sm outline-none cursor-pointer" /><Clock size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" /></div></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-gray-500 mb-1 block">تذكير</label><div className="relative"><select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-10 text-sm outline-none">{reminderOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select><Bell size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" /></div></div>
                        <div><label className="text-xs text-gray-500 mb-1 block">المدة</label><select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm outline-none">{durationOptions.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                    </div>
                    {isTask && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs text-gray-500 mb-1 block">الأولوية</label><select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm outline-none"><option value={3}>🔴 عالية</option><option value={2}>🟡 متوسطة</option><option value={1}>🔵 منخفضة</option></select></div>
                            <div><label className="text-xs text-gray-500 mb-1 block">المشروع</label><div className="relative"><select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 pl-8 text-sm outline-none"><option value="">بدون مشروع</option>{projects?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select><Folder size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" /></div></div>
                        </div>
                    )}
                </div>
            )}
            </div>

            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
            {!isEditing && <button disabled={isUploading} onClick={handleSaveAndAddAnother} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-3 rounded-xl font-bold disabled:opacity-50"><PlusCircle size={18} />حفظ وآخر</button>}
            <button disabled={isUploading} onClick={handleSave} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold shadow-md disabled:opacity-50 min-w-[100px] justify-center">
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isUploading ? 'جاري الرفع...' : (isEditing ? 'تحديث' : 'حفظ')}
            </button>
            </div>
        </div>
        </div>
        <ConflictAlertModal isOpen={!!conflictData} onClose={() => setConflictData(null)} reason={conflictData?.reason || ''} suggestion={conflictData?.suggestion} />
    </>
  );
};
