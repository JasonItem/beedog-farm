
import React from 'react';
import { User } from '../types';
import { Axe, Scissors, Fish, Map } from 'lucide-react';

interface DiscoverProps {
    user: User;
    onAction: (action: 'chop' | 'weed' | 'fish') => void;
}

const Discover: React.FC<DiscoverProps> = ({ user, onAction }) => {
  return (
    <div className="min-h-screen bg-[#F0F4E8] pb-32 animate-fade-in">
        {/* Header */}
        <div className="p-6 pt-12 pb-2 bg-white sticky top-0 z-20 shadow-sm rounded-b-3xl">
            <h1 className="text-3xl font-extrabold text-brand-brown flex items-center gap-3">
                <Map size={32} className="text-brand-green" /> 
                野外探索
            </h1>
            <p className="text-brand-brownLight text-sm mt-1 font-bold">消耗体力收集资源</p>
            <div className="mt-2 text-xs font-bold bg-gray-100 inline-block px-2 py-1 rounded text-gray-500">
                剩余体力: {user.energy}
            </div>
        </div>

        <div className="p-6 grid gap-6">
            
            {/* Forest Card */}
            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl group">
                <div className="absolute right-[-20px] top-[-20px] opacity-20 rotate-12"><Axe size={120} /></div>
                <h2 className="text-2xl font-black mb-1 relative z-10">幽静森林</h2>
                <p className="text-green-100 text-sm mb-6 relative z-10">砍伐树木获取木材，可能会掉落种子。</p>
                
                <button 
                    onClick={() => onAction('chop')}
                    className="relative z-10 bg-white text-green-800 font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                    <Axe size={20} /> 砍树 (消耗10体力)
                </button>
            </div>

            {/* Grassland Card */}
            <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
                 <div className="absolute right-[-20px] top-[-20px] opacity-20 rotate-12"><Scissors size={120} /></div>
                <h2 className="text-2xl font-black mb-1 relative z-10">茂盛草原</h2>
                <p className="text-orange-100 text-sm mb-6 relative z-10">清理杂草获得纤维，是制作的基础材料。</p>
                
                <button 
                    onClick={() => onAction('weed')}
                    className="relative z-10 bg-white text-orange-600 font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                    <Scissors size={20} /> 除草 (消耗5体力)
                </button>
            </div>

            {/* River Card */}
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
                 <div className="absolute right-[-20px] top-[-20px] opacity-20 rotate-12"><Fish size={120} /></div>
                <h2 className="text-2xl font-black mb-1 relative z-10">清澈溪流</h2>
                <p className="text-blue-100 text-sm mb-6 relative z-10">试试运气，也许能钓到稀有的大鱼！</p>
                
                <button 
                    onClick={() => onAction('fish')}
                    className="relative z-10 bg-white text-blue-600 font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                    <Fish size={20} /> 钓鱼 (消耗15体力)
                </button>
            </div>

        </div>
    </div>
  );
};

export default Discover;
