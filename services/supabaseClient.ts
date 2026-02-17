
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tsfuovletqzelmsbuktc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZnVvdmxldHF6ZWxtc2J1a3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTkxNDksImV4cCI6MjA4NjQ3NTE0OX0.bARWQOeqsHaaaA0HBaTUO9JhUahKuV1myip8TzUM9Ow';

export const supabase = createClient(supabaseUrl, supabaseKey);
