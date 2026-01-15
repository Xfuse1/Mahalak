"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stars, BakeShadows, Float, Loader } from "@react-three/drei";
import { PlayerController } from "@/components/game/PlayerController";
import { Shelf, Product3D } from "@/components/game/StoreComponents";
import { ShoppingCart, Zap, PackageOpen, CheckCircle } from "lucide-react";

// Initial Products Data
const STORE_PRODUCTS = [
    // Shelf 1 products
    { id: 1, name: "Organic Milk", price: 5.5, color: "#ffffff", position: [-1, 0.95, -4] as [number, number, number] },
    { id: 2, name: "Choco Bar", price: 2.0, color: "#8B4513", position: [0, 0.95, -4] as [number, number, number] },
    { id: 3, name: "Juice Box", price: 3.5, color: "#FFA500", position: [1, 0.95, -4] as [number, number, number] },

    { id: 4, name: "Cereal", price: 8.0, color: "#FFD700", position: [-1, 1.75, -4] as [number, number, number] },
    { id: 5, name: "Oats", price: 4.2, color: "#F5DEB3", position: [0, 1.75, -4] as [number, number, number] },
    { id: 6, name: "Soup Can", price: 1.5, color: "#FF4500", position: [1, 1.75, -4] as [number, number, number] },

    // Shelf 2 products
    { id: 7, name: "Shampoo", price: 12.0, color: "#00BFFF", position: [-1, 0.95, 4] as [number, number, number] },
    { id: 8, name: "Soap", price: 1.0, color: "#FF69B4", position: [0, 0.95, 4] as [number, number, number] },
];

export default function SupermarketSimulatorPage() {
    const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);

    const addToCart = (name: string, price: number) => {
        setCart((prev) => [...prev, { name, price }]);
        // Play sound if possible
        const audio = new Audio('/sounds/pop.mp3'); // Example (won't play if missing)
        audio.play().catch(() => { });
    };

    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="h-screen w-full bg-slate-950 text-white overflow-hidden relative selection:bg-indigo-500/30">

            {/* 3D Canvas */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 1.7, 5], fov: 60 }}>
                    {/* Environment */}
                    <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                    <pointLight position={[-10, 10, -10]} intensity={0.5} color="blue" />

                    {/* Floor */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                        <planeGeometry args={[100, 100]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.2} />
                        <gridHelper args={[100, 100, 0x444444, 0x222222]} rotation={[-Math.PI / 2, 0, 0]} />
                    </mesh>

                    {/* Walls to make it look indoor-ish */}
                    <mesh position={[0, 5, -10]} receiveShadow>
                        <planeGeometry args={[50, 20]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>

                    {/* Shelves */}
                    <Shelf position={[0, 0, -4]} /> {/* Front Shelf */}
                    <Shelf position={[0, 0, 4]} />  {/* Back Shelf */}
                    <Shelf position={[-5, 0, 0]} /> {/* Side Shelf (Visual) */}
                    <mesh position={[-5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <Shelf position={[0, 0, 0]} />
                    </mesh>

                    {/* Products */}
                    <Suspense fallback={null}>
                        {STORE_PRODUCTS.map((prod) => (
                            <Product3D
                                key={prod.id}
                                {...prod}
                                onAddToCart={addToCart}
                            />
                        ))}
                    </Suspense>

                    <BakeShadows />
                    <PlayerController />
                </Canvas>
                <Loader />
            </div>

            {/* UI Overlay */}
            <div className="absolute inset-x-0 top-0 p-6 flex justify-between items-start pointer-events-none z-10">
                <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-xl">
                    <h1 className="text-2xl font-bold font-mono tracking-tighter flex items-center gap-2">
                        <Zap className="text-yellow-400 fill-yellow-400" />
                        Mahalak<span className="text-indigo-400">3D</span>
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">Movement: WASD | Look: Mouse | Click to Buy</p>
                </div>

                {/* Cart Widget */}
                <div className="bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-xl w-64 pointer-events-auto">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                        <h2 className="font-bold flex items-center gap-2">
                            <ShoppingCart size={18} className="text-indigo-400" />
                            Cart
                        </h2>
                        <span className="text-green-400 font-mono font-bold">${totalPrice.toFixed(2)}</span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 mb-4 pr-1 scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-transparent">
                        {cart.length === 0 && <p className="text-slate-500 text-center text-sm py-4">Cart is empty</p>}
                        {cart.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm bg-white/5 p-2 rounded animate-in fade-in slide-in-from-right-4">
                                <span>{item.name}</span>
                                <span className="text-slate-400">${item.price}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 transition-colors py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={cart.length === 0}
                    >
                        Proceed to Checkout
                    </button>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckout && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto">
                    <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="text-green-500 w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Order Successful!</h2>
                        <p className="text-slate-400 mb-6">You've purchased {cart.length} items for <span className="text-white font-bold">${totalPrice.toFixed(2)}</span>. They will be shipped to your real address.</p>
                        <button
                            onClick={() => {
                                setCart([]);
                                setShowCheckout(false);
                            }}
                            className="bg-white text-black hover:bg-slate-200 px-6 py-2 rounded-full font-bold transition-all"
                        >
                            Keep Shopping
                        </button>
                    </div>
                </div>
            )}

            {/* Click Helper */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-50">
                <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            </div>

            <style jsx global>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 4px; }
      `}</style>
        </div>
    );
}
