
import React, { useState, useEffect } from 'react';
import { X, Lightbulb, StickyNote, Trash2, Image as ImageIcon, FileText, Eye, Pencil, ChevronDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Idea, Attachment } from '../types';
import toast from 'react-hot-toast';
import { FilePreviewModal } from './FilePreviewModal';
import { QuickCaptureModal } from './QuickCaptureModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { syncService } from '../services/syncService';

interface Props {
  parentTaskId: number;
  parentTitle: string;
  onClose: () => void;
}

// Sub-component for individual Linked Idea Items
interface LinkedIdeaItemProps {
    idea: Idea;
    onEdit: (i: Idea) => void;
    onDelete: (i: Idea) => void;
    onPreview: (a: Attachment) => void;
}

const LinkedIdeaItem: React.FC<LinkedIdeaItemProps> = ({ 
    idea, 
    onEdit, 
    onDelete, 
    onPreview 
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isIdea = idea.type === 'idea';

    return (
        <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-3 rounded-xl border shadow-sm relative group transition-all cursor-pointer
                ${isIdea 
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' 
                    : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                }`}
        >
            <div className="flex items-start gap-3">
                <div className={`mt-1 ${isIdea ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {isIdea ? <Lightbulb size={18} /> : <StickyNote size={18} />}
                </div>
                <div className="flex-1 min-w-0 pl-10">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold
                            ${isIdea 
                                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                            {isIdea ? 'فكرة' : 'ملاحظة'}
                        </span>
                    </div>
                    
                    {/* Content with Line Clamp */}
                    <p className={`text-gray-800 dark:text-gray-200 text-sm leading-relaxed transition-all
                        ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3 overflow-hidden text-ellipsis'}`}>
                        {idea.content}
                    </p>

                    {!isExpanded && idea.content.length > 80 && (
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 opacity-60">
                            <ChevronDown size={12} />
                            <span>المزيد...</span>
                        </div>
                    )}
                    
                    {/* Attachment Display */}
                    {idea.attachment && (
                        <div 
                            onClick={(e) => { 
                                e.stopPropagation();
                                onPreview(idea.attachment!); 
                            }}
                            className="mt-3 flex items-center gap-3 bg-white/60 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:bg-white dark:hover:bg-black/40 transition-colors w-fit max-w-full"
                        >
                            <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 flex-shrink-0">
                                {idea.attachment.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                            </div>
                            <div className="flex flex-col min-w-0 overflow-hidden">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{idea.attachment.name}</span>
                                <span className="text-[10px] text-gray-500">{(idea.attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <Eye size={14} className="text-gray-400 mr-1 flex-shrink-0" />
                        </div>
                    )}

                    <span className="text-[10px] text-gray-400 mt-2 block">
                        {idea.createdAt.toLocaleDateString()}
                    </span>
                </div>
                
                <div className="flex flex-col gap-1 absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(idea);
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white/50 rounded-lg transition-colors"
                        title="تعديل"
                    >
                        <Pencil size={16} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(idea);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white/50 rounded-lg transition-colors"
                        title="حذف"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export const LinkedContentModal: React.FC<Props> = ({ parentTaskId, parentTitle, onClose }) => {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [ideaToEdit, setIdeaToEdit] = useState<Idea | null>(null);
  const [ideaToDelete, setIdeaToDelete] = useState<Idea | null>(null);

  // Manual trigger to force re-query on updates
  const [changeSignal, setChangeSignal] = useState(0);

  // Listen for global update events to refresh the list automatically
  useEffect(() => {
    const handleUpdate = () => setChangeSignal(c => c + 1);
    window.addEventListener('pos-update', handleUpdate);
    return () => window.removeEventListener('pos-update', handleUpdate);
  }, []);

  // Filter Deleted
  const ideas = useLiveQuery(() => 
    db.ideas.where('linkedTaskId').equals(parentTaskId).filter(i => !i.deletedAt).toArray()
  , [parentTaskId, changeSignal]);

  // Auto-close if the list becomes empty (e.g. after moving/deleting all notes)
  useEffect(() => {
      if (ideas && ideas.length === 0) {
          onClose();
      }
  }, [ideas, onClose]);

  const confirmDelete = async () => {
      if (!ideaToDelete || !ideaToDelete.id) return;
      try {
          // Use deleteRecord for Hard Delete
          await syncService.deleteRecord('ideas', ideaToDelete.id);
          toast.success('تم الحذف');
          window.dispatchEvent(new Event('pos-update')); // Force global update for counters
          setIdeaToDelete(null);
      } catch (e) {
          toast.error('حدث خطأ');
      }
  };

  return (
    <>
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" dir="rtl">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">أفكار وملاحظات مرتبطة</h3>
                <p className="text-xs text-gray-500 truncate max-w-[250px]">{parentTitle}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
            </button>
            </div>

            {/* Content List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {!ideas || ideas.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        لا توجد ملاحظات مرتبطة
                    </div>
                ) : (
                    ideas.map((idea) => (
                        <LinkedIdeaItem 
                            key={idea.id}
                            idea={idea}
                            onEdit={setIdeaToEdit}
                            onDelete={setIdeaToDelete}
                            onPreview={setPreviewAttachment}
                        />
                    ))
                )}
            </div>
        </div>
        </div>

        {/* File Preview Modal */}
        {previewAttachment && (
           <FilePreviewModal 
               attachment={previewAttachment}
               onClose={() => setPreviewAttachment(null)}
           />
        )}

        {/* Edit Modal */}
        {ideaToEdit && (
           <QuickCaptureModal 
               editItem={ideaToEdit}
               onClose={() => setIdeaToEdit(null)}
           />
        )}

        {/* Delete Confirmation */}
        <DeleteConfirmationModal 
            isOpen={!!ideaToDelete}
            onClose={() => setIdeaToDelete(null)}
            onConfirm={confirmDelete}
            title="حذف العنصر؟"
            message="هل أنت متأكد من حذف هذه الفكرة/الملاحظة؟ لا يمكن التراجع عن هذا الإجراء."
        />
    </>
  );
};
