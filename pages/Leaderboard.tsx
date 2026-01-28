
import React from 'react';
import { InventoryItem, ITEMS } from '../types.ts';
import { Backpack } from 'lucide-react';

interface BagProps {
    inventory: InventoryItem[];
}

const Leaderboard: React.FC<BagProps> = ({ inventory }) => {

    return (
        <div className="bg-brand-bg min-h-screen pb-32 animate-fade-in">
             <div className="pt-12 px-6 pb-6 sticky top-0 bg-brand-bg z-10">
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-extrabold text-brand-brown flex items-center gap-3">
                        <Backpack size={32} className="text-brand-brown" /> 
                        我的背包
                    </h1>
                </div>
                <p className="text-brand-brownLight text-sm font-bold">查看你收集的所有物品</p>
            </div>

            <div className="px-6 grid grid-cols-2 gap-4">
                {inventory.length > 0 ? (
                    inventory.map(inv => {
                        const item = ITEMS[inv.itemId];
                        if (!item) return null; // Safety check
                        return (
                            <div key={inv.itemId} className="bg-white p-4 rounded-3xl shadow-sm flex flex-col gap-3 group border border-gray-100">
                                <div className="flex justify-between items-start">
                                    <div className={`w-14 h-14 rounded-2xl ${item.color.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
                                         <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300" />
                                    </div>
                                    <div className="bg-gray-100 px-2 py-1 rounded-lg text-xs font-black text-brand-brown">
                                        x{inv.count}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-brand-brown">{item.name}</h3>
                                    <p className="text-[10px] text-brand-brownLight leading-tight mt-1 line-clamp-2 h-8 opacity-80">
                                        {item.description}
                                    </p>
                                </div>
                                <div className="mt-auto pt-2 border-t border-gray-50 flex justify-between items-center text-xs font-bold text-brand-brownLight">
                                    <span className="bg-gray-50 px-2 py-0.5 rounded text-[10px]">
                                        {item.type === 'resource' ? '材料' : item.type === 'crop' ? '农作物' : '种子'}
                                    </span>
                                    <span className="text-brand-orange text-xs">${item.sellPrice}</span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                     <div className="col-span-2 text-center py-20">
                        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Backpack size={40} />
                        </div>
                        <p className="text-brand-brownLight font-bold">背包是空的</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
