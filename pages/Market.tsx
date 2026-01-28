
import React, { useState } from 'react';
import { User, InventoryItem, ITEMS, getSeasonInfo } from '../types.ts';
import { Store, Coins, X, Plus, Minus, ShoppingBag, Calendar } from 'lucide-react';
import { playSound } from '../utils/sound';

interface MarketProps {
    user: User;
    inventory: InventoryItem[];
    onBuy: (itemId: string) => void;
    onSell: (itemId: string, amount: number) => void;
}

const Market: React.FC<MarketProps> = ({ user, inventory, onBuy, onSell }) => {
    // Mode state persists because App.tsx no longer remounts this component on prop change
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    
    // Modal State for Selling
    const [selectedSellItem, setSelectedSellItem] = useState<{ id: string, max: number, name: string, price: number, img: string } | null>(null);
    const [sellQuantity, setSellQuantity] = useState(1);

    // Calculate Season
    const seasonInfo = getSeasonInfo(user.day);

    // Filter Buyable items (Seeds) based on Season
    const buyableItems = Object.values(ITEMS).filter(item => {
        if (item.type !== 'seed') return false;
        // If seed has season property, check match
        if (item.seasons) {
            return item.seasons.includes(seasonInfo.season);
        }
        return false;
    });
    
    // Filter Sellable items (User has in inventory)
    const sellableItems = inventory
        .map(inv => ({ def: ITEMS[inv.itemId], count: inv.count }))
        .filter((item): item is { def: NonNullable<typeof item.def>; count: number } => !!item.def);

    const openSellModal = (item: typeof sellableItems[0]) => {
        playSound('pop');
        setSelectedSellItem({
            id: item.def.id,
            max: item.count,
            name: item.def.name,
            price: item.def.sellPrice,
            img: item.def.imageUrl
        });
        setSellQuantity(1);
    };

    const handleConfirmSell = () => {
        if (selectedSellItem) {
            onSell(selectedSellItem.id, sellQuantity);
            setSelectedSellItem(null); // Close modal
        }
    };

    const handleTabChange = (newMode: 'buy' | 'sell') => {
        if (mode !== newMode) {
            playSound('click');
            setMode(newMode);
        }
    };

    return (
        <div className="bg-[#FFF8E7] min-h-screen pb-32 animate-fade-in flex flex-col relative">
            <div className="pt-12 px-6 pb-6 bg-white rounded-b-[40px] shadow-sm z-10 sticky top-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold text-brand-brown flex items-center gap-2">
                        <Store size={32} className="text-brand-orange" /> 皮埃尔的商店
                    </h1>
                    <div className="bg-brand-orangeLight text-brand-orange px-4 py-2 rounded-full font-black flex items-center gap-2">
                        <Coins size={16} className="fill-current" />
                        {user.coins}
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4 px-2">
                     <div className="flex items-center gap-2 text-sm font-black text-brand-brownLight bg-gray-100 px-3 py-1.5 rounded-xl">
                         <Calendar size={16} />
                         <span>{seasonInfo.label}特供</span>
                     </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-full relative">
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white shadow-md rounded-full transition-all duration-300 ${mode === 'buy' ? 'left-1' : 'left-[calc(50%+4px)]'}`}></div>
                    <button onClick={() => handleTabChange('buy')} className={`flex-1 relative z-10 font-bold text-sm py-2.5 transition-colors ${mode === 'buy' ? 'text-brand-brown' : 'text-gray-400'}`}>
                        买种子
                    </button>
                    <button onClick={() => handleTabChange('sell')} className={`flex-1 relative z-10 font-bold text-sm py-2.5 transition-colors ${mode === 'sell' ? 'text-brand-brown' : 'text-gray-400'}`}>
                        卖货物
                    </button>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4 overflow-y-auto">
                {mode === 'buy' ? (
                    buyableItems.length > 0 ? (
                        buyableItems.map(item => (
                            <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl ${item.color.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
                                        <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-brand-brown">{item.name}</h3>
                                        <p className="text-[10px] text-brand-brownLight mb-1.5 line-clamp-1">{item.description}</p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-brand-orange flex items-center gap-1 bg-brand-orangeLight/50 px-2 py-1 rounded-md">
                                                <Coins size={12} className="fill-current"/> {item.price}
                                            </span>
                                            {item.growthDays && (
                                                <span className="text-[10px] font-bold text-brand-brownLight bg-gray-100 px-2 py-1 rounded-md">
                                                    ⏱️ {item.growthDays}天
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onBuy(item.id)}
                                    disabled={user.coins < item.price}
                                    className="bg-brand-brown text-white h-10 px-5 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform"
                                >
                                    购买
                                </button>
                            </div>
                        ))
                    ) : (
                         <div className="text-center py-20 text-brand-brownLight/50 font-bold">
                             这个季节没有可售的种子...<br/>(试试别的季节?)
                         </div>
                    )
                ) : (
                    sellableItems.length > 0 ? (
                        sellableItems.map((item) => (
                            <div key={item.def.id} className="bg-white p-4 rounded-3xl shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl ${item.def.color.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
                                        <img src={item.def.imageUrl} alt={item.def.name} className="w-10 h-10 object-contain drop-shadow-sm" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-brand-brown">{item.def.name}</h3>
                                        <p className="text-xs text-brand-brownLight mb-1">库存: {item.count}</p>
                                        <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md inline-block">
                                            <Coins size={12} className="fill-current"/> +{item.def.sellPrice}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => openSellModal(item)}
                                    className="bg-green-100 text-green-700 h-10 px-5 rounded-xl font-bold text-sm active:scale-95 transition-transform hover:bg-green-200"
                                >
                                    出售
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 text-brand-brownLight/50 font-bold flex flex-col items-center">
                            <ShoppingBag size={48} className="mb-2 opacity-20" />
                            背包空空如也<br/><span className="text-xs font-normal">快去种地或探索吧！</span>
                        </div>
                    )
                )}
            </div>

            {/* Sell Quantity Modal */}
            {selectedSellItem && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-pop-in relative">
                        <button 
                            onClick={() => { playSound('cancel'); setSelectedSellItem(null); }} 
                            className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 active:scale-90"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center mb-6">
                             <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-3">
                                <img src={selectedSellItem.img} className="w-12 h-12 object-contain" />
                             </div>
                             <h2 className="text-xl font-black text-brand-brown">出售 {selectedSellItem.name}</h2>
                             <p className="text-xs font-bold text-brand-brownLight">单价: ${selectedSellItem.price}</p>
                        </div>

                        {/* Quantity Selector */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-2 mb-6 border border-gray-100">
                             <button 
                                onClick={() => { playSound('pop'); setSellQuantity(Math.max(1, sellQuantity - 1)); }}
                                className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-brown active:scale-90 transition-transform"
                             >
                                 <Minus size={18} strokeWidth={3} />
                             </button>
                             
                             <div className="flex flex-col items-center w-20">
                                 <span className="text-xl font-black text-brand-brown">{sellQuantity}</span>
                                 <span className="text-[10px] font-bold text-brand-brownLight uppercase">数量</span>
                             </div>

                             <button 
                                onClick={() => { playSound('pop'); setSellQuantity(Math.min(selectedSellItem.max, sellQuantity + 1)); }}
                                className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-brown active:scale-90 transition-transform"
                             >
                                 <Plus size={18} strokeWidth={3} />
                             </button>
                        </div>

                        {/* Max Button Helper */}
                        <div className="flex justify-center mb-6">
                            <button onClick={() => { playSound('pop'); setSellQuantity(selectedSellItem.max); }} className="text-xs font-bold text-brand-orange bg-brand-orangeLight px-3 py-1 rounded-lg active:scale-95">
                                最大值 ({selectedSellItem.max})
                            </button>
                        </div>

                        <button 
                            onClick={handleConfirmSell}
                            className="w-full py-4 bg-brand-brown text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <span>确认出售</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-sm flex items-center gap-1">
                                <Coins size={12} className="fill-current" />
                                {selectedSellItem.price * sellQuantity}
                            </span>
                        </button>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Market;
