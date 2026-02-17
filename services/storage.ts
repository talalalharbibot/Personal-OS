
import { supabase } from './supabaseClient';

const BUCKET_NAME = 'attachments';

export const uploadAttachment = async (file: File): Promise<string | null> => {
    try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
             throw new Error("No internet connection");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;

        if (!userId) throw new Error("User not authenticated");

        // Create a unique path: user_id/timestamp_filename
        // Sanitize filename to avoid encoding issues
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${userId}/${Date.now()}_${sanitizedFileName}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Storage Upload Error:', error);
            throw error;
        }

        return data.path;
    } catch (e) {
        console.error('Upload Exception:', e);
        return null;
    }
};

export const getFileUrl = async (path: string): Promise<string | null> => {
    // Optimization: Don't attempt to fetch if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null;
    }

    try {
        // Get a signed URL valid for 1 hour
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(path, 3600);

        if (error) {
            // Suppress common network errors to avoid console noise
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))) {
                return null;
            }
            console.error('Get URL Error:', error);
            return null;
        }

        return data.signedUrl;
    } catch (e: any) {
        if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('Network request failed'))) {
             return null;
        }
        console.error('Get URL Exception:', e);
        return null;
    }
};

export const deleteAttachment = async (path: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

    try {
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (error) {
            console.error('Delete Attachment Error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Delete Attachment Exception:', e);
        return false;
    }
};
