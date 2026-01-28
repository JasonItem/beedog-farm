import { supabase } from '../lib/supabase';
import { User } from '../types';

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

    // Fetch extra profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.warn('Profile missing, using fallback data:', profileError);
      return {
        id: authData.user.id,
        email: authData.user.email,
        name: email.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${authData.user.id}`,
        bio: '这个家伙很懒，什么都没写',
        points: 100,
        exp: 0, // Fallback exp
        level: 1,
        friends: 0,
        coins: 100,
        energy: 100,
        maxEnergy: 100,
        day: 1
      };
    }

    return { ...profile, email: authData.user.email, exp: profile.exp || 0 } as User;
  },

  // Register Logic (Real Email)
  async register(email: string, password: string): Promise<void> {
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) throw new Error(authError.message);
    
    // If sign up is successful but user is null, it usually means rate limit or config error
    if (!authData.user) throw new Error('注册请求失败');

    // 2. Create Initial Profile Entry
    const defaultName = email.split('@')[0];
    
    const newUserProfile = {
      id: authData.user.id,
      name: defaultName,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${authData.user.id}`,
      bio: '新来的冒险家',
      points: 100,
      exp: 0, // Initialize exp
      level: 1,
      friends: 0
    };

    const { error: dbError } = await supabase
      .from('profiles')
      .insert([newUserProfile]);

    if (dbError) {
      console.error('Error creating profile:', dbError);
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
    
    // If data exists, return it
    if (data) {
        return { ...data, exp: data.exp || 0 } as User;
    }

    // If no data returned (data is null), it means the profile row is missing.
    console.log("Profile missing during update, creating new one...");
    
    const newProfile = {
      id: userId,
      name: updates.name || 'User',
      avatar: updates.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
      bio: updates.bio || '新来的冒险家',
      points: 100,
      exp: 0,
      level: 1,
      friends: 0
    };

    const { data: newData, error: insertError } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select()
      .single();

    if (insertError) throw new Error("修复档案失败: " + insertError.message);
    
    return newData as User;
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    // Graceful fallback
    if (!profile) {
        return {
            id: session.user.id,
            email: session.user.email,
            name: session.user.email?.split('@')[0] || 'User',
            avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${session.user.id}`,
            bio: '暂无介绍',
            points: 100,
            exp: 0,
            level: 1,
            friends: 0,
            coins: 100,
            energy: 100,
            maxEnergy: 100,
            day: 1
        };
    }
    return { ...profile, email: session.user.email, exp: profile.exp || 0 } as User;
  },

  // Logout
  async logout() {
    await supabase.auth.signOut();
  }
};