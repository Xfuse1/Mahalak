"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stars, BakeShadows, Loader, SoftShadows, PointerLockControls } from "@react-three/drei";
import { PlayerController } from "@/components/game/PlayerController";
import { Shelf, Product3D, Wall } from "@/components/game/StoreComponents";
import { ShoppingCart, Zap, PackageOpen, CheckCircle, Info, Move, Star } from "lucide-react";

//systematic product generation
const categories = [
    { name: "DAIRY", shelfPos: [0, 0, -8], color: "#ffffff", type: 'box' },
    { name: "SNACKS", shelfPos: [5, 0, -8], color: "#ffcc00", type: 'box' },
    { name: "FRUITS", shelfPos: [-5, 0, -8], color: "#ff3300", type: 'fruit' },
    { name: "DRINKS", shelfPos: [0, 0, -3], color: "#00ccff", type: 'cylinder' },
    { name: "BAKERY", shelfPos: [5, 0, -3], color: "#ddaa66", type: 'box' },
    { name: "VEGETABLES", shelfPos: [-5, 0, -3], color: "#33bb33", type: 'fruit' },
    { name: "MEAT", shelfPos: [-5, 0, 2], color: "#cc4444", type: 'box' },
    { name: "ELECTRONICS", shelfPos: [0, 0, 2], color: "#444444", type: 'box' },
    { name: "HOUSEWARE", shelfPos: [5, 0, 2], color: "#88aacc", type: 'box' },
    { name: "PETS", shelfPos: [-5, 0, 7], color: "#996633", type: 'box' },
    { name: "PERSONAL CARE", shelfPos: [0, 0, 7], color: "#ff66aa", type: 'cylinder' },
    { name: "CLEANING", shelfPos: [5, 0, 7], color: "#33ffcc", type: 'cylinder' },
];

const itemsPerShelf = [
    { name: "Milk", price: 4.5, cat: "DAIRY" }, { name: "Cheese", price: 6.2, cat: "DAIRY" }, { name: "Yogurt", price: 2.1, cat: "DAIRY" }, { name: "Butter", price: 3.5, cat: "DAIRY" },
    { name: "Chips", price: 1.5, cat: "SNACKS" }, { name: "Choco", price: 2.0, cat: "SNACKS" }, { name: "Cookies", price: 3.5, cat: "SNACKS" }, { name: "Nuts", price: 5.0, cat: "SNACKS" },
    { name: "Apple", price: 0.8, cat: "FRUITS" }, { name: "Banana", price: 0.5, cat: "FRUITS" }, { name: "Orange", price: 1.0, cat: "FRUITS" }, { name: "Grapes", price: 3.0, cat: "FRUITS" },
    { name: "Cola", price: 1.5, cat: "DRINKS" }, { name: "Water", price: 0.5, cat: "DRINKS" }, { name: "Juice", price: 2.5, cat: "DRINKS" }, { name: "Coffee", price: 8.0, cat: "DRINKS" },
    { name: "Bread", price: 2.5, cat: "BAKERY" }, { name: "Cake", price: 15.0, cat: "BAKERY" }, { name: "Bun", price: 1.0, cat: "BAKERY" }, { name: "Donut", price: 1.2, cat: "BAKERY" },
    { name: "Tomato", price: 0.4, cat: "VEGETABLES" }, { name: "Carrot", price: 0.3, cat: "VEGETABLES" }, { name: "Onion", price: 0.5, cat: "VEGETABLES" }, { name: "Garlic", price: 0.2, cat: "VEGETABLES" },
    { name: "Steak", price: 25.0, cat: "MEAT" }, { name: "Chicken", price: 12.0, cat: "MEAT" }, { name: "Salmon", price: 18.0, cat: "MEAT" }, { name: "Burgers", price: 10.0, cat: "MEAT" },
    { name: "Phone", price: 699.0, cat: "ELECTRONICS" }, { name: "Mouse", price: 45.0, cat: "ELECTRONICS" }, { name: "Cable", price: 15.0, cat: "ELECTRONICS" }, { name: "Tablet", price: 350.0, cat: "ELECTRONICS" },
    { name: "Bowl", price: 5.0, cat: "HOUSEWARE" }, { name: "Plate", price: 4.0, cat: "HOUSEWARE" }, { name: "Knife", price: 12.0, cat: "HOUSEWARE" }, { name: "Pan", price: 35.0, cat: "HOUSEWARE" },
    { name: "Cat Food", price: 8.0, cat: "PETS" }, { name: "Dog Toy", price: 5.5, cat: "PETS" }, { name: "Bird Seed", price: 4.0, cat: "PETS" }, { name: "Fish Food", price: 3.0, cat: "PETS" },
    { name: "Shampoo", price: 12.0, cat: "PERSONAL CARE" }, { name: "Soap", price: 1.5, cat: "PERSONAL CARE" }, { name: "Lotion", price: 8.0, cat: "PERSONAL CARE" }, { name: "Perfume", price: 55.0, cat: "PERSONAL CARE" },
    { name: "Bleach", price: 3.0, cat: "CLEANING" }, { name: "Spray", price: 4.5, cat: "CLEANING" }, { name: "Sponge", price: 1.0, cat: "CLEANING" }, { name: "Mop", price: 15.0, cat: "CLEANING" },
];

