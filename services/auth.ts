
import { supabase } from '../lib/supabase';
import { User } from '../types';

// Helper: 生成默认的用户档案数据
const getDefaultProfile = (id: string, email: string) => ({
  id,
  name: email.split('@')[0] || '冒险家',
  avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${id}`,
  bio: '新来的冒险家',
  points: 100,
  exp: 0,
  level: 1,
  friends: 0,
  coins: 100,
  energy: 100,
  maxEnergy: 100,
  day: 1
});

// Helper: 将 DB 返回的 snake_case 对象转换为 App 使用的 User 对象
const mapProfileToUser = (profile: any, email?: string): User => ({
  ...profile,
  email: email || profile.email,
  exp: profile.exp || 0,
  maxEnergy: profile.max_energy || profile.maxEnergy || 100 // Handle snake_case from DB
});

export const authService = {
  // Login Logic
  async login(email: string, password: string): Promise<User> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
            throw new Error("账号或密码错误");
        }
        if (authError.message.includes("Email not confirmed")) {
            throw new Error("请先前往邮箱完成验证");
        }
        throw new Error(authError.message);
    }
    
    if (!authData.user) throw new Error('登录失败');

    // 登录成功后，确保 Profile 存在
    return this.ensureProfileExists(authData.user.id, authData.user.email || email);
  },

  // Register Logic (Real Email)
  async register(email: string, password: string): Promise<void> {
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) throw new Error(authError.message);
    
    if (!authData.user) throw new Error('注册请求失败');

    // 2. Create Initial Profile Entry
    // 尝试直接创建 Profile，如果这里失败了，用户下次登录时 ensureProfileExists 也会自动修复
    const newProfile = {
      id: authData.user.id,
      name: email.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${authData.user.id}`,
      bio: '新来的冒险家',
      points: 100,
      exp: 0,
      level: 1,
      friends: 0,
      coins: 100,
      energy: 100,
      day: 1,
      max_energy: 100 // 明确指定数据库字段名
    };

    const { error: dbError } = await supabase
      .from('profiles')
      .insert([newProfile]);

    if (dbError) {
      console.warn('Register: Profile creation failed (will be fixed on login):', dbError);
    }
  },

  // Update Profile
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.avatar) dbUpdates.avatar = updates.avatar;
    if (updates.bio) dbUpdates.bio = updates.bio;

    // Try to update existing profile
    const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId)
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    
    if (data) {
        return mapProfileToUser(data);
    }

    // 如果更新时发现没有 Profile，则创建
    console.log("Profile missing during update, creating new one...");
    const baseProfile = getDefaultProfile(userId, 'User');
    const { maxEnergy, ...rest } = baseProfile;
    
    // 合并更新内容 & Map maxEnergy -> max_energy
    const newProfile = { 
        ...rest, 
        ...updates, 
        id: userId,
        max_energy: maxEnergy // Use snake_case for DB
    };

    const { data: newData, error: insertError } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select()
      .single();

    if (insertError) throw new Error("修复档案失败: " + insertError.message);
    
    return mapProfileToUser(newData);
  },

  // Update Password
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  // Get Current User Session
  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) return null;

    // 获取当前用户时，同样确保 Profile 存在
    return this.ensureProfileExists(session.user.id, session.user.email || '');
  },

  // Logout
  async logout() {
    await supabase.auth.signOut();
  },

  // --- 核心方法：确保 Profile 存在，不存在则自动创建 ---
  async ensureProfileExists(userId: string, email: string): Promise<User> {
    // 1. 尝试查询
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // 2. 如果存在，直接返回
    if (profile) {
        return mapProfileToUser(profile, email);
    }

    // 3. 如果不存在，自动创建默认数据
    console.log(`检测到用户 ${userId} 缺失档案数据，正在自动修复...`);
    const appProfile = getDefaultProfile(userId, email);

    // 转换: 将 appProfile (camelCase) 转换为 DB (snake_case)
    // 主要是处理 maxEnergy -> max_energy，并移除 maxEnergy 键
    const { maxEnergy, ...rest } = appProfile;
    const dbProfile = {
        ...rest,
        max_energy: maxEnergy
    };

    const { error: insertError } = await supabase
      .from('profiles')
      .insert([dbProfile]);

    if (insertError) {
        console.error("自动创建档案失败:", insertError);
        // 返回临时对象，虽然数据库写入失败，但防止前端白屏
        return { ...appProfile, email };
    }

    console.log("档案自动修复成功。");
    return { ...appProfile, email };
  }
};
