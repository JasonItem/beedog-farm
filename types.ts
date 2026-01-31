
export interface User {
    id: string;
    name: string;
    avatar: string;
    email?: string;
    bio?: string;
    // 游戏数值
    coins: number;
    energy: number;
    maxEnergy: number;
    day: number;
    exp: number;
    level: number;
    // 社交与元数据
    points: number;
    friends: number;
}

export interface Friend {
    id: string; // 关联到 User.id
    friendId: string;
    friendProfile: User; // 关联出的好友详细信息
    createdAt: string;
}

export type ItemType = 'seed' | 'crop' | 'resource' | 'food';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface ItemDef {
    id: string;
    name: string;
    type: ItemType;
    description: string;
    price: number;
    sellPrice: number;
    icon?: string; // 保留作为 fallback
    imageUrl: string; // 物品本身的图片 (种子包 或 成熟作物)
    color: string; // 用于背景色
    growthDays?: number;
    energyRegen?: number;
    // 新增：适宜生长的季节
    seasons?: Season[];
    // 新增：生长阶段图片数组 (不含种子包和最终收获物)
    growthStages?: string[];
    // 新增：收获产量范围
    minHarvest?: number;
    maxHarvest?: number;
}

export interface InventoryItem {
    itemId: string;
    count: number;
}

export type PlotType = 'grass' | 'soil' | 'stone' | 'wood' | 'weed' | 'water' | 'sand';
export type TreeType = 'ordinary' | 'fruit' | 'birch';

export interface Plot {
    id: number;
    type: PlotType;
    isUnlocked: boolean;
    status: 'empty' | 'planted' | 'withered';
    seedId?: string;
    daysPlanted: number;
    isWatered: boolean;
    isWithered: boolean;
    isWalkable: boolean;
    // 树木相关
    treeType?: TreeType;
    treeStage?: number; // 0: 小, 1: 中, 2: 大
    daysGrown?: number;
    // 资源变体 (石头大小, 杂草外观)
    variation?: number;
    // 草地装饰物 (1-6)
    grassDecor?: number;
}

export interface GameState {
    plots: Plot[];
    inventory: InventoryItem[];
}

export const MAP_COLS = 128;
export const MAP_ROWS = 285;
export const DAYS_PER_SEASON = 30;

export const getSeasonInfo = (totalDay: number): { season: Season, dayInSeason: number, label: string } => {
    const adjustedDay = totalDay - 1;
    const seasonIndex = Math.floor(adjustedDay / DAYS_PER_SEASON) % 4;
    const dayInSeason = (adjustedDay % DAYS_PER_SEASON) + 1;

    const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
    const labels = ['春季', '夏季', '秋季', '冬季'];

    return {
        season: seasons[seasonIndex],
        dayInSeason: dayInSeason,
        label: labels[seasonIndex]
    };
};

const p = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
const w = (path: string) => p(`https://stardewvalleywiki.com/mediawiki/images${path}`);

