import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zroytjuunanyaismtxbf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyb3l0anV1bmFueWFpc210eGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Nzk4NTIsImV4cCI6MjA4NDI1NTg1Mn0.Kqb_cCzwDyewMGBNxAEcsq01BL4iZ9d4JDc02kUvz1o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);