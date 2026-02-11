
import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, File } from 'lucide-react';
import { Attachment } from '../types';

interface Props {
  attachment: Attachment;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<Props> = ({ attachment, onClose }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.data) {
      // Create a Blob URL for the attachment data
      const url = URL.createObjectURL(attachment.data);
      setObjectUrl(url);
      
      // Cleanup on unmount
      return () => URL.revokeObjectURL(url);
    }
  }, [attachment]);

  if (!objectUrl) return null;

  const isImage = attachment.type.startsWith('image/');
  const isPdf = attachment.type === 'application/pdf';

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full h-full md:w-[90%] md:h-[90%] flex flex-col relative bg-black/50 md:rounded-xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header / Controls */}
        <div className="flex justify-between items-center p-4 text-white z-10 bg-gradient-to-b from-black/80 to-transparent">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                 {isImage ? <ImageIcon size={20} /> : isPdf ? <FileText size={20} /> : <File size={20} />}
              </div>
              <div className="flex flex-col">
                  <h3 className="font-bold text-sm md:text-base text-white">{attachment.name}</h3>
                  <span className="text-xs text-gray-300" dir="ltr">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <button 
                onClick={handleDownload}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
                title="تحميل"
              >
                 <Download size={20} />
              </button>
              <button 
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full transition-colors backdrop-blur-md"
              >
                 <X size={20} />
              </button>
           </div>
        </div>

        {/* Content Preview Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center relative bg-gray-900">
            {isImage && (
                <img 
                    src={objectUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain"
                />
            )}

            {isPdf && (
                <iframe 
                    src={objectUrl} 
                    className="w-full h-full bg-white" 
                    title="PDF Preview"
                />
            )}

            {!isImage && !isPdf && (
                <div className="text-center text-white p-8 max-w-md bg-gray-800 rounded-2xl border border-gray-700 mx-4">
                    <FileText size={64} className="mx-auto mb-6 text-blue-400" />
                    <h3 className="text-xl font-bold mb-3">لا يمكن معاينة هذا الملف مباشرة</h3>
                    <p className="text-gray-400 mb-6 leading-relaxed text-sm">
                        هذا النوع من الملفات (مثل Word) يتطلب تحميلاً لفتحه في التطبيق المختص به.
                    </p>
                    <button 
                        onClick={handleDownload}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto transition-colors w-full"
                    >
                        <Download size={20} />
                        تحميل وفتح الملف
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
