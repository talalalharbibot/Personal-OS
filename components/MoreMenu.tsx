
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Settings, Focus, X, PieChart, Info, HelpCircle } from 'lucide-react';

interface MoreMenuProps {
  onClose: () => void;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      
      <div 
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-10 duration-300"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Handle Bar for visuals */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />

        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">المزيد</h3>
            <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <X size={20} />
            </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Focus Mode - Main Feature */}
            <NavLink 
                to="/focus" 
                onClick={onClose}
                className="bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-700/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group hover:scale-[1.02] transition-transform shadow-sm"
            >
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-800 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-300">
                    <Focus size={24} />
                </div>
                <span className="font-bold text-primary-900 dark:text-primary-100">وضع التركيز</span>
            </NavLink>

            {/* Statistics */}
            <NavLink
                to="/statistics"
                onClick={onClose}
                className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-700/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group hover:scale-[1.02] transition-transform shadow-sm"
            >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                    <PieChart size={24} />
                </div>
                <span className="font-bold text-indigo-900 dark:text-indigo-100">الإحصائيات</span>
            </NavLink>
        </div>

        <div className="space-y-2">
            <NavLink 
                to="/settings"
                onClick={onClose}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">
                    <Settings size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">الإعدادات</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">المظهر، البيانات، النسخ الاحتياطي</p>
                </div>
                <div className="text-gray-400">
                    <Settings size={16} className="rotate-90" />
                </div>
            </NavLink>

            <NavLink 
                to="/help"
                onClick={onClose}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">
                    <HelpCircle size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">المساعدة والدعم</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">الأسئلة الشائعة، تواصل معنا</p>
                </div>
                <div className="text-gray-400">
                    <Settings size={16} className="rotate-90" />
                </div>
            </NavLink>

            <NavLink 
                to="/about"
                onClick={onClose}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">
                    <Info size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">عن التطبيق</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">الإصدار، المميزات، المطور</p>
                </div>
                <div className="text-gray-400">
                    <Settings size={16} className="rotate-90" />
                </div>
            </NavLink>
        </div>
      </div>
    </div>
  );
};
