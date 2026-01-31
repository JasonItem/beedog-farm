
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Login from './pages/Login.tsx';
import Home from './pages/Home.tsx';
import Market from './pages/Market.tsx';
import Inventory from './pages/Inventory.tsx';
import Profile from './pages/Profile.tsx';
import Social from './pages/Social.tsx';
import { authService } from './services/auth.ts';
import { gameService, RemotePlayerState } from './services/game.ts';
import { User, GameState, ITEMS, getSeasonInfo, Plot, InventoryItem, MAP_COLS, MAP_ROWS } from './types.ts';
import { CheckCircle, AlertCircle, X, Save, LogOut, Loader2 } from 'lucide-react';
import { playSound } from './utils/sound.ts';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    img?: string;
}

interface PlayerRecord extends RemotePlayerState {
    lastSeen: number;
}

const AppContent: React.FC = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [gameState, setGameState] = useState<GameState>({ plots: [], inventory: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [visitingUser, setVisitingUser] = useState<{ id: string, name: string } | null>(null);
    const [isSessionConflict, setIsSessionConflict] = useState(false);

    const remotePlayersRef = useRef<Record<string, PlayerRecord>>({});
    const [remotePlayersList, setRemotePlayersList] = useState<RemotePlayerState[]>([]);
    const localPosRef = useRef({ x: MAP_COLS / 2, z: MAP_ROWS / 2 });

    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', img?: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, img }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    // 初始加载当前用户信息
    useEffect(() => {
        const initApp = async () => {
            try {
                const user = await authService.getCurrentUser();
                if (user) {
                    const gameUser = { ...user, coins: user.coins ?? 100, energy: user.energy ?? 100, maxEnergy: 100, day: user.day || 1 };
                    setCurrentUser(gameUser);
                }
            } catch (error) { console.error(error); } finally { setIsLoading(false); }
        };
        initApp();
    }, []);

    // 动态加载对应玩家的地图数据
    useEffect(() => {
        const loadTargetMap = async () => {
            const targetId = visitingUser ? visitingUser.id : currentUser?.id;
            if (!targetId) return;

            try {
                const data = await gameService.loadGameState(targetId);
                setGameState(data);
                if (visitingUser) {
                    addToast(`正在参观 ${visitingUser.name} 的农场`, 'info');
                }
            } catch (e) {
                addToast("加载农场数据失败", "error");
            }
        };

        if (currentUser) {
            loadTargetMap();
        }
    }, [currentUser?.id, visitingUser?.id]);

    useEffect(() => {
        if (!currentUser || visitingUser) return;
        const cleanupMonitor = gameService.monitorUserSession(currentUser.id, () => {
            setIsSessionConflict(true);
            playSound('error');
        });
        return () => cleanupMonitor();
    }, [currentUser?.id, visitingUser]);

    useEffect(() => {
        const farmId = visitingUser ? visitingUser.id : currentUser?.id;
        if (!farmId || !currentUser) return;
        remotePlayersRef.current = {};
        setRemotePlayersList([]);
        gameService.joinGameRoom(
            farmId,
            currentUser,
            localPosRef.current,
            (plotUpdate) => {
                setGameState(prev => {
                    const newPlots = [...prev.plots];
                    const index = newPlots.findIndex(p => p.id === plotUpdate.plotIndex);
                    if (index !== -1) newPlots[index] = { ...newPlots[index], ...plotUpdate.plotData };
                    return { ...prev, plots: newPlots };
                });
            },
            (playerUpdate) => {
                if (playerUpdate.id === currentUser.id) return;
                const now = Date.now();
                const existing = remotePlayersRef.current[playerUpdate.id];
                remotePlayersRef.current[playerUpdate.id] = { ...existing, ...playerUpdate, lastSeen: now };
                setRemotePlayersList(Object.values(remotePlayersRef.current));
            },
            (onlinePlayers) => {
                const now = Date.now();
                const onlineIds = onlinePlayers.map(p => p.id);
                onlinePlayers.forEach(p => {
                    if (p.id === currentUser.id) return;
                    const existing = remotePlayersRef.current[p.id];
                    remotePlayersRef.current[p.id] = { ...existing, ...p, lastSeen: now };
                });
                Object.keys(remotePlayersRef.current).forEach(id => {
                    if (!onlineIds.includes(id)) delete remotePlayersRef.current[id];
                });
                setRemotePlayersList(Object.values(remotePlayersRef.current));
            }
        );
        return () => gameService.leaveGameRoom();
    }, [currentUser?.id, visitingUser?.id]);

    const handleManualSave = async () => {
        // 拜访模式下禁用存档（防止覆盖好友数据或产生逻辑冲突）
        if (!currentUser || isSaving || !hasUnsavedChanges || visitingUser) return;
        setIsSaving(true);
        playSound('click');
        try {
            await gameService.saveFullGameData(currentUser.id, gameState.plots, gameState.inventory, {
                coins: currentUser.coins, energy: currentUser.energy, day: currentUser.day, exp: currentUser.exp
            });
            setHasUnsavedChanges(false);
            playSound('success');
            addToast("存档成功！", "success");
        } catch (e: any) {
            playSound('error');
            addToast("存档失败", "error");
        } finally { setIsSaving(false); }
    };

    const handleLogin = async (user: User) => {
        setIsLoading(true);
        const gameUser = { ...user, coins: user.coins ?? 100, energy: user.energy ?? 100, maxEnergy: 100, day: user.day || 1 };
        setCurrentUser(gameUser);
        setIsSessionConflict(false);
        setHasUnsavedChanges(false);
        try {
            const data = await gameService.loadGameState(user.id);
            setGameState(data);
            playSound('success');
            addToast(`欢迎回来，${gameUser.name}！`, 'success');
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const handleLogout = async () => {
        gameService.leaveGameRoom();
        try { await authService.logout(); } catch (e) {}
        setCurrentUser(null);
        setGameState({ plots: [], inventory: [] });
        setVisitingUser(null);
        setIsSessionConflict(false);
        setHasUnsavedChanges(false);
    };

    const updateInventorySimple = (itemId: string, delta: number) => {
        if (!currentUser) return;
        setGameState(prev => {
            let newInv = [...prev.inventory];
            const idx = newInv.findIndex(i => i.itemId === itemId);
            if (idx !== -1) {
                const count = newInv[idx].count + delta;
                if (count <= 0) newInv.splice(idx, 1);
                else newInv[idx] = { ...newInv[idx], count };
            } else if (delta > 0) {
                newInv.push({ itemId, count: delta });
            }
            return { ...prev, inventory: newInv };
        });
    };

    const handleBuy = (itemId: string) => {
        if (!currentUser) return;
        const item = ITEMS[itemId];
        if (!item) return;
        if (currentUser.coins < item.price) {
            addToast("金币不足", "error");
            playSound('error');
            return;
        }
        const newUser = { ...currentUser, coins: currentUser.coins - item.price };
        setCurrentUser(newUser);
        updateInventorySimple(itemId, 1);
        setHasUnsavedChanges(true);
        playSound('coin');
        addToast(`购买了 ${item.name}`, 'success', item.imageUrl);
    };

    const handleSell = (itemId: string, amount: number) => {
        if (!currentUser) return;
        const item = ITEMS[itemId];
        if (!item) return;
        const totalPrice = item.sellPrice * amount;
        const newUser = { ...currentUser, coins: currentUser.coins + totalPrice };
        setCurrentUser(newUser);
        updateInventorySimple(itemId, -amount);
        setHasUnsavedChanges(true);
        playSound('coin');
        addToast(`卖出了 ${item.name} x${amount}，获得 ${totalPrice} 金币`, 'success', item.imageUrl);
    };

    const handleUseItem = (itemId: string) => {
        if (!currentUser) return;
        const item = ITEMS[itemId];
        if (!item) return;

        if (item.energyRegen && item.energyRegen > 0) {
            const newEnergy = Math.min(currentUser.maxEnergy, currentUser.energy + item.energyRegen);
            const newUser = { ...currentUser, energy: newEnergy };
            setCurrentUser(newUser);
            updateInventorySimple(itemId, -1);
            setHasUnsavedChanges(true);
            playSound('success');
            addToast(`食用了 ${item.name}，体力恢复了 ${item.energyRegen}`, 'success', item.imageUrl);
        }
    };

    const handleSleep = async () => {
        if (!currentUser || visitingUser) return;
        playSound('success');
        const nextDay = currentUser.day + 1;
        const newUser = { ...currentUser, energy: currentUser.maxEnergy, day: nextDay };
        const newPlots = gameState.plots.map(plot => {
            let p = { ...plot };
            if (p.type === 'soil' && p.status === 'planted' && p.seedId && !p.isWithered && p.isWatered) {
                p.daysPlanted += 1;
            }
            if (p.type === 'soil') p.isWatered = false;
            if (p.type === 'wood' && p.treeStage !== undefined && p.treeStage < 2) {
                const daysNeeded = p.treeStage === 0 ? 3 : 5;
                p.daysGrown = (p.daysGrown || 0) + 1;
                if (p.daysGrown >= daysNeeded) {
                    p.treeStage += 1;
                    p.daysGrown = 0;
                }
            }
            return p;
        });
        setCurrentUser(newUser);
        setGameState(prev => ({ ...prev, plots: newPlots }));
        setHasUnsavedChanges(true);
        addToast("新的一天开始了！", "info");
    };

    const handleFarmAction = async (plotId: number, action: string, payload?: string) => {
        if (!currentUser || visitingUser) return;
        const newPlots = [...gameState.plots];
        const pIdx = newPlots.findIndex(p => p.id === plotId);
        if (pIdx === -1) return;
        const plot = { ...newPlots[pIdx] };
        let energyCost = 0;
        let expGain = 0;

        switch(action) {
            case 'clear':
                if (plot.type === 'wood') {
                    const woodCount = plot.treeStage === 0 ? 3 : (plot.treeStage === 1 ? 9 : 20);
                    energyCost = plot.treeStage === 0 ? 3 : (plot.treeStage === 1 ? 6 : 10);
                    updateInventorySimple('wood', woodCount);
                    expGain = plot.treeStage === 2 ? 15 : 5;
                    addToast(`获得了木材 x${woodCount}`, 'success', ITEMS['wood'].imageUrl);
                } else if (plot.type === 'stone') {
                    const size = plot.variation ?? 0;
                    const yieldCount = size === 0 ? 2 : (size === 1 ? 5 : 12);
                    energyCost = size === 0 ? 5 : (size === 1 ? 8 : 15);
                    updateInventorySimple('stone', yieldCount);
                    expGain = size === 2 ? 10 : (size === 1 ? 5 : 2);
                    addToast(`获得了石头 x${yieldCount}`, 'success', ITEMS['stone'].imageUrl);
                } else if (plot.type === 'weed') {
                    updateInventorySimple('fiber', 1);
                    energyCost = 3;
                    expGain = 1;
                }
                plot.type = 'grass';
                plot.status = 'empty';
                plot.seedId = undefined;
                plot.treeType = undefined;
                plot.treeStage = undefined;
                plot.isWithered = false;
                plot.isWalkable = true;
                break;
            case 'till':
                const aboveIdx = plotId - MAP_COLS;
                if (aboveIdx >= 0) {
                    const abovePlot = newPlots.find(p => p.id === aboveIdx);
                    if (abovePlot && abovePlot.type === 'wood') {
                        addToast("树阴下太凉快了，不适合开垦", "error");
                        playSound('error');
                        return;
                    }
                }
                plot.type = 'soil';
                plot.status = 'empty';
                energyCost = 4;
                expGain = 1;
                break;
            case 'plant':
                if (!payload) return;
                plot.status = 'planted';
                plot.seedId = payload;
                plot.daysPlanted = 0;
                updateInventorySimple(payload, -1);
                energyCost = 0;
                break;
            case 'water':
                plot.isWatered = true;
                energyCost = 2;
                expGain = 1;
                playSound('water');
                break;
            case 'harvest':
                if (plot.seedId) {
                    const item = ITEMS[plot.seedId];
                    const cropId = plot.seedId.replace('seed_', 'crop_');
                    const count = Math.floor(Math.random() * ((item.maxHarvest || 1) - (item.minHarvest || 1) + 1)) + (item.minHarvest || 1);
                    updateInventorySimple(cropId, count);
                    expGain = 10;
                    addToast(`收获了 ${ITEMS[cropId]?.name} x${count}`, 'success', ITEMS[cropId]?.imageUrl);
                }
                plot.status = 'empty';
                plot.seedId = undefined;
                plot.daysPlanted = 0;
                plot.isWatered = false;
                energyCost = 4;
                break;
        }

        if (currentUser.energy < energyCost) {
            addToast("体力不足！", "error");
            playSound('error');
            return;
        }

        const newUser = { ...currentUser, energy: currentUser.energy - energyCost, exp: currentUser.exp + expGain };
        setCurrentUser(newUser);
        newPlots[pIdx] = plot;
        setGameState(prev => ({ ...prev, plots: newPlots }));
        setHasUnsavedChanges(true);
        if (action !== 'water') playSound('pop');
        gameService.broadcastPlotUpdate(plotId, plot);
    };

    const handleMyMove = useCallback((moveData: { x: number, z: number, direction: string, action: string }) => {
        if (!currentUser) return;
        localPosRef.current = { x: moveData.x, z: moveData.z };
        gameService.broadcastMyMove({ id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, ...moveData });
    }, [currentUser]);

    // 统一 Layout 属性，拜访模式下隐藏存档按钮
    const layoutProps = {
        onSave: visitingUser ? undefined : handleManualSave,
        isSaving,
        hasUnsavedChanges
    };

    return (
        <>
            <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none w-full px-4">
                {toasts.map(t => (
                    <div key={t.id} className="animate-slide-up bg-white/95 shadow-xl rounded-2xl px-6 py-3 flex items-center gap-3 border border-gray-100">
                        <CheckCircle className={t.type === 'error' ? 'text-red-500' : 'text-brand-green'} size={20} />
                        <span className="text-sm font-black text-brand-brown">{t.message}</span>
                    </div>
                ))}
            </div>
            <Routes>
                <Route path="/login" element={!currentUser ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />

                <Route path="/" element={currentUser ? (
                    <Layout {...layoutProps}>
                        <Home
                            user={currentUser}
                            gameState={gameState}
                            onAction={handleFarmAction}
                            onSleep={handleSleep}
                            isVisiting={!!visitingUser}
                            visitingName={visitingUser?.name}
                            visitingId={visitingUser?.id}
                            onReturnHome={() => setVisitingUser(null)}
                            remotePlayers={remotePlayersList}
                            onLocalMove={handleMyMove}
                        />
                    </Layout>
                ) : <Navigate to="/login" />} />

                <Route path="/social" element={currentUser ? (
                    <Layout {...layoutProps}>
                        <Social
                            currentUser={currentUser}
                            onVisit={(fid, fname) => {
                                setVisitingUser({ id: fid, name: fname });
                                navigate('/');
                            }}
                        />
                    </Layout>
                ) : <Navigate to="/login" />} />

                <Route path="/market" element={currentUser ? (
                    <Layout {...layoutProps}>
                        <Market
                            user={currentUser}
                            inventory={gameState.inventory}
                            onBuy={handleBuy}
                            onSell={handleSell}
                        />
                    </Layout>
                ) : <Navigate to="/login" />} />

                <Route path="/bag" element={currentUser ? (
                    <Layout {...layoutProps}>
                        <Inventory
                            inventory={gameState.inventory}
                            onUse={handleUseItem}
                        />
                    </Layout>
                ) : <Navigate to="/login" />} />

                <Route path="/profile" element={currentUser ? (
                    <Layout {...layoutProps}>
                        <Profile
                            user={currentUser}
                            onLogout={handleLogout}
                        />
                    </Layout>
                ) : <Navigate to="/login" />} />
            </Routes>

            {isSessionConflict && (
                <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl text-center flex flex-col items-center gap-4 border-4 border-red-100">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-2">
                            <AlertCircle size={48} />
                        </div>
                        <h2 className="text-2xl font-black text-brand-brown">账号在其他设备登录</h2>
                        <p className="text-brand-brownLight font-bold">为了您的账号安全，本次连接已断开。</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-brand-brown text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform"
                        >
                            重新登录
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <AppContent />
        </Router>
    );
};

export default App;
