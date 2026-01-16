"use client";

import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
    PointerLockControls,
    Sky,
    ContactShadows,
    Environment,
    PerspectiveCamera,
    Text,
    Html,
    Box,
    Cylinder
} from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingCart, LogOut, Package, Zap } from 'lucide-react';

// --- Constants ---
const TILE_SIZE = 4;
const SHELF_WIDTH = 12;
const SHELF_HEIGHT = 4;
const SHELF_DEPTH = 1.2;
const AISLE_WIDTH = 5;

// --- Product Data with Brand Colors ---
const PRODUCTS = [
    { name: 'Cereal Box', color: '#ffcc00', price: 15 }, // Yellow Cereal
    { name: 'Red Cereal', color: '#cc0000', price: 18 }, // Red Cereal
    { name: 'Blue Pack', color: '#0066cc', price: 12 },  // Blue Pack
    { name: 'Green Goods', color: '#009900', price: 20 }, // Green Goods
    { name: 'Canned Food', color: '#7f8c8d', price: 5 },  // Grey Can
    { name: 'Juice', color: '#f39c12', price: 10 },       // Orange Juice
];

// --- Sub-components ---

function CeilingLight({ position }: any) {
    return (
        <group position={position}>
            {/* Light Frame */}
            <mesh position={[0, -0.05, 0]}>
                <boxGeometry args={[4, 0.1, 1.2]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={5} />
            </mesh>
            <pointLight position={[0, -0.5, 0]} intensity={10} distance={15} color="#ffffff" castShadow shadow-mapSize={[512, 512]} />
        </group>
    );
}

function Product({ position, data, onPick }: any) {
    const [hovered, setHovered] = useState(false);

    return (
        <group
            position={position}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onClick={() => onPick(data)}
        >
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.35, 0.5, 0.3]} />
                <meshStandardMaterial color={data.color} roughness={0.3} metalness={0.1} />
            </mesh>
            {/* Mock label text on front */}
            <mesh position={[0, 0, 0.155]}>
                <planeGeometry args={[0.25, 0.4]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
            {hovered && (
                <Html distanceFactor={3} position={[0, 0.6, 0]}>
                    <div className="bg-white text-black p-2 rounded shadow-xl text-[10px] whitespace-nowrap border-2 border-blue-500 font-bold">
                        <div className="text-blue-600">{data.name}</div>
                        <div className="text-emerald-600">${data.price}</div>
                    </div>
                </Html>
            )}
        </group>
    );
}

function Shelf({ position, rotation = [0, 0, 0] }: any) {
    // More detailed shelf structure
    const levels = 5;
    const productsOnShelf = useMemo(() => {
        const items = [];
        for (let level = 0; level < levels; level++) {
            for (let x = -SHELF_WIDTH / 2 + 0.6; x <= SHELF_WIDTH / 2 - 0.6; x += 0.5) {
                const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
                items.push({
                    pos: [x, level * 0.75 - 1.5, 0.3],
                    data: p
                });
            }
        }
        return items;
    }, []);

    return (
        <group position={position} rotation={rotation}>
            {/* Back board */}
            <mesh receiveShadow castShadow position={[0, 0, -SHELF_DEPTH / 2]}>
                <boxGeometry args={[SHELF_WIDTH, SHELF_HEIGHT, 0.1]} />
                <meshStandardMaterial color="#e2e8f0" />
            </mesh>

            {/* Support Pillars */}
            {[-SHELF_WIDTH / 2, SHELF_WIDTH / 2].map(x => (
                <mesh key={x} position={[x, 0, 0]} castShadow>
                    <boxGeometry args={[0.2, SHELF_HEIGHT, SHELF_DEPTH]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
            ))}

            {/* Shelving planks */}
            {Array.from({ length: levels }).map((_, i) => (
                <mesh key={i} position={[0, i * 0.75 - 1.8, 0]} receiveShadow castShadow>
                    <boxGeometry args={[SHELF_WIDTH, 0.05, SHELF_DEPTH]} />
                    <meshStandardMaterial color="#f8fafc" />
                </mesh>
            ))}

            {/* Products */}
            {productsOnShelf.map((item, i) => (
                <Product
                    key={i}
                    position={item.pos}
                    data={item.data}
                    onPick={(d: any) => window.dispatchEvent(new CustomEvent('PICK_ITEM', { detail: d }))}
                />
            ))}
        </group>
    );
}

function PlayerCart() {
    const group = useRef<THREE.Group>(null);

    // Follow camera slightly with some lag or just fixed in view
    useFrame((state) => {
        if (group.current) {
            // Position it nicely in the lower right of the view
            group.current.position.set(0.6, -0.6, -1.2);
            group.current.rotation.set(0, -Math.PI / 6, 0);
        }
    });

    return (
        <group ref={group}>
            {/* Red Plastic Basket */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.8, 0.5, 1]} />
                <meshStandardMaterial color="#cc0000" roughness={0.2} />
            </mesh>
            {/* Inside hollow feel */}
            <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[0.75, 0.45, 0.95]} />
                <meshStandardMaterial color="#880000" />
            </mesh>
            {/* Wheels/Base */}
            <mesh position={[0, -0.3, 0]}>
                <boxGeometry args={[0.7, 0.1, 0.9]} />
                <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Handle */}
            <mesh position={[0, 0.35, -0.45]} rotation={[0.4, 0, 0]}>
                <boxGeometry args={[0.7, 0.05, 0.05]} />
                <meshStandardMaterial color="#475569" />
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
        const speed = 8;
        // Movement logic
        direction.current.set(
            Number(moveState.current.right) - Number(moveState.current.left),
            0,
            Number(moveState.current.backward) - Number(moveState.current.forward)
        ).normalize();

        if (moveState.current.forward || moveState.current.backward) velocity.current.z -= direction.current.z * speed * delta;
        if (moveState.current.left || moveState.current.right) velocity.current.x -= direction.current.x * speed * delta;

        camera.translateX(-velocity.current.x);
        camera.translateZ(-velocity.current.z);

        // Constraints
        camera.position.y = 1.65; // Human eye level
        camera.position.x = Math.max(-12, Math.min(12, camera.position.x));
        camera.position.z = Math.max(-12, Math.min(12, camera.position.z));

        velocity.current.multiplyScalar(0.85); // Friction
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

    return (
        <group>
            <PlayerCart />
        </group>
    );
}

