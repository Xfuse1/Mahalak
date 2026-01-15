"use client";

import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, BakeShadows, Loader, SoftShadows } from "@react-three/drei";
import { PlayerController } from "@/components/game/PlayerController";
import { ShelfUnit, Product3D, CashierCounter, Entrance, Wall } from "@/components/game/StoreComponents";
import * as THREE from "three";
import { ShoppingCart, Zap, PackageOpen, CheckCircle, Star, ArrowRight, Store } from "lucide-react";

/*
  LAYOUT BASED ON THE PROVIDED IMAGE:
  
  LEFT SIDE: Entrance
  LEFT-CENTER: 3 Rows of Shelves 
  RIGHT SIDE: 3 Cashier Counters with Queue Areas
  
  Walking aisles between shelves and from entrance to cashiers.
*/

// Shelf configuration matching the image (3 main shelf rows on the left side)
const SHELF_ROWS = [
    { id: 1, z: -10, label: "SNACKS & CANDY" },
    { id: 2, z: 0, label: "DAIRY & BAKERY" },
    { id: 3, z: 10, label: "DRINKS & MORE" },
];

// Cashier positions on the right side
const CASHIERS = [
    { id: 1, z: -10 },
    { id: 2, z: 0 },
    { id: 3, z: 10 },
];

// Product database organized by shelf
const PRODUCTS_DB = [
    // Shelf 1: Snacks
    { name: "Chips", price: 2.5, color: "#ffd700", type: "box", shelf: 1 },
    { name: "Chocolate", price: 1.8, color: "#8b4513", type: "box", shelf: 1 },
    { name: "Cookies", price: 3.5, color: "#d2691e", type: "box", shelf: 1 },
    { name: "Candy", price: 1.2, color: "#ff69b4", type: "box", shelf: 1 },
    { name: "Nuts", price: 5.0, color: "#deb887", type: "box", shelf: 1 },
    { name: "Popcorn", price: 2.0, color: "#fffacd", type: "box", shelf: 1 },

    // Shelf 2: Dairy & Bakery
    { name: "Milk", price: 3.5, color: "#ffffff", type: "cylinder", shelf: 2 },
    { name: "Cheese", price: 6.0, color: "#ffa500", type: "box", shelf: 2 },
    { name: "Yogurt", price: 2.0, color: "#ffb6c1", type: "cylinder", shelf: 2 },
    { name: "Butter", price: 4.5, color: "#fffdd0", type: "box", shelf: 2 },
    { name: "Bread", price: 2.5, color: "#f5deb3", type: "box", shelf: 2 },
    { name: "Croissant", price: 1.5, color: "#daa520", type: "box", shelf: 2 },

    // Shelf 3: Drinks
    { name: "Cola", price: 1.5, color: "#8b0000", type: "cylinder", shelf: 3 },
    { name: "Water", price: 0.8, color: "#00bfff", type: "cylinder", shelf: 3 },
    { name: "Juice", price: 3.0, color: "#ffa500", type: "cylinder", shelf: 3 },
    { name: "Energy", price: 2.5, color: "#32cd32", type: "cylinder", shelf: 3 },
    { name: "Tea", price: 2.0, color: "#daa520", type: "cylinder", shelf: 3 },
    { name: "Coffee", price: 8.0, color: "#4a2c2a", type: "cylinder", shelf: 3 },
];

