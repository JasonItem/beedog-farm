export const LEVEL_CAP = 100;

export const getLevelTitle = (level: number): string => {
  if (level <= 10) return "初出茅庐";
  if (level <= 20) return "丛林探险家";
  if (level <= 30) return "荒野猎人";
  if (level <= 40) return "洞穴寻宝者";
  if (level <= 50) return "深海潜行者";
  if (level <= 60) return "赏金游侠";
  if (level <= 70) return "天空领航员";
  if (level <= 80) return "荣耀领主";
  if (level <= 90) return "传奇守护者";
  return "不朽英雄";
};

/**
 * 升级算法：难度递增
 * Level 1 -> 2: 200 XP
 * Level 2 -> 3: 300 XP
 * Level 3 -> 4: 400 XP
 * 公式：下一级所需 XP = 100 * (当前等级 + 1)
 */

interface LevelProgress {
    level: number;
    percentage: number;
    currentExp: number;
    expInCurrentLevel: number;
    expNeededForNextLevel: number;
}

export const getLevelProgress = (totalExp: number): LevelProgress => {
    let level = 1;
    let expForNextLevel = 200; // 初始升级门槛 (1->2)
    let currentLevelBaseExp = 0; // 当前等级的起始总经验值

    // 循环扣除经验值来计算当前等级
    // 当总经验 >= 当前等级起始经验 + 升级所需经验，且未满级时，升级
    while (totalExp >= currentLevelBaseExp + expForNextLevel && level < LEVEL_CAP) {
        currentLevelBaseExp += expForNextLevel;
        level++;
        expForNextLevel += 100; // 每一级增加100点难度
    }

    const expInCurrentLevel = totalExp - currentLevelBaseExp;
    
    // 防止满级溢出显示
    if (level >= LEVEL_CAP) {
        return {
            level,
            percentage: 100,
            currentExp: totalExp,
            expInCurrentLevel: expForNextLevel,
            expNeededForNextLevel: expForNextLevel
        };
    }

    const percentage = Math.min(100, Math.max(0, (expInCurrentLevel / expForNextLevel) * 100));

    return {
        level,
        percentage: Math.round(percentage),
        currentExp: totalExp,
        expInCurrentLevel: expInCurrentLevel,
        expNeededForNextLevel: expForNextLevel
    };
};