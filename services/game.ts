
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { Plot, InventoryItem, PlotType, MAP_COLS, MAP_ROWS, Friend, User } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- Perlin Noise Implementation ---
class Perlin {
    p: number[] = []; // Removed 'private' to avoid "Unexpected reserved word" if TS is not fully stripped
    constructor() {
        this.p = new Array(512);
        const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        for (let i = 0; i < 256; i++) {
            this.p[256 + i] = this.p[i] = permutation[i];
        }
    }
    fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t: number, a: number, b: number) { return a + t * (b - a); }
    grad(hash: number, x: number, y: number, z: number) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    noise(x: number, y: number, z: number) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z),
            this.grad(this.p[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.p[AB], x, y - 1, z),
                this.grad(this.p[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1),
                this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}
const perlin = new Perlin();

// Helper: Chunk Array into smaller pieces
// Changed to function expression to avoid JSX parsing ambiguity with <T>
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

// 生成初始地图数据
const generateInitialPlots = (userId: string) => {
    const centerX = MAP_COLS / 2;
    const centerY = MAP_ROWS / 2;
    const seed = Math.random() * 100; 

    return Array.from({ length: MAP_COLS * MAP_ROWS }, (_, i) => {
        const col = i % MAP_COLS;
        const row = Math.floor(i / MAP_COLS);
        const nx = (col - centerX) / (centerX * 0.95); 
        const ny = (row - centerY) / (centerY * 0.95);
        const d = Math.sqrt(nx * nx + ny * ny);

        const scale = 0.1; 
        let noiseVal = perlin.noise(col * scale + seed, row * scale + seed, 0) * 1.0;
        noiseVal += perlin.noise(col * 0.2 + seed, row * 0.2 + seed, 10) * 0.5;

        let elevation = (noiseVal * 0.8 + 0.6) - (Math.pow(d, 3) * 2.0);
        let type: PlotType = 'water';

        if (elevation < -0.1) { type = 'water'; } 
        else if (elevation < 0.05) { type = 'sand'; } 
        else if (elevation < 0.4) { 
            type = 'grass';
            const decorNoise = Math.random();
            if (decorNoise > 0.96) type = 'stone'; 
            else if (decorNoise > 0.92) type = 'weed'; 
        } else {
            const treeNoise = Math.random();
            type = (treeNoise > 0.8) ? 'wood' : 'grass';
        }
        
        if (d < 0.1) type = 'grass';

        return {
            id: i,
            type: type,
            isUnlocked: true,
            status: 'empty' as const,
            seedId: undefined,
            daysPlanted: 0,
            isWatered: false,
            isWithered: false
        };
    });
};

let channel: RealtimeChannel | null = null;
let sessionChannel: RealtimeChannel | null = null;

export const gameService = {
    // --- 0. Realtime: 游戏地块同步 ---
    joinGameRoom(userId: string, onUpdate: (payload: { plotIndex: number, plotData: Partial<Plot> }) => void) {
        // 先清理旧连接
        if (channel) {
             supabase.removeChannel(channel);
        }

        console.log(`📡 Joining realtime room: game_room:${userId}`);

        // 创建新频道
        channel = supabase.channel(`game_room:${userId}`, {
            config: {
                broadcast: { self: true } // 允许自己接收自己的广播（用于多端同步）
            }
        });

        // 监听广播事件
        channel
            .on('broadcast', { event: 'plot_update' }, (payload) => {
                // console.log("📡 Received update:", payload);
                if (payload.payload) {
                    onUpdate(payload.payload);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log("✅ Subscribed to game room");
                }
            });
    },

    broadcastPlotUpdate(plotIndex: number, plotData: Partial<Plot>) {
        if (!channel) return;
        channel.send({
            type: 'broadcast',
            event: 'plot_update',
            payload: { plotIndex, plotData }
        });
    },

    leaveGameRoom() {
        if (channel) {
            supabase.removeChannel(channel);
            channel = null;
        }
    },

    // --- 0.5 Realtime: 会话互踢监控 ---
    // 监听用户专属的 Session 频道。如果收到 'new_login' 事件且 sessionId 不同，说明有新设备登录。
    monitorUserSession(userId: string, onConflict: () => void): () => void {
        const localSessionId = Math.random().toString(36).substring(7);
        console.log(`🔒 Initializing session monitor: ${localSessionId}`);

        if (sessionChannel) {
            supabase.removeChannel(sessionChannel);
        }

        sessionChannel = supabase.channel(`session_control:${userId}`, {
             config: { broadcast: { self: true } }
        });

        sessionChannel
            .on('broadcast', { event: 'new_login' }, (payload) => {
                // 如果接收到的 session ID 与本地不同，说明是另一个设备登录了
                if (payload.payload?.sessionId && payload.payload.sessionId !== localSessionId) {
                    console.warn(`⚠️ Conflict detected! Remote session: ${payload.payload.sessionId}, Local: ${localSessionId}`);
                    onConflict();
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // 订阅成功后，广播“我来了”
                    // 稍微延迟一下确保通道就绪
                    setTimeout(async () => {
                         await sessionChannel?.send({
                            type: 'broadcast',
                            event: 'new_login',
                            payload: { sessionId: localSessionId }
                        });
                    }, 500);
                }
            });

        return () => {
            if (sessionChannel) {
                supabase.removeChannel(sessionChannel);
                sessionChannel = null;
            }
        };
    },

    // 1. 初始化或获取游戏状态
    async loadGameState(userId: string): Promise<{ plots: Plot[], inventory: InventoryItem[] }> {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;
        const isOwner = currentUserId === userId;

        // 获取背包
        const { data: invData } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', userId);

        const finalInv = invData?.map(i => ({ itemId: i.item_id, count: i.count })) || [];

        let finalPlots: Plot[] = [];

        // 尝试从新表读取
        const { data: mapRow, error: mapError } = await supabase
            .from('player_maps')
            .select('map_data')
            .eq('user_id', userId)
            .maybeSingle();

        if (mapRow && mapRow.map_data) {
            // 命中新缓存
            finalPlots = mapRow.map_data as Plot[];
        } else {
            // 新表读取失败或为空，尝试旧表读取 (Fallback)
            const { data: plotsData } = await supabase
                .from('plots')
                .select('*')
                .eq('user_id', userId)
                .order('plot_index', { ascending: true });

            if (plotsData && plotsData.length === (MAP_COLS * MAP_ROWS)) {
                // 旧表有完整数据，使用旧表数据
                 finalPlots = plotsData.map(p => ({
                    id: p.plot_index,
                    type: p.type as PlotType,
                    isUnlocked: true,
                    status: p.status,
                    seedId: p.seed_id,
                    daysPlanted: p.days_planted,
                    isWatered: p.is_watered,
                    isWithered: false
                }));
            } else {
                // 两个表都没有数据，生成新地图
                if (isOwner) {
                    console.log(`为用户 ${userId} 生成新地图...`);
                    finalPlots = generateInitialPlots(userId);
                    
                    // 默认尝试存入新表，如果失败会在 saveGameData 中处理
                    await this.saveGameData(userId, finalPlots);

                    if (!invData || invData.length === 0) {
                        await this.updateInventoryItem(userId, 'seed_parsnip', 5);
                        finalInv.push({ itemId: 'seed_parsnip', count: 5 });
                    }
                } else {
                    finalPlots = generateInitialPlots(userId);
                }
            }
        }

        return {
            plots: finalPlots,
            inventory: finalInv
        };
    },

    // 2. 智能存档：优先尝试新表，失败则回退旧表
    async saveGameData(userId: string, plots: Plot[]) {
        // 尝试写入新表
        const { error } = await supabase
            .from('player_maps')
            .upsert({
                user_id: userId,
                map_data: plots,
                updated_at: new Date().toISOString()
            });

        // 如果遇到表不存在的错误 (PGRST205 或 42P01)，降级使用旧表
        if (error) {
            if (error.code === 'PGRST205' || error.code === '42P01' || error.message.includes('player_maps')) {
                console.warn("High-perf table missing, falling back to legacy save...");
                
                // 将 plots 转换为数据库行格式
                const allUpdates = plots.map(p => ({
                    user_id: userId,
                    plot_index: p.id,
                    type: p.type,
                    status: p.status,
                    seed_id: p.seedId || null,
                    days_planted: p.daysPlanted,
                    is_watered: p.isWatered
                }));

                // 分批插入/更新旧表 (Chunking)
                const chunks = chunkArray(allUpdates, 1000);
                for (const chunk of chunks) {
                    const { error: legacyError } = await supabase
                        .from('plots')
                        .upsert(chunk, { onConflict: 'user_id, plot_index' });
                    if (legacyError) console.error("Legacy save chunk failed:", legacyError);
                }
            } else {
                console.error("Save failed:", error);
                throw error;
            }
        }
    },
    
    // 2.5 退出时的可靠存档 (针对关键的小数据使用 keepalive)
    // 地图数据太大，不适合 keepalive (限制 64KB)，但我们可以保存关键的 User Stats
    async saveProfileKeepAlive(userId: string, stats: { coins?: number, energy?: number, day?: number, exp?: number }) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) return;

        const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
        
        // 使用原生 fetch + keepalive: true
        // 这会将请求放入浏览器的后台队列，即使页面关闭也能发送
        fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(stats),
            keepalive: true
        });
    },

    // 3. 更新背包 (保持不变)
    async updateInventoryItem(userId: string, itemId: string, newCount: number) {
        if (newCount <= 0) {
            await supabase.from('inventory').delete().match({ user_id: userId, item_id: itemId });
        } else {
            await supabase.from('inventory').upsert({ user_id: userId, item_id: itemId, count: newCount }, { onConflict: 'user_id, item_id' });
        }
    },

    // 4. 更新玩家统计 (保持不变)
    async updateUserStats(userId: string, stats: { coins?: number, energy?: number, day?: number, exp?: number }) {
        await supabase.from('profiles').update(stats).eq('id', userId);
    },

    // 5. 重置账户
    async resetAccount(userId: string) {
        await supabase.from('profiles').update({ coins: 100, energy: 100, day: 1, exp: 0, level: 1, friends: 0 }).eq('id', userId);
        await supabase.from('inventory').delete().eq('user_id', userId);
        // 尝试删除两个表的数据
        try { await supabase.from('player_maps').delete().eq('user_id', userId); } catch {}
        try { await supabase.from('plots').delete().eq('user_id', userId); } catch {}
    },

    // 6. 搜索用户
    async searchUser(query: string): Promise<User | null> {
        const cleanQuery = query.trim();
        const { data: byId } = await supabase.from('profiles').select('*').eq('id', cleanQuery).maybeSingle();
        return byId ? (byId as User) : null; 
    },

    // 7. 添加好友
    async addFriend(currentUserId: string, friendId: string): Promise<void> {
        if (currentUserId === friendId) throw new Error("不能添加自己为好友");
        const { error } = await supabase.rpc('add_mutual_friend', { target_friend_id: friendId });
        if (error) throw new Error("添加失败: " + error.message);
    },

    // 8. 获取好友列表
    async getFriends(userId: string): Promise<Friend[]> {
        const { data, error } = await supabase.from('friendships').select(`friend_id, created_at, profiles:friend_id (*)`).eq('user_id', userId);
        if (error) return [];
        return data.map((item: any) => ({
            id: userId,
            friendId: item.friend_id,
            friendProfile: item.profiles as User,
            createdAt: item.created_at
        }));
    }
};
