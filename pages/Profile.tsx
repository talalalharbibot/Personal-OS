
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { uploadAttachment, getFileUrl } from '../services/storage';
import { ArrowRight, Camera, Save, User, Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // User Data
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          setName(user.user_metadata?.full_name || '');
          setEmail(user.email || '');
          
          // Load existing avatar if available
          const avatarPath = user.user_metadata?.avatar_path;
          if (avatarPath) {
             const url = await getFileUrl(avatarPath);
             if (url) setAvatarPreview(url);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setFetching(false);
      }
    };
    fetchProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
          toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
          return;
      }
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        let avatarPath = user?.user_metadata?.avatar_path;

        // 1. Upload new avatar if selected
        if (avatarFile) {
            const path = await uploadAttachment(avatarFile);
            if (path) {
                avatarPath = path;
            } else {
                toast.error('فشل رفع الصورة الشخصية');
            }
        }

        // 2. Prepare Update Data
        const updates: any = {
            email: email,
            data: {
                full_name: name,
                avatar_path: avatarPath
            }
        };

        // Only update password if provided
        if (password.trim()) {
            updates.password = password;
        }

        const { error } = await supabase.auth.updateUser(updates);

        if (error) throw error;

        toast.success('تم تحديث الملف الشخصي بنجاح');
        
        // Clear password field after save
        setPassword('');
        
    } catch (error: any) {
        toast.error(error.message || 'حدث خطأ أثناء التحديث');
    } finally {
        setLoading(false);
    }
  };

  if (fetching) {
      return (
        <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      );
  }

  return (
    <div className="h-full overflow-y-auto pb-32 p-6 max-w-lg mx-auto animate-in slide-in-from-right duration-300">
      
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowRight size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">الملف الشخصي</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
          
          <form onSubmit={handleSave} className="space-y-6">
              
              {/* Avatar Section */}
              <div className="flex flex-col items-center justify-center mb-6">
                  <div className="relative group">
                      <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-28 h-28 rounded-full bg-gray-100 dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg flex items-center justify-center cursor-pointer overflow-hidden transition-transform active:scale-95"
                      >
                          {avatarPreview ? (
                              <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                              <User size={40} className="text-gray-400" />
                          )}
                      </div>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-primary-600 p-2 rounded-full text-white cursor-pointer shadow-md hover:bg-primary-700 transition-colors"
                      >
                          <Camera size={16} />
                      </div>
                      <input 
                          ref={fileInputRef}
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileChange} 
                          className="hidden" 
                      />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">اضغط للتغيير</p>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
                      <div className="relative">
                          <input 
                              type="text" 
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 pl-10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                          />
                          <User size={18} className="absolute left-3 top-3.5 text-gray-400" />
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">البريد الإلكتروني</label>
                      <div className="relative">
                          <input 
                              type="email" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 pl-10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                          />
                          <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 mr-1">تغيير البريد الإلكتروني قد يتطلب إعادة تأكيد.</p>
                  </div>

                  <div className="pt-2 border-t dark:border-gray-700">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">كلمة المرور الجديدة</label>
                      <div className="relative">
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="اتركها فارغة إذا لم ترد التغيير"
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 pl-10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                          />
                          <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                      </div>
                  </div>
              </div>

              {/* Submit */}
              <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  <span>حفظ التغييرات</span>
              </button>

          </form>
      </div>
    </div>
  );
};