export default function SupermarketSimulatorPage() {
    const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);
    const [xp, setXP] = useState(0);

    // Generate products with proper positions on shelves
    const products = React.useMemo(() => {
        const result: any[] = [];

        SHELF_ROWS.forEach((shelf) => {
            const shelfProducts = PRODUCTS_DB.filter(p => p.shelf === shelf.id);

            shelfProducts.forEach((item, idx) => {
                const side = idx < 3 ? 1 : -1; // Front or back of shelf
                const localIdx = idx % 3;

                const xPos = -15; // Shelf X position (left side of store)
                const yPos = [0.75, 1.55, 2.35, 3.15][Math.floor(idx / 6) % 4];
                const zPos = shelf.z + (localIdx - 1) * 1.5;
                const zOffset = side * 0.7;

                result.push({
                    id: `${shelf.id}-${idx}`,
                    name: item.name,
                    price: item.price,
                    color: item.color,
                    type: item.type,
                    position: [xPos, yPos, zPos + zOffset] as [number, number, number]
                });
            });
        });

        return result;
    }, []);

    const addToCart = (name: string, price: number) => {
        setCart((prev) => [...prev, { name, price }]);
        setXP(p => p + 25);
    };

    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="h-screen w-full bg-[#0a0a0f] text-white overflow-hidden relative font-sans">

            {/* 3D WORLD */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 12, 30], fov: 55 }}>
                    <SoftShadows size={25} samples={16} />

                    {/* Lighting */}
                    <Stars radius={100} depth={50} count={500} factor={3} saturation={0} fade speed={1} />
                    <ambientLight intensity={0.5} />

                    {/* Ceiling Lights Grid */}
                    {[-15, 0, 15].map((x) => (
                        [-10, 0, 10].map((z) => (
                            <pointLight
                                key={`${x}-${z}`}
                                position={[x, 8, z]}
                                intensity={0.8}
                                color="#ffffff"
                                distance={20}
                                castShadow
                            />
                        ))
                    ))}

                    {/* Main Floor */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[80, 60]} />
                        <meshStandardMaterial color="#1c1c24" roughness={0.2} metalness={0.6} />
                    </mesh>

                    {/* Floor Grid */}
                    <gridHelper args={[80, 40, 0x333344, 0x1a1a22]} position={[0, 0.01, 0]} />

                    {/* Perimeter Walls */}
                    <Wall position={[0, 5, -25]} args={[80, 10, 1]} />
                    <Wall position={[0, 5, 25]} args={[80, 10, 1]} />
                    <Wall position={[-35, 5, 0]} args={[1, 10, 50]} />
                    <Wall position={[35, 5, 0]} args={[1, 10, 50]} />

                    {/* Ceiling */}
                    <mesh position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[80, 60]} />
                        <meshStandardMaterial color="#0a0a10" />
                    </mesh>

                    {/* === LEFT SIDE: ENTRANCE === */}
                    <Entrance position={[-30, 0, 0]} />

                    {/* === LEFT-CENTER: 3 SHELF ROWS === */}
                    {SHELF_ROWS.map((shelf) => (
                        <ShelfUnit
                            key={shelf.id}
                            position={[-15, 0, shelf.z]}
                            label={shelf.label}
                            length={8}
                        />
                    ))}

                    {/* === RIGHT SIDE: 3 CASHIER COUNTERS === */}
                    {CASHIERS.map((cashier) => (
                        <CashierCounter
                            key={cashier.id}
                            position={[20, 0, cashier.z]}
                            number={cashier.id}
                        />
                    ))}

                    {/* Walking Aisle Floor Markers (White stripes) */}
                    {[-5, 5].map((x) => (
                        <mesh key={x} position={[x, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[0.3, 40]} />
                            <meshStandardMaterial color="#ffffff" opacity={0.15} transparent />
                        </mesh>
                    ))}

                    {/* Products on Shelves */}
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

            {/* UI OVERLAY */}
            <div className="absolute inset-0 pointer-events-none flex flex-col p-6 z-10">

                {/* Header */}
                <div className="flex justify-between items-start">
                    {/* Store Info */}
                    <div className="bg-black/70 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40">
                                <Store className="text-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black italic tracking-tight uppercase">
                                    Mahalak <span className="text-blue-500">Mart</span>
                                </h1>
                                <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase">3D Shopping Simulator</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-yellow-400 fill-yellow-400" />
                                <span className="font-black">{xp} <span className="text-[9px] text-slate-500 uppercase tracking-widest">XP</span></span>
                            </div>
                            <div className="h-5 w-px bg-white/20" />
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-4">
                                <span>WASD: Walk</span>
                                <span>Mouse: Look</span>
                                <span>Click: Buy</span>
                            </div>
                        </div>
                    </div>

                    {/* Shopping Cart */}
                    <div className="bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl w-80 pointer-events-auto">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                            <h2 className="text-xl font-black flex items-center gap-3 uppercase">
                                <ShoppingCart size={24} className="text-blue-500" />
                                Cart
                            </h2>
                            <div className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-black shadow-lg">
                                ${totalPrice.toFixed(2)}
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2 mb-6 custom-scroll">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 opacity-30">
                                    <PackageOpen size={64} className="mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em]">Empty Cart</p>
                                </div>
                            ) : (
                                cart.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-all animate-in slide-in-from-right-4">
                                        <span className="text-sm font-bold uppercase">{item.name}</span>
                                        <span className="text-slate-400 font-mono text-xs">${item.price.toFixed(2)}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => setShowCheckout(true)}
                            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/30 disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-2"
                            disabled={cart.length === 0}
                        >
                            Checkout <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Bottom Guide */}
                <div className="mt-auto flex justify-center">
                    <div className="bg-black/60 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white/10 text-[9px] font-bold tracking-widest uppercase text-slate-500">
                        Walk to shelves • Click products to add • Go to cashier to checkout
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckout && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center pointer-events-auto p-8">
                    <div className="bg-zinc-900 border border-white/10 p-16 rounded-[3rem] max-w-xl w-full text-center shadow-2xl animate-in zoom-in-95">
                        <div className="w-24 h-24 bg-green-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/30">
                            <CheckCircle className="text-white w-12 h-12" />
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tight uppercase">Order Complete!</h2>
                        <p className="text-slate-400 mb-10 text-lg">
                            {cart.length} items for <span className="text-white font-bold">${totalPrice.toFixed(2)}</span>
                        </p>
                        <button
                            onClick={() => { setCart([]); setShowCheckout(false); }}
                            className="bg-blue-600 text-white hover:bg-blue-500 px-16 py-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl active:scale-95"
                        >
                            Continue Shopping
                        </button>
                    </div>
                </div>
            )}

            {/* Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_12px_white]" />
            </div>

            <style jsx global>{`
                .custom-scroll::-webkit-scrollbar { width: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
            `}</style>
        </div>
    );
}
