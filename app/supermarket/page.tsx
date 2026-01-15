"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stars, BakeShadows, Loader, SoftShadows, PointerLockControls } from "@react-three/drei";
import { PlayerController } from "@/components/game/PlayerController";
import { Shelf, Product3D, Wall } from "@/components/game/StoreComponents";
import * as THREE from "three";
import { ShoppingCart, Zap, PackageOpen, CheckCircle, Info, Move, Star, Navigation } from "lucide-react";

// --- Realistic Supermarket Layout Configuration ---
const STORE_LAYOUT = {
    length: 50,
    width: 40,
    aisleX: [-12, -4, 4, 12], // X-positions of the 4 main aisles
    backZ: -18,
    frontZ: 15,
};

const CATEGORIES = [
    // Main Aisles (Middle of store)
    { id: "DAIRY", name: "Dairy & Eggs", pos: [STORE_LAYOUT.aisleX[0], 0, 0], rot: [0, 0, 0], width: 10 },
    { id: "SNACKS", name: "Snacks & Candy", pos: [STORE_LAYOUT.aisleX[1], 0, 0], rot: [0, 0, 0], width: 10 },
    { id: "DRINKS", name: "Soft Drinks", pos: [STORE_LAYOUT.aisleX[2], 0, 0], rot: [0, 0, 0], width: 10 },
    { id: "BAKERY", name: "Fresh Bakery", pos: [STORE_LAYOUT.aisleX[3], 0, 0], rot: [0, 0, 0], width: 10 },

    // Back Perimeter
    { id: "MEAT", name: "Fresh Meat", pos: [-10, 0, STORE_LAYOUT.backZ], rot: [0, 0, 0], width: 8 },
    { id: "ELECTRONICS", name: "Electronics", pos: [0, 0, STORE_LAYOUT.backZ], rot: [0, 0, 0], width: 8 },
    { id: "CLEANING", name: "House Cleaning", pos: [10, 0, STORE_LAYOUT.backZ], rot: [0, 0, 0], width: 8 },

    // Side Walls
    { id: "PETS", name: "Pet Shop", pos: [-18, 0, 0], rot: [0, Math.PI / 2, 0], width: 15 },
    { id: "PERSONAL", name: "Personal Care", pos: [18, 0, 0], rot: [0, -Math.PI / 2, 0], width: 15 },
];

const ITEMS_DB = [
    { name: "Milk", price: 4.5, cat: "DAIRY", color: "#ffffff", type: "cylinder" },
    { name: "Large Eggs", price: 5.0, cat: "DAIRY", color: "#fefae0", type: "box" },
    { name: "Yogurt", price: 1.5, cat: "DAIRY", color: "#ffccd5", type: "cylinder" },
    { name: "Butter", price: 3.2, cat: "DAIRY", color: "#fffeb3", type: "box" },

    { name: "Potato Chips", price: 2.5, cat: "SNACKS", color: "#ffcc33", type: "box" },
    { name: "Chocolate", price: 1.8, cat: "SNACKS", color: "#7f5539", type: "box" },
    { name: "Cookies", price: 4.0, cat: "SNACKS", color: "#ddb892", type: "box" },
    { name: "Fruit Gums", price: 2.0, cat: "SNACKS", color: "#ff006e", type: "box" },

    { name: "Cola 1.5L", price: 1.9, cat: "DRINKS", color: "#cc0000", type: "cylinder" },
    { name: "Still Water", price: 0.8, cat: "DRINKS", color: "#00b4d8", type: "cylinder" },
    { name: "Orange Juice", price: 3.5, cat: "DRINKS", color: "#fb8500", type: "cylinder" },
    { name: "Energy Drink", price: 2.5, cat: "DRINKS", color: "#aacc00", type: "cylinder" },

    { name: "Sliced Bread", price: 1.5, cat: "BAKERY", color: "#ede0d4", type: "box" },
    { name: "Donut Box", price: 6.0, cat: "BAKERY", color: "#ffafcc", type: "box" },
    { name: "Baguette", price: 1.2, cat: "BAKERY", color: "#d4a373", type: "box" },
    { name: "Croissant", price: 1.0, cat: "BAKERY", color: "#e6ccb2", type: "box" },

    { name: "Premium Steak", price: 35.0, cat: "MEAT", color: "#9d0208", type: "box" },
    { name: "Chicken Wing", price: 12.0, cat: "MEAT", color: "#f48c06", type: "box" },
    { name: "Salmon Fillet", price: 28.0, cat: "MEAT", color: "#ffb4a2", type: "box" },

    { name: "Smartphone", price: 799.0, cat: "ELECTRONICS", color: "#111111", type: "box" },
    { name: "Wireless Buds", price: 150.0, cat: "ELECTRONICS", color: "#ffffff", type: "box" },
    { name: "USB-C Cable", price: 15.0, cat: "ELECTRONICS", color: "#3a86ff", type: "cylinder" },

    { name: "Dog Food", price: 45.0, cat: "PETS", color: "#8338ec", type: "box" },
    { name: "Cat Litter", price: 18.0, cat: "PETS", color: "#fb5607", type: "box" },
    { name: "Bird Seed", price: 12.0, cat: "PETS", color: "#ffbe0b", type: "box" },

    { name: "Shampoo", price: 9.0, cat: "PERSONAL", color: "#ff006e", type: "cylinder" },
    { name: "Toothpaste", price: 3.5, cat: "PERSONAL", color: "#3a86ff", type: "box" },
    { name: "Hand Soap", price: 2.0, cat: "PERSONAL", color: "#fb8500", type: "cylinder" },

    { name: "Bleach", price: 4.5, cat: "CLEANING", color: "#ffffff", type: "cylinder" },
    { name: "Glass Spray", price: 6.0, cat: "CLEANING", color: "#00b4d8", type: "cylinder" },
    { name: "Laundry Pods", price: 18.0, cat: "CLEANING", color: "#3a86ff", type: "box" },
];

