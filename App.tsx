
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
import { gameService } from './services/game.ts';
import { User, GameState, ITEMS, getSeasonInfo, Plot, InventoryItem } from './types.ts';
import { CheckCircle, AlertCircle, X, Save, LogOut } from 'lucide-react';
import { playSound } from './utils/sound.ts';

// --- Toast Component ---
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    img?: string; 
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState<GameState>({
      plots: [], 
      inventory: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // --- Auto Save State ---
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Visiting State ---
  const [visitingUser, setVisitingUser] = useState<{ id: string, name: string } | null>(null);

  // --- Session State ---
  const [isSessionConflict, setIsSessionConflict] = useState(false);

  // Toast Helper
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', img?: string) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type, img }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
  }, []);

  // --- Auth & Data Loading Logic ---
  useEffect(() => {
    const initApp = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
            const gameUser = {
                ...user,
                coins: user.coins ?? 100, 
                energy: user.energy ?? 100, 
                maxEnergy: 100, 
                day: user.day || 1
            };
            setCurrentUser(gameUser);

            const data = await gameService.loadGameState(user.id);
            setGameState(data);
        }
      } catch (error) {
        console.error("Initialization failed", error);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  // --- Session Monitor Logic ---
  useEffect(() => {
      if (!currentUser || visitingUser) return;

      // 开始监听会话冲突
      const cleanupMonitor = gameService.monitorUserSession(currentUser.id, () => {
          setIsSessionConflict(true);
          playSound('error');
      });

      return () => {
          cleanupMonitor();
      };
  }, [currentUser?.id, visitingUser]);

  // --- Realtime Subscription Logic ---
  useEffect(() => {
      const targetUserId = visitingUser ? visitingUser.id : currentUser?.id;
      if (!targetUserId) return;

      gameService.joinGameRoom(targetUserId, (update) => {
          setGameState(prev => {
              const newPlots = [...prev.plots];
              const targetPlot = newPlots.find(p => p.id === update.plotIndex);
              if (targetPlot) {
                   const updatedPlot = { ...targetPlot, ...update.plotData };
                   const index = newPlots.findIndex(p => p.id === update.plotIndex);
                   if (index !== -1) {
                       newPlots[index] = updatedPlot;
                   }
                   return { ...prev, plots: newPlots };
              }
              return prev;
          });
      });

      return () => {
          gameService.leaveGameRoom();
      };
  }, [currentUser?.id, visitingUser?.id]);


  // --- Auto Save Logic (Optimized for Non-Critical Actions) ---
  useEffect(() => {
      if (!currentUser || visitingUser) return;

      if (hasUnsavedChanges) {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          
          autoSaveTimerRef.current = setTimeout(async () => {
              await performSave();
          }, 2000); 
      }

      return () => {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      };
  }, [hasUnsavedChanges, gameState.plots, currentUser, visitingUser]);

  // --- Exit Protection ---
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (hasUnsavedChanges) {
              e.preventDefault();
              e.returnValue = '';
              return '';
          }
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden' && currentUser && !visitingUser) {
              gameService.saveProfileKeepAlive(currentUser.id, {
                  coins: currentUser.coins,
                  energy: currentUser.energy,
                  exp: currentUser.exp,
                  day: currentUser.day
              });

              if (hasUnsavedChanges) {
                  gameService.saveGameData(currentUser.id, gameState.plots);
              }
          }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [hasUnsavedChanges, currentUser, gameState.plots, visitingUser]);


  const performSave = async () => {
      if (!currentUser || !hasUnsavedChanges) return;
      setIsSaving(true);
      try {
          await gameService.saveGameData(currentUser.id, gameState.plots);
          setHasUnsavedChanges(false);
      } catch (e) {
          console.warn("Auto save failed", e);
      } finally {
          setIsSaving(false);
      }
  };

  const handleLogin = async (user: User) => {
    setIsLoading(true);
    const gameUser = { 
        ...user, 
        coins: user.coins ?? 100, 
        energy: user.energy ?? 100, 
        maxEnergy: 100, 
        day: user.day || 1 
    };
    setCurrentUser(gameUser);
    setIsSessionConflict(false); // Reset session flag
    
    try {
        const data = await gameService.loadGameState(user.id);
        setGameState(data);
        playSound('success'); 
        addToast(`欢迎回来，${gameUser.name}！`, 'success');
    } catch (e) {
        console.error("Login load failed", e);
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    // If logging out normally, save. If conflict, don't save (might overwrite new data)
    if (currentUser && hasUnsavedChanges && !isSessionConflict) {
        await gameService.saveGameData(currentUser.id, gameState.plots);
    }
    gameService.leaveGameRoom();
    try { await authService.logout(); } catch (e) {}
    setCurrentUser(null);
    setGameState({ plots: [], inventory: [] });
    setVisitingUser(null);
    setIsSessionConflict(false);
  };

  const syncUserStats = (newUser: User) => {
      // Background sync, no await
      gameService.updateUserStats(newUser.id, {
          coins: newUser.coins,
          energy: newUser.energy,
          exp: newUser.exp,
          day: newUser.day
      }).catch(err => console.error("Failed to sync user stats:", err));
  };

  // --- Helper: Pure Inventory Modification (No Side Effects) ---
  const calculateNewInventory = (currentInventory: InventoryItem[], itemId: string, delta: number) => {
      let newInv = [...currentInventory];
      const existingIndex = newInv.findIndex(i => i.itemId === itemId);
      let finalCount = delta;

      if (existingIndex !== -1) {
          newInv[existingIndex] = { ...newInv[existingIndex], count: newInv[existingIndex].count + delta };
          finalCount = newInv[existingIndex].count;
          if (newInv[existingIndex].count <= 0) {
              newInv.splice(existingIndex, 1);
          }
      } else if (delta > 0) {
          newInv.push({ itemId, count: delta });
      }
      return { newInv, finalCount };
  };

  // --- Wrapper for simple inventory updates (Market/Eat) ---
  const updateInventorySimple = (itemId: string, delta: number) => {
      if (!currentUser) return;
      const { newInv, finalCount } = calculateNewInventory(gameState.inventory, itemId, delta);
      setGameState(prev => ({ ...prev, inventory: newInv }));
      gameService.updateInventoryItem(currentUser.id, itemId, finalCount);
  };

  const handleBuy = (itemId: string) => {
      if (!currentUser) return;
      const item = ITEMS[itemId];
      if (currentUser.coins >= item.price) {
          const newUser = { ...currentUser, coins: currentUser.coins - item.price };
          setCurrentUser(newUser);
          syncUserStats(newUser);
          updateInventorySimple(itemId, 1);
          playSound('coin'); 
          addToast(`购买成功：${item.name} (-${item.price}金币)`, 'success');
      } else {
          playSound('error');
          addToast("金币不足！", "error");
      }
  };

  const handleSell = (itemId: string, amount: number) => {
      if (!currentUser) return;
      const item = ITEMS[itemId];
      const totalEarned = item.sellPrice * amount;
      
      const newUser = { ...currentUser, coins: currentUser.coins + totalEarned };
      setCurrentUser(newUser);
      syncUserStats(newUser);
      updateInventorySimple(itemId, -amount);
      playSound('coin'); 
      addToast(`出售成功：${item.name} x${amount} (+${totalEarned}金币)`, 'success');
  };

  const handleUseItem = (itemId: string) => {
      if (!currentUser) return;
      const itemDef = ITEMS[itemId];
      if (!itemDef || !itemDef.energyRegen) return;

      if (currentUser.energy >= currentUser.maxEnergy) {
           addToast("体力已满，不需要吃东西。", "info");
           return;
      }

      updateInventorySimple(itemId, -1);
      const newEnergy = Math.min(currentUser.maxEnergy, currentUser.energy + itemDef.energyRegen);
      const energyGained = newEnergy - currentUser.energy;

      const newUser = { ...currentUser, energy: newEnergy };
      setCurrentUser(newUser);
      syncUserStats(newUser);

      playSound('pop'); 
      addToast(`食用：${itemDef.name} (体力 +${energyGained})`, 'success', itemDef.imageUrl);
  };

  const handleSleep = async () => {
      if (!currentUser || visitingUser) return; 
      
      playSound('success'); 

      const oldSeasonInfo = getSeasonInfo(currentUser.day);
      const nextDay = currentUser.day + 1;
      const newSeasonInfo = getSeasonInfo(nextDay);
      const isSeasonChange = oldSeasonInfo.season !== newSeasonInfo.season;

      const newUser = { 
          ...currentUser, 
          energy: currentUser.maxEnergy,
          day: nextDay 
      };

      const newPlots = gameState.plots.map(plot => {
          let updatedPlot = { ...plot };

          if (isSeasonChange && updatedPlot.type === 'soil' && updatedPlot.status === 'planted' && updatedPlot.seedId) {
              const seedDef = ITEMS[updatedPlot.seedId];
              if (seedDef && seedDef.seasons && !seedDef.seasons.includes(newSeasonInfo.season)) {
                  updatedPlot = {
                      ...updatedPlot,
                      status: 'withered',
                      seedId: 'dead_crop',
                      daysPlanted: 0,
                      isWatered: false,
                      isWithered: true
                  };
              }
          }

          if (updatedPlot.type === 'soil' && updatedPlot.status === 'planted' && updatedPlot.seedId && !updatedPlot.isWithered) {
              if (updatedPlot.isWatered) {
                  updatedPlot.daysPlanted += 1;
                  updatedPlot.isWatered = false;
              } else {
                  updatedPlot.isWatered = false;
              }
          }
          
          if (updatedPlot.type === 'soil') {
              updatedPlot.isWatered = false;
          }

          return updatedPlot;
      });

      setCurrentUser(newUser);
      setGameState(prev => ({ ...prev, plots: newPlots }));
      
      if (isSeasonChange) {
          addToast(`季节变迁！现在是${newSeasonInfo.label}了。`, "info");
      } else {
          addToast("新的一天开始了！体力已恢复。", "info");
      }

      await gameService.updateUserStats(newUser.id, { energy: newUser.energy, day: newUser.day });
      
      setIsSaving(true);
      await gameService.saveGameData(newUser.id, newPlots);
      setHasUnsavedChanges(false);
      setIsSaving(false);
  };

  // --- Main Game Action Logic (Safe Transaction) ---
  const handleFarmAction = async (plotId: number, action: 'clear' | 'till' | 'plant' | 'water' | 'harvest' | 'fish_start' | 'fish_catch' | 'fish_fail', payload?: string) => {
      if (!currentUser) return;
      
      if (visitingUser) {
          playSound('error');
          addToast("你只能参观好友的农场，不能操作哦！", "info");
          return;
      }

      // Fishing Start / Fail are transient, no save needed
      if (action === 'fish_start') {
          if (currentUser.energy < 5) {
             addToast("体力不足！去睡一觉吧。", "error");
             playSound('error');
             return;
          }
          const newUser = { ...currentUser, energy: currentUser.energy - 5 };
          setCurrentUser(newUser);
          syncUserStats(newUser);
          playSound('water'); 
          return;
      }
      if (action === 'fish_fail') {
          addToast("哎呀，鱼溜走了...", "info");
          return;
      }

      // --- Pre-Calculate Changes ---
      const nextPlots = [...gameState.plots];
      let plotIndex = -1;
      let nextInventory = [...gameState.inventory];
      let nextUser = { ...currentUser };
      let energyCost = 0;
      let xpGain = 0;
      let successMessage = "";
      
      // We will collect inventory changes to sync remotely later
      const inventorySyncQueue: { itemId: string, finalCount: number }[] = [];

      // Helper to modify local inventory and queue sync
      const modifyInventory = (itemId: string, delta: number) => {
          const { newInv, finalCount } = calculateNewInventory(nextInventory, itemId, delta);
          nextInventory = newInv;
          inventorySyncQueue.push({ itemId, finalCount });
      };

      // 1. Fishing Catch Logic (No plot interaction)
      if (action === 'fish_catch' && payload) {
          modifyInventory(payload, 1);
          const fishItem = ITEMS[payload];
          const fishName = fishItem?.name || payload;
          successMessage = `钓到了：${fishName}!`;
          xpGain = 15;
          playSound('success');
      } 
      // 2. Plot Interaction Logic
      else {
          plotIndex = nextPlots.findIndex(p => p.id === plotId);
          if (plotIndex === -1) return;
          const plot = { ...nextPlots[plotIndex] }; // Clone specific plot

          // Calculate Costs
          if (action === 'clear') {
             if (plot.type === 'wood' || plot.type === 'stone') energyCost = 8;
             else if (plot.type === 'weed' || plot.status === 'withered') energyCost = 3;
          } else if (action === 'till') energyCost = 4;
          else if (action === 'water') energyCost = 2;
          else if (action === 'plant') energyCost = 2;
          else if (action === 'harvest') energyCost = 4; 

          // Energy Check
          if (currentUser.energy < energyCost) {
              addToast("体力不足！去睡一觉吧。", "error");
              playSound('error');
              return;
          }

          // Action Logic
          if (action === 'clear') {
              let dropItem = '';
              if (plot.type === 'wood') dropItem = 'wood';
              else if (plot.type === 'stone') dropItem = 'stone';
              else if (plot.type === 'weed') dropItem = 'fiber';

              if (dropItem) {
                  modifyInventory(dropItem, 1);
                  const itemName = ITEMS[dropItem]?.name || dropItem;
                  successMessage = `获得：${itemName}`;
              }

              playSound('pop'); 
              if (plot.type === 'soil') {
                  // Reset soil
                  plot.status = 'empty';
                  plot.seedId = undefined;
                  plot.daysPlanted = 0;
                  plot.isWatered = false;
                  plot.isWithered = false;
              } else {
                  // Reset resource to grass
                  plot.type = 'grass';
                  plot.status = 'empty';
              }
              xpGain = 5;
          } else if (action === 'till') {
              if (plot.type !== 'grass') return;
              playSound('pop');
              plot.type = 'soil';
              plot.status = 'empty';
          } else if (action === 'water') {
              if (plot.type !== 'soil') return;
              playSound('water'); 
              plot.isWatered = true;
          } else if (action === 'plant' && payload) {
              if (plot.type !== 'soil') return;
              modifyInventory(payload, -1);
              playSound('pop');
              plot.status = 'planted';
              plot.seedId = payload;
              plot.daysPlanted = 0;
              plot.isWatered = false;
              addToast(`种植了 ${ITEMS[payload].name}`, 'info');
          } else if (action === 'harvest') {
              if (plot.seedId) {
                  const seedDef = ITEMS[plot.seedId];
                  const cropId = plot.seedId.replace('seed_', 'crop_');
                  let count = 1;
                  if (seedDef && seedDef.minHarvest && seedDef.maxHarvest) {
                      count = Math.floor(Math.random() * (seedDef.maxHarvest - seedDef.minHarvest + 1)) + seedDef.minHarvest;
                  }
                  modifyInventory(cropId, count);
                  xpGain = 10;
                  const cropName = ITEMS[cropId]?.name || "作物";
                  successMessage = `收获：${cropName} x${count}`;
              }
              playSound('success'); 
              // Harvest resets plot
              plot.status = 'empty';
              plot.seedId = undefined;
              plot.daysPlanted = 0;
              plot.isWatered = false;
          }

          nextPlots[plotIndex] = plot;
          gameService.broadcastPlotUpdate(plotId, plot);
      }

      // Apply Stats
      nextUser.energy -= energyCost;
      nextUser.exp += xpGain;

      // 3. Optimistic Local Update (Instant Feedback)
      setGameState({ plots: nextPlots, inventory: nextInventory });
      setCurrentUser(nextUser);
      if (successMessage) addToast(successMessage, 'success');

      // 4. Critical Sync Strategy
      // Is this an action that modifies inventory (risk of asset loss)?
      const isCritical = inventorySyncQueue.length > 0;

      if (isCritical) {
          // Clear any pending auto-saves to avoid race conditions
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          setHasUnsavedChanges(false);

          try {
              // A. Save Map FIRST (Ensures world state is persistent)
              // If this fails, we throw and DO NOT sync inventory/stats, preventing asset loss.
              if (plotIndex !== -1) {
                  await gameService.saveGameData(currentUser.id, nextPlots);
              }

              // B. Save Inventory (Now safe to proceed)
              for (const update of inventorySyncQueue) {
                  await gameService.updateInventoryItem(currentUser.id, update.itemId, update.finalCount);
              }

              // C. Save Stats
              await gameService.updateUserStats(currentUser.id, { 
                  energy: nextUser.energy, 
                  exp: nextUser.exp 
              });

          } catch (error) {
              console.error("Critical Sync Failed:", error);
              addToast("网络异常，正在恢复存档...", "error");
              
              // ROLLBACK: Re-fetch data from server to undo optimistic updates
              // This ensures if Map save failed, we get back the seed we "used".
              setIsLoading(true);
              try {
                  const restored = await gameService.loadGameState(currentUser.id);
                  setGameState(restored);
                  // Refresh user stats too
                  const freshUser = await authService.getCurrentUser();
                  if (freshUser) {
                      setCurrentUser({ ...freshUser, coins: freshUser.coins ?? 100, energy: freshUser.energy ?? 100, maxEnergy: 100, day: freshUser.day || 1 });
                  }
              } catch(e) { /* ignore */ }
              setIsLoading(false);
          }
      } else {
          // Non-critical action (e.g., Water, Till) -> Just mark as dirty for AutoSave
          setHasUnsavedChanges(true);
          // Sync stats in background lazily
          syncUserStats(nextUser);
      }
  };

  const handleVisitFriend = async (friendId: string, friendName: string) => {
      setIsLoading(true);
      try {
          gameService.leaveGameRoom();
          const friendGameData = await gameService.loadGameState(friendId);
          setVisitingUser({ id: friendId, name: friendName });
          setGameState(prev => ({ ...prev, plots: friendGameData.plots }));
          playSound('pop');
          addToast(`正在前往 ${friendName} 的农场...`, 'info');
      } catch (e) {
          addToast("加载好友农场失败", "error");
      } finally {
          setIsLoading(false);
      }
  };

  const handleReturnHome = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
          gameService.leaveGameRoom(); 
          const myData = await gameService.loadGameState(currentUser.id);
          setVisitingUser(null);
          setGameState(myData);
          setHasUnsavedChanges(false); 
          playSound('pop');
          addToast("回到温暖的家", 'success');
      } catch (e) {
          addToast("回家失败，请刷新重试", "error");
      } finally {
          setIsLoading(false);
      }
  };

  const SocialWrapper = () => {
      const navigate = useNavigate();
      const onVisitAndNavigate = (fid: string, fname: string) => {
          handleVisitFriend(fid, fname);
          navigate('/');
      };
      return currentUser ? (
        <Layout>
            <Social currentUser={currentUser} onVisit={onVisitAndNavigate} />
        </Layout>
      ) : <Navigate to="/login" />;
  };

  // --- Session Conflict Overlay ---
  if (isSessionConflict) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-[9999] p-6 animate-fade-in relative">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-pop-in border-4 border-red-50">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-500 animate-pulse-slow">
                      <LogOut size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-brand-brown mb-2">登录状态已失效</h2>
                  <p className="text-brand-brownLight mb-8 font-bold leading-relaxed">
                      您的账号已在其他设备登录。<br/>
                      如果这不是您本人的操作，请立即修改密码。
                  </p>
                  <button 
                      onClick={handleLogout}
                      className="w-full py-4 bg-brand-brown text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
                  >
                      返回登录页
                  </button>
              </div>
          </div>
      );
  }

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#FDFBF7] text-brand-brown gap-4">
        <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-sm text-brand-brownLight">正在同步云端存档...</p>
      </div>
    );
  }

  return (
    <Router>
       <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none w-full px-4">
            {toasts.map(toast => (
                <div key={toast.id} className={`animate-slide-up bg-white/95 backdrop-blur shadow-xl rounded-2xl px-6 py-3 flex items-center gap-3 border shadow-black/5 ${toast.type === 'error' ? 'border-red-100' : 'border-green-100'}`}>
                    {toast.img ? (
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 border border-gray-100">
                             <img src={toast.img} className="w-8 h-8 object-contain" alt="icon" />
                        </div>
                    ) : (
                        <>
                            {toast.type === 'success' && <CheckCircle className="text-brand-green" size={20} />}
                            {toast.type === 'error' && <AlertCircle className="text-red-500" size={20} />}
                            {toast.type === 'info' && <AlertCircle className="text-blue-500" size={20} />}
                        </>
                    )}
                    <span className={`text-sm font-black ${toast.type === 'error' ? 'text-red-500' : 'text-brand-brown'}`}>{toast.message}</span>
                </div>
            ))}
      </div>

      <Routes>
        <Route path="/login" element={!currentUser ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
        
        <Route path="/" element={
            currentUser ? (
                <Layout>
                    <Home 
                        user={currentUser} 
                        gameState={gameState} 
                        onAction={handleFarmAction} 
                        onSleep={handleSleep} 
                        isVisiting={!!visitingUser}
                        visitingName={visitingUser?.name}
                        onReturnHome={handleReturnHome}
                        onShowMessage={(msg) => addToast(msg, 'info')}
                    />
                </Layout>
            ) : <Navigate to="/login" />
        } />
        
        <Route path="/social" element={<SocialWrapper />} />

        <Route path="/market" element={
            currentUser ? (
                <Layout>
                    <Market 
                        user={currentUser} 
                        inventory={gameState.inventory} 
                        onBuy={handleBuy} 
                        onSell={handleSell} 
                    />
                </Layout>
            ) : <Navigate to="/login" />
        } />
        
        <Route path="/bag" element={
            currentUser ? (
                <Layout>
                    <Inventory 
                        inventory={gameState.inventory} 
                        onUse={handleUseItem} 
                    />
                </Layout>
            ) : <Navigate to="/login" />
        } />
        
        <Route path="/profile" element={
            currentUser ? (
                <Layout>
                    <Profile user={currentUser} onLogout={handleLogout} />
                </Layout>
            ) : <Navigate to="/login" />
        } />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;
