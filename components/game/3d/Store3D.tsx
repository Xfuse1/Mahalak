"use client";

import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import {
    PointerLockControls,
    Sky,
    ContactShadows,
    Environment,
    PerspectiveCamera,
    Html,
    useTexture
} from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingCart, Zap, Box, Package } from 'lucide-react';

// --- Constants ---
const SHELF_WIDTH = 12;
const SHELF_HEIGHT = 4.2;
const SHELF_DEPTH = 1.0;
const AISLE_GAP = 6.5; // Space between aisles
const PRODUCT_COLS = 20;
const LEVELS = 5;

// --- Real Product Data ---
const PRODUCTS = [
    { name: 'Nestle Cereal', img: 'https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=200&h=300&fit=crop', price: 25 },
    { name: 'Fresh Milk', img: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&h=300&fit=crop', price: 15 },
    { name: 'Tuna Can', img: 'https://images.unsplash.com/photo-1625937329935-d7c003cdb87e?w=200&h=300&fit=crop', price: 30 },
    { name: 'Fruit Juice', img: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=200&h=300&fit=crop', price: 12 },
    { name: 'Pasta Pack', img: 'https://images.unsplash.com/photo-1551462147-fffb9036ef74?w=200&h=300&fit=crop', price: 10 },
    { name: 'Coffee Jar', img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=200&h=300&fit=crop', price: 45 },
    { name: 'Dish Soap', img: 'https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=200&h=300&fit=crop', price: 20 },
    { name: 'Olive Oil', img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&h=300&fit=crop', price: 60 },
    { name: 'Tomato Sauce', img: 'https://images.unsplash.com/photo-1587411768941-4057f2c5e4d8?w=200&h=300&fit=crop', price: 18 },
    { name: 'Chocolate', img: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=200&h=300&fit=crop', price: 35 }
];

// --- Sub-components ---

function CeilingLight({ position }: any) {
    return (
        <group position={position}>
            <mesh position={[0, -0.05, 0]}>
                <boxGeometry args={[5, 0.1, 1.5]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={6} />
            </mesh>
            <pointLight position={[0, -0.5, 0]} intensity={12} distance={20} color="#ffffff" castShadow />
        </group>
    );
}

function Product({ position, data, onPick }: any) {
    const [hovered, setHovered] = useState(false);
    const texture = useTexture(data.img);

    return (
        <group
            position={position}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onClick={() => onPick(data)}
        >
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.38, 0.6, 0.35]} />
                <meshStandardMaterial map={texture as THREE.Texture} roughness={0.4} metalness={0.15} />
            </mesh>
            {hovered && (
                <Html distanceFactor={3} position={[0, 0.5, 0]}>
                    <div className="bg-white/95 text-black p-3 rounded-2xl shadow-2xl text-[11px] whitespace-nowrap border-2 border-blue-500 font-bold animate-in zoom-in-50">
                        <div className="text-blue-600 mb-1">{data.name}</div>
                        <div className="text-emerald-600 text-lg font-black">${data.price}</div>
                    </div>
                </Html>
            )}
        </group>
    );
}

function Shelf({ position, rotation = [0, 0, 0] }: any) {
    const productsOnShelf = useMemo(() => {
        const items = [];
        for (let level = 0; level < LEVELS; level++) {
            for (let x = -SHELF_WIDTH / 2 + 0.6; x <= SHELF_WIDTH / 2 - 0.6; x += 0.55) {
                const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
                items.push({
                    pos: [x, level * 0.8 - 1.6, 0.32],
                    data: p
                });
            }
        }
        return items;
    }, []);

    return (
        <group position={position} rotation={rotation}>
            {/* Back Plate */}
            <mesh receiveShadow castShadow position={[0, 0, -SHELF_DEPTH / 2]}>
                <boxGeometry args={[SHELF_WIDTH, SHELF_HEIGHT, 0.1]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
            </mesh>

            {/* Structural Frame */}
            {[-SHELF_WIDTH / 2, SHELF_WIDTH / 2].map(x => (
                <mesh key={x} position={[x, 0, 0]} castShadow>
                    <boxGeometry args={[0.2, SHELF_HEIGHT + 0.2, SHELF_DEPTH + 0.05]} />
                    <meshStandardMaterial color="#64748b" />
                </mesh>
            ))}

            {/* Shelving Levels */}
            {Array.from({ length: LEVELS }).map((_, i) => (
                <group key={i} position={[0, i * 0.8 - 1.95, 0]}>
                    <mesh receiveShadow castShadow>
                        <boxGeometry args={[SHELF_WIDTH, 0.06, SHELF_DEPTH]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    {/* Price Tag rail */}
                    <mesh position={[0, -0.03, SHELF_DEPTH / 2 + 0.02]}>
                        <boxGeometry args={[SHELF_WIDTH, 0.1, 0.02]} />
                        <meshStandardMaterial color="#3b82f6" />
                    </mesh>
                </group>
            ))}

            {/* Products */}
            {productsOnShelf.map((item, i) => (
                <React.Suspense key={i} fallback={null}>
                    <Product
                        position={item.pos}
                        data={item.data}
                        onPick={(d: any) => window.dispatchEvent(new CustomEvent('PICK_ITEM', { detail: d }))}
                    />
                </React.Suspense>
            ))}
        </group>
    );
}

function PlayerCart() {
    const group = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (group.current) {
            group.current.position.set(0.7, -0.7, -1.35);
            group.current.rotation.set(0, -Math.PI / 5, 0);
        }
    });

    return (
        <group ref={group}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 0.6, 1.2]} />
                <meshStandardMaterial color="#ef4444" roughness={0.2} wireframe={false} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[0.95, 0.55, 1.15]} />
                <meshStandardMaterial color="#991b1b" />
            </mesh>
            <mesh position={[0, -0.35, 0]}>
                <boxGeometry args={[0.9, 0.1, 1.1]} />
                <meshStandardMaterial color="#1f2937" />
            </mesh>
        </group>
    );
}

function Player() {
    const { camera } = useThree();
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());
    const moveState = useRef({ forward: false, backward: false, left: false, right: false });

    useFrame((state, delta) => {
        const speed = 10;
        direction.current.set(
            Number(moveState.current.right) - Number(moveState.current.left),
            0,
            Number(moveState.current.backward) - Number(moveState.current.forward)
        ).normalize();

        if (moveState.current.forward || moveState.current.backward) velocity.current.z -= direction.current.z * speed * delta;
        if (moveState.current.left || moveState.current.right) velocity.current.x -= direction.current.x * speed * delta;

        camera.translateX(-velocity.current.x);
        camera.translateZ(-velocity.current.z);

        // Limits & Height
        camera.position.y = 1.68;
        camera.position.x = Math.max(-25, Math.min(25, camera.position.x));
        camera.position.z = Math.max(-25, Math.min(25, camera.position.z));

        velocity.current.multiplyScalar(0.85);
    });

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': moveState.current.forward = true; break;
                case 'KeyS': moveState.current.backward = true; break;
                case 'KeyA': moveState.current.left = true; break;
                case 'KeyD': moveState.current.right = true; break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': moveState.current.forward = false; break;
                case 'KeyS': moveState.current.backward = false; break;
                case 'KeyA': moveState.current.left = false; break;
                case 'KeyD': moveState.current.right = false; break;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    return <PlayerCart />;
}

