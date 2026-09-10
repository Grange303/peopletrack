import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://klbbhjlkggvmqrzenrsc.supabase.co';
const supabaseKey = 'sb_publishable_iYE6JfogzinIxfbzW2ml5g_h6_f6xm7';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------
// AUTH (manager login) — added for PeopleTrack's manager sign-in.
// Managers sign in with email + password (a real Supabase account);
// employees keep using the username + PIN path and never create a session.
// ---------------------------------------------------------------------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim(),
    password: String(password || ""),
  });
  if (error) throw error;
  return data.user;
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
export async function getUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user || null));
  return () => data?.subscription?.unsubscribe();
}
