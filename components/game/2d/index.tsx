"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";
import GameScene from "./game/GameScene";
import Inventory from "./components/Inventory";
import StoreControlPanel from "./components/StoreControlPanel";
import { eventBus } from "./game/EventBus";
import useStore from "./store/useStore";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ShoppingCart, Zap, PackageOpen, Star, Move, Navigation, Activity } from "lucide-react";

export default function Supermarket2DSimulator() {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    const money = useStore((s) => s.money);
    const items = useStore((s) => s.inventory);
    const logs = useStore((s) => s.logs);
    const npcCount = useStore((s) => s.npcCount);

    useEffect(() => {
        // subscribe to events from phaser
        const offPickup = eventBus.on("pickup", (e) => {
            useStore.getState().addItem(e.item);
        });
        const offMoney = eventBus.on("money", (m: number) => useStore.getState().setMoney(m));
        const offLog = eventBus.on("log", (msg: string) => useStore.getState().pushLog(msg));
        const offNpc = eventBus.on("npc:changed", (count: number) => useStore.getState().setNpcCount(count));

        return () => {
            offPickup();
            offMoney();
            offLog();
            offNpc();
        };
    }, []);

    useEffect(() => {
        if (!mountRef.current) return;
        if (gameRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 1100,
            height: 700,
            parent: mountRef.current,
            backgroundColor: "#071029",
            physics: {
                default: "arcade",
                arcade: {
                    debug: false
                }
            },
            scene: [GameScene]
        };

        gameRef.current = new Phaser.Game(config);

        return () => {
            gameRef.current?.destroy(true);
            gameRef.current = null;
        };
    }, []);

    const checkout = () => {
        const total = items.reduce((s, it) => s + it.price, 0);
        if (total === 0) return;
        if (money < total) {
            alert("Insufficient funds for checkout!");
            return;
        }
        useStore.getState().setMoney(money - total);
        useStore.getState().clearInventory();
        eventBus.emit("log", `Successful transaction: $${total} for ${items.length} items`);
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="flex h-screen bg-[#0a0a0f] text-white p-6 gap-6 font-sans overflow-hidden">

                {/* Left Side: Game Canvas */}
                <div className="flex-1 flex flex-col gap-6">
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-600/40">
                                    <Zap className="text-white fill-white" size={30} />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                                        Mahalak <span className="text-blue-500">2D Engine</span>
                                    </h1>
                                    <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Phaser Powered Simulation</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Current Balance</span>
                                    <span className="text-2xl font-black text-blue-400">${money}</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative rounded-[2rem] overflow-hidden border-4 border-white/5 bg-slate-900 shadow-inner group">
                            <div ref={mountRef} className="w-full h-full flex items-center justify-center min-h-[500px]" />
                            <div className="absolute bottom-6 left-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex gap-4">
                                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-[9px] font-black tracking-widest uppercase flex items-center gap-2">
                                    <Move size={12} className="text-blue-400" /> WASD Move
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex-1 overflow-hidden flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={16} className="text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">System Logs</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scroll font-mono text-[11px] space-y-1 pr-4">
                            {logs.slice().reverse().map((l, idx) => (
                                <div key={idx} className="opacity-60 hover:opacity-100 transition-opacity border-l-2 border-blue-500/20 pl-3 py-1">
                                    {l}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Panels */}
                <div className="w-96 flex flex-col gap-6">
                    <div className="bg-slate-900/80 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                            <h2 className="text-xl font-black flex items-center gap-3 uppercase italic">
                                <ShoppingCart size={24} className="text-blue-500" />
                                Terminal
                            </h2>
                            <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                                <Star size={12} className="text-blue-400 fill-blue-400" />
                                <span className="text-[10px] font-black text-blue-400">{items.length} items</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <Inventory />
                        </div>

                        <button
                            onClick={checkout}
                            disabled={items.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-blue-600/30 disabled:opacity-20 disabled:grayscale mt-6 flex items-center justify-center gap-3"
                        >
                            Confirm Checkout <Zap size={16} className="fill-white" />
                        </button>
                    </div>

                    <StoreControlPanel />

                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Simulated NPCs</span>
                            <span className="text-blue-400">{npcCount} Active</span>
                        </div>
                    </div>
                </div>

                <style jsx global>{`
          .custom-scroll::-webkit-scrollbar { width: 4px; }
          .custom-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
          .canvas-container canvas { border-radius: 2rem; max-width: 100%; height: auto !important; }
        `}</style>
            </div>
        </DndProvider>
    );
}
