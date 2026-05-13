import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zlxrellgxpxyninqturj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'SUA_ANON_KEY_AQUI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
