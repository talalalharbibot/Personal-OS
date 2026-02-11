
import React from 'react';
import { AlertTriangle, Clock, CalendarX } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  suggestion?: string;
}

export const ConflictAlertModal: React.FC<Props> = ({ isOpen, onClose, reason, suggestion }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" dir="rtl">
        
        <div className="bg-red-50 dark:bg-red-900/20 p-6 flex flex-col items-center justify-center border-b border-red-100 dark:border-red-900/30">
             <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-2 shadow-inner">
                <CalendarX size={32} />
             </div>
             <h3 className="text-lg font-bold text-red-600 dark:text-red-400">تعارض في الجدول</h3>
        </div>

        <div className="p-6 text-center space-y-4">
          <p className="text-gray-800 dark:text-gray-200 font-medium text-base leading-relaxed">
            {reason}
          </p>

          {suggestion && (
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 text-right">
                  <Clock size={18} className="text-primary-500 flex-shrink-0" />
                  <span>{suggestion}</span>
              </div>
          )}

          <p className="text-xs text-gray-400">
            لا يمكن إتمام العملية لوجود تعارض زمني أو تجاوز لساعات العمل.
          </p>

          <button
            onClick={onClose}
            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg mt-2"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
};
