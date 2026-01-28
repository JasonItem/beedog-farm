
import React, { useState } from 'react';
import { InventoryItem, ITEMS, ItemDef } from '../types.ts';
import { Backpack, X, Zap } from 'lucide-react';
import { playSound } from '../utils/sound';

interface BagProps {
    inventory: InventoryItem[];
    onUse: (itemId: string) => void;
}

const Inventory: React.FC<BagProps> = ({ inventory, onUse }) => {
    const [selectedItem, setSelectedItem] = useState<{ def: ItemDef, count: number } | null>(null);

    const handleItemClick = (item: ItemDef, count: number) => {
        playSound('pop');
        setSelectedItem({ def: item, count });
    };

    const handleEat = () => {
        if (selectedItem) {
            onUse(selectedItem.def.id);
            setSelectedItem(null); // Close modal after eating
        }
    };

    return (
        <div className="bg-brand-bg min-h-screen pb-32 animate-fade-in relative">
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
                            <div 
                                key={inv.itemId} 
                                onClick={() => handleItemClick(item, inv.count)}
                                className="bg-white p-4 rounded-3xl shadow-sm flex flex-col gap-3 group border border-gray-100 active:scale-95 transition-transform cursor-pointer"
                            >
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

            {/* Item Detail & Eat Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-pop-in relative" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => { playSound('cancel'); setSelectedItem(null); }} 
                            className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 active:scale-90"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center mb-4">
                             <div className={`w-24 h-24 rounded-3xl ${selectedItem.def.color.replace('text-', 'bg-')}/20 flex items-center justify-center mb-4`}>
                                <img src={selectedItem.def.imageUrl} className="w-16 h-16 object-contain drop-shadow-md scale-125" />
                             </div>
                             <h2 className="text-2xl font-black text-brand-brown">{selectedItem.def.name}</h2>
                             <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-bold">{selectedItem.def.type === 'resource' ? '材料' : selectedItem.def.type === 'crop' ? '农作物' : '种子'}</span>
                                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">售价 ${selectedItem.def.sellPrice}</span>
                             </div>
                        </div>

                        <p className="text-sm text-brand-brownLight text-center font-bold bg-gray-50 p-3 rounded-xl mb-6 leading-relaxed">
                            {selectedItem.def.description}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            {/* Eat Button */}
                            {selectedItem.def.energyRegen && selectedItem.def.energyRegen > 0 ? (
                                <button 
                                    onClick={handleEat}
                                    className="w-full py-3.5 bg-green-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
                                >
                                    <Zap size={20} className="fill-white" />
                                    <span>食用 (体力 +{selectedItem.def.energyRegen})</span>
                                </button>
                            ) : (
                                <div className="text-center text-xs text-gray-400 font-bold py-2">
                                    该物品不可食用
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
