
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Lock, LogOut, ChevronRight, Edit2, ChevronLeft, Save, RefreshCw, Mail, Loader2, Crown, BookOpen, X, Sprout, AlertTriangle, Trash2 } from 'lucide-react';
import { User, ITEMS, ItemDef } from '../types';
import { authService } from '../services/auth';
import { gameService } from '../services/game';
import { getLevelProgress, getLevelTitle } from '../utils/levelLogic';

interface ProfileProps {
    user: User;
    onLogout: () => void;
}

type ViewState = 'main' | 'edit' | 'security' | 'compendium';

const Profile: React.FC<ProfileProps> = ({ user: initialUser, onLogout }) => {
  const [user, setUser] = useState<User>(initialUser);
  const [view, setView] = useState<ViewState>('main');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  // Custom Confirmation Modal State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editAvatarSeed, setEditAvatarSeed] = useState(user.avatar);

  // Password Form State
  const [newPassword, setNewPassword] = useState('');

  // Compendium State
  const [selectedItem, setSelectedItem] = useState<ItemDef | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'crop' | 'seed' | 'resource' | 'fish'>('all');

  // Level Logic using EXP
  const progress = getLevelProgress(user.exp);
  const displayLevel = progress.level;
  const levelTitle = getLevelTitle(displayLevel);

  // Handlers
  const handleSaveProfile = async () => {
      setIsLoading(true);
      setMessage(null);
      try {
          const updatedUser = await authService.updateProfile(user.id, {
              name: editName,
              bio: editBio,
              avatar: editAvatarSeed
          });
          setUser({ ...user, ...updatedUser }); 
          setMessage({ type: 'success', text: '个人资料已更新！' });
          setTimeout(() => setView('main'), 1000);
      } catch (err: any) {
          setMessage({ type: 'error', text: err.message });
      } finally {
          setIsLoading(false);
      }
  };

  const handleChangePassword = async () => {
      if (newPassword.length < 6) {
          setMessage({ type: 'error', text: '密码长度至少需要6位' });
          return;
      }
      setIsLoading(true);
      setMessage(null);
      try {
          await authService.updatePassword(newPassword);
          setMessage({ type: 'success', text: '密码修改成功！' });
          setNewPassword('');
      } catch (err: any) {
          setMessage({ type: 'error', text: '修改失败: ' + err.message });
      } finally {
          setIsLoading(false);
      }
  };

  const handleLogoutClick = async () => {
      setIsLoggingOut(true);
      await onLogout();
  };
  
  const performReset = async () => {
      setShowResetConfirm(false);
      setIsLoading(true);
      setMessage({ type: 'success', text: '正在重置世界...' });
      
      try {
          await gameService.resetAccount(user.id);
          // 稍微延迟一下，给用户看一眼提示，然后登出
          setTimeout(async () => {
              await onLogout(); 
          }, 1500);
      } catch (err: any) {
          setMessage({ type: 'error', text: '重置失败: ' + err.message });
          setIsLoading(false);
      }
  };

  const regenerateAvatar = () => {
      const randomSeed = Math.random().toString(36).substring(7);
      setEditAvatarSeed(`https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`);
  };

  // --- Sub-View: Compendium (图鉴) ---
  if (view === 'compendium') {
      const allItems = Object.values(ITEMS);
      const filteredItems = allItems.filter(i => {
          if (filterType === 'all') return true;
          // Fish logic: ID starts with 'fish_'
          if (filterType === 'fish') return i.id.startsWith('fish_');
          // Resource logic: type is resource/food BUT NOT a fish
          if (filterType === 'resource') return (i.type === 'resource' || i.type === 'food') && !i.id.startsWith('fish_');
          // Others (seed, crop)
          return i.type === filterType;
      });

      return (
          <div className="bg-brand-bg min-h-screen flex flex-col animate-slide-up relative">
              <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white sticky top-0 z-20 shadow-sm rounded-b-3xl">
                  <button onClick={() => setView('main')} className="p-2 bg-gray-100 rounded-full text-brand-brown active:bg-gray-200">
                      <ChevronLeft size={24} />
                  </button>
                  <h1 className="text-xl font-black text-brand-brown flex items-center gap-2">
                      <BookOpen className="text-brand-orange" /> 游戏图鉴
                  </h1>
                  <div className="w-10"></div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 px-6 py-4 overflow-x-auto no-scrollbar">
                  {[
                      { id: 'all', label: '全部' },
                      { id: 'crop', label: '农作物' },
                      { id: 'fish', label: '鱼类' },
                      { id: 'seed', label: '种子' },
                      { id: 'resource', label: '材料' }
                  ].map(tab => (
                      <button 
                          key={tab.id}
                          onClick={() => setFilterType(tab.id as any)}
                          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                              filterType === tab.id 
                                  ? 'bg-brand-brown text-brand-orangeLight' 
                                  : 'bg-white text-brand-brownLight'
                          }`}
                      >
                          {tab.label}
                      </button>
                  ))}
              </div>

              {/* Grid */}
              <div className="px-6 pb-12 grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {filteredItems.map(item => (
                      <button 
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 active:scale-95 transition-transform"
                      >
                          <div className={`w-12 h-12 rounded-xl ${item.color.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
                              <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain drop-shadow-sm" />
                          </div>
                          <span className="text-[10px] font-bold text-brand-brown text-center leading-tight line-clamp-1">{item.name}</span>
                      </button>
                  ))}
              </div>

              {/* Detail Modal - Using Portal to escape parent transforms */}
              {selectedItem && createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedItem(null)}>
                      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-pop-in relative" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                              <X size={20} />
                          </button>

                          <div className="flex flex-col items-center">
                              <div className={`w-24 h-24 rounded-3xl ${selectedItem.color.replace('text-', 'bg-')}/20 flex items-center justify-center mb-4`}>
                                  <img src={selectedItem.imageUrl} className="w-16 h-16 object-contain drop-shadow-md scale-125" />
                              </div>
                              <h2 className="text-2xl font-black text-brand-brown">{selectedItem.name}</h2>
                              <div className="flex gap-2 mt-2 mb-4">
                                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 rounded-md text-brand-brownLight uppercase">
                                      {/* 动态显示类型标签 */}
                                      {selectedItem.id.startsWith('fish_') ? '鱼类' : 
                                       selectedItem.type === 'resource' ? '材料' : 
                                       selectedItem.type === 'crop' ? '农作物' : '种子'}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-1 bg-brand-orangeLight text-brand-orange rounded-md">售价 ${selectedItem.sellPrice}</span>
                                  {selectedItem.energyRegen && selectedItem.energyRegen > 0 && (
                                     <span className="text-[10px] font-bold px-2 py-1 bg-green-100 text-green-600 rounded-md">体力 +{selectedItem.energyRegen}</span>
                                  )}
                              </div>
                              <p className="text-sm text-brand-brownLight text-center font-bold bg-brand-bg p-4 rounded-xl w-full mb-4">
                                  {selectedItem.description}
                              </p>

                              {/* Growth Stages Visualization */}
                              {(selectedItem.type === 'crop' || selectedItem.type === 'seed') && (
                                  <div className="w-full">
                                      <div className="flex items-center gap-2 mb-2">
                                          <Sprout size={16} className="text-brand-green" />
                                          <span className="text-xs font-black text-brand-brown">生长过程预览</span>
                                      </div>
                                      
                                      {/* Scrollable Container */}
                                      <div className="bg-[#F8FDF0] p-4 rounded-2xl border-2 border-[#EBF5DF] flex overflow-x-auto no-scrollbar gap-2 relative snap-x">
                                          
                                          {(() => {
                                              // Determine seed item and crop item for data
                                              let seedItem: ItemDef | undefined = selectedItem.type === 'seed' ? selectedItem : ITEMS[selectedItem.id.replace('crop_', 'seed_')];
                                              if (!seedItem) seedItem = selectedItem; // Fallback
                                              
                                              // Get the crop item to show as final harvest
                                              let cropItem: ItemDef | undefined = selectedItem.type === 'crop' ? selectedItem : ITEMS[selectedItem.id.replace('seed_', 'crop_')];
                                              
                                              const stages = seedItem.growthStages || [];
                                              
                                              // Construct the display array: Seed -> Stages -> Harvest
                                              const displayStages = [
                                                  { img: seedItem.imageUrl, label: '种子包', isSpecial: false },
                                                  ...stages.map((img, i) => ({ 
                                                      img, 
                                                      label: i === stages.length - 1 ? '成熟植株' : `阶段 ${i+1}`,
                                                      isSpecial: i === stages.length - 1
                                                  })),
                                                  // Only add harvest product if it exists and is different from the mature plant image (usually it is)
                                                  ...(cropItem ? [{ img: cropItem.imageUrl, label: '收获物', isSpecial: true }] : [])
                                              ];

                                              return displayStages.map((stage, idx) => (
                                                  <div key={idx} className="flex flex-col items-center gap-1 min-w-[70px] snap-center">
                                                      <div className={`w-14 h-14 bg-white rounded-xl border ${stage.isSpecial ? 'border-brand-green bg-green-50' : 'border-[#EBF5DF]'} flex items-center justify-center shadow-sm relative shrink-0`}>
                                                          {/* Connector Line */}
                                                          {idx < displayStages.length - 1 && (
                                                              <div className="absolute top-1/2 -right-3 w-3 h-0.5 bg-[#EBF5DF] z-0"></div>
                                                          )}
                                                          {stage.img ? <img src={stage.img} className="w-9 h-9 object-contain" /> : <span className="text-xs">?</span>}
                                                      </div>
                                                      <span className={`text-[9px] font-bold ${stage.isSpecial ? 'text-brand-green' : 'text-gray-400'}`}>{stage.label}</span>
                                                  </div>
                                              ));
                                          })()}

                                      </div>
                                      <div className="text-[9px] text-gray-300 text-center mt-1 font-bold">左右滑动查看完整过程</div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>,
                  document.body
              )}
          </div>
      );
  }

  // --- Sub-View: Edit Profile ---
  if (view === 'edit') {
      return (
          <div className="bg-brand-bg min-h-screen flex flex-col animate-slide-up">
              <div className="px-6 pt-12 pb-4 flex items-center justify-between">
                  <button onClick={() => setView('main')} className="p-2 bg-white rounded-full shadow-sm text-brand-brown">
                      <ChevronLeft size={24} />
                  </button>
                  <h1 className="text-xl font-bold text-brand-brown">编辑资料</h1>
                  <div className="w-10"></div>
              </div>
              
              <div className="px-6 pt-4 space-y-6">
                  {/* Avatar Edit */}
                  <div className="flex flex-col items-center">
                      <div className="w-28 h-28 rounded-full bg-white p-1 shadow-md mb-4 overflow-hidden relative group">
                          <img src={editAvatarSeed} alt="Avatar" className="w-full h-full rounded-full bg-gray-100" />
                      </div>
                      <button onClick={regenerateAvatar} className="flex items-center gap-2 text-sm font-bold text-brand-orange bg-brand-orangeLight px-4 py-2 rounded-full active:scale-95 transition-transform">
                          <RefreshCw size={16} /> 随机生成头像
                      </button>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-brand-brownLight ml-1 mb-1 block">昵称</label>
                          <input 
                              type="text" 
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full p-4 rounded-2xl bg-white text-brand-brown font-bold focus:outline-none focus:ring-2 focus:ring-brand-green transition-shadow"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-brand-brownLight ml-1 mb-1 block">个人简介</label>
                          <textarea 
                              value={editBio}
                              onChange={(e) => setEditBio(e.target.value)}
                              rows={3}
                              className="w-full p-4 rounded-2xl bg-white text-brand-brown font-medium focus:outline-none focus:ring-2 focus:ring-brand-green resize-none transition-shadow"
                              placeholder="介绍一下你自己..."
                          />
                      </div>
                  </div>

                  {message && (
                      <div className={`p-3 rounded-xl text-sm font-bold text-center animate-pop-in ${message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                          {message.text}
                      </div>
                  )}

                  <button 
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                      className="w-full py-4 bg-brand-brown text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                      {isLoading ? '保存中...' : <><Save size={20} /> 保存修改</>}
                  </button>
              </div>
          </div>
      );
  }

  // --- Sub-View: Security ---
  if (view === 'security') {
      return (
        <div className="bg-brand-bg min-h-screen flex flex-col animate-slide-up relative">
            <div className="px-6 pt-12 pb-4 flex items-center justify-between">
                <button onClick={() => setView('main')} className="p-2 bg-white rounded-full shadow-sm text-brand-brown">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-brand-brown">账号与安全</h1>
                <div className="w-10"></div>
            </div>

            <div className="px-6 pt-4 space-y-6">
                {/* Email Display */}
                <div className="bg-white p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-1">
                        <Mail className="text-brand-brownLight" size={20} />
                        <span className="text-sm font-bold text-brand-brownLight">绑定邮箱</span>
                    </div>
                    <div className="pl-8 font-bold text-brand-brown text-lg">{user.email || '未绑定'}</div>
                    <div className="pl-8 text-xs text-green-500 font-bold mt-1">已验证</div>
                </div>

                {/* Password Change */}
                <div className="space-y-4">
                    <h3 className="font-bold text-brand-brown ml-1">修改密码</h3>
                    <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="输入新密码 (至少6位)"
                        className="w-full p-4 rounded-2xl bg-white text-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-green transition-shadow"
                    />
                     <button 
                        onClick={handleChangePassword}
                        disabled={isLoading || !newPassword}
                        className={`w-full py-3 bg-brand-brown text-white rounded-2xl font-bold shadow-md ${!newPassword ? 'opacity-50' : 'active:scale-95 transition-transform'}`}
                    >
                        {isLoading ? '更新中...' : '确认修改'}
                    </button>
                </div>

                {message && (
                      <div className={`p-3 rounded-xl text-sm font-bold text-center animate-pop-in ${message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                          {message.text}
                      </div>
                  )}

                {/* Danger Zone */}
                <div className="mt-8 border-t border-gray-100 pt-6">
                    <h3 className="font-bold text-red-500 ml-1 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} /> 危险区域
                    </h3>
                    <p className="text-xs text-brand-brownLight mb-4 leading-relaxed">
                        重置存档将清除所有进度、物品和农田状态。此操作无法撤销。
                    </p>
                    <button 
                        onClick={() => setShowResetConfirm(true)}
                        disabled={isLoading}
                        className="w-full py-3 bg-red-50 text-red-500 border border-red-100 rounded-2xl font-bold shadow-sm active:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    >
                         {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18} />}
                        重置所有存档
                    </button>
                </div>
            </div>

            {/* Custom Reset Confirmation Modal - Using Portal */}
            {showResetConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-pop-in relative flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-brand-brown mb-2">危险操作</h3>
                        <p className="text-brand-brownLight text-sm mb-6 font-bold leading-relaxed">
                            你确定要删除所有存档吗？<br/>
                            <span className="text-red-500">背包、金币、等级和农田将全部清空且无法恢复！</span>
                        </p>
                        
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => setShowResetConfirm(false)}
                                className="flex-1 py-3 bg-gray-100 text-brand-brown rounded-2xl font-bold active:scale-95 transition-transform"
                            >
                                取消
                            </button>
                            <button 
                                onClick={performReset}
                                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-200 active:scale-95 transition-transform"
                            >
                                确认重置
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
      );
  }

  // --- Main Profile View ---
  return (
    <div className="bg-brand-bg min-h-screen animate-fade-in">
      {/* Top Graphic Area - Reduced height to h-44 */}
      <div className="relative h-44 bg-[#DCEAC8] overflow-hidden">
        {/* Decorative Mountains/Hills */}
        <div className="absolute bottom-0 w-full animate-slide-up delay-100">
            <svg viewBox="0 0 1440 320" className="w-full h-auto text-[#C5DFA5] fill-current">
                <path fillOpacity="1" d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
        </div>
        <div className="absolute bottom-[-20px] w-full animate-slide-up delay-200">
            <svg viewBox="0 0 1440 320" className="w-full h-auto text-brand-bg fill-current">
                 <path fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
        </div>
        
        {/* Header Title */}
        <div className="absolute top-8 w-full text-center">
             <h1 className="text-lg font-bold text-brand-brown">个人中心</h1>
        </div>
      </div>

      {/* Avatar Section - Adjusted margin to -mt-14 */}
      <div className="relative px-6 -mt-14 text-center z-10 animate-pop-in">
        <div className="relative inline-block group cursor-pointer" onClick={() => setView('edit')}>
            <div className="w-28 h-28 rounded-full p-1 bg-white shadow-lg transition-transform active:scale-95">
                <img src={user.avatar} alt="Profile" className="w-full h-full rounded-full object-cover bg-gray-200" />
            </div>
            <div className="absolute bottom-0 right-0 bg-brand-brown p-2 rounded-full border-4 border-white transition-transform group-hover:scale-110">
                <Edit2 size={14} className="text-white" />
            </div>
        </div>
        
        {/* Name & Designed Level Badge */}
        <div className="flex flex-col items-center mt-3">
            <h2 className="text-2xl font-extrabold text-brand-brown leading-tight">{user.name}</h2>
            
            {/* Rank Title */}
             <span className="text-brand-brownLight text-xs font-bold mt-1 mb-2 tracking-wide opacity-80">{levelTitle}</span>

            {/* Level Badge & XP Bar Container */}
            <div className="w-full max-w-[200px]">
                <div className="flex items-center justify-between mb-1 px-1">
                     {/* Badge */}
                    <div className="flex items-center gap-1 pl-1 pr-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-sm border border-orange-200">
                        <div className="bg-white/20 p-0.5 rounded-full">
                            <Crown size={8} className="text-white" fill="currentColor" />
                        </div>
                        <span className="text-white font-black text-[10px] italic tracking-wide text-shadow-sm">
                            Lv.{displayLevel}
                        </span>
                    </div>
                    {/* XP Text */}
                    <span className="text-[10px] font-bold text-brand-brownLight">
                        {progress.expInCurrentLevel}/{progress.expNeededForNextLevel} XP
                    </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-brand-green to-green-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progress.percentage}%` }}
                    ></div>
                </div>
            </div>
        </div>

        <p className="text-sm text-brand-brownLight mt-4 max-w-[200px] mx-auto line-clamp-2">{user.bio || '暂无介绍'}</p>
        
        {/* Stats */}
        <div className="flex justify-center gap-12 mt-6 mb-8 animate-slide-up delay-100">
            <div>
                <div className="text-brand-brown font-extrabold text-xl">{user.points}</div>
                <div className="text-brand-brownLight text-xs">总积分</div>
            </div>
             <div className="w-px bg-gray-300"></div>
            <div>
                <div className="text-brand-brown font-extrabold text-xl">{user.friends}</div>
                <div className="text-brand-brownLight text-xs">好友</div>
            </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="px-6 pb-24 space-y-4 animate-slide-up delay-200">
        
        <div className="bg-white rounded-3xl p-2 shadow-sm">
            <MenuItem 
                icon={BookOpen} 
                label="游戏图鉴" 
                color="text-blue-500" 
                bgColor="bg-blue-100" 
                onClick={() => setView('compendium')}
            />
            <div className="h-px bg-gray-50 mx-4"></div>
            <MenuItem 
                icon={Settings} 
                label="个人资料设置" 
                color="text-brand-orange" 
                bgColor="bg-brand-orangeLight" 
                onClick={() => setView('edit')}
            />
            <div className="h-px bg-gray-50 mx-4"></div>
            <MenuItem 
                icon={Lock} 
                label="账号与安全" 
                color="text-brand-greenDark" 
                bgColor="bg-brand-greenLight" 
                onClick={() => setView('security')}
            />
        </div>

        <button 
            onClick={handleLogoutClick}
            disabled={isLoggingOut}
            className="w-full bg-white rounded-3xl p-4 shadow-sm flex items-center gap-4 group active:scale-95 transition-transform disabled:opacity-70 disabled:pointer-events-none"
        >
            <div className={`w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500`}>
                {isLoggingOut ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
            </div>
            <span className="flex-1 text-left font-bold text-red-500">
                {isLoggingOut ? '正在退出...' : '退出登录'}
            </span>
        </button>

      </div>
    </div>
  );
};

const MenuItem = ({ icon: Icon, label, color, bgColor, onClick }: { icon: any, label: string, color: string, bgColor: string, onClick?: () => void }) => (
    <button onClick={onClick} className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 rounded-2xl transition-colors active:bg-gray-100">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${color}`}>
            <Icon size={20} />
        </div>
        <span className="flex-1 text-left font-bold text-brand-brown">{label}</span>
        <ChevronRight size={20} className="text-gray-300" />
    </button>
);

export default Profile;
