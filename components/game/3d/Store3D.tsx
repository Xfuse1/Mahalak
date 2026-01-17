"use client";

import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
    PointerLockControls,
    Sky,
    ContactShadows,
    PerspectiveCamera,
    Html,
    useTexture,
    Environment
} from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingCart, Move, MousePointer2 } from 'lucide-react';

// --- Constants ---
const SHELF_WIDTH = 12;
const SHELF_HEIGHT = 4.2;
const SHELF_DEPTH = 1.0;
const AISLE_GAP = 7.0;
const LEVELS = 5;

// --- Real Product Data (Updated with stable IDs) ---
const PRODUCTS = [
    { name: 'Cereal Box', img: 'https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=128&q=80', price: 25 },
    { name: 'Fresh Milk', img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=128&q=80', price: 15 },
    { name: 'Canned Tuna', img: 'https://images.unsplash.com/photo-1584278859964-118329668e1b?w=128&q=80', price: 30 },
    { name: 'Orange Juice', img: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=128&q=80', price: 12 },
    { name: 'Pasta', img: 'https://images.unsplash.com/photo-1551462147-fffb9036ef74?w=128&q=80', price: 10 },
    { name: 'Coffee Bean', img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=128&q=80', price: 45 },
    { name: 'Liquid Soap', img: 'https://images.unsplash.com/photo-1585232561307-3f1d643a60a4?w=128&q=80', price: 20 },
    { name: 'Olive Oil', img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=128&q=80', price: 60 },
    { name: 'Ketchup', img: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=128&q=80', price: 18 },
    { name: 'Chocolate', img: 'https://images.unsplash.com/photo-1621451537084-482c7304192b?w=128&q=80', price: 35 }
];

// --- Utilities ---

interface ErrorBoundaryProps {
    fallback: React.ReactNode;
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ImageErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// --- Sub-components ---

function CeilingLight({ position, main = false }: any) {
    return (
        <group position={position}>
            <mesh position={[0, -0.05, 0]}>
                <boxGeometry args={[4.5, 0.08, 1.2]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={8} />
            </mesh>
            <pointLight
                position={[0, -0.4, 0]}
                intensity={main ? 12 : 5}
                distance={25}
                color="#ffffff"
                castShadow={main}
                shadow-mapSize={[512, 512]}
            />
        </group>
    );
}

function ProductPlaceholder({ position, data, onPick }: any) {
    return (
        <group position={position} onClick={() => onPick(data)}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.35, 0.55, 0.3]} />
                <meshStandardMaterial color={stringToColor(data.name)} roughness={0.5} />
            </mesh>
        </group>
    );
}

function ProductWithTexture({ position, data, onPick }: any) {
    const [hovered, setHovered] = useState(false);
    // useTexture can suspend or throw
    const texture = useTexture(data.img);

    return (
        <group
            position={position}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={() => setHovered(false)}
            onClick={() => onPick(data)}
        >
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.35, 0.55, 0.3]} />
                <meshStandardMaterial map={texture as THREE.Texture} roughness={0.3} metalness={0.1} />
            </mesh>
            {hovered && (
                <Html distanceFactor={4} position={[0, 0.5, 0]} center zIndexRange={[100, 0]}>
                    <div className="bg-white/95 text-black p-3 rounded-2xl shadow-2xl text-[11px] whitespace-nowrap border-2 border-blue-500 font-bold pointer-events-none">
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
            for (let x = -SHELF_WIDTH / 2 + 0.65; x <= SHELF_WIDTH / 2 - 0.65; x += 0.55) {
                const productIdx = Math.floor(Math.random() * PRODUCTS.length);
                items.push({
                    pos: [x, level * 0.8 - 1.6, 0.3],
                    data: PRODUCTS[productIdx]
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
                <meshStandardMaterial color="#cbd5e1" />
            </mesh>

            {/* Structural Pillars */}
            {[-SHELF_WIDTH / 2, SHELF_WIDTH / 2].map(x => (
                <mesh key={x} position={[x, 0, 0]} castShadow>
                    <boxGeometry args={[0.22, SHELF_HEIGHT + 0.1, SHELF_DEPTH + 0.05]} />
                    <meshStandardMaterial color="#475569" />
                </mesh>
            ))}

            {/* Shelving Levels */}
            {Array.from({ length: LEVELS }).map((_, i) => (
                <group key={i} position={[0, i * 0.8 - 1.95, 0]}>
                    <mesh receiveShadow castShadow>
                        <boxGeometry args={[SHELF_WIDTH, 0.05, SHELF_DEPTH]} />
                        <meshStandardMaterial color="#f8fafc" />
                    </mesh>
                    <mesh position={[0, -0.04, SHELF_DEPTH / 2 + 0.01]}>
                        <boxGeometry args={[SHELF_WIDTH, 0.08, 0.02]} />
                        <meshStandardMaterial color="#2563eb" />
                    </mesh>
                </group>
            ))}

            {/* Products with individual Error Handling */}
            {productsOnShelf.map((item, i) => (
                <ImageErrorBoundary
                    key={i}
                    fallback={<ProductPlaceholder position={item.pos} data={item.data} onPick={(d: any) => window.dispatchEvent(new CustomEvent('PICK_ITEM', { detail: d }))} />}
                >
                    <Suspense fallback={<ProductPlaceholder position={item.pos} data={item.data} onPick={(d: any) => window.dispatchEvent(new CustomEvent('PICK_ITEM', { detail: d }))} />}>
                        <ProductWithTexture
                            position={item.pos}
                            data={item.data}
                            onPick={(d: any) => window.dispatchEvent(new CustomEvent('PICK_ITEM', { detail: d }))}
                        />
                    </Suspense>
                </ImageErrorBoundary>
            ))}
        </group>
    );
}

function PlayerCart() {
    const group = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (group.current) {
            group.current.position.set(0.65, -0.65, -1.3);
            group.current.rotation.set(0, -Math.PI / 6, 0);
        }
    });

    return (
        <group ref={group}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.8, 0.5, 1.1]} />
                <meshStandardMaterial color="#dc2626" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[0.75, 0.45, 1.05]} />
                <meshStandardMaterial color="#991b1b" />
            </mesh>
            {/* Handle */}
            <mesh position={[0, 0.3, -0.5]} rotation={[0.5, 0, 0]}>
                <boxGeometry args={[0.7, 0.04, 0.04]} />
                <meshStandardMaterial color="#1e293b" />
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
        const speed = 7;
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
        camera.position.y = 1.68;
        camera.position.x = Math.max(-20, Math.min(20, camera.position.x));
        camera.position.z = Math.max(-25, Math.min(25, camera.position.z));

        velocity.current.multiplyScalar(0.85);
    });

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': moveState.current.forward = true; break;
                case 'KeyS': case 'ArrowDown': moveState.current.backward = true; break;
                case 'KeyA': case 'ArrowLeft': moveState.current.left = true; break;
                case 'KeyD': case 'ArrowRight': moveState.current.right = true; break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': moveState.current.forward = false; break;
                case 'KeyS': case 'ArrowDown': moveState.current.backward = false; break;
                case 'KeyA': case 'ArrowLeft': moveState.current.left = false; break;
                case 'KeyD': case 'ArrowRight': moveState.current.right = false; break;
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

function SceneContent() {
    const [cartCount, setCartCount] = useState(0);
    const [money, setMoney] = useState(1500);

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
        <group>
            <Sky sunPosition={[100, 45, 100]} />
            <Environment preset="city" />
            <ambientLight intensity={0.4} />

            {/* Distributed Lights */}
            {[-AISLE_GAP, 0, AISLE_GAP].map((x, i) => (
                <React.Fragment key={x}>
                    <CeilingLight position={[x, 5.5, 8]} main={i === 1} />
                    <CeilingLight position={[x, 5.5, 0]} main={i === 1} />
                    <CeilingLight position={[x, 5.5, -8]} main={i === 1} />
                </React.Fragment>
            ))}

            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <TileMaterial />
            </mesh>

            {/* Aisles Layout */}
            <group>
                {/* Center Aisle */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`center-${z}`} position={[-3.2, 2.1, z]} />
                ))}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`center-r-${z}`} position={[3.2, 2.1, z]} rotation={[0, Math.PI, 0]} />
                ))}

                {/* Left Aisle */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`left-${z}`} position={[-3.2 - AISLE_GAP, 2.1, z]} />
                ))}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`left-r-${z}`} position={[3.2 - AISLE_GAP, 2.1, z]} rotation={[0, Math.PI, 0]} />
                ))}

                {/* Right Aisle */}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`right-${z}`} position={[-3.2 + AISLE_GAP, 2.1, z]} />
                ))}
                {[-10, -5, 0, 5, 10].map(z => (
                    <Shelf key={`right-r-${z}`} position={[3.2 + AISLE_GAP, 2.1, z]} rotation={[0, Math.PI, 0]} />
                ))}
            </group>

            {/* End Caps */}
            <Shelf position={[0, 2.1, -15]} rotation={[0, Math.PI / 2, 0]} />
            <Shelf position={[AISLE_GAP, 2.1, -15]} rotation={[0, Math.PI / 2, 0]} />
            <Shelf position={[-AISLE_GAP, 2.1, -15]} rotation={[0, Math.PI / 2, 0]} />

            {/* Boundaries */}
            <mesh position={[0, 2.5, -20]}>
                <boxGeometry args={[60, 5, 0.5]} />
                <meshStandardMaterial color="#f1f5f9" />
            </mesh>

            <Player />
            <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={50} blur={2.5} far={10} />

            {/* HUD Overlay */}
            <Html fullscreen className="pointer-events-none">
                <div className="w-full h-full p-8 flex flex-col justify-between">
                    <div>
                        <div className="bg-white/95 backdrop-blur-3xl p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] inline-flex flex-col gap-6 pointer-events-auto">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <ShoppingCart size={28} className="text-white fill-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none text-left">
                                        Mahalak <span className="text-blue-600">3D Immersive</span>
                                    </h1>
                                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-2">Premium Shopping Sim</p>
                                </div>
                            </div>
                            <div className="flex gap-12 px-2">
                                <div className="text-left">
                                    <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Balance</div>
                                    <div className="text-4xl font-black text-emerald-500 font-mono">${money}</div>
                                </div>
                                <div className="w-[1px] bg-slate-100" />
                                <div className="text-left">
                                    <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Items</div>
                                    <div className="text-4xl font-black text-blue-600 font-mono">{cartCount}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-200 text-[10px] font-black tracking-widest text-slate-500 uppercase flex gap-4 pointer-events-auto">
                            <span className="flex items-center gap-2"><Move size={14} /> WASD Move</span>
                            <span className="flex items-center gap-2"><MousePointer2 size={14} /> Click to Pick</span>
                        </div>
                    </div>
                </div>
            </Html>
        </group>
    );
}

export default function Store3D() {
    return (
        <div className="w-full h-screen bg-white relative font-sans overflow-hidden">
            {/* Target Aim */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full ring-4 ring-blue-100 shadow-xl" />
            </div>

            <Canvas shadows dpr={[1, 1.5]}>
                <PerspectiveCamera makeDefault fov={70} position={[0, 1.68, 12]} />
                <PointerLockControls />
                {/* We use Suspense around the entire scene as a last resort, but individual products handle their own fallbacks */}
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}

function TileMaterial() {
    // Generate simple procedural tile texture to avoid useTexture issues for floor
    const texture = useMemo(() => {
        if (typeof document === 'undefined') return null;
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

    return <meshStandardMaterial map={texture as THREE.Texture} roughness={0.15} metalness={0.05} />;
}
