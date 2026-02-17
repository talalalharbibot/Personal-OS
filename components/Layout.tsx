
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, FolderKanban, Plus, Menu, Layers, User, LogOut, X, Pencil } from 'lucide-react';
import { QuickCaptureModal } from './QuickCaptureModal';
import { MoreMenu } from './MoreMenu';
import { Toaster } from 'react-hot-toast';
import { supabase } from '../services/supabaseClient';
import { syncService } from '../services/syncService';
import { getFileUrl } from '../services/storage';
import { db } from '../db';
import toast from 'react-hot-toast';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const location = useLocation();
  const isFocusMode = location.pathname === '/focus';

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
    });

    // Listen for changes (login, logout, user updates)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Effect to load avatar URL when user changes
  useEffect(() => {
      const loadAvatar = async () => {
          if (user?.user_metadata?.avatar_path) {
              const url = await getFileUrl(user.user_metadata.avatar_path);
              setAvatarUrl(url);
          } else {
              setAvatarUrl(null);
          }
      };
      loadAvatar();
  }, [user]);

  const handleLogout = async () => {
      const toastId = toast.loading('جاري تسجيل الخروج...');
      try {
          if (navigator.onLine && user) {
             try { await syncService.triggerSync(); } catch(e) { console.warn('Logout sync failed', e); }
          }
          syncService.stopAutoSync();
          (db as any).close(); 
          await (db as any).delete(); 
          await (db as any).open();
          await supabase.auth.signOut();
          toast.success('تم تسجيل الخروج', { id: toastId });
          setIsProfileOpen(false);
          setAvatarUrl(null);
          navigate('/auth');
      } catch (error) {
          toast.error('حدث خطأ أثناء الخروج', { id: toastId });
      }
  };

  const handleProfileClick = () => {
      setIsProfileOpen(false);
      navigate('/profile');
  };

  // Hide Nav if focused
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
      
      {/* APP HEADER */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 z-30 flex-shrink-0">
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center text-white shadow-sm">
                  <Layers size={18} />
              </div>
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">نظام</h1>
          </div>
          
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-600 transition-colors border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
              {avatarUrl ? (
                  <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
              ) : (
                  <User size={18} />
              )}
          </button>
      </header>

      {/* Content Area - Children handle scrolling */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Floating Action Button (FAB) */}
      {!isMoreMenuOpen && !isProfileOpen && (
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

      {/* PROFILE MENU MODAL/DROPDOWN */}
      {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 animate-in fade-in" onClick={() => setIsProfileOpen(false)}>
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
              <div 
                className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden relative z-10 animate-in slide-in-from-top-5 duration-200"
                onClick={e => e.stopPropagation()}
                dir="rtl"
              >
                  {/* Profile Header & Info */}
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      
                      {/* Close Button */}
                      <div className="flex justify-end mb-2">
                          <button 
                              onClick={() => setIsProfileOpen(false)} 
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                          >
                              <X size={16} />
                          </button>
                      </div>

                      {/* Clickable Info Area */}
                      <div 
                        onClick={handleProfileClick}
                        className="flex items-center justify-between cursor-pointer group p-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 text-xl font-bold overflow-hidden border border-gray-200 dark:border-gray-700">
                                  {avatarUrl ? (
                                      <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                                  ) : (
                                      user?.email?.[0].toUpperCase() || <User />
                                  )}
                              </div>
                              <div>
                                  <h3 className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-primary-600 transition-colors">
                                      {user?.user_metadata?.full_name || 'المستخدم'}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">{user?.email || 'زائر'}</p>
                              </div>
                          </div>
                          
                          {/* Edit Pencil Icon */}
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600 group-hover:border-primary-200 group-hover:text-primary-600 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-all shadow-sm">
                             <Pencil size={16} />
                          </div>
                      </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors text-left text-sm font-bold">
                          <LogOut size={18} />
                          <span>تسجيل الخروج</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <NavItem to="/" icon={<LayoutDashboard size={24} />} label="الرئيسية" />
          <NavItem to="/calendar" icon={<Calendar size={24} />} label="التقويم" />
          <div className="w-12" /> {/* Spacer for FAB visual balance */}
          <NavItem to="/organizer" icon={<FolderKanban size={24} />} label="منظم" />
          
          {/* More Button */}
          <button 
             onClick={() => setIsMoreMenuOpen(true)}
             className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isMoreMenuOpen ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
             <Menu size={24} />
             <span className="text-xs font-medium">المزيد</span>
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
      `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
        isActive
          ? 'text-primary-600 dark:text-primary-400 font-bold'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`
    }
  >
    {icon}
    <span className="text-xs font-medium">{label}</span>
  </NavLink>
);
