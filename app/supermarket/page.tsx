"use client"

import dynamic from "next/dynamic"

const Store3D = dynamic(() => import("@/components/game/3d/Store3D"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex items-center justify-center bg-gray-100 text-lg">
            جاري تحميل السوبرماركت...
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
