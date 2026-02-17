
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Folder, Inbox, Archive as ArchiveIcon, ChevronLeft, CheckCircle2, Plus, Trash2, CheckSquare, Pencil, CalendarClock, Lightbulb, StickyNote, Calendar, Users, Clock, Paperclip, FileText, Image as ImageIcon, Download, Eye, ChevronDown, ChevronUp, Link as LinkIcon, AlertCircle, Timer } from 'lucide-react';
import { TaskStatus, Project, Task, Attachment, Idea } from '../types';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { RescheduleModal } from '../components/RescheduleModal';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { QuickCaptureModal } from '../components/QuickCaptureModal'; 
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { addDays, isAfter, differenceInDays } from 'date-fns';
import { TaskFSM } from '../services/fsm';
import { syncService } from '../services/syncService';

interface IdeaInboxItemProps {
    idea: Idea;
    linkedTask?: Task;
    onEdit: (i: Idea) => void;
    onDelete: (i: Idea) => void;
    onPreview: (a: Attachment) => void;
}

const IdeaInboxItem: React.FC<IdeaInboxItemProps> = ({ idea, linkedTask, onEdit, onDelete, onPreview }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isIdea = idea.type === 'idea';
    
    const getLinkDetails = () => {
        if (!linkedTask) return null;
        if (linkedTask.type === 'meeting') return { label: 'اجتماع', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800' };
        if (linkedTask.type === 'appointment') return { label: 'موعد', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' };
        return { label: 'مهمة', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' };
    };
    const linkDetails = getLinkDetails();

    return (
        <div onClick={() => setIsExpanded(!isExpanded)} className={`p-4 rounded-xl border shadow-sm relative group transition-all cursor-pointer ${isIdea ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'}`}>
            <div className="flex items-start gap-3">
                <div className={`mt-1 ${isIdea ? 'text-amber-500' : 'text-emerald-500'}`}>{isIdea ? <Lightbulb size={18} /> : <StickyNote size={18} />}</div>
                <div className="flex-1 min-w-0 pl-10">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${isIdea ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>{isIdea ? 'فكرة' : 'ملاحظة'}</span>
                        
                        {/* Linked Task Indicator */}
                        {linkDetails && (
                            <div className={`flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded border ${linkDetails.bg} ${linkDetails.border}`}>
                                <LinkIcon size={10} className={linkDetails.color} />
                                <span className="text-gray-500 dark:text-gray-400">مرتبط بـ:</span>
                                <span className={`font-bold ${linkDetails.color}`}>{linkDetails.label}</span>
                                <span className="text-gray-400 dark:text-gray-500">|</span>
                                <span className="text-gray-800 dark:text-gray-200 font-medium max-w-[120px] truncate">{linkedTask?.title}</span>
                            </div>
                        )}
                    </div>
                    <p className={`text-gray-900 dark:text-gray-200 text-sm leading-relaxed font-medium transition-all duration-200 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3 text-ellipsis overflow-hidden'}`}>{idea.content}</p>
                    {!isExpanded && idea.content.length > 100 && (<div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1 opacity-80"><ChevronDown size={12} /><span>المزيد...</span></div>)}
                    {idea.attachment && (
                        <div onClick={(e) => { e.stopPropagation(); onPreview(idea.attachment!); }} className="mt-3 flex items-center gap-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-white dark:hover:bg-black/30 transition-colors w-fit">
                            <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">{idea.attachment.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}</div>
                            <div className="flex flex-col"><span className="text-xs font-bold text-gray-800 dark:text-gray-300 truncate max-w-[150px]">{idea.attachment.name}</span><span className="text-[10px] text-gray-500">{(idea.attachment.size / 1024 / 1024).toFixed(2)} MB</span></div>
                            <Eye size={14} className="text-gray-400 mr-1" />
                        </div>
                    )}
                    <span className="text-[10px] text-gray-500 mt-2 block">{idea.createdAt.toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col gap-1 absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(idea); }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors"><Pencil size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(idea); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
            </div>
        </div>
    );
};

export const Organizer: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'projects' | 'inbox' | 'ideas'>('projects');
  const [inboxSubTab, setInboxSubTab] = useState<'tasks' | 'deferred' | 'appointments' | 'completed'>('appointments');

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [ideaToDelete, setIdeaToDelete] = useState<Idea | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [ideaToEdit, setIdeaToEdit] = useState<Idea | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [changeSignal, setChangeSignal] = useState(0);
  const forceUpdate = () => setChangeSignal(c => c + 1);

  // Trigger Sync on Mount to ensure data freshness
  useEffect(() => {
    syncService.triggerSync();
  }, []);

  useEffect(() => {
    const handleUpdate = () => forceUpdate();
    window.addEventListener('pos-update', handleUpdate);
    return () => window.removeEventListener('pos-update', handleUpdate);
  }, []);

  // Filter Deleted Projects
  const projects = useLiveQuery(() => db.projects.filter(p => !p.deletedAt).toArray(), [changeSignal], []);
  
  // Filter Deleted Ideas AND Fetch Linked Tasks efficiently
  const ideasData = useLiveQuery(async () => {
      const ideas = await db.ideas.filter(i => !i.deletedAt).reverse().toArray();
      
      // Get all linked task IDs
      const taskIds = ideas.map(i => i.linkedTaskId).filter(Boolean) as number[];
      
      // Fetch tasks map if there are any links
      const taskMap = new Map<number, Task>();
      if (taskIds.length > 0) {
          const tasks = await db.tasks.where('id').anyOf(taskIds).toArray();
          tasks.forEach(t => taskMap.set(t.id!, t));
      }

      return { ideas, taskMap };
  }, [changeSignal], { ideas: [], taskMap: new Map() });

  const inboxIdeas = ideasData.ideas;
  const linkedTaskMap = ideasData.taskMap;

  // --- OPTIMIZED INBOX QUERY ---
  const inboxData = useLiveQuery(async () => {
      if (activeTab !== 'inbox') return { tasks: [], deferred: [], appointments: [], completed: [] };

      const today = new Date(); today.setHours(0,0,0,0);

      if (inboxSubTab === 'completed') {
          return {
              tasks: [], deferred: [], appointments: [],
              completed: await db.tasks.where('status').equals(TaskStatus.Completed).filter(t => !t.deletedAt).reverse().limit(50).toArray()
          };
      }

      let tasksList: Task[] = [];
      let deferredList: Task[] = [];
      let appointmentsList: Task[] = [];

      const activeOrScheduled = await db.tasks
        .where('status')
        .anyOf([TaskStatus.Active, TaskStatus.Captured, TaskStatus.Scheduled, TaskStatus.Deferred, TaskStatus.Stalled])
        .filter(t => !t.deletedAt)
        .toArray();

      activeOrScheduled.forEach(t => {
          const isTimeBound = t.type === 'appointment' || t.type === 'meeting';
          if (isTimeBound && t.executionDate && isAfter(new Date(t.executionDate), today)) {
             appointmentsList.push(t);
          }
          else if (t.status === TaskStatus.Deferred || t.status === TaskStatus.Stalled) {
             deferredList.push(t);
          }
          else if ((!t.type || t.type === 'task') && (t.status === TaskStatus.Captured || t.status === TaskStatus.Active)) {
             tasksList.push(t);
          }
      });
      
      return { 
          tasks: tasksList.sort((a,b) => (a.executionDate?.getTime() || 0) - (b.executionDate?.getTime() || 0)), 
          deferred: deferredList.sort((a,b) => b.priority - a.priority), 
          appointments: appointmentsList.sort((a,b) => (a.executionDate?.getTime() || 0) - (b.executionDate?.getTime() || 0)),
          completed: []
      };
  }, [activeTab, inboxSubTab, changeSignal], { tasks: [], deferred: [], appointments: [], completed: [] }); 

  const finalInboxData = inboxData || { tasks: [], deferred: [], appointments: [], completed: [] };

  const handleDeleteProject = async () => {
    if (!projectToDelete || !projectToDelete.id) return;
    try {
        await (db as any).transaction('rw', db.projects, db.tasks, async () => {
            // Bulk Soft Delete: Update deletedAt AND syncedAt=0 to trigger sync
            // The SyncService pushBatch will handle the hard delete in cloud based on deletedAt
            await db.tasks.where('projectId').equals(projectToDelete.id!).modify({ deletedAt: new Date(), syncedAt: 0 });
            await db.projects.update(projectToDelete.id!, { deletedAt: new Date(), syncedAt: 0 });
        });
        
        toast.success('تم حذف المشروع ومهامه بنجاح'); 
        setProjectToDelete(null); 
        forceUpdate(); 
        window.dispatchEvent(new Event('pos-update'));
        
        // Trigger sync to push deletions
        syncService.triggerSync();
    } catch (e) { toast.error('حدث خطأ أثناء الحذف'); }
  };

  const handleDeleteTask = async () => {
      if (!taskToDelete || !taskToDelete.id) return;
      try { 
          // Use deleteRecord for Hard Delete
          await syncService.deleteRecord('tasks', taskToDelete.id);
          toast.success('تم حذف المهمة'); 
          setTaskToDelete(null); 
          forceUpdate(); 
          window.dispatchEvent(new Event('pos-update')); 
      } catch (e) { toast.error('فشل الحذف'); }
  };

  const handleDeleteIdea = async () => {
      if (!ideaToDelete || !ideaToDelete.id) return;
      try { 
          // Use deleteRecord for Hard Delete
          await syncService.deleteRecord('ideas', ideaToDelete.id);
          toast.success('تم الحذف'); 
          setIdeaToDelete(null); 
          forceUpdate(); 
          window.dispatchEvent(new Event('pos-update')); 
      } catch (e) { toast.error('فشل الحذف'); }
  };

  const getCompletionLabel = (type?: string) => { if (type === 'meeting') return 'تم الاجتماع'; if (type === 'appointment') return 'تم حضور الموعد'; return 'تم إنجاز المهمة'; };

  return (
    <div className="h-full overflow-y-auto pb-24 p-6 max-w-lg mx-auto">
       <header className="mb-6 flex justify-between items-center"><h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">المنظم</h1></header>
       <div className="flex p-1 bg-gray-200 dark:bg-gray-800 rounded-xl mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('projects')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'projects' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900'}`}>المشاريع</button>
          <button onClick={() => setActiveTab('inbox')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'inbox' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900'}`}>صندوق الوارد</button>
          <button onClick={() => setActiveTab('ideas')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'ideas' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900'}`}>الأفكار والملاحظات</button>
       </div>

       <div className="space-y-4">
          {activeTab === 'projects' && (
             <div className="grid gap-4">
                <button onClick={() => setShowCreateProject(true)} className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all font-bold gap-2"><Plus size={20} />إضافة مشروع جديد</button>
                {projects?.map(project => (
                    <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary-500 transition-colors relative">
                        <div className="flex items-center gap-4"><div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: project.color }}><Folder size={18} /></div><div><h3 className="font-bold text-gray-900 dark:text-white">{project.title}</h3>{project.goal && <p className="text-xs text-gray-500 line-clamp-1">{project.goal}</p>}</div></div>
                        <div className="flex items-center gap-1">
                             <button onClick={(e) => { e.stopPropagation(); setProjectToEdit(project); }} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="تعديل المشروع"><Pencil size={18} /></button>
                             <button onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="حذف المشروع"><Trash2 size={18} /></button>
                             <ChevronLeft size={20} className="text-gray-400 group-hover:text-primary-500 transition-colors" />
                        </div>
                    </div>
                ))}
                {projects?.length === 0 && (<div className="text-center py-4 text-gray-400 text-sm">ابدأ بإنشاء مشروعك الأول</div>)}
             </div>
          )}

          {activeTab === 'inbox' && (
             <div className="animate-in fade-in slide-in-from-bottom-2">
                 <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                     <button onClick={() => setInboxSubTab('appointments')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 whitespace-nowrap ${inboxSubTab === 'appointments' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600'}`}><CalendarClock size={14} />موعد/اجتماع ({finalInboxData.appointments.length})</button>
                     <button onClick={() => setInboxSubTab('tasks')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 whitespace-nowrap ${inboxSubTab === 'tasks' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600'}`}><CheckSquare size={14} />مهام نشطة ({finalInboxData.tasks.length})</button>
                     <button onClick={() => setInboxSubTab('deferred')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 whitespace-nowrap ${inboxSubTab === 'deferred' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600'}`}><AlertCircle size={14} />مؤجلة ({finalInboxData.deferred.length})</button>
                     <button onClick={() => setInboxSubTab('completed')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 whitespace-nowrap ${inboxSubTab === 'completed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600'}`}><CheckCircle2 size={14} />مكتملة ({finalInboxData.completed.length})</button>
                 </div>

                 {inboxSubTab === 'tasks' && (
                     <div className="space-y-2">
                        {finalInboxData.tasks.length === 0 && (<div className="text-center py-10 text-gray-400 text-sm">لا توجد مهام نشطة جديدة</div>)}
                        {finalInboxData.tasks.map(task => (
                            <div key={task.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 w-8 h-8 flex items-center justify-center rounded-lg"><CheckSquare size={16} /></div>
                                    <div><p className="text-gray-900 dark:text-white font-bold text-sm">{task.title}</p><div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-1"><span>{task.executionDate ? new Date(task.executionDate).toLocaleDateString('en-GB') : 'Inbox'}</span>{task.scheduledTime && (<><span className="text-gray-300 dark:text-gray-600">•</span><span className="flex items-center gap-1" dir="ltr"><Clock size={10} />{new Date(task.scheduledTime).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span></>)}{task.durationMinutes && (<span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">( {task.durationMinutes} د )</span>)}</div></div>
                                </div>
                                <div className="flex items-center gap-1"><button onClick={() => setTaskToEdit(task)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Pencil size={16} /></button><button onClick={() => setTaskToDelete(task)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button></div>
                            </div>
                        ))}
                     </div>
                 )}
                 {inboxSubTab === 'deferred' && (
                     <div className="space-y-2">
                        {finalInboxData.deferred.length === 0 && (<div className="text-center py-10 text-gray-400 text-sm">لا توجد مهام مؤجلة</div>)}
                        {finalInboxData.deferred.map(task => (
                            <div key={task.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center group">
                                <div className="flex items-center gap-3"><div className="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 w-8 h-8 flex items-center justify-center rounded-lg"><AlertCircle size={16} /></div><div><p className="text-gray-900 dark:text-white font-bold text-sm">{task.title}</p><div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-1"><span className="text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10} />{task.rolloverCount > 0 ? `تأجلت ${task.rolloverCount} مرات` : 'مؤجلة'}</span></div></div></div>
                                <div className="flex items-center gap-1"><button onClick={() => setTaskToEdit(task)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Pencil size={16} /></button><button onClick={() => setTaskToDelete(task)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button></div>
                            </div>
                        ))}
                     </div>
                 )}
                 {inboxSubTab === 'appointments' && (
                     <div className="space-y-2">
                        {finalInboxData.appointments.length === 0 && (<div className="text-center py-10 text-gray-400 text-sm">لا توجد مواعيد قادمة</div>)}
                        {finalInboxData.appointments.map(apt => (
                            <div key={apt.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center group">
                                <div className="flex items-center gap-3"><div className={`text-white w-8 h-8 flex items-center justify-center rounded-lg ${apt.type === 'meeting' ? 'bg-teal-500' : 'bg-purple-500'}`}>{apt.type === 'meeting' ? <Users size={16} /> : <Calendar size={16} />}</div><div><p className="text-gray-900 dark:text-white font-bold text-sm">{apt.title}</p><span className="text-[10px] text-gray-500 block flex items-center gap-1 mt-1"><Calendar size={10} />{apt.executionDate ? new Date(apt.executionDate).toLocaleDateString() : ''}<span className="mx-1">•</span>{apt.scheduledTime ? new Date(apt.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span></div></div>
                                <div className="flex items-center gap-1"><button onClick={() => setTaskToEdit(apt)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Pencil size={16} /></button><button onClick={() => setTaskToDelete(apt)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button></div>
                            </div>
                        ))}
                     </div>
                 )}
                 {inboxSubTab === 'completed' && (
                     <div className="space-y-3">
                        {finalInboxData.completed.map(task => {
                            const dateObj = task.completedAt ? new Date(task.completedAt) : null;
                            return (
                                <div key={task.id} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                                    <CheckCircle2 size={20} className="text-green-600 dark:text-green-500" />
                                    <div className="flex-1"><h4 className="text-gray-900 dark:text-gray-200 line-through text-sm font-bold">{task.title}</h4><div className="flex flex-wrap items-center gap-2 mt-1.5"><span className="text-xs font-bold text-gray-600 dark:text-gray-400">{getCompletionLabel(task.type)}</span>{dateObj ? (<div className="flex items-center gap-2 bg-white dark:bg-gray-700/50 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-600/50 text-xs font-medium text-gray-700 dark:text-gray-300"><span>{dateObj.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="text-gray-300 dark:text-gray-500">|</span><span dir="ltr" className="font-mono">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>) : (<span className="text-xs text-gray-400">-</span>)}</div></div>
                                </div>
                            );
                        })}
                        {finalInboxData.completed.length === 0 && (<div className="text-center py-10 text-gray-400">القائمة فارغة</div>)}
                     </div>
                 )}
             </div>
          )}

          {activeTab === 'ideas' && (
             <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                {(!inboxIdeas || inboxIdeas.length === 0) && (<div className="text-center py-10 text-gray-400 text-sm">لا توجد أفكار أو ملاحظات</div>)}
                {inboxIdeas?.map(idea => (
                    <IdeaInboxItem 
                        key={idea.id} 
                        idea={idea} 
                        linkedTask={idea.linkedTaskId ? linkedTaskMap.get(idea.linkedTaskId) : undefined} 
                        onEdit={setIdeaToEdit} 
                        onDelete={setIdeaToDelete} 
                        onPreview={setPreviewAttachment} 
                    />
                ))}
             </div>
          )}
       </div>

       {previewAttachment && <FilePreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
       {(showCreateProject || projectToEdit) && <CreateProjectModal onClose={() => { setShowCreateProject(false); setProjectToEdit(null); }} onSuccess={forceUpdate} projectToEdit={projectToEdit} />}
       {taskToEdit && <RescheduleModal task={taskToEdit} onClose={() => setTaskToEdit(null)} onSuccess={forceUpdate} />}
       {ideaToEdit && <QuickCaptureModal editItem={ideaToEdit} onClose={() => setIdeaToEdit(null)} onSuccess={forceUpdate} />}
       <DeleteConfirmationModal isOpen={!!projectToDelete} onClose={() => setProjectToDelete(null)} onConfirm={handleDeleteProject} title="حذف المشروع؟" message={`هل أنت متأكد من حذف مشروع "${projectToDelete?.title}"؟`} />
       <DeleteConfirmationModal isOpen={!!taskToDelete} onClose={() => setTaskToDelete(null)} onConfirm={handleDeleteTask} title="حذف المهمة؟" message={`هل أنت متأكد من حذف مهمة "${taskToDelete?.title}"؟`} />
       <DeleteConfirmationModal isOpen={!!ideaToDelete} onClose={() => setIdeaToDelete(null)} onConfirm={handleDeleteIdea} title="حذف الفكرة؟" message="هل أنت متأكد من حذف هذه الفكرة/الملاحظة؟" />
    </div>
  );
};
