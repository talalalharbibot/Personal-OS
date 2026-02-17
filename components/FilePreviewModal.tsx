
import React, { useEffect, useState, useRef } from 'react';
import { X, Download, FileText, Image as ImageIcon, File, ExternalLink, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';
import { Attachment } from '../types';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileUrl } from '../services/storage';

interface Props {
  attachment: Attachment;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<Props> = ({ attachment, onClose }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Word State
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2); 
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isImage = attachment.type.startsWith('image/');
  const isPdf = attachment.type === 'application/pdf';
  const isWord = attachment.type === 'application/msword' || 
                 attachment.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  useEffect(() => {
    const fetchContent = async () => {
        setLoading(true);
        setErrorMsg(null);

        let url: string | null = null;

        // 1. Try fetching from Cloud if path exists
        if (attachment.path) {
            url = await getFileUrl(attachment.path);
        } 
        // 2. Fallback to Blob if exists (Old Data)
        else if (attachment.data) {
            url = URL.createObjectURL(attachment.data);
        }

        if (!url) {
            setErrorMsg("تعذر الوصول للملف. قد يكون محذوفاً من السحابة.");
            setLoading(false);
            return;
        }

        setObjectUrl(url);

        // Specific File Handlers
        if (isImage) {
            setLoading(false);
        } 
        else if (isWord) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const convertToHtml = mammoth.convertToHtml || (mammoth as any).default?.convertToHtml;
                if (convertToHtml) {
                    const result = await convertToHtml({ arrayBuffer });
                    setWordHtml(result.value);
                } else {
                    throw new Error("Mammoth library missing");
                }
            } catch (e) {
                console.error(e);
                setErrorMsg("فشل عرض مستند Word.");
            } finally {
                setLoading(false);
            }
        }
        else if (isPdf) {
            try {
                const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;
                if (!pdfjs) throw new Error("PDF.js missing");
                
                if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
                     pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
                }

                const loadingTask = pdfjs.getDocument(url);
                const pdf = await loadingTask.promise;
                setPdfDoc(pdf);
                setNumPages(pdf.numPages);
            } catch (e) {
                console.error(e);
                setErrorMsg("فشل تحميل ملف PDF.");
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };

    fetchContent();

    return () => {
        // Clean up object URLs only if they were locally created blobs
        if (attachment.data && objectUrl && objectUrl.startsWith('blob:')) {
            URL.revokeObjectURL(objectUrl);
        }
    };
  }, [attachment]);

  useEffect(() => {
      if (pdfDoc && canvasRef.current) {
          const renderPage = async () => {
              try {
                  const page = await pdfDoc.getPage(pageNum);
                  const viewport = page.getViewport({ scale });
                  const canvas = canvasRef.current!;
                  const context = canvas.getContext('2d');
                  
                  if (context) {
                      canvas.height = viewport.height;
                      canvas.width = viewport.width;
                      await page.render({ canvasContext: context, viewport: viewport }).promise;
                  }
              } catch (err) { console.error(err); }
          };
          renderPage();
      }
  }, [pdfDoc, pageNum, scale]);

  const handleDownload = () => {
    if (!objectUrl) return;
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenExternal = () => {
      if (objectUrl) window.open(objectUrl, '_blank');
  };

  if (errorMsg) {
      return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-2xl max-w-sm">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">خطأ</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{errorMsg}</p>
                <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold">إغلاق</button>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full h-full md:w-[90%] md:h-[90%] flex flex-col relative bg-black/50 md:rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 text-white z-10 bg-gradient-to-b from-black/80 to-transparent">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                 {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
              </div>
              <div className="flex flex-col">
                  <h3 className="font-bold text-sm md:text-base text-white">{attachment.name}</h3>
                  <span className="text-xs text-gray-300" dir="ltr">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <button onClick={handleOpenExternal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full" title="فتح خارجي"><ExternalLink size={20} /></button>
              <button onClick={handleDownload} className="p-2 bg-white/10 hover:bg-white/20 rounded-full" title="تحميل"><Download size={20} /></button>
              <button onClick={onClose} className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full"><X size={20} /></button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-gray-900 justify-center">
            {loading ? (
                <div className="flex flex-col items-center justify-center text-white">
                    <Loader2 size={40} className="animate-spin mb-3 text-primary-500" />
                    <span className="text-sm">جاري جلب الملف من السحابة...</span>
                </div>
            ) : (
                <>
                    {isImage && objectUrl && <div className="w-full h-full flex items-center justify-center"><img src={objectUrl} className="max-w-full max-h-full object-contain" /></div>}
                    
                    {isPdf && (
                        <div className="w-full h-full flex flex-col">
                            <div className="flex justify-center items-center gap-4 bg-gray-800 p-2 border-b border-gray-700">
                                <button disabled={pageNum <= 1} onClick={() => setPageNum(p=>p-1)} className="text-white disabled:opacity-30"><ChevronRight /></button>
                                <span className="text-white text-sm">{pageNum} / {numPages}</span>
                                <button disabled={pageNum >= numPages} onClick={() => setPageNum(p=>p+1)} className="text-white disabled:opacity-30"><ChevronLeft /></button>
                                <button onClick={() => setScale(s => s+0.2)} className="text-white"><ZoomIn size={18} /></button>
                            </div>
                            <div className="flex-1 overflow-auto flex justify-center bg-gray-600 p-4"><canvas ref={canvasRef} className="shadow-2xl" /></div>
                        </div>
                    )}

                    {isWord && wordHtml && (
                        <div className="w-full h-full bg-white text-gray-900 overflow-y-auto p-8"><div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: wordHtml }} /></div>
                    )}

                    {!isImage && !isPdf && !isWord && (
                        <div className="text-center text-white">
                            <File size={64} className="mx-auto mb-4 text-gray-500" />
                            <p>لا يمكن معاينة هذا الملف.</p>
                            <button onClick={handleDownload} className="mt-4 bg-primary-600 px-6 py-2 rounded-lg">تحميل</button>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};
