
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { uploadAttachment } from '../services/storage'; // Added import
import { Mail, Lock, User, Camera, ArrowLeft, Loader2, AlertCircle, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatar(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
        throw error;
      }

      if (data.user) {
        toast.success('تم تسجيل الدخول بنجاح');
        // Navigation is handled by AuthGuard in App.tsx to ensure DB cleanup
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('كلمات المرور غير متطابقة');
      setLoading(false);
      return;
    }

    try {
      // 1. If avatar is present, we attempt to upload it first. 
      // Note: Supabase Storage RLS usually requires authentication. 
      // If "public" uploads aren't allowed for anon, this might fail unless user is created first.
      // However, typical flow is create user -> then update user with avatar.
      // We will try standard signup with metadata first, then if we have avatar, upload and update.
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            // Avatar path will be added after successful creation if needed
          },
        },
      });

      if (error) {
        if (error.message.includes('rate limit') || error.status === 429) {
             throw new Error('تم تجاوز حد إرسال الرسائل (Rate Limit). يرجى تعطيل "Confirm Email" في إعدادات Supabase أو المحاولة لاحقاً.');
        }
        if (error.message.includes('User already registered') || error.status === 400) {
            throw new Error('User already exists. Sign in?');
        }
        throw error;
      }

      if (data.user) {
        // 2. Upload Avatar if selected (User is now authenticated/created)
        if (avatar) {
            try {
                // We need to temporarily sign in implicitly or use the returned session to upload
                // If email confirmation is off, data.session is present.
                if (data.session) {
                    const avatarPath = await uploadAttachment(avatar);
                    if (avatarPath) {
                        await supabase.auth.updateUser({
                            data: { avatar_path: avatarPath }
                        });
                    }
                }
            } catch (uploadErr) {
                console.error("Failed to upload avatar during signup", uploadErr);
                // Don't block signup success
            }
        }

        if (data.user.identities && data.user.identities.length === 0) {
             throw new Error('User already exists. Sign in?');
        }
        
        toast.success('تم إنشاء الحساب بنجاح!');
      }
    } catch (err: any) {
      if (err.message === 'User already exists. Sign in?') {
          setErrorMsg(null);
          setErrorMsg('المستخدم مسجل بالفعل. هل تريد تسجيل الدخول؟');
      } else {
          setErrorMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700">
        
        {/* Header / Branding */}
        <div className="bg-primary-600 p-8 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
             <div className="relative z-10 flex flex-col items-center">
                 <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg">
                    <Layers size={32} />
                 </div>
                 <h1 className="text-2xl font-extrabold text-white">نظام (Nizam)</h1>
                 <p className="text-primary-100 text-sm">نظام التشغيل الشخصي</p>
             </div>
        </div>

        {/* Auth Toggle */}
        <div className="flex p-2 m-4 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
            <button
                onClick={() => { setMode('login'); setErrorMsg(null); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
                تسجيل الدخول
            </button>
            <button
                onClick={() => { setMode('signup'); setErrorMsg(null); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
                حساب جديد
            </button>
        </div>

        {/* Forms */}
        <div className="px-8 pb-8">
            
            {errorMsg && (
                <div 
                    className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm
                    ${errorMsg.includes('تسجيل الدخول') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'}`}
                >
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <span className="font-bold block mb-1">تنبيه</span>
                        {errorMsg}
                        {errorMsg.includes('مسجل بالفعل') && (
                             <button 
                                onClick={() => setMode('login')} 
                                className="block mt-2 font-bold underline hover:no-underline"
                             >
                                 الانتقال لتسجيل الدخول
                             </button>
                        )}
                    </div>
                </div>
            )}

            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
                
                {/* Signup: Avatar & Name */}
                {mode === 'signup' && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                        <div className="flex justify-center">
                            <div className="relative">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary-500 transition-colors overflow-hidden"
                                >
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera size={28} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-primary-600 p-1.5 rounded-full text-white pointer-events-none shadow-md">
                                    <Camera size={12} />
                                </div>
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute right-4 top-3.5 text-gray-400">
                                <User size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="الاسم الكامل"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-3 pr-11 pl-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                required
                            />
                        </div>
                    </div>
                )}

                {/* Common: Email */}
                <div className="relative">
                    <div className="absolute right-4 top-3.5 text-gray-400">
                        <Mail size={20} />
                    </div>
                    <input
                        type="email"
                        placeholder="البريد الإلكتروني"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-3 pr-11 pl-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        required
                    />
                </div>

                {/* Common: Password */}
                <div className="relative">
                    <div className="absolute right-4 top-3.5 text-gray-400">
                        <Lock size={20} />
                    </div>
                    <input
                        type="password"
                        placeholder="كلمة المرور"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-3 pr-11 pl-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        required
                    />
                </div>

                {/* Signup: Confirm Password */}
                {mode === 'signup' && (
                    <div className="relative animate-in slide-in-from-top-2">
                        <div className="absolute right-4 top-3.5 text-gray-400">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            placeholder="تأكيد كلمة المرور"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-3 pr-11 pl-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
                >
                    {loading && <Loader2 size={20} className="animate-spin" />}
                    {mode === 'login' ? 'الدخول' : 'إنشاء الحساب'}
                </button>

            </form>
        </div>
      </div>
    </div>
  );
};
