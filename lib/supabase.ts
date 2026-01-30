import { createClient } from '@supabase/supabase-js';

// --- 配置说明 ---
// SUPABASE_URL: 您的项目 API 终端地址
// SUPABASE_ANON_KEY: 您的项目 Anon 公钥 (需以 'eyJ' 开头)

export const SUPABASE_URL = 'http://localhost:8000';
// 这里的 Key 必须是从 Supabase 控制台获取的真实 Anon Key，否则无法连接数据库。
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY5NjE2MDAwLCJleHAiOjE5MjczODI0MDB9.xdnVb90TmSmbbjk1Y1YS2K_kl3nz2yI3kcWWkzOj164'; 

if (SUPABASE_ANON_KEY.includes('placeholder')) {
  console.warn('🚨 请在 lib/supabase.ts 中填入真实的 Supabase Anon Key 以启用云端同步。');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);