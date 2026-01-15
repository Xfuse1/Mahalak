"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stars, BakeShadows, Loader, SoftShadows, PointerLockControls } from "@react-three/drei";
import { PlayerController } from "@/components/game/PlayerController";
import { Shelf, Product3D, Wall } from "@/components/game/StoreComponents";
import { ShoppingCart, Zap, PackageOpen, CheckCircle, Info, Move } from "lucide-react";

// Expanded Products Data Categorized
const STORE_PRODUCTS = [
    // --- SECTION: DAIRY (Row -1) ---
    { id: 1, name: "Organic Milk", price: 5.5, color: "#ffffff", position: [-1.5, 0.9, -6] as [number, number, number] },
    { id: 2, name: "Greek Yogurt", price: 3.2, color: "#f0f0f0", position: [-0.5, 0.9, -6] as [number, number, number] },
    { id: 3, name: "Cheddar Cheese", price: 6.0, color: "#FFA500", position: [0.5, 0.9, -6] as [number, number, number] },
    { id: 4, name: "Butter", price: 4.5, color: "#FFFACD", position: [1.5, 0.9, -6] as [number, number, number] },

    // --- SECTION: SNACKS (Row 1) ---
    { id: 5, name: "Potato Chips", price: 2.5, color: "#FFD700", position: [-1.5, 1.7, -6] as [number, number, number] },
    { id: 6, name: "Choco Bar", price: 1.5, color: "#8B4513", position: [-0.5, 1.7, -6] as [number, number, number] },
    { id: 7, name: "Gummy Bears", price: 2.0, color: "#FF0000", position: [0.5, 1.7, -6] as [number, number, number] },
    { id: 8, name: "Pretzels", price: 3.0, color: "#DEB887", position: [1.5, 1.7, -6] as [number, number, number] },

    // --- SECTION: DRINKS (Row -2) ---
    { id: 9, name: "Soda Pop", price: 1.2, color: "#FF4500", position: [-1.5, 0.9, -2] as [number, number, number] },
    { id: 10, name: "Energy Drink", price: 3.0, color: "#ADFF2F", position: [-0.5, 0.9, -2] as [number, number, number] },
    { id: 11, name: "Mineral Water", price: 1.0, color: "#00BFFF", position: [0.5, 0.9, -2] as [number, number, number] },
    { id: 12, name: "Iced Tea", price: 2.5, color: "#D2691E", position: [1.5, 0.9, -2] as [number, number, number] },

    // --- SECTION: BAKERY (Row 2 on Shelf at +2) ---
    { id: 13, name: "Sliced Bread", price: 2.8, color: "#F5DEB3", position: [-1.5, 1.7, 2] as [number, number, number] },
    { id: 14, name: "Croissant", price: 1.8, color: "#DEB887", position: [-0.5, 1.7, 2] as [number, number, number] },
    { id: 15, name: "Muffin", price: 2.5, color: "#8B4513", position: [0.5, 1.7, 2] as [number, number, number] },
    { id: 16, name: "Baguette", price: 2.0, color: "#F4A460", position: [1.5, 1.7, 2] as [number, number, number] },

    // --- SECTION: ELECTRONICS (Shelf at +6) ---
    { id: 17, name: "Headphones", price: 45.0, color: "#111111", position: [-1.5, 0.9, 6] as [number, number, number] },
    { id: 18, name: "Gaming Mouse", price: 25.0, color: "#333333", position: [-0.5, 0.9, 6] as [number, number, number] },
    { id: 19, name: "USB Cable", price: 10.0, color: "#ffffff", position: [0.5, 0.9, 6] as [number, number, number] },
    { id: 20, name: "Power Bank", price: 30.0, color: "#444", position: [1.5, 0.9, 6] as [number, number, number] },
];

