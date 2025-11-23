import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kwnmbvqaxtoyffzpecfw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bm1idnFheHRveWZmenBlY2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTUyMzYsImV4cCI6MjA3OTM3MTIzNn0.IkVNifA5a0BzqEokt9dnQxKs1E6iT43AiodvBoQuMAs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