export const ITEMS: Record<string, ItemDef> = {
    // --- 特殊：枯萎作物 ---
    'dead_crop': { id: 'dead_crop', name: '枯萎的植物', type: 'resource', description: '换季导致作物枯死了。用镰刀清理掉吧。', price: 0, sellPrice: 0, imageUrl: w(`/d/d3/Dead_Crop.png`), color: 'text-gray-600' },

    // --- 基础资源 ---
    'wood': { id: 'wood', name: '木材', type: 'resource', description: '用于建筑的基础材料。', price: 0, sellPrice: 2, imageUrl: w(`/d/df/Wood.png`), color: 'text-amber-700' },
    'fiber': { id: 'fiber', name: '纤维', type: 'resource', description: '从杂草中采集的植物纤维。', price: 0, sellPrice: 1, imageUrl: w(`/4/45/Fiber.png`), color: 'text-green-600' },
    'stone': { id: 'stone', name: '石头', type: 'resource', description: '坚硬的建筑材料。', price: 0, sellPrice: 2, imageUrl: p(`https://patchwiki.biligame.com/images/stardewvalley/d/d4/svz08tx1xcj7hw9mge7m5xuhykxn1yf.png`), color: 'text-gray-500' },
    'coal': { id: 'coal', name: '煤炭', type: 'resource', description: '可燃的矿物。', price: 15, sellPrice: 25, imageUrl: w(`/a/a7/Coal.png`), color: 'text-gray-800' },

    // ================= 鱼类大百科 (Fish) =================
    'fish_common': { id: 'fish_common', name: '沙丁鱼', type: 'resource', description: '一种常见的海鱼。', price: 0, sellPrice: 40, imageUrl: w(`/0/04/Sardine.png`), color: 'text-blue-400', energyRegen: 13, seasons: ['spring', 'fall', 'winter'] },
    'fish_rare': { id: 'fish_rare', name: '大比目鱼', type: 'resource', description: '一种生活在海底的扁平鱼类。', price: 0, sellPrice: 80, imageUrl: w(`/0/02/Halibut.png`), color: 'text-indigo-600', energyRegen: 25, seasons: ['spring', 'summer', 'winter'] },

    // --- 河流与湖泊 ---
    'fish_sunfish': { id: 'fish_sunfish', name: '太阳鱼', type: 'resource', description: '一种常见的河鱼。', price: 0, sellPrice: 30, imageUrl: w(`/5/56/Sunfish.png`), color: 'text-orange-400', energyRegen: 13, seasons: ['spring', 'summer'] },
    'fish_catfish': { id: 'fish_catfish', name: '鲶鱼', type: 'resource', description: '一种罕见的鱼，要在雨天的河里才能找到。', price: 0, sellPrice: 200, imageUrl: w(`/9/99/Catfish.png`), color: 'text-gray-700', energyRegen: 50, seasons: ['spring', 'fall'] },
    'fish_largemouth_bass': { id: 'fish_largemouth_bass', name: '大嘴鲈鱼', type: 'resource', description: '一种生活在湖里的受欢迎的鱼。', price: 0, sellPrice: 100, imageUrl: w(`/1/11/Largemouth_Bass.png`), color: 'text-green-700', energyRegen: 38, seasons: ['spring', 'summer', 'fall', 'winter'] },
    'fish_smallmouth_bass': { id: 'fish_smallmouth_bass', name: '小嘴鲈鱼', type: 'resource', description: '一种生活在干净水域的淡水鱼。', price: 0, sellPrice: 50, imageUrl: w(`/a/a5/Smallmouth_Bass.png`), color: 'text-green-600', energyRegen: 25, seasons: ['spring', 'fall'] },
    'fish_rainbow_trout': { id: 'fish_rainbow_trout', name: '虹鳟鱼', type: 'resource', description: '一种身上有彩虹条纹的淡水鳟鱼。', price: 0, sellPrice: 65, imageUrl: w(`/1/14/Rainbow_Trout.png`), color: 'text-teal-500', energyRegen: 25, seasons: ['summer'] },
    'fish_salmon': { id: 'fish_salmon', name: '鲑鱼', type: 'resource', description: '会游到上游产卵。', price: 0, sellPrice: 75, imageUrl: w(`/e/e0/Salmon.png`), color: 'text-red-400', energyRegen: 38, seasons: ['fall'] },
    'fish_carp': { id: 'fish_carp', name: '鲤鱼', type: 'resource', description: '一种常见的池塘鱼。', price: 0, sellPrice: 30, imageUrl: w(`/a/a8/Carp.png`), color: 'text-yellow-600', energyRegen: 13, seasons: ['spring', 'summer', 'fall'] },
    'fish_pike': { id: 'fish_pike', name: '狗鱼', type: 'resource', description: '一种难以捕捉的淡水鱼。', price: 0, sellPrice: 100, imageUrl: w(`/3/31/Pike.png`), color: 'text-yellow-700', energyRegen: 38, seasons: ['summer', 'winter'] },
    'fish_bream': { id: 'fish_bream', name: '布里姆鱼', type: 'resource', description: '一种夜行性的河鱼。', price: 0, sellPrice: 45, imageUrl: w(`/8/82/Bream.png`), color: 'text-blue-800', energyRegen: 13, seasons: ['spring', 'summer', 'fall', 'winter'] },
    'fish_sturgeon': { id: 'fish_sturgeon', name: '鲟鱼', type: 'resource', description: '古老的底层鱼类，数量正在减少。', price: 0, sellPrice: 200, imageUrl: w(`/4/42/Sturgeon.png`), color: 'text-slate-600', energyRegen: 63, seasons: ['summer', 'winter'] },
    'fish_tiger_trout': { id: 'fish_tiger_trout', name: '虎纹鳟鱼', type: 'resource', description: '一种稀有的杂交鳟鱼。', price: 0, sellPrice: 150, imageUrl: w(`/0/01/Tiger_Trout.png`), color: 'text-orange-800', energyRegen: 25, seasons: ['fall', 'winter'] },
    'fish_dorado': { id: 'fish_dorado', name: '鬼头刀', type: 'resource', description: '一种凶猛的肉食性鱼类。', price: 0, sellPrice: 100, imageUrl: w(`/1/18/Dorado.png`), color: 'text-yellow-500', energyRegen: 25, seasons: ['summer'] },
    'fish_walleye': { id: 'fish_walleye', name: '大眼鱼', type: 'resource', description: '如果在它那怪异的眼睛注视下，很难抓住它。', price: 0, sellPrice: 105, imageUrl: w(`/0/05/Walleye.png`), color: 'text-yellow-600', energyRegen: 30, seasons: ['fall'] },

    // --- 海洋 ---
    'fish_pufferfish': { id: 'fish_pufferfish', name: '河豚', type: 'resource', description: '受到威胁时会膨胀。当心！', price: 0, sellPrice: 200, imageUrl: w(`/b/ba/Pufferfish.png`), color: 'text-yellow-300', energyRegen: 25, seasons: ['summer'] },
    'fish_tuna': { id: 'fish_tuna', name: '金枪鱼', type: 'resource', description: '一种大型海鱼。', price: 0, sellPrice: 100, imageUrl: w(`/c/c5/Tuna.png`), color: 'text-blue-600', energyRegen: 38, seasons: ['summer', 'winter'] },
    'fish_anchovy': { id: 'fish_anchovy', name: '凤尾鱼', type: 'resource', description: '一种海里的小鱼。', price: 0, sellPrice: 30, imageUrl: w(`/7/79/Anchovy.png`), color: 'text-blue-300', energyRegen: 13, seasons: ['spring', 'fall'] },
    'fish_red_snapper': { id: 'fish_red_snapper', name: '红笛鲷', type: 'resource', description: '一种有着漂亮红色的鱼。', price: 0, sellPrice: 50, imageUrl: w(`/d/d3/Red_Snapper.png`), color: 'text-red-500', energyRegen: 25, seasons: ['summer', 'fall'] },
    'fish_herring': { id: 'fish_herring', name: '鲱鱼', type: 'resource', description: '一种常见的海鱼。', price: 0, sellPrice: 30, imageUrl: w(`/f/f1/Herring.png`), color: 'text-blue-400', energyRegen: 13, seasons: ['spring', 'winter'] },
    'fish_eel': { id: 'fish_eel', name: '鳗鱼', type: 'resource', description: '一种长得像蛇一样的长条鱼。', price: 0, sellPrice: 85, imageUrl: w(`/9/91/Eel.png`), color: 'text-orange-700', energyRegen: 30, seasons: ['spring', 'fall'] },
    'fish_octopus': { id: 'fish_octopus', name: '章鱼', type: 'resource', description: '一种神秘且聪明的生物。', price: 0, sellPrice: 150, imageUrl: w(`/5/5a/Octopus.png`), color: 'text-pink-600', energyRegen: 0, seasons: ['summer'] },
    'fish_red_mullet': { id: 'fish_red_mullet', name: '红鲻鱼', type: 'resource', description: '以前也是宠物。', price: 0, sellPrice: 75, imageUrl: w(`/f/f2/Red_Mullet.png`), color: 'text-red-400', energyRegen: 25, seasons: ['summer', 'winter'] },
    'fish_squid': { id: 'fish_squid', name: '鱿鱼', type: 'resource', description: '一种深海生物，能像人一样长。', price: 0, sellPrice: 80, imageUrl: w(`/8/81/Squid.png`), color: 'text-pink-300', energyRegen: 25, seasons: ['winter'] },
    'fish_flounder': { id: 'fish_flounder', name: '比目鱼', type: 'resource', description: '生活在底层的鱼。', price: 0, sellPrice: 100, imageUrl: w(`/8/85/Flounder.png`), color: 'text-yellow-200', energyRegen: 38, seasons: ['spring', 'summer'] },

    // ================= 春季作物 (Spring) =================
    'seed_parsnip': {
        id: 'seed_parsnip', name: '防风草种子', type: 'seed', description: '春季作物。4天成熟。适合新手练手。', price: 20, sellPrice: 10,
        imageUrl: w(`/d/d3/Parsnip_Seeds.png`), color: 'text-orange-200', growthDays: 4, seasons: ['spring'],
        minHarvest: 1, maxHarvest: 1,
        growthStages: [
            w(`/6/66/Parsnip_Stage_1.png`),
            w(`/b/b4/Parsnip_Stage_2.png`),
            w(`/6/69/Parsnip_Stage_3.png`),
            w(`/1/19/Parsnip_Stage_4.png`),
            w(`/2/21/Parsnip_Stage_5.png`),
        ]
    },
    'crop_parsnip': { id: 'crop_parsnip', name: '防风草', type: 'crop', description: '虽然便宜，但胜在生长快。', price: 0, sellPrice: 55, imageUrl: w(`/d/db/Parsnip.png`), color: 'text-orange-200', energyRegen: 25 },

    'seed_bean': {
        id: 'seed_bean', name: '青豆种子', type: 'seed', description: '春季作物。10天成熟。产量极其丰富！', price: 60, sellPrice: 30,
        imageUrl: w(`/2/26/Bean_Starter.png`), color: 'text-green-300', growthDays: 10, seasons: ['spring'],
        minHarvest: 4, maxHarvest: 8,
        growthStages: [
            w(`/b/bf/Green_Bean_Stage_2.png`),
            w(`/5/50/Green_Bean_Stage_3.png`),
            w(`/2/24/Green_Bean_Stage_4.png`),
            w(`/a/ab/Green_Bean_Stage_5.png`),
            w(`/7/75/Green_Bean_Stage_6.png`) ,
            w(`/2/28/Green_Bean_Stage_7.png`) ,
            w(`/3/3c/Green_Bean_Stage_8.png`)
        ]
    },
    'crop_bean': { id: 'crop_bean', name: '青豆', type: 'crop', description: '漫长的等待是值得的，它很值钱。', price: 0, sellPrice: 75, imageUrl: w(`/5/5c/Green_Bean.png`), color: 'text-green-500', energyRegen: 25 },

    'seed_cauliflower': {
        id: 'seed_cauliflower', name: '花椰菜种子', type: 'seed', description: '春季作物。12天成熟。高价值作物。', price: 80, sellPrice: 40,
        imageUrl: w(`/b/bb/Cauliflower_Seeds.png`), color: 'text-white', growthDays: 12, seasons: ['spring'],
        minHarvest: 1, maxHarvest: 1,
        growthStages: [
            w(`/4/45/Cauliflower_Stage_1.png`),
            w(`/1/14/Cauliflower_Stage_2.png`),
            w(`/e/e5/Cauliflower_Stage_3.png`),
            w(`/1/16/Cauliflower_Stage_4.png`),
            w(`/2/2f/Cauliflower_Stage_5.png`),
            w(`/d/d7/Cauliflower_Stage_6.png`)
        ]
    },
    'crop_cauliflower': { id: 'crop_cauliflower', name: '花椰菜', type: 'crop', description: '巨大的花球，市场收购价很高。', price: 0, sellPrice: 550, imageUrl: w(`/a/aa/Cauliflower.png`), color: 'text-green-100', energyRegen: 75 },

    'seed_potato': {
        id: 'seed_potato', name: '土豆种子', type: 'seed', description: '春季作物。6天成熟。运气好能挖到更多。', price: 50, sellPrice: 25,
        imageUrl: w(`/4/44/Potato_Seeds.png`), color: 'text-amber-600', growthDays: 6, seasons: ['spring'],
        minHarvest: 1, maxHarvest: 3,
        growthStages: [
            w(`/a/a5/Potato_Stage_1.png`),
            w(`/f/f0/Potato_Stage_2.png`),
            w(`/f/f5/Potato_Stage_3.png`),
            w(`/0/0e/Potato_Stage_4.png`),
            w(`/0/0f/Potato_Stage_5.png`),
            w(`/e/e2/Potato_Stage_6.png`)
        ]
    },
    'crop_potato': { id: 'crop_potato', name: '土豆', type: 'crop', description: '可以蒸、煮、炸的万能食材。', price: 0, sellPrice: 100, imageUrl: w(`/c/c2/Potato.png`), color: 'text-amber-200', energyRegen: 25 },

    'seed_kale': {
        id: 'seed_kale', name: '甘蓝种子', type: 'seed', description: '春季作物。6天成熟。', price: 70, sellPrice: 35,
        imageUrl: w(`/0/00/Kale_Seeds.png`), color: 'text-green-400', growthDays: 6, seasons: ['spring'],
        minHarvest: 1, maxHarvest: 1,
        growthStages: [
            w(`/8/86/Kale_Stage_1.png`),
            w(`/5/59/Kale_Stage_2.png`),
            w(`/a/a3/Kale_Stage_3.png`),
            w(`/b/b6/Kale_Stage_4.png`),
            w(`/e/e9/Kale_Stage_5.png`)
        ]
    },
    'crop_kale': { id: 'crop_kale', name: '甘蓝', type: 'crop', description: '健康的绿色蔬菜。', price: 0, sellPrice: 160, imageUrl: w(`/d/d1/Kale.png`), color: 'text-green-600', energyRegen: 50 },

    'seed_strawberry': {
        id: 'seed_strawberry', name: '草莓种子', type: 'seed', description: '春季作物。8天成熟。春天的甜美馈赠。', price: 100, sellPrice: 50,
        imageUrl: w(`/f/f2/Strawberry_Seeds.png`), color: 'text-red-300', growthDays: 8, seasons: ['spring'],
        minHarvest: 2, maxHarvest: 4,
        growthStages: [
            w(`/2/2c/Strawberry_Stage_1.png`),
            w(`/7/7b/Strawberry_Stage_2.png`),
            w(`/d/d6/Strawberry_Stage_3.png`),
            w(`/8/8e/Strawberry_Stage_4.png`),
            w(`/6/65/Strawberry_Stage_5.png`),
            w(`/4/48/Strawberry_Stage_6.png`)
        ]
    },
    'crop_strawberry': { id: 'crop_strawberry', name: '草莓', type: 'crop', description: '深受大家喜爱的水果。', price: 0, sellPrice: 180, imageUrl: w(`/6/6d/Strawberry.png`), color: 'text-red-500', energyRegen: 50 },

    // ================= 夏季作物 (Summer) =================
    'seed_melon': {
        id: 'seed_melon', name: '甜瓜种子', type: 'seed', description: '夏季作物。12天成熟。高风险高回报。', price: 80, sellPrice: 40,
        imageUrl: w(`/5/5e/Melon_Seeds.png`), color: 'text-pink-300', growthDays: 12, seasons: ['summer'],
        minHarvest: 1, maxHarvest: 1,
        growthStages: [
            w(`/a/a2/Melon_Stage_1.png`),
            w(`/d/d4/Melon_Stage_2.png`),
            w(`/b/b3/Melon_Stage_3.png`),
            w(`/e/e7/Melon_Stage_4.png`),
            w(`/b/b4/Melon_Stage_5.png`)
        ]
    },
    'crop_melon': { id: 'crop_melon', name: '甜瓜', type: 'crop', description: '夏日祭典上的明星水果。', price: 0, sellPrice: 550, imageUrl: w(`/1/19/Melon.png`), color: 'text-pink-400', energyRegen: 113 },

    'seed_tomato': {
        id: 'seed_tomato', name: '番茄种子', type: 'seed', description: '夏季作物。11天成熟。多产。', price: 50, sellPrice: 25,
        imageUrl: w(`/5/5e/Melon_Seeds.png`), color: 'text-red-400', growthDays: 11, seasons: ['summer'],
        minHarvest: 3, maxHarvest: 6,
        growthStages: [
            w(`/8/80/Melon_Stage_1.png`),
            w(`/3/36/Melon_Stage_2.png`),
            w(`/a/aa/Melon_Stage_3.png`),
            w(`/c/cf/Melon_Stage_4.png`),
            w(`/6/6d/Melon_Stage_5.png`),
            w(`/d/d9/Melon_Stage_6.png`)
        ]
    },
    'crop_tomato': { id: 'crop_tomato', name: '番茄', type: 'crop', description: '无论是生吃还是做酱都很棒。', price: 0, sellPrice: 85, imageUrl: w(`/9/9d/Tomato.png`), color: 'text-red-600', energyRegen: 20 },

    'seed_blueberry': {
        id: 'seed_blueberry', name: '蓝莓种子', type: 'seed', description: '夏季作物。13天成熟。一次收获一大堆！', price: 80, sellPrice: 40,
        imageUrl: w(`/8/81/Blueberry_Seeds.png`), color: 'text-blue-500', growthDays: 13, seasons: ['summer'],
        minHarvest: 4, maxHarvest: 8,
        growthStages: [
            w(`/2/2c/Blueberry_Stage_1.png`),
            w(`/3/32/Blueberry_Stage_2.png`),
            w(`/5/54/Blueberry_Stage_3.png`),
            w(`/b/b1/Blueberry_Stage_4.png`),
            w(`/6/69/Blueberry_Stage_5.png`),
            w(`/8/84/Blueberry_Stage_6.png`)
        ]
    },
    'crop_blueberry': { id: 'crop_blueberry', name: '蓝莓', type: 'crop', description: '据说能保护视力的超级食物。', price: 0, sellPrice: 80, imageUrl: w(`/9/9e/Blueberry.png`), color: 'text-blue-700', energyRegen: 25 },

    'seed_hotpepper': {
        id: 'seed_hotpepper', name: '辣椒种子', type: 'seed', description: '夏季作物。5天成熟。', price: 40, sellPrice: 20,
        imageUrl: w(`/6/67/Pepper_Seeds.png`), color: 'text-red-500', growthDays: 5, seasons: ['summer'],
        minHarvest: 2, maxHarvest: 4,
        growthStages: [
            w(`/1/18/Hot_Pepper_Stage_1.png`),
            w(`/1/13/Hot_Pepper_Stage_2.png`),
            w(`/8/8a/Hot_Pepper_Stage_3.png`),
            w(`/8/85/Hot_Pepper_Stage_4.png`),
            w(`/a/af/Hot_Pepper_Stage_4b.png`),
            w(`/9/96/Hot_Pepper_Stage_5.png`)
        ]
    },
    'crop_hotpepper': { id: 'crop_hotpepper', name: '辣椒', type: 'crop', description: '非常辣，带有一丝甜味。', price: 0, sellPrice: 60, imageUrl: w(`/f/f1/Hot_Pepper.png`), color: 'text-red-600', energyRegen: 13 },

    'seed_corn': {
        id: 'seed_corn', name: '玉米种子', type: 'seed', description: '夏/秋季作物。14天成熟。', price: 150, sellPrice: 75,
        imageUrl: w(`/d/d1/Corn_Seeds.png`), color: 'text-yellow-400', growthDays: 14, seasons: ['summer', 'fall'],
        minHarvest: 2, maxHarvest: 4,
        growthStages: [
            w(`/5/57/Corn_Stage_1.png`),
            w(`/9/97/Corn_Stage_2.png`),
            w(`/d/db/Corn_Stage_3.png`),
            w(`/1/11/Corn_Stage_4.png`),
            w(`/4/4d/Corn_Stage_5.png`),
            w(`/9/9d/Corn_Stage_6.png`)
        ]
    },
    'crop_corn': { id: 'crop_corn', name: '玉米', type: 'crop', description: '甜美新鲜的玉米棒。', price: 0, sellPrice: 100, imageUrl: w(`/f/f8/Corn.png`), color: 'text-yellow-300', energyRegen: 25 },

    // ================= 秋季作物 (Fall) =================
    'seed_pumpkin': {
        id: 'seed_pumpkin', name: '南瓜种子', type: 'seed', description: '秋季作物。13天成熟。财富的象征。', price: 100, sellPrice: 50,
        imageUrl: w(`/9/99/Pumpkin_Seeds.png`), color: 'text-orange-500', growthDays: 13, seasons: ['fall'],
        minHarvest: 1, maxHarvest: 1,
        growthStages: [
            w(`/0/09/Pumpkin_Stage_1.png`),
            w(`/1/1b/Pumpkin_Stage_2.png`),
            w(`/c/cf/Pumpkin_Stage_3.png`),
            w(`/a/ab/Pumpkin_Stage_4.png`),
            w(`/d/dd/Pumpkin_Stage_5.png`),
            w(`/9/9d/Pumpkin_Stage_6.png`)
        ]
    },
    'crop_pumpkin': { id: 'crop_pumpkin', name: '南瓜', type: 'crop', description: '秋季最值钱的农作物。', price: 0, sellPrice: 720, imageUrl: w(`/6/64/Pumpkin.png`), color: 'text-orange-600', energyRegen: 0 },

    'seed_eggplant': {
        id: 'seed_eggplant', name: '茄子种子', type: 'seed', description: '秋季作物。5天成熟。', price: 20, sellPrice: 10,
        imageUrl: w(`/f/f9/Eggplant_Seeds.png`), color: 'text-purple-600', growthDays: 5, seasons: ['fall'],
        minHarvest: 1, maxHarvest: 3,
        growthStages: [
            w(`/9/97/Eggplant_Stage_1.png`),
            w(`/c/ca/Eggplant_Stage_2.png`),
            w(`/d/d6/Eggplant_Stage_3.png`),
            w(`/a/a1/Eggplant_Stage_4.png`),
            w(`/0/01/Eggplant_Stage_5.png`),
            w(`/1/17/Eggplant_Stage_6.png`)
        ]
    },
    'crop_eggplant': { id: 'crop_eggplant', name: '茄子', type: 'crop', description: '味道浓郁，也很有营养。', price: 0, sellPrice: 90, imageUrl: w(`/8/8f/Eggplant.png`), color: 'text-purple-700', energyRegen: 20 },

    'seed_grape': {
        id: 'seed_grape', name: '葡萄种子', type: 'seed', description: '秋季作物。10天成熟。', price: 60, sellPrice: 30,
        imageUrl: w(`/d/de/Grape_Starter.png`), color: 'text-purple-400', growthDays: 10, seasons: ['fall'],
        minHarvest: 3, maxHarvest: 6,
        growthStages: [
            w(`/b/be/Grape_Stage_1.png`),
            w(`/9/9f/Grape_Stage_2.png`),
            w(`/f/fa/Grape_Stage_3.png`),
            w(`/e/e7/Grape_Stage_4.png`),
            w(`/e/ea/Grape_Stage_5.png`),
            w(`/1/12/Grape_Stage_6.png`)
        ]
    },
    'crop_grape': { id: 'crop_grape', name: '葡萄', type: 'crop', description: '一串甜美的水果。', price: 0, sellPrice: 110, imageUrl: w(`/c/c2/Grape.png`), color: 'text-purple-500', energyRegen: 38 },

    'seed_bokchoy': {
        id: 'seed_bokchoy', name: '小白菜种子', type: 'seed', description: '秋季作物。4天成熟。', price: 50, sellPrice: 25,
        imageUrl: w(`/2/21/Bok_Choy_Seeds.png`), color: 'text-green-300', growthDays: 4, seasons: ['fall'],
        minHarvest: 1, maxHarvest: 1,
        growthStages: [
            w(`/3/3d/Bok_Choy_Stage_1.png`),
            w(`/0/00/Bok_Choy_Stage_2.png`),
            w(`/8/88/Bok_Choy_Stage_3.png`),
            w(`/c/c7/Bok_Choy_Stage_4.png`),
            w(`/5/50/Bok_Choy_Stage_5.png`)
        ]
    },
    'crop_bokchoy': { id: 'crop_bokchoy', name: '小白菜', type: 'crop', description: '绿色的菜叶和纤维状的菜茎。', price: 0, sellPrice: 90, imageUrl: w(`/4/40/Bok_Choy.png`), color: 'text-green-500', energyRegen: 25 },

    'seed_sunflower': {
        id: 'seed_sunflower', name: '向日葵种子', type: 'seed', description: '夏/秋季作物。8天成熟。', price: 40, sellPrice: 20,
        imageUrl: w(`/1/1f/Sunflower_Seeds.png`), color: 'text-yellow-400', growthDays: 8, seasons: ['summer', 'fall'],
        minHarvest: 1, maxHarvest: 2,
        growthStages: [
            w(`/2/21/Sunflower_Stage_1.png`),
            w(`/0/08/Sunflower_Stage_2.png`),
            w(`/4/49/Sunflower_Stage_3.png`),
            w(`/3/30/Sunflower_Stage_4.png`),
            w(`/e/ed/Sunflower_Stage_5.png`)
        ]
    },
    'crop_sunflower': { id: 'crop_sunflower', name: '向日葵', type: 'crop', description: '常被误以为随着太阳转动。', price: 0, sellPrice: 120, imageUrl: w(`/8/81/Sunflower.png`), color: 'text-yellow-500', energyRegen: 45 },
};
