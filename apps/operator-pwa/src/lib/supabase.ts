import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'http://localhost:54321';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'demo-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
