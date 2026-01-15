"use client";

import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Html } from "@react-three/drei";
import * as THREE from "three";

interface ProductProps {
    position: [number, number, number];
    color: string;
    name: string;
    price: number;
    type?: 'box' | 'cylinder' | 'fruit';
    onAddToCart: (name: string, price: number) => void;
}

export function Product3D({ position, color, name, price, type = 'box', onAddToCart }: ProductProps) {
    const mesh = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    useFrame((state) => {
        if (!mesh.current || !position) return;
        if (hovered) {
            mesh.current.rotation.y += 0.05;
            mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 10) * 0.05;
            mesh.current.scale.setScalar(1.15);
        } else {
            mesh.current.position.y = position[1];
            mesh.current.rotation.y = 0;
            mesh.current.scale.setScalar(1.0);
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={mesh}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
                onClick={() => onAddToCart(name, price)}
                castShadow
            >
                {type === 'box' && <boxGeometry args={[0.35, 0.5, 0.25]} />}
                {type === 'cylinder' && <cylinderGeometry args={[0.12, 0.12, 0.45, 16]} />}
                {type === 'fruit' && <sphereGeometry args={[0.18, 16, 16]} />}
                <meshStandardMaterial
                    color={hovered ? "#ffffff" : color}
                    roughness={0.2}
                    metalness={0.5}
                    emissive={hovered ? color : "#000000"}
                    emissiveIntensity={hovered ? 0.6 : 0}
                />
            </mesh>
            <Html position={[0, 0.55, 0]} center transform sprite zIndexRange={[100, 0]}>
                <div className={`pointer-events-none transition-all duration-200 ${hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                    <div className="bg-indigo-600 text-white text-[9px] px-2 py-1 rounded-lg shadow-xl border border-white/50 font-black whitespace-nowrap flex flex-col items-center">
                        <span className="uppercase tracking-wide leading-none">{name}</span>
                        <span className="text-yellow-300 font-mono text-xs">${price}</span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

// Double-sided shelf unit (like in real stores)
export function ShelfUnit({ position, label = "", length = 10 }: { position: [number, number, number], label?: string, length?: number }) {
    return (
        <group position={position}>
            {/* Section Label */}
            {label && (
                <group position={[0, 4.8, 0]}>
                    <mesh>
                        <boxGeometry args={[length * 0.5, 0.6, 0.15]} />
                        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.3} />
                    </mesh>
                    <Text position={[0, 0, 0.08]} fontSize={0.35} color="white" anchorX="center" anchorY="middle" fontWeight="900">
                        {label.toUpperCase()}
                    </Text>
                </group>
            )}

            {/* Central Spine (Back-to-back shelving) */}
            <mesh position={[0, 2, 0]} castShadow>
                <boxGeometry args={[length, 4, 0.15]} />
                <meshStandardMaterial color="#1e40af" />
            </mesh>

            {/* Shelves on BOTH sides */}
            {[-1, 1].map((side) => (
                <group key={side}>
                    {[0.6, 1.4, 2.2, 3.0, 3.8].map((y, i) => (
                        <mesh key={i} position={[0, y, side * 0.5]} castShadow receiveShadow>
                            <boxGeometry args={[length - 0.2, 0.05, 0.8]} />
                            <meshStandardMaterial color="#2563eb" />
                        </mesh>
                    ))}
                </group>
            ))}

            {/* End Caps */}
            {[-length / 2, length / 2].map((x, i) => (
                <mesh key={i} position={[x, 2, 0]} castShadow>
                    <boxGeometry args={[0.15, 4, 1.8]} />
                    <meshStandardMaterial color="#1e3a8a" />
                </mesh>
            ))}

            {/* Base */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
                <boxGeometry args={[length, 0.2, 2]} />
                <meshStandardMaterial color="#111" />
            </mesh>
        </group>
    );
}

// Checkout Counter (Cashier)
export function CashierCounter({ position, number = 1 }: { position: [number, number, number], number?: number }) {
    return (
        <group position={position}>
            {/* Counter */}
            <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[3, 1, 1.5]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>

            {/* Conveyor Belt Area */}
            <mesh position={[-2.5, 0.35, 0]} receiveShadow>
                <boxGeometry args={[5, 0.1, 1]} />
                <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Customer Queue Area (Floor marking) */}
            <mesh position={[-4, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[4, 1.5]} />
                <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
            </mesh>

            {/* Cashier Sign */}
            <group position={[0, 2.5, 0]}>
                <mesh>
                    <boxGeometry args={[1.5, 0.6, 0.1]} />
                    <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
                </mesh>
                <Text position={[0, 0, 0.06]} fontSize={0.3} color="white" anchorX="center" anchorY="middle" fontWeight="900">
                    CASHIER {number}
                </Text>
            </group>

            {/* Cash Register */}
            <mesh position={[0.8, 1.1, 0]} castShadow>
                <boxGeometry args={[0.6, 0.4, 0.5]} />
                <meshStandardMaterial color="#111" metalness={0.9} />
            </mesh>
        </group>
    );
}

// Entrance Gate
export function Entrance({ position }: { position: [number, number, number] }) {
    return (
        <group position={position} rotation={[0, Math.PI / 2, 0]}>
            {/* Gate Frame */}
            <mesh position={[-2.5, 1.5, 0]} castShadow>
                <boxGeometry args={[0.3, 3, 0.3]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>
            <mesh position={[2.5, 1.5, 0]} castShadow>
                <boxGeometry args={[0.3, 3, 0.3]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>
            <mesh position={[0, 3, 0]} castShadow>
                <boxGeometry args={[5.3, 0.3, 0.3]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>

            {/* Sign */}
            <group position={[0, 4, 0]}>
                <mesh>
                    <boxGeometry args={[3, 0.8, 0.15]} />
                    <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
                </mesh>
                <Text position={[0, 0, 0.08]} fontSize={0.4} color="white" anchorX="center" anchorY="middle" fontWeight="900">
                    ENTRANCE
                </Text>
            </group>

            {/* Security Sensors */}
            {[-1.5, 1.5].map((x, i) => (
                <mesh key={i} position={[x, 0.8, 0]} castShadow>
                    <boxGeometry args={[0.15, 1.6, 0.5]} />
                    <meshStandardMaterial color="#666" />
                </mesh>
            ))}
        </group>
    );
}

export function Wall({ position, rotation = [0, 0, 0], args = [10, 10, 0.5] }: { position: [number, number, number], rotation?: [number, number, number], args?: [number, number, number] }) {
    return (
        <mesh position={position} rotation={rotation as any} receiveShadow>
            <boxGeometry args={args} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
        </mesh>
    );
}
