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
            mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 5) * 0.05;
        } else {
            mesh.current.position.y = position[1];
            mesh.current.rotation.y = 0;
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
                {type === 'box' && <boxGeometry args={[0.4, 0.6, 0.3]} />}
                {type === 'cylinder' && <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />}
                {type === 'fruit' && <sphereGeometry args={[0.2, 16, 16]} />}

                <meshStandardMaterial
                    color={hovered ? "#ffffff" : color}
                    roughness={0.1}
                    metalness={0.6}
                    emissive={hovered ? color : "#000000"}
                    emissiveIntensity={hovered ? 0.5 : 0}
                />
            </mesh>

            {/* Label displayed on hover */}
            <Html position={[0, 0.6, 0]} center transform sprite zIndexRange={[100, 0]}>
                <div className={`pointer-events-none transition-all duration-300 ${hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                    <div className="bg-white text-black text-xs px-2 py-1 rounded shadow-2xl border-2 border-black font-black whitespace-nowrap flex flex-col items-center">
                        <span className="uppercase tracking-tighter text-[10px]">{name}</span>
                        <span className="text-indigo-600 font-mono italic font-black">${price}</span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

export function Shelf({ position, rotation = [0, 0, 0], width = 5, label = "" }: { position: [number, number, number], rotation?: [number, number, number], width?: number, label?: string }) {
    return (
        <group position={position} rotation={rotation as any}>
            {/* Massive Section Label */}
            {label && (
                <group position={[0, 4.5, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[width * 0.8, 0.8, 0.2]} />
                        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
                    </mesh>
                    <Text
                        position={[0, 0, 0.11]}
                        fontSize={0.4}
                        color="black"
                        anchorX="center"
                        anchorY="middle"
                        fontWeight="900"
                    >
                        {label.toUpperCase()}
                    </Text>
                    {/* Visual Floor Light under the sign */}
                    <mesh position={[0, -0.4, 0]}>
                        <boxGeometry args={[width * 0.8, 0.05, 0.2]} />
                        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={5} />
                    </mesh>
                </group>
            )}

            {/* Shelf Structure (Larger) */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
                <boxGeometry args={[width, 0.2, 1.5]} />
                <meshStandardMaterial color="#111" metalness={0.8} />
            </mesh>

            {/* High Back Panel */}
            <mesh position={[0, 2, -0.6]} receiveShadow>
                <boxGeometry args={[width, 4, 0.1]} />
                <meshStandardMaterial color="#222" />
            </mesh>

            {/* Shelf Layers (Bigger and Better spaced) */}
            {[1, 2, 3].map((y, i) => (
                <group key={i} position={[0, y, 0]}>
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[width - 0.2, 0.1, 1.2]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.1} />
                    </mesh>
                    {/* Shelf price tag strip */}
                    <mesh position={[0, -0.05, 0.61]}>
                        <boxGeometry args={[width - 0.2, 0.08, 0.01]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                </group>
            ))}

            {/* Side supports */}
            <mesh position={[width / 2, 2, 0]} castShadow>
                <boxGeometry args={[0.2, 4, 1.5]} />
                <meshStandardMaterial color="#000" metalness={0.9} />
            </mesh>
            <mesh position={[-width / 2, 2, 0]} castShadow>
                <boxGeometry args={[0.2, 4, 1.5]} />
                <meshStandardMaterial color="#000" metalness={0.9} />
            </mesh>
        </group>
    );
}

export function Wall({ position, rotation = [0, 0, 0], args = [10, 10, 0.5] }: { position: [number, number, number], rotation?: [number, number, number], args?: [number, number, number] }) {
    return (
        <mesh position={position} rotation={rotation as any} receiveShadow>
            <boxGeometry args={args} />
            <meshStandardMaterial color="#050505" roughness={1} metalness={0.2} />
        </mesh>
    );
}
