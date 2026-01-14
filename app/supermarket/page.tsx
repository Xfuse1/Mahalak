"use client";

import React, { useEffect, useState } from "react";
import { Loader2, ShoppingCart, Zap, Heart } from "lucide-react";

export default function SupermarketSimulatorPage() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading or wait for Unity build files
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
            {/* Premium Header */}
            <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl fixed top-0 w-full z-50">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Zap className="text-white fill-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Mahalak <span className="text-indigo-400">Simulator</span></h1>
                        <p className="text-xs text-slate-400">Experience Shopping in 3D</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="bg-slate-800 px-4 py-2 rounded-full flex items-center gap-2 border border-slate-700">
                        <Heart className="text-rose-500 fill-rose-500" size={16} />
                        <span className="text-sm font-medium">Healthy Mode: ON</span>
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-500 transition-all px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30">
                        <ShoppingCart size={18} />
                        View Site Cart
                    </button>
                </div>
            </header>

            {/* Main Container */}
            <main className="pt-24 pb-8 px-4 flex flex-col items-center">
                <div className="relative w-full max-w-6xl aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-black group">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 transition-opacity duration-1000">
                            <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                            <p className="text-slate-400 animate-pulse uppercase tracking-[0.2em] text-xs font-bold">Initializing Universe...</p>
                        </div>
                    )}

                    {/* Unity WebGL Frame */}
                    <iframe
                        src="/unity/index.html"
                        className="w-full h-full border-none"
                        title="Supermarket Simulator"
                        allow="autoplay; fullscreen; keyboard"
                    />

                    {/* Controls Hint */}
                    <div className="absolute bottom-6 left-6 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="bg-black/80 backdrop-blur px-3 py-1.5 rounded-md border border-white/10 text-[10px] font-mono text-slate-300">
                            [WASD] MOVE
                        </div>
                        <div className="bg-black/80 backdrop-blur px-3 py-1.5 rounded-md border border-white/10 text-[10px] font-mono text-slate-300">
                            [E] GRAB ITEM
                        </div>
                        <div className="bg-black/80 backdrop-blur px-3 py-1.5 rounded-md border border-white/10 text-[10px] font-mono text-slate-300">
                            [TAB] OPEN CART
                        </div>
                    </div>
                </div>

                {/* Integration Info */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
                    <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 transition-colors">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <Zap className="text-yellow-400" size={18} /> Points Sync
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Your Healthy Points earned in-game are automatically synced to your Mahalak profile for real rewards.</p>
                    </div>
                    <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 transition-colors">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <ShoppingCart className="text-green-400" size={18} /> Live Checkout
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Ready items in your 3D cart can be purchased instantly using the connected API bridge.</p>
                    </div>
                    <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 transition-colors">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <Heart className="text-rose-400" size={18} /> Real-time Stock
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Every item you see on the shelf reflects the real inventory from our database.</p>
                    </div>
                </div>
            </main>

            <style jsx global>{`
        body {
          background-color: #020617;
        }
      `}</style>
        </div>
    );
}
