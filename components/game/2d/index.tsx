"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";
import GameScene from "./game/GameScene";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ShoppingCart, Zap, PackageOpen, Star, Move, Activity, User, Wallet, Users, Trash2 } from "lucide-react";

export default function Supermarket2DSimulator() {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    const [money, setMoney] = useState(100);
    const [cart, setCart] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [npcCount, setNpcCount] = useState(3);

    const addLog = (message: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [`[${time}] ${message}`, ...prev].slice(0, 50));
    };

    useEffect(() => {
        if (!mountRef.current) return;
        if (gameRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 1000,
            height: 600,
            parent: mountRef.current,
            backgroundColor: "#0f172a",
            physics: {
                default: "arcade",
                arcade: {
                    debug: false
                }
            },
            scene: [GameScene]
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        // Handle events from Phaser
        game.events.on('BUY_PRODUCT', (product: any) => {
            setCart(prev => [...prev, product]);
            setMoney(prev => prev - product.price);
            addLog(`✓ اشتريت ${product.name} بـ ${product.price} ج.م`);
        });

        addLog('🏪 مرحباً بك في السوبر ماركت!');

        return () => {
            game.destroy(true);
            gameRef.current = null;
        };
    }, []);

    const totalCart = cart.reduce((sum, item) => sum + item.price, 0);

    const clearCart = () => {
        setCart([]);
        addLog('🗑️ تم إفراغ العربة');
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="flex flex-col lg:flex-row h-screen bg-[#0a0a0f] text-white p-4 lg:p-6 gap-6 font-sans overflow-hidden">

                {/* Left Side: Game Canvas */}
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="bg-white/5 backdrop-blur-xl p-6 lg:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col h-full">
                        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                            <div className="flex items-center gap-4 lg:gap-6">
                                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600 rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-lg shadow-blue-600/40">
                                    <Zap className="text-white fill-white" size={24} />
                                </div>
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-black italic tracking-tighter uppercase leading-none">
                                        Mahalak <span className="text-blue-500">2D Sim</span>
                                    </h1>
                                    <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Phaser Powered Matrix</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5 flex flex-col items-end min-w-[120px]">
                                    <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Balance</span>
                                    <span className="text-xl font-black text-emerald-400">{money} ج.م</span>
                                </div>
                                <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5 flex flex-col items-end">
                                    <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">NPCs</span>
                                    <span className="text-xl font-black text-blue-400">{npcCount}</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative flex-1 rounded-[2rem] overflow-hidden border-4 border-white/5 bg-slate-900 shadow-inner group">
                            <div ref={mountRef} className="w-full h-full flex items-center justify-center" />
                            <div className="absolute bottom-6 left-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex gap-4">
                                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-[9px] font-black tracking-widest uppercase flex items-center gap-2">
                                    <Move size={12} className="text-blue-400" /> الحركة: WASD / Arrows
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Panels */}
                <div className="w-full lg:w-96 flex flex-col gap-6 overflow-hidden">
                    {/* Cart Panel */}
                    <div className="bg-slate-900/80 backdrop-blur-2xl p-6 lg:p-8 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col flex-1 overflow-hidden min-h-[400px]">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                            <h2 className="text-xl font-black flex items-center gap-3 uppercase italic">
                                <ShoppingCart size={24} className="text-blue-500" />
                                العربة ({cart.length})
                            </h2>
                            {cart.length > 0 && (
                                <button onClick={clearCart} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scroll pr-2 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-4">
                                    <PackageOpen size={48} />
                                    <div className="text-xs font-black uppercase tracking-widest">عربتك فارغة</div>
                                </div>
                            ) : (
                                cart.map((item, idx) => (
                                    <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/10 flex justify-between items-center animate-in fade-in slide-in-from-right-4">
                                        <div className="flex items-center gap-3">
                                            <img src={item.img} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="" />
                                            <div>
                                                <div className="text-xs font-bold text-white mb-1">{item.name}</div>
                                                <div className="text-[10px] text-emerald-400 font-black">{item.price} ج.م</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Amount</span>
                                <span className="text-2xl font-black text-emerald-400">{totalCart} ج.م</span>
                            </div>
                            <button
                                disabled={cart.length === 0}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all py-5 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-blue-600/30 disabled:opacity-20 flex items-center justify-center gap-3"
                            >
                                Confirm <Zap size={16} className="fill-white" />
                            </button>
                        </div>
                    </div>

                    {/* Event Log */}
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 h-48 flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={16} className="text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">سجل الأحداث</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scroll font-mono text-[11px] space-y-1">
                            {logs.map((l, idx) => (
                                <div key={idx} className="opacity-60 hover:opacity-100 transition-opacity border-l-2 border-blue-500/20 pl-3 py-1">
                                    {l}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Controls Mini Panel */}
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800 rounded-lg">
                                <Move size={14} className="text-slate-400" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">WASD الحركة</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800 rounded-lg">
                                <Users size={14} className="text-slate-400" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">العملاء النشطون</span>
                        </div>
                    </div>
                </div>

                <style jsx global>{`
          .custom-scroll::-webkit-scrollbar { width: 4px; }
          .custom-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
          canvas { border-radius: 2rem; max-width: 100%; height: auto !important; }
        `}</style>
            </div>
        </DndProvider>
    );
}
