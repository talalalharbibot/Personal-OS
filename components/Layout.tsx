
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, FolderKanban, Plus, Menu } from 'lucide-react';
import { QuickCaptureModal } from './QuickCaptureModal';
import { MoreMenu } from './MoreMenu';
import { Toaster } from 'react-hot-toast';

export const Layout: React.FC = () => {
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  const location = useLocation();
  const isFocusMode = location.pathname === '/focus';

  // Hide Nav if focused, but if it's just "settings" or "dashboard" show nav
  if (isFocusMode) {
    return (
      <>
        <Toaster position="top-center" reverseOrder={false} />
        <Outlet />
      </>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* Content Area - Children handle scrolling */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Floating Action Button (FAB) - Hidden if menu is open to prevent visual clutter */}
      {!isMoreMenuOpen && (
        <button
          onClick={() => setIsQuickCaptureOpen(true)}
          className="fixed bottom-24 left-6 z-40 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl p-4 shadow-lg shadow-primary-500/30 transition-transform active:scale-95"
          aria-label="إضافة سريعة"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Quick Capture Modal */}
      {isQuickCaptureOpen && (
        <QuickCaptureModal onClose={() => setIsQuickCaptureOpen(false)} />
      )}

      {/* More Menu Bottom Sheet */}
      {isMoreMenuOpen && (
        <MoreMenu onClose={() => setIsMoreMenuOpen(false)} />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <NavItem to="/" icon={<LayoutDashboard size={24} />} label="الرئيسية" />
          <NavItem to="/calendar" icon={<Calendar size={24} />} label="التقويم" />
          <div className="w-12" /> {/* Spacer for FAB visual balance */}
          <NavItem to="/organizer" icon={<FolderKanban size={24} />} label="منظم" />
          
          {/* More Button (Replaces Focus) */}
          <button 
             onClick={() => setIsMoreMenuOpen(true)}
             className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isMoreMenuOpen ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
             <Menu size={24} />
             <span className="text-xs">المزيد</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center w-full h-full space-y-1 ${
        isActive
          ? 'text-primary-600 dark:text-primary-400 font-bold'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`
    }
  >
    {icon}
    <span className="text-xs">{label}</span>
  </NavLink>
);
