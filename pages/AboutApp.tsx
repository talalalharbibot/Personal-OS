
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Info, Heart, Layers, Shield, Zap, Coffee } from 'lucide-react';

export const AboutApp: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto pb-32 p-6 max-w-lg mx-auto animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowRight size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">عن التطبيق</h1>
      </div>

      <div className="space-y-8">
        
        {/* App Branding */}
        <div className="flex flex-col items-center text-center space-y-4">
             <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl shadow-xl shadow-primary-500/30 flex items-center justify-center text-white transform rotate-3">
                 <Layers size={48} />
             </div>
             <div>
                 <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">نظام (Nizam)</h2>
                 <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">نظام التشغيل الشخصي</p>
                 <span className="inline-block mt-3 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-xs font-mono font-bold">
                     v1.0.0
                 </span>
             </div>
        </div>

        {/* Mission */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
            <div className="relative z-10">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    تم تصميم "نظام" ليكون مساعدك الرقمي المحلي الأول. هدفنا هو مساعدتك على استعادة التركيز، تنظيم الفوضى، وبناء عادات مستدامة في بيئة خالية من التشتت وتعمل بالكامل على جهازك.
                </p>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 dark:bg-primary-900/10 rounded-full -mr-16 -mt-16 z-0"></div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-2 gap-4">
            <FeatureCard 
                icon={<Shield size={18} />} 
                title="خصوصية أولاً" 
                desc="بياناتك مخزنة محلياً على جهازك فقط."
                color="text-emerald-600 dark:text-emerald-400"
                bg="bg-emerald-50 dark:bg-emerald-900/20"
            />
            <FeatureCard 
                icon={<Zap size={18} />} 
                title="أداء فوري" 
                desc="واجهة سريعة الاستجابة بدون تحميل."
                color="text-amber-600 dark:text-amber-400"
                bg="bg-amber-50 dark:bg-amber-900/20"
            />
            <FeatureCard 
                icon={<Coffee size={18} />} 
                title="تركيز عميق" 
                desc="أدوات مدمجة لمساعدتك على الإنجاز."
                color="text-blue-600 dark:text-blue-400"
                bg="bg-blue-50 dark:bg-blue-900/20"
            />
            <FeatureCard 
                icon={<Heart size={18} />} 
                title="صمم بحب" 
                desc="تجربة مستخدم بسيطة ومريحة للعين."
                color="text-red-600 dark:text-red-400"
                bg="bg-red-50 dark:bg-red-900/20"
            />
        </div>

        {/* Footer / Credits */}
        <div className="text-center pt-8 border-t dark:border-gray-800">
            <p className="text-xs text-gray-400 mb-2">
                © {new Date().getFullYear()} نظام (Nizam) POS
            </p>
            <p className="text-[10px] text-gray-300 dark:text-gray-600">
                صنع بشغف للتطوير الشخصي
            </p>
        </div>

      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, color, bg }: { icon: React.ReactNode, title: string, desc: string, color: string, bg: string }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg} ${color}`}>
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{title}</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{desc}</p>
        </div>
    </div>
);
