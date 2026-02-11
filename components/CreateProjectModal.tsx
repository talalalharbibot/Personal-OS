
import React, { useState, useEffect } from 'react';
import { X, Save, Palette, Check } from 'lucide-react';
import { db } from '../db';
import { Project } from '../types';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  projectToEdit?: Project | null;
}

const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
];

export const CreateProjectModal: React.FC<Props> = ({ onClose, onSuccess, projectToEdit }) => {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  // Initialize state if editing
  useEffect(() => {
    if (projectToEdit) {
      setTitle(projectToEdit.title);
      setGoal(projectToEdit.goal || '');
      setSelectedColor(projectToEdit.color);
    }
  }, [projectToEdit]);

  const handleSave = async () => {
    if (!title.trim()) {
        toast.error('يرجى كتابة اسم المشروع');
        return;
    }

    try {
        if (projectToEdit && projectToEdit.id) {
          // Update existing
          await db.projects.update(projectToEdit.id, {
            title,
            goal,
            color: selectedColor
          });
          toast.success('تم تحديث المشروع بنجاح');
        } else {
          // Create new
          await db.projects.add({
              title,
              goal,
              color: selectedColor,
              createdAt: new Date()
          });
          toast.success('تم إنشاء المشروع بنجاح');
        }
        
        if (onSuccess) onSuccess();
        onClose();
    } catch (e) {
        toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {projectToEdit ? 'تعديل المشروع' : 'مشروع جديد'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم المشروع</label>
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: تعلم الفرنسية"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الهدف (اختياري)</label>
                <textarea 
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="لماذا تريد القيام بهذا المشروع؟"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all h-24 resize-none"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">لون المشروع</label>
                <div className="flex flex-wrap gap-3">
                    {COLORS.map(color => (
                        <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center relative"
                            style={{ backgroundColor: color }}
                        >
                            {selectedColor === color && <Check size={16} className="text-white" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
                <Save size={18} />
                {projectToEdit ? 'حفظ التعديلات' : 'حفظ المشروع'}
            </button>
        </div>
      </div>
    </div>
  );
};
