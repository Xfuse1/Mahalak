"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Loader } from "lucide-react";

// Use no SSR for the 3D scene to avoid hydration issues with Three.js
const Supermarket3D = dynamic(() => import("@/components/game/3d/Store3D"), {
    ssr: false,
    loading: () => (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-6">
            <div className="w-20 h-20 border-t-4 border-blue-600 rounded-full animate-spin shadow-[0_0_30px_rgba(37,99,235,0.4)]" />
            <div className="flex flex-col items-center">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Loading Immersive Store</h2>
                <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Initializing 3D Environment</p>
            </div>
        </div>
    )
});

export default function SupermarketSimulatorPage() {
    return (
        <div className="bg-black min-h-screen">
            <Suspense fallback={null}>
                <Supermarket3D />
            </Suspense>
        </div>
    );
}
