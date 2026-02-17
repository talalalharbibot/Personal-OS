import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Moon, Sun, Trash2, Bell, BellRing, Volume2, VolumeX, Clock, Coffee, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../db';
import { getScheduleSettings, saveScheduleSettings } from '../services/scheduling';
import { syncService } from '../services/syncService';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  // Theme State
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  // System Notifications State (Browser Push)
  const [sysNotificationsEnabled, setSysNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  // In-App Sound State (No Permission Needed)
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Scheduling State
  const [scheduleConfig, setScheduleConfig] = useState(getScheduleSettings());

  // Check Permissions & LocalStorage on Mount
  useEffect(() => {
    // 1. System Notifications Check
    if ('Notification' in window) {
        setPermissionStatus(Notification.permission);
        const isSysEnabled = localStorage.getItem('notifications_sys') === 'true';
        setSysNotificationsEnabled(Notification.permission === 'granted' && isSysEnabled);
    }

    // 2. In-App Sound Check
    const isSoundEnabled = localStorage.getItem('notifications_sound') === 'true';
    setSoundEnabled(isSoundEnabled);

    // 3. Permission Listener
    if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' as PermissionName }).then((status) => {
            status.onchange = () => {
                const newPerm = Notification.permission;
                setPermissionStatus(newPerm);
                if (newPerm === 'granted') {
                    setSysNotificationsEnabled(true);
                    localStorage.setItem('notifications_sys', 'true');
                } else {
                    setSysNotificationsEnabled(false);
                    localStorage.setItem('notifications_sys', 'false');
                }
            };
        }).catch(() => {});
    }
  }, []);

  // Scheduling Effects
  useEffect(() => {
    saveScheduleSettings(scheduleConfig);
  }, [scheduleConfig]);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      toast.success('تم تفعيل الوضع الداكن');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      toast.success('تم تفعيل الوضع الفاتح');
    }
  };

  const toggleSound = () => {
      const newState = !soundEnabled;
      setSoundEnabled(newState);
      localStorage.setItem('notifications_sound', String(newState));
      
      if (newState) {
          // Play a gentle test beep
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
          toast.success('تم تفعيل التنبيهات الصوتية', { icon: '🔊' });
      } else {
          toast('تم كتم الصوت', { icon: '🔇' });
      }
  };

  const toggleSysNotifications = async () => {
    if (!('Notification' in window)) {
        toast.error('المتصفح لا يدعم الإشعارات');
        return;
    }

    const currentPermission = Notification.permission;
    setPermissionStatus(currentPermission);

    // Disable
    if (sysNotificationsEnabled) {
        setSysNotificationsEnabled(false);
        localStorage.setItem('notifications_sys', 'false');
        toast('تم إيقاف إشعارات النظام', { icon: '🔕' });
        return;
    }

    // Enable - Handle Denied
    if (currentPermission === 'denied') {
        toast((t) => (
            <div className="flex flex-col gap-3 min-w-[250px]" dir="rtl">
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                    <Lock size={18} className="mt-0.5 flex-shrink-0" />
                    <span className="font-bold text-sm">الإشعارات محظورة</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    المتصفح يمنع الإشعارات. يمكنك الاكتفاء بـ "التنبيهات الصوتية" بالأسفل، أو تغيير إعدادات المتصفح.
                </p>
                <div className="flex gap-2 mt-1">
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-xs py-2 rounded-lg font-bold"
                    >
                         تحديث
                    </button>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 bg-gray-200 dark:bg-gray-700 text-xs py-2 rounded-lg font-bold"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        ), { duration: 6000 });
        return;
    }

    // Enable - Request
    try {
        let permission: NotificationPermission = currentPermission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        setPermissionStatus(permission);

        if (permission === 'granted') {
            setSysNotificationsEnabled(true);
            localStorage.setItem('notifications_sys', 'true');
            new Notification('نظام (Nizam)', { body: 'تم تفعيل إشعارات النظام ✅', icon: '/favicon.ico' });
            toast.success('تم التفعيل');
        } else {
            setSysNotificationsEnabled(false);
            localStorage.setItem('notifications_sys', 'false');
            toast.error('تم رفض الإذن');
        }
    } catch (error) {
        console.error(error);
    }
  };

  const handleClearData = async () => {
    if (confirm('هل أنت متأكد؟ سيتم حذف جميع البيانات والمهام نهائياً!')) {
      syncService.stopAutoSync();
      (db as any).close(); // Close before deleting
      await (db as any).delete();
      await (db as any).open();
      window.location.reload();
      toast.success('تم تصفير البيانات بنجاح');
    }
  };

  const ToggleSwitch = ({ checked }: { checked: boolean }) => (
      <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${checked ? 'left-0.5' : 'right-0.5'}`} />
      </div>
  );

  return (
    <div className="h-full overflow-y-auto pb-32 p-6 max-w-lg mx-auto animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
          <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
              <ArrowRight size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">الإعدادات</h1>
      </div>

      <div className="space-y-6">
        
        {/* Section: General */}
        <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">عام</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div 
                    onClick={toggleTheme}
                    className="p-4 flex items-center justify-between border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-orange-100 text-orange-600'}`}>
                            {isDark ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200">المظهر</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                            {isDark ? 'داكن' : 'فاتح'}
                        </span>
                    </div>
                </div>
            </div>
        </section>

        {/* Section: Scheduling & Time */}
        <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">الجدولة والوقت</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700">
                    <div 
                        className="flex items-center justify-between cursor-pointer mb-3"
                        onClick={() => setScheduleConfig({...scheduleConfig, workHoursEnabled: !scheduleConfig.workHoursEnabled})}
                    >
                         <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <Clock size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-800 dark:text-gray-200">ساعات العمل</span>
                                <span className="text-[10px] text-gray-400">تقييد المهام بوقت بداية ونهاية يومي</span>
                            </div>
                        </div>
                        <ToggleSwitch checked={scheduleConfig.workHoursEnabled} />
                    </div>
                    
                    {scheduleConfig.workHoursEnabled && (
                         <div className="flex gap-4 items-center animate-in fade-in slide-in-from-top-2 pt-2">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 block mb-1">من</label>
                                <input 
                                    type="time" 
                                    value={scheduleConfig.workStart}
                                    onChange={(e) => setScheduleConfig({...scheduleConfig, workStart: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm border border-gray-200 dark:border-gray-700"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 block mb-1">إلى</label>
                                <input 
                                    type="time" 
                                    value={scheduleConfig.workEnd}
                                    onChange={(e) => setScheduleConfig({...scheduleConfig, workEnd: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm border border-gray-200 dark:border-gray-700"
                                />
                            </div>
                         </div>
                    )}
                </div>

                <div className="p-4">
                    <div 
                        className="flex items-center justify-between cursor-pointer mb-3"
                        onClick={() => setScheduleConfig({...scheduleConfig, bufferEnabled: !scheduleConfig.bufferEnabled})}
                    >
                         <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                <Coffee size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-800 dark:text-gray-200">فترة راحة (Buffer)</span>
                                <span className="text-[10px] text-gray-400">فاصل زمني إلزامي بين المهام</span>
                            </div>
                        </div>
                        <ToggleSwitch checked={scheduleConfig.bufferEnabled} />
                    </div>
                    
                    {scheduleConfig.bufferEnabled && (
                         <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                            <label className="text-xs text-gray-500 block mb-1">مدة الراحة (دقائق)</label>
                            <div className="flex gap-2">
                                {[5, 10, 15, 30, 60].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setScheduleConfig({...scheduleConfig, bufferMinutes: mins})}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                            scheduleConfig.bufferMinutes === mins 
                                            ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' 
                                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400'
                                        }`}
                                    >
                                        {mins}د
                                    </button>
                                ))}
                            </div>
                         </div>
                    )}
                </div>

            </div>
        </section>

        {/* Section: Notifications */}
        <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">التنبيهات</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div 
                    onClick={toggleSound}
                    className="p-4 flex items-center justify-between border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-800 dark:text-gray-200">تنبيهات صوتية</span>
                            <span className="text-[10px] text-gray-400">تعمل أثناء استخدام التطبيق فقط (بدون إذن)</span>
                        </div>
                    </div>
                    <ToggleSwitch checked={soundEnabled} />
                </div>

                <div 
                    onClick={toggleSysNotifications}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${sysNotificationsEnabled ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            {sysNotificationsEnabled ? <BellRing size={20} /> : <Bell size={20} />}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-800 dark:text-gray-200">إشعارات النظام</span>
                            <span className="text-[10px] text-gray-400">
                                {permissionStatus === 'denied' 
                                    ? 'محظورة من المتصفح 🔒' 
                                    : 'تصلك حتى والتطبيق مغلق'}
                            </span>
                        </div>
                    </div>
                    <ToggleSwitch checked={sysNotificationsEnabled} />
                </div>

            </div>
        </section>

        {/* Section: Data */}
        <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">البيانات</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div 
                    onClick={handleClearData}
                    className="p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600 dark:text-red-400">
                            <Trash2 size={20} />
                        </div>
                        <span className="font-bold text-red-600 dark:text-red-400">حذف جميع البيانات المحلية</span>
                    </div>
                </div>
            </div>
        </section>

        <div className="text-center pt-8 pb-4">
            <p className="text-xs text-gray-400">تم التطوير بواسطة نظام (Nizam)</p>
        </div>

      </div>
    </div>
  );
};