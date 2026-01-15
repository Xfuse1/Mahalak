"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Loader } from "lucide-react";

// Phaser tends to access window immediately, so we dynamic import with no SSR
const Supermarket2D = dynamic(() => import("@/components/game/2d"), {
    ssr: false,
    loading: () => (
        <div className="h-screen w-full bg-[#0a0a0f] flex flex-col items-center justify-center gap-6">
            <div className="w-20 h-20 border-t-4 border-blue-600 rounded-full animate-spin shadow-[0_0_30px_rgba(37,99,235,0.4)]" />
            <div className="flex flex-col items-center">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Initializing 2D Engine</h2>
                <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Connecting to Simulation Matrix</p>
            </div>
        </div>
    )
});

export default function SupermarketSimulatorPage() {
    return (
        <Suspense fallback={null}>
            <Supermarket2D />
        </Suspense>
    );
}