// --- Main Engine ---

export default function Store3D() {
    const [cartCount, setCartCount] = useState(0);
    const [money, setMoney] = useState(2500);

    React.useEffect(() => {
        const handler = (e: any) => {
            const item = e.detail;
            setCartCount(c => c + 1);
            setMoney(m => m - item.price);
        };
        window.addEventListener('PICK_ITEM', handler);
        return () => window.removeEventListener('PICK_ITEM', handler);
    }, []);

    return (
        <div className="w-full h-screen bg-slate-50 relative font-sans overflow-hidden">
            {/* Immersive HUD */}
            <div className="absolute top-8 left-8 z-20 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-3xl p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <ShoppingCart size={28} className="text-white fill-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                                Mahalak <span className="text-blue-600">Sim High-Fi</span>
                            </h1>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-2">Next-Gen Shopping Experience</p>
                        </div>
                    </div>

                    <div className="flex gap-12 px-2">
                        <div>
                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Balance</div>
                            <div className="text-4xl font-black text-emerald-500 font-mono">${money}</div>
                        </div>
                        <div className="w-[1px] bg-slate-100" />
                        <div>
                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Items</div>
                            <div className="text-4xl font-black text-blue-600 font-mono">{cartCount}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 right-8 z-20 pointer-events-none">
                <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-500/20 text-white">
                    <div className="text-[10px] font-black tracking-[0.3em] uppercase opacity-60 mb-4">Nav Guide</div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm font-bold">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">W</div> Walk Forward
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">M</div> Mouse Look
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold text-emerald-300">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">C</div> Click Pick
                        </div>
                    </div>
                </div>
            </div>

            {/* Target Cursor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping opacity-75" />
                <div className="absolute top-0 left-0 w-2 h-2 bg-blue-600 rounded-full" />
            </div>

            <Canvas shadows dpr={[1, 2]}>
                <PerspectiveCamera makeDefault fov={70} position={[0, 1.68, 12]} />
                <PointerLockControls />

                <Environment preset="city" />
                <Sky sunPosition={[100, 40, 100]} />
                <ambientLight intensity={0.4} />

                {/* Lights along aisles */}
                {[-AISLE_GAP, 0, AISLE_GAP].map(x => (
                    <React.Fragment key={x}>
                        <CeilingLight position={[x, 5.5, 8]} />
                        <CeilingLight position={[x, 5.5, 0]} />
                        <CeilingLight position={[x, 5.5, -8]} />
                    </React.Fragment>
                ))}

                {/* Tiled Floor */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                    <planeGeometry args={[100, 100]} />
                    <TileMaterial />
                </mesh>

                {/* --- Dynamic Aisle Layout --- */}

                {/* Central Aisle */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <React.Fragment key={z}>
                        <Shelf position={[-3.25, 2.15, z]} />
                        <Shelf position={[3.25, 2.15, z]} rotation={[0, Math.PI, 0]} />
                    </React.Fragment>
                ))}

                {/* Left Aisle */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <React.Fragment key={z}>
                        <Shelf position={[-3.25 - AISLE_GAP, 2.15, z]} />
                        <Shelf position={[3.25 - AISLE_GAP, 2.15, z]} rotation={[0, Math.PI, 0]} />
                    </React.Fragment>
                ))}

                {/* Right Aisle */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <React.Fragment key={z}>
                        <Shelf position={[-3.25 + AISLE_GAP, 2.15, z]} />
                        <Shelf position={[3.25 + AISLE_GAP, 2.15, z]} rotation={[0, Math.PI, 0]} />
                    </React.Fragment>
                ))}

                {/* Outer boundaries / End caps */}
                <Shelf position={[0, 2.15, -15]} rotation={[0, Math.PI / 2, 0]} />
                <Shelf position={[AISLE_GAP, 2.15, -15]} rotation={[0, Math.PI / 2, 0]} />
                <Shelf position={[-AISLE_GAP, 2.15, -15]} rotation={[0, Math.PI / 2, 0]} />

                <Player />

                <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={60} blur={2.5} far={10} />
            </Canvas>
        </div>
    );
}

function TileMaterial() {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 512, 512);
            ctx.strokeStyle = '#f1f5f9';
            ctx.lineWidth = 1;
            const size = 64;
            for (let i = 0; i <= 512; i += size) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(20, 20);
        return tex;
    }, []);

    return <meshStandardMaterial map={texture} roughness={0.15} metalness={0.05} />;
}