const INITIAL_PRODUCTS = itemsPerShelf.map((item, index) => {
    const cat = categories.find(c => c.name === item.cat)!;
    // Spread items across 3 layers of the shelf
    const layer = index % 3; // 0, 1, 2
    const shelfIndex = Math.floor(index / 3);
    const xOffset = (shelfIndex % 3) * 0.8 - 0.8;
    const zOffset = cat.shelfPos[2];
    const yPos = [0.95, 1.75, 2.55][layer];

    return {
        id: index,
        name: item.name,
        price: item.price,
        color: cat.color,
        type: cat.type as any,
        position: [cat.shelfPos[0] + xOffset, yPos, zOffset] as [number, number, number]
    };
});

export default function SupermarketSimulatorPage() {
    const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);
    const [points, setPoints] = useState(100);

    const addToCart = (name: string, price: number) => {
        setCart((prev) => [...prev, { name, price }]);
        setPoints(prev => prev + 10);
    };

    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="h-screen w-full bg-black text-white overflow-hidden relative font-sans selection:bg-indigo-500/30">

            {/* 3D Engine */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 1.7, 15], fov: 60 }}>
                    <SoftShadows size={10} samples={10} />

                    {/* Atmospheric Lighting */}
                    <Sky sunPosition={[10, 10, 10]} turbidity={0.01} rayleigh={0.1} />
                    < Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

                    <ambientLight intensity={0.6} />

                    {/* Bright Main Lights */}
                    <pointLight position={[0, 8, 0]} intensity={2} distance={30} castShadow />
                    <pointLight position={[0, 8, -10]} intensity={1.5} distance={30} />
                    <pointLight position={[0, 8, 10]} intensity={1.5} distance={30} />

                    {/* Shelf Glow Lights */}
                    <rectAreaLight width={50} height={2} intensity={0.5} position={[0, 5, 0]} rotation={[-Math.PI / 2, 0, 0]} />

                    {/* Floor (Premium Reflective) */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[100, 100]} />
                        <meshStandardMaterial color="#050510" roughness={0.05} metalness={0.9} />
                        <gridHelper args={[100, 100, 0x1f478b, 0x111111]} rotation={[-Math.PI / 2, 0, 0]} />
                    </mesh>

                    {/* Building Walls */}
                    <Wall position={[0, 5, -20]} args={[40, 10, 1]} />
                    <Wall position={[0, 5, 20]} args={[40, 10, 1]} />
                    <Wall position={[-20, 5, 0]} args={[1, 10, 40]} />
                    <Wall position={[20, 5, 0]} args={[1, 10, 40]} />
                    <Wall position={[0, 10, 0]} args={[40, 1, 40]} />

                    {/* Aisle Shelves */}
                    {categories.map((cat, i) => (
                        <Shelf
                            key={i}
                            position={cat.shelfPos as any}
                            label={cat.name}
                            width={3.5}
                        />
                    ))}

                    {/* Interactive Products */}
                    <Suspense fallback={null}>
                        {INITIAL_PRODUCTS.map((prod) => (
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
            <div className="absolute inset-x-0 top-0 p-8 flex justify-between items-start pointer-events-none z-10">
                <div className="space-y-4">
                    <div className="bg-slate-900/80 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <Zap className="text-white fill-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black italic tracking-tighter leading-none uppercase">
                                    Mahalak <span className="text-indigo-500">3D</span>
                                </h1>
                                <p className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase mt-1">Simulated Shopping Experience</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-xs font-black">{points} XP</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black tracking-widest uppercase">
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center text-white">W</div> Walk</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center text-white">🖱️</div> Buy</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Intelligent Cart Widget */}
                <div className="bg-slate-900/90 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/10 shadow-2xl w-80 pointer-events-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black italic flex items-center gap-3 uppercase">
                            <ShoppingCart size={24} className="text-indigo-500" />
                            Cart
                        </h2>
                        <div className="bg-indigo-500 text-white px-4 py-1.5 rounded-2xl text-sm font-black italic shadow-lg shadow-indigo-500/20">
                            ${totalPrice.toFixed(2)}
                        </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-3 mb-8 pr-2 custom-scroll">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 opacity-20 group">
                                <PackageOpen size={64} className="mb-4 group-hover:scale-110 transition-transform" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Basket Empty</p>
                            </div>
                        ) : (
                            cart.map((item, i) => (
                                <div key={i} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all animate-in slide-in-from-right-4">
                                    <span className="text-sm font-black uppercase tracking-tight">{item.name}</span>
                                    <span className="text-indigo-400 font-mono text-xs font-bold">${item.price.toFixed(2)}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 transition-all py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-indigo-600/30 disabled:opacity-30 disabled:cursor-not-allowed group"
                        disabled={cart.length === 0}
                    >
                        Checkout <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
                    </button>
                </div>
            </div>

            {/* Victory Checkout Overlay */}
            {showCheckout && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center pointer-events-auto px-6">
                    <div className="bg-slate-900/50 border border-white/10 p-12 rounded-[3rem] max-w-xl w-full text-center shadow-2xl animate-in zoom-in-90 duration-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/5 -z-10" />
                        <div className="w-24 h-24 bg-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-indigo-500/40 rotate-12">
                            <CheckCircle className="text-white w-12 h-12" />
                        </div>
                        <h2 className="text-5xl font-black mb-6 tracking-tighter italic uppercase underline decoration-indigo-500/50 underline-offset-8">Payment Success</h2>
                        <p className="text-slate-400 mb-12 text-xl font-medium leading-relaxed max-w-sm mx-auto">
                            Transaction complete. You've earned <span className="text-white font-bold">{cart.length * 10} reward points</span>.
                        </p>
                        <button
                            onClick={() => {
                                setCart([]);
                                setShowCheckout(false);
                            }}
                            className="bg-white text-black hover:bg-slate-200 px-16 py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] transition-all shadow-2xl active:scale-95"
                        >
                            Back Home
                        </button>
                    </div>
                </div>
            )}

            {/* Tactical Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
                <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
                <div className="absolute inset-0 w-8 h-8 border border-white/10 rounded-full scale-150 animate-pulse" />
            </div>

            <style jsx global>{`
                .custom-scroll::-webkit-scrollbar { width: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
            `}</style>
        </div>
    );
}
