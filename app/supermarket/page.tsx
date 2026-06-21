"use client"

import dynamic from "next/dynamic"

const Store3D = dynamic(() => import("@/components/game/3d/Store3D"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lg text-gray-600">Loading... / جاري التحميل...</p>
            </div>
        </div>
    ),
})

export default function SupermarketPage() {
    return (
        <main className="relative w-full h-screen overflow-hidden">
            <Store3D />
        </main>
    );
}
