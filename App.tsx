import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Organizer } from './pages/Organizer';
import { FocusMode } from './pages/FocusMode';
import { ProjectDetails } from './pages/ProjectDetails';
import { Settings } from './pages/Settings';
import { Statistics } from './pages/Statistics';
import { HelpSupport } from './pages/HelpSupport';
import { AboutApp } from './pages/AboutApp';
import { Profile } from './pages/Profile';
import { Auth } from './pages/Auth';
import { checkReminders } from './services/notificationService';
import { db } from './db';
import { supabase } from './services/supabaseClient';
import { syncService } from './services/syncService';
import { Database } from 'lucide-react';

// --- Database Error Modal Component ---
const DatabaseErrorModal: React.FC<{ isOpen: boolean, onClose: () => void, errorMsg?: string }> = ({ isOpen, onClose, errorMsg }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-center animate-in zoom-in-95" dir="rtl">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-500">
                    <Database size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">مطلوب تحديث قاعدة البيانات</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                    تم اكتشاف نقص في جداول أو أعمدة قاعدة البيانات السحابية (Supabase). لا يمكن جلب البيانات حتى يتم إصلاح الهيكل.
                </p>
                {errorMsg && (
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs font-mono text-left mb-6 text-red-500 overflow-x-auto">
                        {errorMsg}
                    </div>
                )}
                <div className="flex gap-3">
                    <button 
                        onClick={() => { onClose(); window.location.hash = '#/settings'; }}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl transition-colors"
                    >
                        الذهاب للإعدادات للإصلاح
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

// Component to handle auth redirect logic AND background services lifecycle
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const hasCachedSession = Object.keys(localStorage).some(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
  );

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(!hasCachedSession);

  // 1. Session Check & Auth State Listener
  useEffect(() => {
    // Initial Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      if (!session && location.pathname !== '/auth') {
        navigate('/auth');
      } 
      else if (session && location.pathname === '/auth') {
        navigate('/');
      }
    });

    // Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      
      // LOGIC: If logging in (session exists + on /auth page), reset DB *BEFORE* setting session state
      // This prevents background services from starting while DB is being deleted.
      if (session && location.pathname === '/auth') {
         try {
             // 1. Stop all services strictly
             syncService.stopAutoSync();
             
             // 2. Close DB
             (db as any).close();
             
             // 3. Wait a moment for connections to release
             await new Promise(resolve => setTimeout(resolve, 100));
             
             // 4. Delete and Re-open
             await (db as any).delete();
             await (db as any).open();
             
             // 5. Clear local flags
             localStorage.removeItem('migration_v6_done');
             
         } catch(e) { console.error('DB Reset Error', e); }

         // NOW update state
         setSession(session);
         navigate('/');
      } else {
         // Standard update
         setSession(session);

         if (!session && location.pathname !== '/auth') {
           navigate('/auth');
         }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  // 2. Manage Background Services (Sync, Notifications) - ONLY when Session exists
  useEffect(() => {
      if (session) {
          // A. Start Sync
          syncService.startAutoSync();

          // B. Start Reminders
          checkReminders(); // Immediate check
          const reminderInterval = setInterval(() => checkReminders(), 60000);

          // C. Run Migration (if needed) for this session
          const runMigration = async () => {
              if (localStorage.getItem('migration_v6_done')) return;
              
              // Safety: Check if DB is open
              if ((db as any).isOpen && !(db as any).isOpen()) return;

              console.log('Running DB migration v6...');
              try {
                  const tables = [db.tasks, db.projects, db.ideas, db.habits];
                  for (const table of tables) {
                      // Double check inside loop
                      if ((db as any).isOpen && !(db as any).isOpen()) return;

                      await (table as any).toCollection().modify((item: any) => {
                          if (!item.uuid) item.uuid = crypto.randomUUID();
                          if (!item.updatedAt) item.updatedAt = new Date();
                          if (item.syncedAt === undefined) item.syncedAt = 0;
                      });
                  }
                  localStorage.setItem('migration_v6_done', 'true');
              } catch (e: any) { 
                  // Ignore closed database errors during migration
                  if (e.name !== 'DatabaseClosedError' && !e.message?.includes('DatabaseClosedError')) {
                    console.error('Migration failed', e); 
                  }
              }
          };
          runMigration();

          return () => {
              // Cleanup when session ends or component unmounts
              syncService.stopAutoSync();
              clearInterval(reminderInterval);
          };
      } else {
          // Ensure services are stopped if no session
          syncService.stopAutoSync();
      }
  }, [session]);

  if (loading) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Initialize Error Listening
  useEffect(() => {
      const handleError = (e: any) => {
          setDbError(`Error in ${e.detail.table}: ${e.detail.error}`);
      };

      window.addEventListener('pos-schema-error', handleError);
      return () => window.removeEventListener('pos-schema-error', handleError);
  }, []);

  return (
    <HashRouter>
      <DatabaseErrorModal isOpen={!!dbError} onClose={() => setDbError(null)} errorMsg={dbError || ''} />
      <AuthGuard>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="organizer" element={<Organizer />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="settings" element={<Settings />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="help" element={<HelpSupport />} />
            <Route path="about" element={<AboutApp />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          
          <Route path="/focus" element={<FocusMode />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    </HashRouter>
  );
};

export default App;