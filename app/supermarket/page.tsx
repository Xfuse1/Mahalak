"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stars, BakeShadows, Loader, SoftShadows, PointerLockControls } from "@react-three/drei";
import { PlayerController } from "@/components/game/PlayerController";
import { Shelf, Product3D, Wall } from "@/components/game/StoreComponents";
import * as THREE from "three";
import { ShoppingCart, Zap, PackageOpen, CheckCircle, Info, Move, Star } from "lucide-react";

// Systematic category and product mapping with a wide-spread layout
const CATEGORIES = [
    { name: "DAIRY", pos: [-12, 0, -12], color: "#ffffff", type: 'box', rot: [0, Math.PI / 4, 0] },
    { name: "SNACKS", pos: [0, 0, -14], color: "#ffcc00", type: 'box', rot: [0, 0, 0] },
    { name: "FRUITS", pos: [12, 0, -12], color: "#ff3300", type: 'fruit', rot: [0, -Math.PI / 4, 0] },

    { name: "DRINKS", pos: [-14, 0, 0], color: "#00ccff", type: 'cylinder', rot: [0, Math.PI / 2, 0] },
    { name: "ELECTRONICS", pos: [-5, 0, 0], color: "#444444", type: 'box', rot: [0, 0, 0] },
    { name: "HOUSEWARE", pos: [5, 0, 0], color: "#88aacc", type: 'box', rot: [0, 0, 0] },
    { name: "BAKERY", pos: [14, 0, 0], color: "#ddaa66", type: 'box', rot: [0, -Math.PI / 2, 0] },

    { name: "MEAT", pos: [-12, 0, 12], color: "#cc4444", type: 'box', rot: [0, 3 * Math.PI / 4, 0] },
    { name: "PERSONAL CARE", pos: [0, 0, 14], color: "#ff66aa", type: 'cylinder', rot: [0, Math.PI, 0] },
    { name: "CLEANING", pos: [12, 0, 12], color: "#33ffcc", type: 'cylinder', rot: [0, -3 * Math.PI / 4, 0] },

    { name: "VEGETABLES", pos: [-7, 0, -7], color: "#33bb33", type: 'fruit', rot: [0, Math.PI / 4, 0] },
    { name: "PETS", pos: [7, 0, 7], color: "#996633", type: 'box', rot: [0, -3 * Math.PI / 4, 0] },
];

const ITEMS = [
    { name: "Milk", price: 4.5, cat: "DAIRY" }, { name: "Cheese", price: 6.2, cat: "DAIRY" }, { name: "Yogurt", price: 2.1, cat: "DAIRY" }, { name: "Cream", price: 3.5, cat: "DAIRY" },
    { name: "Chips", price: 1.5, cat: "SNACKS" }, { name: "Choco", price: 2.0, cat: "SNACKS" }, { name: "Cookies", price: 3.5, cat: "SNACKS" }, { name: "Wafers", price: 5.0, cat: "SNACKS" },
    { name: "Apple", price: 0.8, cat: "FRUITS" }, { name: "Banana", price: 0.5, cat: "FRUITS" }, { name: "Orange", price: 1.0, cat: "FRUITS" }, { name: "Grapes", price: 3.0, cat: "FRUITS" },
    { name: "Cola", price: 1.5, cat: "DRINKS" }, { name: "Water", price: 0.5, cat: "DRINKS" }, { name: "Juice", price: 2.5, cat: "DRINKS" }, { name: "Tea", price: 8.0, cat: "DRINKS" },
    { name: "Bread", price: 2.5, cat: "BAKERY" }, { name: "Cake", price: 15.0, cat: "BAKERY" }, { name: "Muffin", price: 1.0, cat: "BAKERY" }, { name: "Donut", price: 1.2, cat: "BAKERY" },
    { name: "iPhone", price: 999.0, cat: "ELECTRONICS" }, { name: "Laptop", price: 1450.0, cat: "ELECTRONICS" }, { name: "Watch", price: 150.0, cat: "ELECTRONICS" }, { name: "PlayStation", price: 499.0, cat: "ELECTRONICS" },
    { name: "Spoon", price: 5.0, cat: "HOUSEWARE" }, { name: "Plate", price: 14.0, cat: "HOUSEWARE" }, { name: "Knife", price: 12.0, cat: "HOUSEWARE" }, { name: "Pot", price: 35.0, cat: "HOUSEWARE" },
    { name: "Burger", price: 25.0, cat: "MEAT" }, { name: "Steak", price: 112.0, cat: "MEAT" }, { name: "Salmon", price: 18.0, cat: "MEAT" }, { name: "Chicken", price: 10.0, cat: "MEAT" },
    { name: "Cat Food", price: 8.0, cat: "PETS" }, { name: "Dog Bone", price: 5.5, cat: "PETS" }, { name: "Collar", price: 4.0, cat: "PETS" }, { name: "Leash", price: 3.0, cat: "PETS" },
    { name: "Shower Gel", price: 12.0, cat: "PERSONAL CARE" }, { name: "Face wash", price: 11.5, cat: "PERSONAL CARE" }, { name: "Cream", price: 8.0, cat: "PERSONAL CARE" }, { name: "Perfume", price: 55.0, cat: "PERSONAL CARE" },
    { name: "Bleach", price: 3.0, cat: "CLEANING" }, { name: "Detergent", price: 14.5, cat: "CLEANING" }, { name: "Sponge", price: 1.0, cat: "CLEANING" }, { name: "Brush", price: 15.0, cat: "CLEANING" },
];

