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
    Html
} from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const TILE_SIZE = 4;
const SHELF_WIDTH = 8;
const SHELF_HEIGHT = 2.5;
const SHELF_DEPTH = 0.8;

// --- Product Data ---
const PRODUCTS = [
    { name: 'Cereal Box', color: '#e74c3c', price: 15 },
    { name: 'Milk Carton', color: '#f8fafc', price: 12 },
    { name: 'Canned Tuna', color: '#94a3b8', price: 20 },
    { name: 'Pasta Box', color: '#f59e0b', price: 8 },
    { name: 'Juice Bottle', color: '#fbbf24', price: 10 },
    { name: 'Soap Liquid', color: '#38bdf8', price: 18 },
];

// --- Sub-components ---

function Product({ position, data, onPick }: any) {
    const [hovered, setHovered] = useState(false);

    return (
        <group
            position={position}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onClick={() => onPick(data)}
        >
            <mesh castShadow>
                <boxGeometry args={[0.3, 0.4, 0.25]} />
                <meshStandardMaterial color={data.color} />
            </mesh>
            {hovered && (
                <Html distanceFactor={2} position={[0, 0.5, 0]}>
                    <div className="bg-black/80 text-white p-2 rounded text-[10px] whitespace-nowrap border border-white/20">
                        <div className="font-bold">{data.name}</div>
                        <div className="text-emerald-400">${data.price}</div>
                    </div>
                </Html>
            )}
        </group>
    );
}

function Shelf({ position, rotation = [0, 0, 0] }: any) {
    const productsOnShelf = useMemo(() => {
        const items = [];
        for (let level = 0; level < 4; level++) {
            for (let x = -3.5; x <= 3.5; x += 0.6) {
                const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
                items.push({
                    pos: [x, level * 0.6 - 0.9, 0],
                    data: p
                });
            }
        }
        return items;
    }, []);

    return (
        <group position={position} rotation={rotation}>
            {/* Frame */}
            <mesh receiveShadow castShadow>
                <boxGeometry args={[SHELF_WIDTH, SHELF_HEIGHT, SHELF_DEPTH]} />
                <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Shelf Levels (Visual) */}
            {[0.3, -0.3, -0.9].map((y, i) => (
                <mesh key={i} position={[0, y, 0.4]} receiveShadow>
                    <boxGeometry args={[SHELF_WIDTH - 0.1, 0.05, 0.1]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
            ))}

            {/* Products on front side */}
            {productsOnShelf.map((item, i) => (
                <Product
                    key={i}
                    position={[item.pos[0], item.pos[1], 0.3]}
                    data={item.data}
                    onPick={(d: any) => window.dispatchEvent(new CustomEvent('PICK_ITEM', { detail: d }))}
                />
            ))}
        </group>
    );
}

function ShoppingCart() {
    // Simple representation of a red cart in foreground
    return (
        <group position={[0.4, -0.5, -1]} rotation={[0, -Math.PI / 8, 0]}>
            {/* Basket Frame */}
            <mesh castShadow>
                <boxGeometry args={[0.6, 0.4, 0.8]} />
                <meshStandardMaterial color="#ef4444" wireframe />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[0.58, 0.02, 0.78]} />
                <meshStandardMaterial color="#ef4444" opacity={0.5} transparent />
            </mesh>
            {/* Handle */}
            <mesh position={[0, 0.2, -0.4]} rotation={[Math.PI / 4, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.6]} />
                <meshStandardMaterial color="#334155" />
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
        const speed = 5;
        direction.current.set(
            Number(moveState.current.right) - Number(moveState.current.left),
            0,
            Number(moveState.current.backward) - Number(moveState.current.forward)
        ).normalize();

        if (moveState.current.forward || moveState.current.backward) velocity.current.z -= direction.current.z * speed * delta;
        if (moveState.current.left || moveState.current.right) velocity.current.x -= direction.current.x * speed * delta;

        camera.translateX(-velocity.current.x);
        camera.translateZ(-velocity.current.z);

        // Bounds
        camera.position.y = 1.7; // Fixed height
        camera.position.x = Math.max(-14, Math.min(14, camera.position.x));
        camera.position.z = Math.max(-14, Math.min(14, camera.position.z));

        velocity.current.multiplyScalar(0.9); // Friction
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
            <ShoppingCart />
        </group>
    );
}

// --- Main Scene Component ---

export default function Store3D() {
    const [cart, setCart] = useState<any[]>([]);
    const [money, setMoney] = useState(500);

    React.useEffect(() => {
        const handler = (e: any) => {
            const item = e.detail;
            setCart(prev => [...prev, item]);
            setMoney(prev => prev - item.price);
        };
        window.addEventListener('PICK_ITEM', handler);
        return () => window.removeEventListener('PICK_ITEM', handler);
    }, []);

    return (
        <div className="w-full h-screen bg-black relative font-sans overflow-hidden">
            {/* UI Overlay */}
            <div className="absolute top-8 left-8 z-10 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl">
                    <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">
                        Mahalak <span className="text-blue-500">3D Immersive</span>
                    </h1>
                    <div className="flex gap-6 mt-4">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Balance</div>
                            <div className="text-2xl font-black text-emerald-400">${money}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Cart Items</div>
                            <div className="text-2xl font-black text-blue-400">{cart.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 right-8 z-10 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-[10px] uppercase font-bold tracking-widest text-slate-300">
                    WASD To Walk • Click To Pick • Mouse To Look
                </div>
            </div>

            {/* Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
            </div>

            <Canvas shadows>
                <PerspectiveCamera makeDefault fov={75} position={[0, 1.7, 5]} />
                <PointerLockControls />

                {/* Lights */}
                <ambientLight intensity={0.5} />
                <pointLight position={[0, 4, 0]} intensity={1} castShadow />
                <pointLight position={[10, 4, 10]} intensity={0.5} />
                <pointLight position={[-10, 4, -10]} intensity={0.5} />

                <Environment preset="city" />
                <Sky sunPosition={[100, 20, 100]} />

                {/* Floor */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                    <planeGeometry args={[50, 50]} />
                    <meshStandardMaterial color="#f1f5f9">
                        <canvasTexture attach="map" args={[createGridCanvas()]} />
                    </meshStandardMaterial>
                </mesh>

                {/* Shelves - Row Left */}
                {[-5, 0, 5].map(z => (
                    <Shelf key={`left-${z}`} position={[-4, 1.25, z]} />
                ))}

                {/* Shelves - Row Right */}
                {[-5, 0, 5].map(z => (
                    <Shelf key={`right-${z}`} position={[4, 1.25, z]} rotation={[0, Math.PI, 0]} />
                ))}

                {/* Walls */}
                <mesh position={[0, 2.5, -15]} receiveShadow>
                    <boxGeometry args={[30, 5, 0.5]} />
                    <meshStandardMaterial color="#cbd5e1" />
                </mesh>
                <mesh position={[15, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
                    <boxGeometry args={[30, 5, 0.5]} />
                    <meshStandardMaterial color="#cbd5e1" />
                </mesh>
                <mesh position={[-15, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                    <boxGeometry args={[30, 5, 0.5]} />
                    <meshStandardMaterial color="#cbd5e1" />
                </mesh>

                {/* Ceiling */}
                <mesh position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[30, 30]} />
                    <meshStandardMaterial color="#e2e8f0" />
                </mesh>

                <Player />

                <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={20} blur={2.4} far={4.5} />
            </Canvas>
        </div>
    );
}

// Utility to create a grid texture for the floor
function createGridCanvas() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 512, 512);
    }
    return canvas;
}
