
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, HelpCircle, MessageCircle, ChevronDown } from 'lucide-react';

export const HelpSupport: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto pb-32 p-6 max-w-lg mx-auto animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowRight size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">المساعدة والدعم</h1>
      </div>

      <div className="space-y-6">
        
        {/* Intro Card */}
        <div className="bg-primary-50 dark:bg-primary-900/20 p-6 rounded-3xl border border-primary-100 dark:border-primary-800">
             <div className="w-12 h-12 bg-primary-100 dark:bg-primary-800 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-300 mb-4">
                 <HelpCircle size={28} />
             </div>
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">كيف يمكننا مساعدتك؟</h2>
             <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                 مرحباً بك في نظام (Nizam). هنا ستجد إجابات على الأسئلة الشائعة ودليلاً سريعاً لاستخدام التطبيق بأقصى كفاءة.
             </p>
        </div>

        {/* FAQ Section */}
        <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">الأسئلة الشائعة</h3>
            <div className="space-y-3">
                <FAQItem 
                    question="ما هو الفرق بين صندوق الوارد والمشاريع؟"
                    answer="صندوق الوارد هو المكان الذي تضع فيه كل المهام والأفكار السريعة غير المصنفة. أما المشاريع فهي حاويات لتنظيم المهام التي لها هدف مشترك ومحدد."
                />
                <FAQItem 
                    question="كيف يعمل وضع التركيز؟"
                    answer="يساعدك وضع التركيز على إنجاز مهمة واحدة دون تشتت. عند تفعيله، يتم تشغيل مؤقت (Pomodoro) لمساعدتك على العمل بتركيز لمدة 25 دقيقة."
                />
                <FAQItem 
                    question="ما هي المهام المؤجلة؟"
                    answer="إذا لم تنجز مهمة في يومها المحدد، تنتقل تلقائياً إلى الحالة 'مؤجلة' في اليوم التالي، مع عداد يوضح عدد مرات التأجيل لتنبيهك."
                />
                 <FAQItem 
                    question="كيف أضيف تنبيه للموعد؟"
                    answer="عند إضافة موعد، حدد الوقت والتاريخ. التطبيق يقوم تلقائياً بفرز المواعيد وتنبيهك بصرياً قبل وقتها المحدد."
                />
                 <FAQItem 
                    question="ما هي فكرة العادات؟"
                    answer="العادات هي أنشطة يومية صغيرة تريد الالتزام بها (مثل شرب الماء). تظهر في الصفحة الرئيسية لمتابعة التزامك اليومي."
                />
            </div>
        </section>

        {/* Contact/About */}
        <section>
             <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">تواصل معنا</h3>
             <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
                 <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                     <MessageCircle size={24} />
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-900 dark:text-white">لديك اقتراح؟</h4>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                         نحن نعمل باستمرار على تحسين التطبيق.
                     </p>
                 </div>
             </div>
        </section>

         <div className="text-center pt-8 pb-4 text-gray-400 text-xs">
            الإصدار 1.0.0
        </div>

      </div>
    </div>
  );
};

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 cursor-pointer"
        >
            <button className="w-full flex items-center justify-between p-4 text-right">
                <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{question}</span>
                <span className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown size={16} />
                </span>
            </button>
            <div 
                className={`px-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-50 dark:border-gray-700 transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-40 py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}`}
            >
                {answer}
            </div>
        </div>
    );
};
