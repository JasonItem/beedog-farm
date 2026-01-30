
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { Plot, InventoryItem, PlotType, MAP_COLS, MAP_ROWS, Friend, User } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- Perlin Noise Implementation ---
class Perlin {
    p: number[] = [];
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

export interface RemotePlayerState {
    id: string;
    name: string;
    avatar: string;
    x: number;
    z: number;
    direction: string;
    action: string;
}

export const gameService = {
    joinGameRoom(
        farmOwnerId: string,
        currentUser: User,
        initialPos: { x: number, z: number },
        onPlotUpdate: (payload: { plotIndex: number, plotData: Partial<Plot> }) => void,
        onPlayerUpdate: (payload: RemotePlayerState) => void,
        onPresenceSync: (onlinePlayers: RemotePlayerState[]) => void
    ) {
        if (channel) {
            supabase.removeChannel(channel);
        }

        channel = supabase.channel(`farm_room:${farmOwnerId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: currentUser.id }
            }
        });

        channel
            .on('broadcast', { event: 'plot_update' }, (payload) => {
                if (payload.payload) onPlotUpdate(payload.payload);
            })
            .on('broadcast', { event: 'player_move' }, (payload) => {
                if (payload.payload) onPlayerUpdate(payload.payload as RemotePlayerState);
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = channel!.presenceState();
                const players: RemotePlayerState[] = [];

                Object.keys(newState).forEach(id => {
                    const states = newState[id];
                    if (!states || states.length === 0) return;
                    const presence = states[0] as any;

                    players.push({
                        id: id,
                        name: presence.name || '冒险家',
                        avatar: presence.avatar || '',
                        x: presence.x ?? 0,
                        z: presence.z ?? 0,
                        direction: presence.direction || 'down',
                        action: presence.action || 'idle'
                    });
                });
                onPresenceSync(players);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel!.track({
                        id: currentUser.id,
                        name: currentUser.name,
                        avatar: currentUser.avatar,
                        x: initialPos.x,
                        z: initialPos.z,
                        direction: 'down',
                        action: 'idle'
                    });
                }
            });
    },

    /**
     * 更新 Presence 必须要求传入完整身份信息，防止 track 覆盖导致数据丢失
     */
    async updatePresenceMetadata(currentUser: User, moveData: Partial<RemotePlayerState>) {
        if (!channel) return;
        await channel.track({
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            ...moveData
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

    broadcastMyMove(moveData: RemotePlayerState) {
        if (!channel) return;
        channel.send({
            type: 'broadcast',
            event: 'player_move',
            payload: moveData
        });
    },

    leaveGameRoom() {
        if (channel) {
            supabase.removeChannel(channel);
            channel = null;
        }
    },

    monitorUserSession(userId: string, onConflict: () => void): () => void {
        const localSessionId = Math.random().toString(36).substring(7);
        if (sessionChannel) {
            supabase.removeChannel(sessionChannel);
        }
        sessionChannel = supabase.channel(`session_control:${userId}`, {
            config: { broadcast: { self: true } }
        });
        sessionChannel
            .on('broadcast', { event: 'new_login' }, (payload) => {
                if (payload.payload?.sessionId && payload.payload.sessionId !== localSessionId) {
                    onConflict();
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
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

    async loadGameState(userId: string): Promise<{ plots: Plot[], inventory: InventoryItem[] }> {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;
        const isOwner = currentUserId === userId;

        const { data: invData } = await supabase.from('inventory').select('*').eq('user_id', userId);
        const finalInv = invData?.map(i => ({ itemId: i.item_id, count: i.count })) || [];

        let finalPlots: Plot[] = [];
        const { data: mapRow } = await supabase.from('player_maps').select('map_data').eq('user_id', userId).maybeSingle();

        if (mapRow && mapRow.map_data) {
            finalPlots = mapRow.map_data as Plot[];
        } else {
            const { data: plotsData } = await supabase.from('plots').select('*').eq('user_id', userId).order('plot_index', { ascending: true });
            if (plotsData && plotsData.length === (MAP_COLS * MAP_ROWS)) {
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
                if (isOwner) {
                    finalPlots = generateInitialPlots(userId);
                    await this.saveGameMaps(userId, finalPlots);
                    if (!invData || invData.length === 0) {
                        await this.updateInventoryItem(userId, 'seed_parsnip', 5);
                        finalInv.push({ itemId: 'seed_parsnip', count: 5 });
                    }
                } else {
                    finalPlots = generateInitialPlots(userId);
                }
            }
        }
        return { plots: finalPlots, inventory: finalInv };
    },

    async saveGameMaps(userId: string, plots: Plot[]) {
        await supabase.from('player_maps').upsert({
            user_id: userId,
            map_data: plots,
            updated_at: new Date().toISOString()
        });
    },

    async updateInventoryItem(userId: string, itemId: string, newCount: number) {
        if (newCount <= 0) {
            await supabase.from('inventory').delete().match({ user_id: userId, item_id: itemId });
        } else {
            const { data } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
            if (data) {
                await supabase.from('inventory').update({ count: newCount }).eq('id', data.id);
            } else {
                await supabase.from('inventory').insert({ user_id: userId, item_id: itemId, count: newCount });
            }
        }
    },

    async saveFullGameData(userId: string, plots: Plot[], inventory: InventoryItem[], userStats: { coins: number, energy: number, day: number, exp: number }) {
        await this.saveGameMaps(userId, plots);
        await supabase.from('profiles').update(userStats).eq('id', userId);
        await supabase.from('inventory').delete().eq('user_id', userId);
        if (inventory.length > 0) {
            const dbInventory = inventory.map(item => ({ user_id: userId, item_id: item.itemId, count: item.count }));
            await supabase.from('inventory').insert(dbInventory);
        }
    },

    async resetAccount(userId: string) {
        await supabase.from('profiles').update({ coins: 100, energy: 100, day: 1, exp: 0, level: 1, friends: 0 }).eq('id', userId);
        await supabase.from('inventory').delete().eq('user_id', userId);
        try { await supabase.from('player_maps').delete().eq('user_id', userId); } catch {}
    },

    async searchUser(query: string): Promise<User | null> {
        const cleanQuery = query.trim();
        const { data: byId } = await supabase.from('profiles').select('*').eq('id', cleanQuery).maybeSingle();
        return byId ? (byId as User) : null;
    },

    async addFriend(currentUserId: string, friendId: string): Promise<void> {
        if (currentUserId === friendId) throw new Error("不能添加自己为好友");
        const { error } = await supabase.rpc('add_mutual_friend', { target_friend_id: friendId });
        if (error) throw new Error("添加失败: " + error.message);
    },

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
