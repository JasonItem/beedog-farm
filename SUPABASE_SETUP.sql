-- ==========================================
-- 蜜蜂狗农场 (BeeDogFarm) 数据库初始化脚本
-- ==========================================

-- 1. 用户档案表 (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
                                               id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
                                               name text,
                                               avatar text,
                                               bio text,
                                               coins integer DEFAULT 100,
                                               energy integer DEFAULT 100,
                                               max_energy integer DEFAULT 100,
                                               day integer DEFAULT 1,
                                               exp integer DEFAULT 0,
                                               level integer DEFAULT 1,
                                               points integer DEFAULT 100,
                                               friends integer DEFAULT 0,
                                               updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
    );

-- 2. 背包物品表 (Inventory)
CREATE TABLE IF NOT EXISTS public.inventory (
                                                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                                user_id uuid REFERENCES auth.users NOT NULL,
                                                item_id text NOT NULL,
                                                count integer NOT NULL DEFAULT 1,
                                                created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, item_id)
    );

-- 3. 地图数据表 (Player Maps)
-- 采用 JSONB 存储整张地图，提高加载效率
CREATE TABLE IF NOT EXISTS public.player_maps (
                                                  user_id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
                                                  map_data jsonb NOT NULL,
                                                  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
    );

-- 4. 好友关系表 (Friendships)
CREATE TABLE IF NOT EXISTS public.friendships (
                                                  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                                  user_id uuid REFERENCES auth.users NOT NULL,
                                                  friend_id uuid REFERENCES public.profiles(id) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, friend_id)
    );

-- ==========================================
-- 开启行级安全策略 (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Profiles 策略：允许所有人查看档案（用于串门），仅允许用户修改自己的档案
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Inventory 策略：仅允许用户查看和修改自己的背包
CREATE POLICY "Users can view own inventory" ON public.inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory" ON public.inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON public.inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory" ON public.inventory FOR DELETE USING (auth.uid() = user_id);

-- Player Maps 策略：允许所有人查看地图（用于串门），仅允许所有者修改
CREATE POLICY "Maps are viewable by everyone" ON public.player_maps FOR SELECT USING (true);
CREATE POLICY "Users can manage own map" ON public.player_maps FOR ALL USING (auth.uid() = user_id);

-- Friendships 策略：允许用户查看自己的好友列表
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id);

-- ==========================================
-- 定义 RPC 函数
-- ==========================================

-- 好友双向添加函数（带原子性计数更新）
CREATE OR REPLACE FUNCTION add_mutual_friend(target_friend_id uuid)
RETURNS void AS $$
BEGIN
  -- 1. 建立 A -> B 的关系
INSERT INTO public.friendships (user_id, friend_id)
VALUES (auth.uid(), target_friend_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 2. 建立 B -> A 的关系
INSERT INTO public.friendships (user_id, friend_id)
VALUES (target_friend_id, auth.uid())
    ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 3. 更新双方的 profiles 好友计数
UPDATE public.profiles
SET friends = (SELECT count(*) FROM public.friendships WHERE user_id = auth.uid())
WHERE id = auth.uid();

UPDATE public.profiles
SET friends = (SELECT count(*) FROM public.friendships WHERE user_id = target_friend_id)
WHERE id = target_friend_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 开启 Realtime 实时同步
-- ==========================================

-- 确保 supabase_realtime 发布存在并包含对应表
-- 注意：在某些版本的 Supabase 中，需要通过控制台 UI 开启。以下为 SQL 开启指令。
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.profiles,
    public.player_maps;
COMMIT;