export default function SupermarketSimulatorPage() {
    const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);
    const [instructionsOpen, setInstructionsOpen] = useState(true);

    const addToCart = (name: string, price: number) => {
        setCart((prev) => [...prev, { name, price }]);
    };

    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="h-screen w-full bg-slate-950 text-white overflow-hidden relative selection:bg-indigo-500/30">

            {/* 3D Canvas */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 1.7, 12], fov: 65 }}>
                    <SoftShadows size={25} samples={10} />

                    {/* Environment */}
                    <Sky sunPosition={[10, 10, 10]} turbidity={0.01} rayleigh={0.1} />
                    < Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

                    <ambientLight intensity={0.4} />
                    <pointLight position={[0, 10, 0]} intensity={1.5} distance={30} castShadow shadow-mapSize={[2048, 2048]} />
                    <pointLight position={[10, 5, 10]} intensity={0.5} color="#44a" />
                    <pointLight position={[-10, 5, -10]} intensity={0.5} color="#a44" />

                    {/* Floor (Shiny) */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                        <planeGeometry args={[50, 50]} />
                        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.8} />
                        <gridHelper args={[50, 50, 0x333333, 0x111111]} rotation={[-Math.PI / 2, 0, 0]} />
                    </mesh>

                    {/* Perimeter Walls */}
                    <Wall position={[0, 5, -15]} args={[30, 10, 0.5]} /> {/* Back */}
                    <Wall position={[0, 5, 15]} args={[30, 10, 0.5]} />  {/* Front */}
                    <Wall position={[-15, 5, 0]} args={[0.5, 10, 30]} /> {/* Left */}
                    <Wall position={[15, 5, 0]} args={[0.5, 10, 30]} />  {/* Right */}

                    {/* Ceiling (Dark) */}
                    <Wall position={[0, 10, 0]} args={[30, 0.5, 30]} />

                    {/* AISLE LAYOUT */}
                    {/* Row 1: Dairy & Snacks */}
                    <Shelf position={[0, 0, -6]} label="Dairy & Snacks" />
                    <Shelf position={[5, 0, -6]} label="Frozen Goods" />
                    <Shelf position={[-5, 0, -6]} label="Fruits" />

                    {/* Row 2: Drinks */}
                    <Shelf position={[0, 0, -2]} label="Cold Drinks" />
                    <Shelf position={[5, 0, -2]} label="Wine & Beer" />
                    <Shelf position={[-5, 0, -2]} label="Vegetables" />

                    {/* Row 3: Bakery */}
                    <Shelf position={[0, 0, 2]} label="Fresh Bakery" />
                    <Shelf position={[5, 0, 2]} label="Candy Shop" />
                    <Shelf position={[-5, 0, 2]} label="Meat" />

                    {/* Row 4: Electronics */}
                    <Shelf position={[0, 0, 6]} label="Electronics" />
                    <Shelf position={[5, 0, 6]} label="Houseware" />
                    <Shelf position={[-5, 0, 6]} label="Pets" />

                    {/* Products placement (Auto-populated from STORE_PRODUCTS) */}
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
                <div className="space-y-4">
                    <div className="bg-black/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl">
                        <h1 className="text-3xl font-black font-mono tracking-tighter flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/40">
                                <Zap className="text-white fill-white" size={24} />
                            </div>
                            Mahalak<span className="text-indigo-400">Simulator</span>
                        </h1>
                        <div className="mt-3 flex gap-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-1"><Move size={14} className="text-indigo-500" /> Walk: WASD</span>
                            <span className="flex items-center gap-1"><Zap size={14} className="text-yellow-500" /> Click: Buy</span>
                        </div>
                    </div>

                    {instructionsOpen && (
                        <div className="bg-indigo-600/20 backdrop-blur-md p-4 rounded-xl border border-indigo-500/30 max-w-xs animate-in slide-in-from-left-4 duration-500 pointer-events-auto relative">
                            <button onClick={() => setInstructionsOpen(false)} className="absolute top-2 right-2 hover:text-white text-indigo-300">×</button>
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
                                <Info size={16} />
                                Shopping Hint
                            </h3>
                            <p className="text-xs text-indigo-100/70 leading-relaxed">
                                Explore the aisles! We have divided the store into sections like Dairy, Bakery, and Electronics. Click on any item to add it to your virtual cart.
                            </p>
                        </div>
                    )}
                </div>

                {/* Cart Widget */}
                <div className="bg-black/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl w-72 pointer-events-auto">
                    <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
                        <h2 className="text-lg font-black flex items-center gap-3 italic">
                            <ShoppingCart size={22} className="text-indigo-400" />
                            MY CART
                        </h2>
                        <div className="bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                            <span className="text-green-400 font-mono font-black text-sm">${totalPrice.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-transparent">
                        {cart.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 opacity-40">
                                <PackageOpen size={48} className="mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">Awaiting Items...</p>
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 transition-all hover:bg-white/10 group animate-in zoom-in-95">
                                <span className="text-sm font-bold group-hover:text-indigo-300 transition-colors uppercase tracking-tight">{item.name}</span>
                                <span className="text-slate-400 font-mono text-xs">${item.price.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:grayscale"
                        disabled={cart.length === 0}
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckout && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center pointer-events-auto px-4">
                    <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] max-w-lg w-full text-center shadow-[0_0_100px_rgba(99,102,241,0.2)] animate-in zoom-in-90 duration-300">
                        <div className="w-24 h-24 bg-green-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-12">
                            <CheckCircle className="text-green-500 w-12 h-12" />
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tighter italic">DELIVERY ON THE WAY!</h2>
                        <p className="text-slate-400 mb-10 text-lg leading-relaxed">
                            Excellent choices! You've picked <span className="text-white font-bold">{cart.length} premiums</span> for a total of <span className="text-green-400 font-mono font-black">${totalPrice.toFixed(2)}</span>.
                        </p>
                        <button
                            onClick={() => {
                                setCart([]);
                                setShowCheckout(false);
                            }}
                            className="bg-indigo-600 text-white hover:bg-indigo-500 px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20"
                        >
                            Back to Market
                        </button>
                    </div>
                </div>
            )}

            {/* Interaction Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
                <div className="w-10 h-10 flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full scale-150 shadow-[0_0_10px_rgba(255,255,255,1)]" />
                    <div className="absolute w-8 h-8 border border-white/20 rounded-full animate-ping opacity-20" />
                </div>
            </div>

            <style jsx global>{`
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 4px; }
            `}</style>
        </div>
    );
}