export default function SupermarketSimulatorPage() {
    const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);
    const [xp, setXP] = useState(0);

    // Realistic placement calculation
    const products = React.useMemo(() => {
        const result: any[] = [];
        CATEGORIES.forEach((cat) => {
            const catItems = ITEMS_DB.filter(i => i.cat === cat.id);
            catItems.forEach((item, idx) => {
                const layer = idx % 4; // 4 shelves
                const subIdx = Math.floor(idx / 4);

                // Position relative to shelf center
                const offsetX = (subIdx % 5) * 1.2 - 2.5;
                const offsetY = [0.95, 1.95, 2.95, 3.95][layer];
                const offsetZ = 0.45; // Front of shelf

                // Apply Shelf rotation
                const posVector = new THREE.Vector3(offsetX, offsetY, offsetZ);
                posVector.applyEuler(new THREE.Euler(0, cat.rot[1], 0));

                result.push({
                    id: `${cat.id}-${idx}`,
                    name: item.name,
                    price: item.price,
                    color: item.color,
                    type: item.type,
                    position: [cat.pos[0] + posVector.x, posVector.y, cat.pos[2] + posVector.z] as [number, number, number]
                });
            });
        });
        return result;
    }, []);

    const addToCart = (name: string, price: number) => {
        setCart((prev) => [...prev, { name, price }]);
        setXP(p => p + 50);
    };

    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="h-screen w-full bg-[#0a0a0c] text-white overflow-hidden relative font-sans">

            {/* --- 3D ENVIRONMENT --- */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 8, 25], fov: 60 }}>
                    <SoftShadows size={20} samples={16} />

                    {/* Realistic Lighting System */}
                    <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
                    <ambientLight intensity={0.4} />

                    {/* Row of ceiling lights for real store effect */}
                    {[-10, 0, 10].map((x) => (
                        [-15, 0, 15].map((z) => (
                            <pointLight key={`${x}-${z}`} position={[x, 10, z]} intensity={1} color="#ffffff" distance={30} castShadow shadow-mapSize={1024} />
                        ))
                    ))}

                    {/* Floor: Polished Concrete with Grid */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[100, 100]} />
                        <meshStandardMaterial color="#1a1c20" roughness={0.1} metalness={0.7} />
                        <gridHelper args={[100, 40, 0x333333, 0x151515]} rotation={[-Math.PI / 2, 0, 0]} />
                    </mesh>

                    {/* Perimeter Walls (The Building) */}
                    <Wall position={[0, 6, -25]} args={[50, 12, 1]} /> {/* Back */}
                    <Wall position={[0, 6, 25]} args={[50, 12, 1]} />  {/* Front */}
                    <Wall position={[-25, 6, 0]} args={[1, 12, 50]} /> {/* Left */}
                    <Wall position={[25, 6, 0]} args={[1, 12, 50]} />  {/* Right */}

                    {/* Dark Acoustic Ceiling */}
                    <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[100, 100]} />
                        <meshStandardMaterial color="#050505" />
                    </mesh>

                    {/* AISLE LAYOUT - The Streets */}
                    {CATEGORIES.map((cat) => (
                        <Shelf
                            key={cat.id}
                            position={cat.pos as any}
                            rotation={cat.rot as any}
                            label={cat.name}
                            width={cat.width}
                        />
                    ))}

                    {/* PRODUCTS */}
                    <Suspense fallback={null}>
                        {products.map((prod) => (
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

            {/* --- PREMIUM UI --- */}
            <div className="absolute inset-0 pointer-events-none flex flex-col p-8 z-10">

                {/* Header Section */}
                <div className="flex justify-between items-start">
                    <div className="bg-white/5 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in slide-in-from-top-4 duration-700">
                        <div className="flex items-center gap-6 mb-6">
                            <div className="w-14 h-14 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-600/40">
                                <Zap className="text-white fill-white" size={32} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-[1000] italic tracking-tight uppercase leading-none">
                                    Mahalak <span className="text-indigo-500">Retail</span>
                                </h1>
                                <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Simulation Engine v3.0</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-3">
                                <Star size={20} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-xl font-black">{xp} <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Points</span></span>
                            </div>
                            <div className="h-8 w-px bg-white/10" />
                            <div className="flex gap-4">
                                <span className="flex items-center gap-2 text-[10px] font-black tracking-widest text-indigo-400"><Move size={14} /> WASD</span>
                                <span className="flex items-center gap-2 text-[10px] font-black tracking-widest text-indigo-400"><Navigation size={14} /> MOUSE</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/10 shadow-2xl w-96 pointer-events-auto">
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                            <h2 className="text-2xl font-black flex items-center gap-4 uppercase italic">
                                <ShoppingCart size={28} className="text-indigo-500" />
                                My Cart
                            </h2>
                            <div className="bg-indigo-600 text-white px-5 py-2 rounded-2xl text-sm font-black shadow-xl">
                                ${totalPrice.toFixed(2)}
                            </div>
                        </div>

                        <div className="max-h-[25rem] overflow-y-auto pr-2 custom-scroll space-y-3 mb-8">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                    <PackageOpen size={80} className="mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em]">Basket Is Empty</p>
                                </div>
                            ) : (
                                cart.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group animate-in slide-in-from-right-4">
                                        <span className="text-sm font-black uppercase tracking-tight group-hover:text-indigo-400">{item.name}</span>
                                        <span className="text-slate-500 font-mono text-[10px] font-black underline underline-offset-4 decoration-indigo-500/50">${item.price.toFixed(2)}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => setShowCheckout(true)}
                            className="w-full bg-white text-black hover:bg-indigo-50 active:scale-95 transition-all py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-indigo-600/10 disabled:grayscale disabled:opacity-30"
                            disabled={cart.length === 0}
                        >
                            Finalize Order
                        </button>
                    </div>
                </div>

                {/* Bottom Guide */}
                <div className="mt-auto flex justify-center">
                    <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-[10px] font-black tracking-widest uppercase text-slate-400">
                        Click on 3D elements to interact • ESC to free mouse
                    </div>
                </div>
            </div>

            {/* --- CHECKOUT OVERLAY --- */}
            {showCheckout && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-50 flex items-center justify-center pointer-events-auto p-12">
                    <div className="bg-zinc-900 border border-white/10 p-20 rounded-[4rem] max-w-2xl w-full text-center shadow-2xl animate-in zoom-in-95">
                        <div className="w-28 h-28 bg-green-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-green-500/30 rotate-12">
                            <CheckCircle className="text-white w-14 h-14" />
                        </div>
                        <h2 className="text-6xl font-[1000] mb-6 tracking-tighter italic uppercase">Payment Confirmed</h2>
                        <p className="text-slate-400 mb-14 text-2xl font-medium leading-relaxed max-w-sm mx-auto">
                            Logistic protocols activated. Your {cart.length} items are preparing for dispatch.
                        </p>
                        <button
                            onClick={() => {
                                setCart([]);
                                setShowCheckout(false);
                            }}
                            className="bg-indigo-600 text-white hover:bg-indigo-500 px-20 py-8 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] transition-all shadow-2xl active:scale-95"
                        >
                            Back To Market
                        </button>
                    </div>
                </div>
            )}

            {/* --- CROSSHAIR --- */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_15px_white]" />
            </div>

            <style jsx global>{`
                .custom-scroll::-webkit-scrollbar { width: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 10px; }
            `}</style>
        </div>
    );
}
