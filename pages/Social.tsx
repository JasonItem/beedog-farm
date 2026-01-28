
import React, { useState, useEffect } from 'react';
import { User, Friend } from '../types';
import { gameService } from '../services/game';
import { Users, UserPlus, Copy, Check, Search, Map, ExternalLink } from 'lucide-react';
import { playSound } from '../utils/sound';

interface SocialProps {
    currentUser: User;
    onVisit: (friendId: string, friendName: string) => void;
}

const Social: React.FC<SocialProps> = ({ currentUser, onVisit }) => {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchId, setSearchId] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        setIsLoading(true);
        try {
            const list = await gameService.getFriends(currentUser.id);
            setFriends(list);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(currentUser.id);
        setCopied(true);
        playSound('success');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddFriend = async () => {
        // 强力去空格：去除前后及中间的所有空白字符
        const cleanId = searchId.replace(/\s+/g, '');

        if (!cleanId) return;
        
        if (cleanId === currentUser.id) {
            setMessage({ type: 'error', text: '不能添加自己为好友哦' });
            return;
        }

        setIsAdding(true);
        setMessage(null);
        try {
            // 1. 验证用户是否存在
            const targetUser = await gameService.searchUser(cleanId);
            if (!targetUser) {
                throw new Error("找不到该用户 ID，请确认对方已登录过游戏");
            }
            // 2. 添加好友
            await gameService.addFriend(currentUser.id, targetUser.id);
            setMessage({ type: 'success', text: `成功！你们现在是双向好友了。` });
            playSound('success');
            setSearchId('');
            loadFriends(); // 刷新列表
        } catch (err: any) {
            playSound('error');
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="bg-brand-bg min-h-screen pb-32 animate-fade-in">
            {/* Header */}
            <div className="pt-12 px-6 pb-6 sticky top-0 bg-brand-bg z-10">
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-extrabold text-brand-brown flex items-center gap-3">
                        <Users size={32} className="text-brand-brown" /> 
                        好友社区
                    </h1>
                </div>
                <p className="text-brand-brownLight text-sm font-bold">互相串门，发现更多灵感</p>
            </div>

            <div className="px-6 space-y-6">
                
                {/* My ID Card */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-brand-green/10 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-brand-brownLight uppercase tracking-wider">我的邀请码 (ID)</span>
                        {copied ? 
                            <span className="flex items-center gap-1 text-xs font-bold text-green-500 animate-pop-in"><Check size={14}/> 已复制</span> : 
                            null
                        }
                    </div>
                    <button 
                        onClick={handleCopyId}
                        className="bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all p-3 rounded-xl flex items-center justify-between group border border-dashed border-gray-300"
                    >
                        <code className="text-sm font-mono font-bold text-brand-brown truncate max-w-[200px]">{currentUser.id}</code>
                        <Copy size={16} className="text-gray-400 group-hover:text-brand-brown transition-colors" />
                    </button>
                    <p className="text-[10px] text-gray-400">将 ID 分享给朋友，让他们添加你。</p>
                </div>

                {/* Add Friend Section */}
                <div className="bg-white p-5 rounded-3xl shadow-sm">
                    <h2 className="text-lg font-black text-brand-brown mb-4 flex items-center gap-2">
                        <UserPlus size={20} className="text-brand-orange" /> 添加新好友
                    </h2>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            placeholder="粘贴好友 ID..."
                            className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-orange/50 font-mono"
                        />
                        <button 
                            onClick={handleAddFriend}
                            disabled={isAdding || !searchId}
                            className="bg-brand-brown text-white px-4 rounded-xl font-bold active:scale-95 transition-transform disabled:opacity-50"
                        >
                            {isAdding ? '...' : <Search size={20} />}
                        </button>
                    </div>
                    {message && (
                        <div className={`mt-3 text-xs font-bold p-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                            {message.text}
                        </div>
                    )}
                </div>

                {/* Friends List */}
                <div>
                    <h2 className="text-lg font-black text-brand-brown mb-4 ml-1">我的好友 ({friends.length})</h2>
                    {isLoading ? (
                        <div className="text-center py-10 text-gray-400 text-sm font-bold">加载中...</div>
                    ) : friends.length > 0 ? (
                        <div className="grid gap-4">
                            {friends.map(friend => (
                                <div key={friend.friendId} className="bg-white p-4 rounded-3xl shadow-sm flex items-center gap-4 border border-gray-50 animate-slide-up">
                                    <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden shrink-0">
                                        <img src={friend.friendProfile.avatar} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-brand-brown truncate">{friend.friendProfile.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Lv.{friend.friendProfile.level}</span>
                                            <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{friend.friendProfile.bio || '暂无介绍'}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => onVisit(friend.friendId, friend.friendProfile.name)}
                                        className="bg-brand-greenLight text-brand-greenDark px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-transform shadow-sm hover:bg-brand-green hover:text-white"
                                    >
                                        <Map size={14} /> 拜访
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 opacity-50">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                                <Users size={32} />
                            </div>
                            <p className="text-sm font-bold text-gray-400">还没有好友，快去添加吧！</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Social;
