import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zlxrellgxpxyninqturj.supabase.co'
const supabaseAnonKey = 'SUA_ANON_KEY_AQUI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)