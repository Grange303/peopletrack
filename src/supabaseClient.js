import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://klbbhjlkggvmqrzenrsc.supabase.co';
const supabaseKey = 'sb_publishable_iYE6JfogzinIxfbzW2ml5g_h6_f6xm7';

export const supabase = createClient(supabaseUrl, supabaseKey);
