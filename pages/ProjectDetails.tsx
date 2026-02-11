
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ArrowRight, Trash2, PieChart as PieIcon, Calendar, CheckSquare, Plus, Pencil } from 'lucide-react';
import { TaskStatus, Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { TaskFSM } from '../services/fsm';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { RescheduleModal } from '../components/RescheduleModal';

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  
  // States
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // For Project
  
  // Task Management States
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  
  // Track expanded task ID for Accordion behavior
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // Manual signal to force refresh
  const [changeSignal, setChangeSignal] = useState(0);
  const forceUpdate = () => setChangeSignal(c => c + 1);

  // Listen for global update events (from Quick Capture Modal)
  useEffect(() => {
    const handleUpdate = () => forceUpdate();
    window.addEventListener('pos-update', handleUpdate);
    return () => window.removeEventListener('pos-update', handleUpdate);
  }, []);

  // Broad observation for tasks with forced refresh signal
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [changeSignal]);
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId, changeSignal]);

  // Filter and Sort
  const tasks = useMemo(() => {
    const projectTasks = allTasks?.filter(t => t.projectId === projectId) || [];
    
    return projectTasks.sort((a, b) => {
        // Helper to get comparable timestamp
        const getSortTime = (t: Task) => {
            // 1. Precise Scheduled Time
            if (t.scheduledTime) return new Date(t.scheduledTime).getTime();
            // 2. Execution Date (Start of day)
            if (t.executionDate) return new Date(t.executionDate).setHours(0,0,0,0);
            // 3. No Date (Push to bottom)
            return 8640000000000000; 
        };

        const timeA = getSortTime(a);
        const timeB = getSortTime(b);
        
        // Primary: Date/Time Ascending (Earliest First)
        if (timeA !== timeB) return timeA - timeB;

        // Secondary: Status (Active before Completed if same time)
        const isACompleted = a.status === TaskStatus.Completed;
        const isBCompleted = b.status === TaskStatus.Completed;
        if (isACompleted && !isBCompleted) return 1;
        if (!isACompleted && isBCompleted) return -1;

        // Tertiary: Priority (High to Low)
        return b.priority - a.priority;
    });
  }, [allTasks, projectId]);

  if (!project) return null;

  const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleDeleteProject = async () => {
      await (db as any).transaction('rw', db.projects, db.tasks, async () => {
          await db.tasks.where('projectId').equals(projectId).delete();
          await db.projects.delete(projectId);
      });
      toast.success('تم حذف المشروع');
      navigate('/organizer');
  };

  const handleDeleteTask = async () => {
      if (!taskToDelete || !taskToDelete.id) return;
      try {
          await db.tasks.delete(taskToDelete.id);
          toast.success('تم حذف المهمة');
          setTaskToDelete(null);
          forceUpdate();
      } catch (e) {
          toast.error('فشل الحذف');
      }
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
  };
  
  // Handler for Accordion Toggle
  const handleTaskToggle = (id: number) => {
    setExpandedTaskId(prevId => prevId === id ? null : id);
  };

  const statsData = [
    { name: 'Completed', value: completedTasks, color: '#10b981' },
    { name: 'Remaining', value: totalTasks - completedTasks, color: '#e5e7eb' },
  ];

  return (
    <div className="h-full overflow-y-auto pb-32 p-6 max-w-lg mx-auto animate-in slide-in-from-right duration-300">
        
        {/* Navigation & Actions */}
        <div className="flex justify-between items-center mb-6">
            <button 
                onClick={() => navigate(-1)}
                className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                <ArrowRight size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowEditProject(true)}
                    className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-full transition-colors"
                >
                    <Pencil size={20} />
                </button>
                <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                >
                    <Trash2 size={20} />
                </button>
            </div>
        </div>

        {/* Project Header */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm mb-6 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
            <div 
                className="absolute top-0 right-0 w-2 h-full"
                style={{ backgroundColor: project.color }}
            />
            
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{project.title}</h1>
            {project.goal && <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{project.goal}</p>}

            {/* Stats Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <div className="w-16 h-16 relative">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statsData}
                                    innerRadius={20}
                                    outerRadius={30}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    {statsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">
                             {progress}%
                         </div>
                     </div>
                     <div>
                         <p className="text-xs text-gray-500">معدل الإنجاز</p>
                         <p className="font-bold text-gray-800 dark:text-gray-200">{completedTasks} / {totalTasks} مهام</p>
                     </div>
                </div>
            </div>
        </div>

        {/* Tasks List Header */}
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <CheckSquare size={18} />
                المهام المرتبطة
            </h3>
            <button 
                onClick={() => setShowAddTask(true)}
                className="text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
            >
                <Plus size={16} />
                إضافة مهمة
            </button>
        </div>
        
        {/* Tasks List */}
        <div className="space-y-1">
            {tasks.map(task => {
                const isCompleted = task.status === TaskStatus.Completed;
                return (
                    <div 
                        key={task.id} 
                        className={`transition-all duration-300 ${isCompleted ? 'opacity-60 grayscale scale-[0.98]' : ''}`}
                    >
                        <TaskCard 
                            task={task} 
                            onReschedule={handleEditTask}
                            onDelete={(id) => setTaskToDelete(task)}
                            // Controlled Expansion
                            isExpanded={expandedTaskId === task.id}
                            onToggle={handleTaskToggle}
                        />
                    </div>
                );
            })}
            {tasks.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-400 mb-2">لا توجد مهام في هذا المشروع</p>
                    <button onClick={() => setShowAddTask(true)} className="text-primary-600 font-bold text-sm">أضف مهمتك الأولى</button>
                </div>
            )}
        </div>

        {/* Edit Project Modal */}
        {showEditProject && project && (
            <CreateProjectModal
                projectToEdit={project}
                onClose={() => setShowEditProject(false)}
                onSuccess={forceUpdate}
            />
        )}

        {/* Add Task Modal for this project */}
        {showAddTask && (
            <QuickCaptureModal 
                onClose={() => setShowAddTask(false)} 
                defaultProjectId={projectId} 
                onSuccess={forceUpdate}
            />
        )}

        {/* Delete Confirmation Modal (For Project) */}
        <DeleteConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDeleteProject}
            title="حذف المشروع؟"
            message="هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع المهام المرتبطة به نهائياً."
        />
        
        {/* Delete Confirmation Modal (For Individual Task) */}
        <DeleteConfirmationModal
            isOpen={!!taskToDelete}
            onClose={() => setTaskToDelete(null)}
            onConfirm={handleDeleteTask}
            title="حذف المهمة؟"
            message={`هل أنت متأكد من حذف مهمة "${taskToDelete?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        />

        {/* Edit Task Modal */}
        {taskToEdit && (
            <RescheduleModal
                task={taskToEdit}
                mode="default"
                onClose={() => setTaskToEdit(null)}
                onSuccess={forceUpdate}
            />
        )}
    </div>
  );
};