export default function SupermarketSimulatorPage() {
    const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);
    const [xp, setXP] = useState(100);

    // Generate final products inside component to avoid SSR/Build issues
    const finalProducts = React.useMemo(() => {
        return ITEMS.map((item, idx) => {
            const cat = CATEGORIES.find(c => c.name === item.cat)!;
            const layer = idx % 4; // 0, 1, 2, 3
            const subIdx = Math.floor(idx / 4);

            // Spread along the width of the shelf
            const xOffset = (subIdx % 4) * 1 - 1.5;
            const yPos = [1.2, 2.2, 3.2, 1.2][layer];

            // Calculate final position considering shelf rotation
            const originalPos = new THREE.Vector3(xOffset, yPos, 0);
            const rotation = new THREE.Euler(0, cat.rot[1], 0);
            originalPos.applyEuler(rotation);

            return {
                id: idx,
                name: item.name,
                price: item.price,
                color: cat.color,
                type: cat.type as any,
                position: [cat.pos[0] + originalPos.x, originalPos.y, cat.pos[2] + originalPos.z] as [number, number, number]
            };
        });
    }, []);

    const addToCart = (name: string, price: number) => {
        setCart((prev) => [...prev, { name, price }]);
        setXP(p => p + 25);
    };

    return (
        <div className="h-screen w-full bg-black text-white overflow-hidden relative font-sans">

            {/* 3D World */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 5, 25], fov: 60 }}>
                    <SoftShadows size={15} samples={15} />

                    {/* Lighting - Deep and Atmospheric */}
                    <Sky distance={450000} sunPosition={[0, -1, 0]} inclination={0} azimuth={0.25} turbidity={10} rayleigh={0.5} />
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1.5} />

                    <ambientLight intensity={0.2} />

                    {/* Main Area Flood Lights */}
                    <pointLight position={[0, 15, 0]} intensity={4} distance={60} castShadow />
                    <pointLight position={[-20, 10, -20]} intensity={1} color="#6366f1" />
                    <pointLight position={[20, 10, 20]} intensity={1} color="#f43f5e" />

                    {/* Floor (Infinite Grid Plate) */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                        <planeGeometry args={[100, 100]} />
                        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.95} />
                        <gridHelper args={[100, 50, 0x4f46e5, 0x0f172a]} rotation={[-Math.PI / 2, 0, 0]} />
                    </mesh>

                    {/* Outer Boundary Walls */}
                    <Wall position={[0, 5, -25]} args={[50, 10, 1]} />
                    <Wall position={[0, 5, 25]} args={[50, 10, 1]} />
                    <Wall position={[-25, 5, 0]} args={[1, 10, 50]} />
                    <Wall position={[25, 5, 0]} args={[1, 10, 50]} />
                    <Wall position={[0, 10, 0]} args={[50, 1, 50]} />

                    {/* Spatially Distributed Shelves */}
                    {CATEGORIES.map((cat, i) => (
                        <Shelf
                            key={i}
                            position={cat.pos as any}
                            rotation={cat.rot as any}
                            label={cat.name}
                            width={5}
                        />
                    ))}

                    {/* Distributed Products */}
                    <Suspense fallback={null}>
                        {finalProducts.map((prod) => (
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

            {/* Premium UI Overlay */}
            <div className="absolute inset-x-0 top-0 p-10 flex justify-between items-start pointer-events-none z-10 shrink-0">

                {/* Logo & Stats */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900/40 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-6 mb-6">
                            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                                <Zap className="text-white fill-white" size={32} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black italic tracking-tighter leading-none uppercase">
                                    MAHALAK<span className="text-indigo-500 text-5xl">3D</span>
                                </h1>
                                <p className="text-[10px] text-slate-400 font-black tracking-[0.5em] uppercase mt-2">Next-Gen Shopping Hub</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                                <Star size={18} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                                <span className="text-sm font-black tracking-tighter">{xp} POWER</span>
                            </div>
                            <div className="flex items-center gap-4 text-slate-500 text-[10px] font-black tracking-widest uppercase">
                                <span className="flex items-center gap-2"><div className="w-5 h-5 rounded-lg bg-indigo-500/10 flex items-center justify-center text-white text-[8px] border border-white/5">W</div> MOVE</span>
                                <span className="flex items-center gap-2"><div className="w-5 h-5 rounded-lg bg-indigo-500/10 flex items-center justify-center text-white text-[8px] border border-white/5">BUY</div> CLICK</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cart Control Center */}
                <div className="bg-slate-900/60 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/10 shadow-2xl w-96 pointer-events-auto">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                        <h2 className="text-2xl font-black italic flex items-center gap-4 uppercase tracking-tighter">
                            <ShoppingCart size={28} className="text-indigo-400" />
                            Market Basket
                        </h2>
                        <div className="bg-white text-black px-5 py-2 rounded-2xl text-sm font-black shadow-xl">
                            ${cart.reduce((s, i) => s + i.price, 0).toFixed(2)}
                        </div>
                    </div>

                    <div className="max-h-[30rem] overflow-y-auto pr-4 mb-8 custom-scroll space-y-4">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-10">
                                <PackageOpen size={96} className="mb-6" />
                                <p className="text-xs font-black uppercase tracking-[0.6em]">Scanning For Items</p>
                            </div>
                        ) : (
                            cart.map((item, i) => (
                                <div key={i} className="flex justify-between items-center bg-white/5 p-5 rounded-3xl border border-white/5 hover:border-indigo-500/30 transition-all group animate-in slide-in-from-right-8">
                                    <span className="text-sm font-black uppercase tracking-tight group-hover:text-indigo-400">{item.name}</span>
                                    <span className="text-slate-400 font-mono text-[10px] font-black tracking-wide">${item.price.toFixed(2)}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all py-6 rounded-3xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-indigo-600/40 disabled:opacity-20 flex items-center justify-center gap-4 group"
                        disabled={cart.length === 0}
                    >
                        INITIATE DELIVERY <Zap size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Checkout & Summary Overlay */}
            {showCheckout && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl z-50 flex items-center justify-center pointer-events-auto p-10">
                    <div className="bg-slate-900/30 border border-white/10 p-16 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl animate-in zoom-in-95 duration-500 relative">
                        <div className="w-32 h-32 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-[0_0_60px_rgba(79,70,229,0.4)] rotate-6">
                            <CheckCircle className="text-white w-16 h-16" />
                        </div>
                        <h2 className="text-6xl font-black mb-6 tracking-tight italic uppercase">Orders Locked!</h2>
                        <p className="text-slate-400 mb-14 text-2xl font-medium leading-relaxed max-w-md mx-auto">
                            Logistic protocols updated. Your {cart.length} premiums are now assigned to your profile coordinates.
                        </p>
                        <button
                            onClick={() => {
                                setCart([]);
                                setShowCheckout(false);
                            }}
                            className="bg-white text-black hover:bg-indigo-50 px-20 py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.5em] transition-all shadow-2xl active:scale-95"
                        >
                            Resume Ops
                        </button>
                    </div>
                </div>
            )}

            {/* Tactical Targeting UI */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
                <div className="w-0.5 h-0.5 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,1)]" />
                <div className="absolute inset-0 w-12 h-12 -translate-x-1/2 -translate-y-1/2 border border-white/5 rounded-full scale-150" />
            </div>

            <style jsx global>{`
                .custom-scroll::-webkit-scrollbar { width: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 4px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
}
