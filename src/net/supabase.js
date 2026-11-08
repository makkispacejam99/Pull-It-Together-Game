import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const SUPABASE_URL = 'https://hamtqpuiszebwfohpnbe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZYrDq8s5W4bmz_BDnX-t9A_jHnzgTy3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});