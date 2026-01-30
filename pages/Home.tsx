
import React, { useState, useRef } from 'react';
import { User, GameState, ITEMS, getSeasonInfo } from '../types';
import { CloudSun, Droplets, Shovel, Moon, Coins, Plus, Minus, CheckCircle, Axe, Hammer, Scissors, Zap, Fish, X, MapPin, ArrowLeft, Users as UsersIcon } from 'lucide-react';
import { playSound } from '../utils/sound';
import Scene3D from '../components/Scene3D';
import { RemotePlayerState } from '../services/game';

interface HomeProps {
    user: User;
    gameState: GameState;
    onAction: (plotId: number, action: 'clear' | 'till' | 'plant' | 'water' | 'harvest' | 'fish_start' | 'fish_catch' | 'fish_fail', payload?: string) => void;
    onSleep: () => void;
    isVisiting?: boolean;
    visitingName?: string;
    visitingId?: string;
    onReturnHome?: () => void;
    onShowMessage?: (msg: string) => void;
    remotePlayers?: RemotePlayerState[];
    onLocalMove?: (moveData: { x: number, z: number, direction: string, action: string }) => void;
}

const Home: React.FC<HomeProps> = ({
                                       user, gameState, onAction, onSleep, isVisiting, visitingName, visitingId, onReturnHome,
                                       remotePlayers = [], onLocalMove
                                   }) => {
    const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
    const [showFishingGame, setShowFishingGame] = useState(false);

    const seasonInfo = getSeasonInfo(user.day);

    // 确定谁是农场主
    const farmOwnerId = isVisiting ? visitingId : user.id;

    // 计算当前农场总人数 (远程玩家 + 1个本地玩家)
    const totalPeople = remotePlayers.length + 1;

    const startFishing = () => {
        if (isVisiting) {
            onAction(0, 'fish_start');
            return;
        }
        if (user.energy >= 5) {
            onAction(0, 'fish_start');
            setShowFishingGame(true);
            setSelectedPlotId(null);
        } else {
            onAction(0, 'fish_start');
        }
    };

    const handleFishCatch = (success: boolean) => {
        setShowFishingGame(false);
        if (success) {
            const allFish = Object.values(ITEMS).filter(item => (item.id.startsWith('fish_') || item.type === 'resource') && item.seasons);
            const currentSeasonFish = allFish.filter(fish => fish.seasons && fish.seasons.includes(seasonInfo.season));
            const availableFish = currentSeasonFish.length > 0 ? currentSeasonFish : allFish.filter(f => f.id === 'fish_common');

            let totalWeight = 0;
            const weightedFish = availableFish.map(fish => {
                const weight = Math.max(1, Math.floor(3000 / (fish.sellPrice + 10)));
                totalWeight += weight;
                return { ...fish, weight };
            });
            let randomNum = Math.random() * totalWeight;
            let selectedFishId = 'fish_common';
            for (const fish of weightedFish) {
                if (randomNum < fish.weight) {
                    selectedFishId = fish.id;
                    break;
                }
                randomNum -= fish.weight;
            }
            onAction(0, 'fish_catch', selectedFishId);
        } else {
            onAction(0, 'fish_fail');
        }
    };

    const selectedPlot = selectedPlotId !== null ? gameState.plots.find(p => p.id === selectedPlotId) : null;
    const seedsInBag = gameState.inventory.filter(i => {
        const item = ITEMS[i.itemId];
        return item?.type === 'seed' && item.seasons?.includes(seasonInfo.season);
    });

    const isSelectedPlotMature = () => {
        if (!selectedPlot || selectedPlot.type !== 'soil' || selectedPlot.status !== 'planted' || !selectedPlot.seedId) return false;
        const itemDef = ITEMS[selectedPlot.seedId];
        if (!itemDef) return false;
        return selectedPlot.daysPlanted >= (itemDef.growthDays || 99);
    };

    const handlePlotSelect = (id: number | null) => {
        if (isVisiting && id !== null) return;
        setSelectedPlotId(id);
        if (id !== null) playSound('pop');
    };

    return (
        <div className="h-full w-full relative flex flex-col overflow-hidden select-none touch-none bg-[#99CB68]">
            {/* 3D Scene Layer */}
            <div className="absolute inset-0 z-0">
                <Scene3D
                    plots={gameState.plots}
                    selectedPlotId={selectedPlotId}
                    onSelectPlot={handlePlotSelect}
                    playerName={user.name}
                    remotePlayers={remotePlayers}
                    onLocalMove={onLocalMove}
                    farmOwnerId={farmOwnerId}
                    isVisiting={isVisiting}
                />
            </div>

            {/* UI Layer (Overlay) */}
            <div className="absolute inset-0 z-10 pointer-events-none">

                {/* Top Bar Area */}
                <div className="p-4 pt-8 pointer-events-auto flex flex-col items-center gap-2">
                    <div className="flex justify-between items-center w-full max-w-4xl mx-auto">
                        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl px-4 py-2 rounded-full text-brand-brown font-black shadow-sm border border-white/50 min-w-[140px] justify-center transform transition-transform hover:scale-105">
                            <CloudSun size={18} className="text-pink-400" />
                            <span className="text-xs">{seasonInfo.label} {seasonInfo.dayInSeason}日</span>
                        </div>

                        {isVisiting ? (
                            <div className="flex items-center gap-2 bg-brand-brown/90 text-white backdrop-blur-md px-4 py-2 rounded-full font-bold shadow-md border border-white/20 animate-pop-in">
                                <MapPin size={14} className="text-yellow-400" />
                                <span className="text-xs">参观: {visitingName}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl px-4 py-2 rounded-full text-brand-brown font-black shadow-sm border border-white/50">
                                <span className="text-xs">{user.coins}</span>
                                <Coins size={18} className="text-yellow-500 fill-yellow-400" />
                            </div>
                        )}
                    </div>

                    {/* 当前房间在线人数指示器 */}
                    <div className="animate-slide-up delay-300">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-white/90 text-[10px] font-bold border border-white/10">
                            <UsersIcon size={12} />
                            <span>当前农场: {totalPeople} 人在线</span>
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse ml-0.5"></div>
                        </div>
                    </div>
                </div>

                {/* Right Side Controls */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 pointer-events-auto">
                    {!isVisiting && (
                        <>
                            <div className="bg-white/80 backdrop-blur-xl p-2 rounded-full shadow-lg border border-white/50 flex flex-col items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-inner">
                                    <Zap size={18} fill="currentColor" />
                                </div>
                                <div className="h-28 w-4 bg-gray-200/50 rounded-full relative overflow-hidden shadow-inner">
                                    <div
                                        className={`absolute bottom-0 w-full transition-all duration-500 ease-out rounded-full ${user.energy < 20 ? 'bg-red-400' : 'bg-yellow-400'}`}
                                        style={{ height: `${(user.energy / user.maxEnergy) * 100}%` }}
                                    ></div>
                                </div>
                                <span className={`text-xs font-black ${user.energy < 20 ? 'text-red-500' : 'text-brand-brown'}`}>
                                {user.energy}
                            </span>
                            </div>

                            <button
                                onClick={onSleep}
                                className="bg-brand-brown/90 backdrop-blur-md text-white w-12 py-5 rounded-3xl font-black shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition-all border-b-4 border-black/20 hover:bg-brand-brown"
                                title="休息"
                            >
                                <Moon size={22} fill="yellow" className="animate-pulse drop-shadow-sm" />
                                <span className="text-sm font-black tracking-widest drop-shadow-md" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>休息</span>
                            </button>
                        </>
                    )}
                </div>

                {/* Return Button (Visiting) */}
                {isVisiting && (
                    <div className="absolute bottom-36 left-0 right-0 flex justify-center pointer-events-auto animate-slide-up">
                        <button
                            onClick={onReturnHome}
                            className="bg-brand-green text-white px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 active:scale-95 transition-transform"
                        >
                            <ArrowLeft size={20} /> 返回我的农场
                        </button>
                    </div>
                )}
            </div>

            {/* Fishing Game Modal (High Z-Index) */}
            {showFishingGame && (
                <div className="absolute inset-0 z-[200] pointer-events-auto">
                    <FishingMiniGame onComplete={handleFishCatch} onCancel={() => { playSound('cancel'); setShowFishingGame(false); }} />
                </div>
            )}

            {/* Action Menu (Bottom Sheet for Selected Plot) */}
            {selectedPlot && !isVisiting && (
                <div className="absolute bottom-28 left-4 right-4 bg-white/85 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl z-[110] animate-slide-up border border-white/60 flex flex-col gap-4 ring-1 ring-black/5 pointer-events-auto">
                    <div className="flex justify-between items-center pb-2 border-b border-black/5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-brand-bg rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-black/5 overflow-hidden">
                                {selectedPlot.seedId && ITEMS[selectedPlot.seedId] ? (
                                    <img src={ITEMS[selectedPlot.seedId].imageUrl} className="w-8 h-8 object-contain" />
                                ) : (
                                    <span>
                                    {selectedPlot.type === 'soil' ? '🟫' :
                                        selectedPlot.type === 'water' ? '🌊' :
                                            selectedPlot.type === 'sand' ? '🏖️' : '🌱'}
                                </span>
                                )}
                            </div>
                            <div className="flex flex-col">
                            <span className="text-lg font-black text-brand-brown">
                                {selectedPlot.type === 'soil' ? (selectedPlot.seedId ? ITEMS[selectedPlot.seedId].name : '耕地') :
                                    selectedPlot.type === 'water' ? '水域' :
                                        selectedPlot.type === 'sand' ? '沙滩' : '闲置'}
                            </span>
                                {selectedPlot.seedId && !selectedPlot.isWithered && (
                                    <span className="text-xs font-bold text-brand-brownLight">
                                    {isSelectedPlotMature() ? '可收获' : '生长中'}
                                </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => { playSound('cancel'); setSelectedPlotId(null); }} className="w-8 h-8 flex items-center justify-center bg-gray-100/50 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                        {selectedPlot.type === 'wood' && <ToolButton icon={Axe} label="砍伐" cost={8} onClick={() => { onAction(selectedPlot.id, 'clear'); setSelectedPlotId(null); }} color="text-amber-700" bg="bg-amber-100" />}
                        {selectedPlot.type === 'stone' && <ToolButton icon={Hammer} label="开采" cost={8} onClick={() => { onAction(selectedPlot.id, 'clear'); setSelectedPlotId(null); }} color="text-gray-700" bg="bg-gray-200" />}
                        {selectedPlot.type === 'weed' && <ToolButton icon={Scissors} label="除草" cost={3} onClick={() => { onAction(selectedPlot.id, 'clear'); setSelectedPlotId(null); }} color="text-green-700" bg="bg-green-100" />}
                        {selectedPlot.type === 'grass' && <ToolButton icon={Shovel} label="开垦" cost={4} onClick={() => { onAction(selectedPlot.id, 'till'); setSelectedPlotId(null); }} color="text-brand-brown" bg="bg-brand-bg" />}
                        {selectedPlot.type === 'water' && <ToolButton icon={Fish} label="钓鱼" cost={5} onClick={startFishing} color="text-blue-600" bg="bg-blue-100" />}

                        {selectedPlot.type === 'sand' && (
                            <div className="flex flex-col items-center justify-center w-full py-2 opacity-50">
                                <span className="text-2xl mb-1">🏖️</span>
                                <span className="text-xs font-bold text-brand-brown">享受沙滩阳光吧</span>
                            </div>
                        )}

                        {selectedPlot.type === 'soil' && (
                            <>
                                {selectedPlot.status === 'planted' && !selectedPlot.isWithered && (
                                    <ToolButton
                                        icon={Droplets}
                                        label={selectedPlot.isWatered ? "已浇水" : "浇水"}
                                        cost={2}
                                        disabled={selectedPlot.isWatered || isSelectedPlotMature()}
                                        onClick={() => { onAction(selectedPlot.id, 'water'); setSelectedPlotId(null); }}
                                        color="text-blue-500"
                                        bg="bg-blue-50"
                                    />
                                )}

                                {selectedPlot.status === 'empty' && (
                                    seedsInBag.length > 0 ? (
                                        seedsInBag.map(inv => (
                                            <button key={inv.itemId} onClick={() => { onAction(selectedPlot.id, 'plant', inv.itemId); setSelectedPlotId(null); }} className="flex flex-col items-center gap-2 bg-brand-bg p-3 rounded-2xl min-w-[80px] border border-brand-green/20 active:scale-95 shadow-sm">
                                                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm"><img src={ITEMS[inv.itemId].imageUrl} className="w-6 h-6 object-contain" /></div>
                                                <span className="text-[10px] font-black text-brand-brown truncate w-full text-center">{ITEMS[inv.itemId].name}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-gray-50 min-w-[100px] opacity-60">
                                            <span className="text-xs font-bold text-gray-400">没有种子</span>
                                        </div>
                                    )
                                )}

                                {selectedPlot.status === 'planted' && !selectedPlot.isWithered && (
                                    <ToolButton
                                        icon={CheckCircle}
                                        label="收获"
                                        cost={4}
                                        disabled={!isSelectedPlotMature()}
                                        onClick={() => { onAction(selectedPlot.id, 'harvest'); setSelectedPlotId(null); }}
                                        color="text-green-700"
                                        bg="bg-green-200"
                                    />
                                )}

                                {(selectedPlot.isWithered || selectedPlot.status === 'withered') && (
                                    <ToolButton icon={Scissors} label="清理" cost={3} onClick={() => { onAction(selectedPlot.id, 'clear'); setSelectedPlotId(null); }} color="text-red-700" bg="bg-red-100" />
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolButton = ({ icon: Icon, label, cost, color, bg, onClick, disabled }: { icon: any, label: string, cost: number, color: string, bg: string, onClick: () => void, disabled?: boolean }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl ${bg} ${color} min-w-[70px] shadow-sm transition-all ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'active:scale-95'}`}
    >
        <Icon size={20} strokeWidth={2.5} />
        <span className="text-[10px] font-black">{label}</span>
        {!disabled && <span className="text-[9px] font-bold opacity-80 bg-white/40 px-1.5 rounded">-{cost}⚡</span>}
    </button>
);

const FishingMiniGame = ({ onComplete, onCancel }: { onComplete: (success: boolean) => void, onCancel: () => void }) => {
    const [barPos, setBarPos] = useState(10);
    const [fishPos, setFishPos] = useState(40);
    const [progress, setProgress] = useState(30);

    const barPosRef = useRef(10);
    const velocityRef = useRef(0);
    const fishPosRef = useRef(40);
    const fishTargetRef = useRef(Math.random() * 80);
    const fishTimerRef = useRef(0);
    const progressRef = useRef(30);
    const isMouseDownRef = useRef(false);
    const requestRef = useRef<number>(null);

    const update = () => {
        if (isMouseDownRef.current) velocityRef.current += 0.55;
        else velocityRef.current -= 0.55;

        velocityRef.current *= 0.93;
        barPosRef.current += velocityRef.current;

        if (barPosRef.current < 0) { barPosRef.current = 0; velocityRef.current = 0; }
        if (barPosRef.current > 76) { barPosRef.current = 76; velocityRef.current = 0; }

        fishTimerRef.current++;
        if (fishTimerRef.current > 40) {
            fishTimerRef.current = 0;
            fishTargetRef.current = Math.random() * 88;
        }
        const diff = fishTargetRef.current - fishPosRef.current;
        fishPosRef.current += diff * (Math.abs(diff) > 20 ? 0.09 : 0.06);

        const barHeight = 24;
        const fishHeight = 8;
        const overlap = Math.max(0, Math.min(barPosRef.current + barHeight, fishPosRef.current + fishHeight) - Math.max(barPosRef.current, fishPosRef.current));

        if (overlap > 2) progressRef.current += 0.5;
        else progressRef.current -= 0.4;

        progressRef.current = Math.max(0, Math.min(100, progressRef.current));

        setBarPos(barPosRef.current);
        setFishPos(fishPosRef.current);
        setProgress(progressRef.current);

        if (progressRef.current >= 100) { onComplete(true); return; }
        if (progressRef.current <= 0) { onComplete(false); return; }

        requestRef.current = requestAnimationFrame(update);
    };

    React.useEffect(() => {
        requestRef.current = requestAnimationFrame(update);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, []);

    const handleActionStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isMouseDownRef.current = true;
    };

    const handleActionEnd = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isMouseDownRef.current = false;
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm touch-none select-none"
            onPointerDown={handleActionStart}
            onPointerUp={handleActionEnd}
            onPointerCancel={handleActionEnd}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{
                touchAction: 'none',
                WebkitTouchCallout: 'none',
            }}
        >
            <div
                className="bg-[#5D4037] p-3 rounded-[32px] flex gap-2 shadow-2xl border-4 border-[#3E2723] animate-pop-in relative w-[150px]"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-[#5D4037] text-brand-brown rounded-full flex items-center justify-center shadow-lg z-[210] active:scale-90"
                >
                    <X size={16} strokeWidth={3} />
                </button>

                <div className="w-3 h-64 bg-[#3E2723] rounded-full relative overflow-hidden border border-[#5D4037] shadow-inner flex flex-col justify-end">
                    <div
                        className="w-full bg-[#A3C562]"
                        style={{ height: `${progress}%` }}
                    ></div>
                </div>

                <div className="flex-1 h-64 bg-[#4DD0E1] border-2 border-[#26C6DA] rounded-xl relative overflow-hidden shadow-inner">
                    <div className="absolute inset-0 bg-[#00BCD4]/10 pointer-events-none"></div>

                    <div
                        className="absolute left-0 w-full bg-[#9CCC65]/95 border-t-2 border-b-2 border-[#7CB342] shadow-sm z-10 pointer-events-none"
                        style={{ bottom: `${barPos}%`, height: '24%' }}
                    ></div>

                    <div
                        className="absolute left-1/2 -translate-x-1/2 text-2xl z-20 drop-shadow-md pointer-events-none"
                        style={{ bottom: `${fishPos}%` }}
                    >
                        🐟
                    </div>
                </div>
            </div>

            <div className="absolute bottom-24 text-white font-black text-xs tracking-widest opacity-60 animate-pulse pointer-events-none">
                点击屏幕任意处控制
            </div>
        </div>
    );
}

export default Home;
