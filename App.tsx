
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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

// 远程玩家存储结构
interface PlayerRecord extends RemotePlayerState {
    lastSeen: number;
}

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [gameState, setGameState] = useState<GameState>({ plots: [], inventory: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [visitingUser, setVisitingUser] = useState<{ id: string, name: string } | null>(null);
    const [isSessionConflict, setIsSessionConflict] = useState(false);

    // --- 核心优化：使用 Ref 跟踪远程玩家，State 只驱动渲染 ---
    const remotePlayersRef = useRef<Record<string, PlayerRecord>>({});
    const [remotePlayersList, setRemotePlayersList] = useState<RemotePlayerState[]>([]);
    const localPosRef = useRef({ x: MAP_COLS / 2, z: MAP_ROWS / 2 });

    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', img?: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, img }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    useEffect(() => {
        const initApp = async () => {
            try {
                const user = await authService.getCurrentUser();
                if (user) {
                    const gameUser = { ...user, coins: user.coins ?? 100, energy: user.energy ?? 100, maxEnergy: 100, day: user.day || 1 };
                    setCurrentUser(gameUser);
                    const data = await gameService.loadGameState(user.id);
                    setGameState(data);
                }
            } catch (error) { console.error(error); } finally { setIsLoading(false); }
        };
        initApp();
    }, []);

    useEffect(() => {
        if (!currentUser || visitingUser) return;
        const cleanupMonitor = gameService.monitorUserSession(currentUser.id, () => {
            setIsSessionConflict(true);
            playSound('error');
        });
        return () => cleanupMonitor();
    }, [currentUser?.id, visitingUser]);

    // --- 重构的多人同步逻辑 ---
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

                // 身份锁定：如果包里是“冒险家”，但缓存里有真名，保护真名不被覆盖
                const hasRealName = existing && existing.name && existing.name !== '冒险家';
                const incomingIsDefault = playerUpdate.name === '冒险家';

                remotePlayersRef.current[playerUpdate.id] = {
                    ...existing,
                    ...playerUpdate,
                    name: (incomingIsDefault && hasRealName) ? existing.name : playerUpdate.name,
                    avatar: (playerUpdate.avatar === '' && existing?.avatar) ? existing.avatar : playerUpdate.avatar,
                    lastSeen: now
                };

                setRemotePlayersList(Object.values(remotePlayersRef.current));
            },
            (onlinePlayers) => {
                const now = Date.now();
                const onlineIds = onlinePlayers.map(p => p.id);

                onlinePlayers.forEach(p => {
                    if (p.id === currentUser.id) return;
                    const existing = remotePlayersRef.current[p.id];

                    if (!existing) {
                        remotePlayersRef.current[p.id] = { ...p, lastSeen: now };
                    } else {
                        // Presence 更新时同样执行身份保护
                        const hasRealName = existing.name && existing.name !== '冒险家';
                        const incomingIsDefault = p.name === '冒险家';

                        remotePlayersRef.current[p.id].name = (incomingIsDefault && hasRealName) ? existing.name : p.name;
                        remotePlayersRef.current[p.id].avatar = (p.avatar === '' && existing.avatar) ? existing.avatar : p.avatar;
                    }
                });

                Object.keys(remotePlayersRef.current).forEach(id => {
                    if (!onlineIds.includes(id)) {
                        delete remotePlayersRef.current[id];
                    }
                });

                setRemotePlayersList(Object.values(remotePlayersRef.current));
            }
        );

        return () => gameService.leaveGameRoom();
    }, [currentUser?.id, visitingUser?.id]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '有未保存的进度！';
                return '有未保存的进度！';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleManualSave = async () => {
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
        let newInv = [...gameState.inventory];
        const idx = newInv.findIndex(i => i.itemId === itemId);
        if (idx !== -1) {
            const count = newInv[idx].count + delta;
            if (count <= 0) newInv.splice(idx, 1);
            else newInv[idx] = { ...newInv[idx], count };
        } else if (delta > 0) newInv.push({ itemId, count: delta });
        setGameState(prev => ({ ...prev, inventory: newInv }));
        setHasUnsavedChanges(true);
    };

    const handleBuy = (itemId: string) => {
        if (!currentUser) return;
        const item = ITEMS[itemId];
        if (currentUser.coins >= item.price) {
            setCurrentUser({ ...currentUser, coins: currentUser.coins - item.price });
            updateInventorySimple(itemId, 1);
            playSound('coin');
            addToast(`购买成功：${item.name}`, 'success');
        } else {
            playSound('error');
            addToast("金币不足！", "error");
        }
    };

    const handleSell = (itemId: string, amount: number) => {
        if (!currentUser) return;
        const item = ITEMS[itemId];
        const earn = item.sellPrice * amount;
        setCurrentUser({ ...currentUser, coins: currentUser.coins + earn });
        updateInventorySimple(itemId, -amount);
        playSound('coin');
        addToast(`出售成功 (+${earn})`, 'success');
    };

    const handleUseItem = (itemId: string) => {
        if (!currentUser) return;
        const item = ITEMS[itemId];
        if (!item || !item.energyRegen) return;
        if (currentUser.energy >= currentUser.maxEnergy) { addToast("体力已满", "info"); return; }
        updateInventorySimple(itemId, -1);
        setCurrentUser({ ...currentUser, energy: Math.min(currentUser.maxEnergy, currentUser.energy + item.energyRegen) });
        setHasUnsavedChanges(true);
        playSound('pop');
        addToast(`食用：${item.name}`, 'success', item.imageUrl);
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
            return p;
        });
        setCurrentUser(newUser);
        setGameState(prev => ({ ...prev, plots: newPlots }));
        setHasUnsavedChanges(true);
        addToast("新的一天开始了！", "info");
    };

    const handleFarmAction = async (plotId: number, action: string, payload?: string) => {
        if (!currentUser || visitingUser) return;
        setHasUnsavedChanges(true);
    };

    const handleMyMove = useCallback((moveData: { x: number, z: number, direction: string, action: string }) => {
        if (!currentUser) return;
        localPosRef.current = { x: moveData.x, z: moveData.z };
        // 广播和 Presence 都带上当前用户身份
        gameService.broadcastMyMove({ id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, ...moveData });

        if (Math.random() > 0.98) {
            gameService.updatePresenceMetadata(currentUser, moveData);
        }
    }, [currentUser]);

    const handleVisitFriend = async (friendId: string, friendName: string) => {
        setIsLoading(true);
        try {
            gameService.leaveGameRoom();
            const data = await gameService.loadGameState(friendId);
            setVisitingUser({ id: friendId, name: friendName });
            setGameState(prev => ({ ...prev, plots: data.plots }));
            addToast(`正在参观 ${friendName} 的农场`, 'info');
        } catch (e) { addToast("访问好友失败", "error"); }
        finally { setIsLoading(false); }
    };

    const handleReturnHome = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            gameService.leaveGameRoom();
            const data = await gameService.loadGameState(currentUser.id);
            setVisitingUser(null);
            setGameState(data);
            addToast("回到家了", 'success');
        } catch (e) { addToast("回家失败", "error"); }
        finally { setIsLoading(false); }
    };

    const SocialWrapper = () => {
        const navigate = useNavigate();
        const onVisitAndNavigate = (fid: string, fname: string) => { handleVisitFriend(fid, fname); navigate('/'); };
        return currentUser ? <Layout onSave={visitingUser ? undefined : handleManualSave} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges}><Social currentUser={currentUser} onVisit={onVisitAndNavigate} /></Layout> : <Navigate to="/login" />;
    };

    if (isSessionConflict) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-black/60 z-[9999] p-6 text-center">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full">
                <LogOut size={40} className="mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-black mb-2">登录已失效</h2>
                <p className="text-gray-500 mb-6">账号已在别处登录</p>
                <button onClick={handleLogout} className="w-full py-4 bg-brand-brown text-white rounded-2xl font-bold">重新登录</button>
            </div>
        </div>
    );

    if (isLoading) return <div className="h-screen w-full flex items-center justify-center">正在加载存档...</div>;

    return (
        <Router>
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
                <Route path="/" element={currentUser ? <Layout {...(visitingUser ? {} : {onSave: handleManualSave, isSaving, hasUnsavedChanges})}><Home user={currentUser} gameState={gameState} onAction={handleFarmAction} onSleep={handleSleep} isVisiting={!!visitingUser} visitingName={visitingUser?.name} visitingId={visitingUser?.id} onReturnHome={handleReturnHome} remotePlayers={remotePlayersList} onLocalMove={handleMyMove}/></Layout> : <Navigate to="/login" />} />
                <Route path="/social" element={<SocialWrapper />} />
                <Route path="/market" element={currentUser ? <Layout><Market user={currentUser} inventory={gameState.inventory} onBuy={handleBuy} onSell={handleSell} /></Layout> : <Navigate to="/login" />} />
                <Route path="/bag" element={currentUser ? <Layout><Inventory inventory={gameState.inventory} onUse={handleUseItem} /></Layout> : <Navigate to="/login" />} />
                <Route path="/profile" element={currentUser ? <Layout><Profile user={currentUser} onLogout={handleLogout} /></Layout> : <Navigate to="/login" />} />
            </Routes>
        </Router>
    );
};

export default App;