// --- Main Scene ---

export default function Store3D() {
    const [cart, setCart] = useState<any[]>([]);
    const [money, setMoney] = useState(1000);

    React.useEffect(() => {
        const handler = (e: any) => {
            const item = e.detail;
            setCart(prev => [...prev, item]);
            setMoney(prev => prev - item.price);
        };
        window.addEventListener('PICK_ITEM', handler);
        return () => window.removeEventListener('PICK_ITEM', handler);
    }, []);

    const floorTexture = useMemo(() => createTileTexture(), []);

    return (
        <div className="w-full h-screen bg-white relative font-sans overflow-hidden">
            {/* Premium UI */}
            <div className="absolute top-8 left-8 z-20 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <ShoppingCart size={24} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                            Mahalak <span className="text-blue-600">Pro 3D</span>
                        </h1>
                    </div>
                    <div className="flex gap-10">
                        <div>
                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Total Balance</div>
                            <div className="text-3xl font-black text-emerald-500 font-mono">${money}</div>
                        </div>
                        <div className="w-[2px] bg-slate-100" />
                        <div>
                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Cart Size</div>
                            <div className="text-3xl font-black text-blue-600 font-mono">{cart.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-8 z-20 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-200 text-[10px] font-black tracking-widest text-slate-500 uppercase flex gap-4">
                    <span>WASD الحركه</span>
                    <span>Mouse الرؤية</span>
                    <span className="text-blue-600 underline">Tap to Pick Items</span>
                </div>
            </div>

            {/* Aim dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full ring-4 ring-blue-100 shadow-xl" />
            </div>

            <Canvas shadows onCreated={(state) => {
                state.gl.setClearColor('#ffffff');
                state.gl.outputColorSpace = THREE.SRGBColorSpace;
            }}>
                <PerspectiveCamera makeDefault fov={70} position={[0, 1.65, 8]} />
                <PointerLockControls />

                {/* Lights - Bright Supermarket Style */}
                <ambientLight intensity={0.4} />
                <CeilingLight position={[0, 4.9, 5]} />
                <CeilingLight position={[0, 4.9, 0]} />
                <CeilingLight position={[0, 4.9, -5]} />
                <CeilingLight position={[0, 4.9, -10]} />

                {/* Floor - Clean White Tiles */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                    <planeGeometry args={[100, 100]} />
                    <meshStandardMaterial map={floorTexture || undefined} roughness={0.1} />
                </mesh>

                {/* Shelves Layout - The "Aisle" Feel from the photo */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`left-${z}`} position={[-3.5, 2.05, z]} />
                ))}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`right-${z}`} position={[3.5, 2.05, z]} rotation={[0, Math.PI, 0]} />
                ))}

                {/* Distant wall to look like a store background */}
                <mesh position={[0, 2.5, -15]} receiveShadow>
                    <boxGeometry args={[40, 5, 0.5]} />
                    <meshStandardMaterial color="#f1f5f9" />
                </mesh>

                {/* Fill the background with more "shelves" at the end of the aisle */}
                <Shelf position={[0, 2.05, -14.5]} rotation={[0, 0, 0]} />

                <Player />

                <ContactShadows position={[0, 0.01, 0]} opacity={0.25} scale={40} blur={2} far={4.5} />
            </Canvas>
        </div>
    );
}

// Tile Floor Texture
function createTileTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1024, 1024);

        // Tiles
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        const tileSize = 64;
        for (let x = 0; x <= 1024; x += tileSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(1024, x); ctx.stroke();
        }

        // Subtle detail
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2;
        for (let x = 0; x <= 1024; x += tileSize * 4) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(1024, x); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(25, 25);
    return tex;
}
