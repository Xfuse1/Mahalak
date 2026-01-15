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
    onAddToCart: (name: string, price: number) => void;
}

export function Product3D({ position, color, name, price, onAddToCart }: ProductProps) {
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
                <boxGeometry args={[0.3, 0.5, 0.3]} />
                <meshStandardMaterial
                    color={hovered ? "#ffff00" : color}
                    roughness={0.2}
                    metalness={0.3}
                    emissive={hovered ? "#444400" : "#000000"}
                />
            </mesh>

            {/* Price Tag UI (Floating) */}
            <Html position={[0, 0.6, 0]} center transform sprite zIndexRange={[100, 0]}>
                <div className={`pointer-events-none transition-all duration-300 ${hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    <div className="bg-black/90 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur border border-white/20 whitespace-nowrap flex flex-col items-center">
                        <span className="font-bold">{name}</span>
                        <span className="text-green-400 font-mono">${price}</span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

export function Shelf({ position, rotation = [0, 0, 0], width = 3, label = "" }: { position: [number, number, number], rotation?: [number, number, number], width?: number, label?: string }) {
    return (
        <group position={position} rotation={rotation as any}>
            {/* Label Sign on top of the shelf */}
            {label && (
                <group position={[0, 3.2, 0]}>
                    <mesh>
                        <boxGeometry args={[1.5, 0.5, 0.1]} />
                        <meshStandardMaterial color="#222" emissive="#111" />
                    </mesh>
                    <Text
                        position={[0, 0, 0.06]}
                        fontSize={0.2}
                        color="white"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {label}
                    </Text>
                </group>
            )}

            {/* Base */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
                <boxGeometry args={[width, 0.2, 1]} />
                <meshStandardMaterial color="#2a2a2a" />
            </mesh>
            {/* Back Panel */}
            <mesh position={[0, 1.5, -0.45]} receiveShadow>
                <boxGeometry args={[width, 3, 0.1]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            {/* Shelves */}
            {[0.8, 1.6, 2.4].map((y, i) => (
                <mesh key={i} position={[0, y, 0]} castShadow receiveShadow>
                    <boxGeometry args={[width, 0.05, 1]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>
            ))}
            {/* Side supports */}
            <mesh position={[width / 2, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.1, 3, 1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[-width / 2, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.1, 3, 1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
        </group>
    );
}

export function Wall({ position, rotation = [0, 0, 0], args = [10, 10, 0.5] }: { position: [number, number, number], rotation?: [number, number, number], args?: [number, number, number] }) {
    return (
        <mesh position={position} rotation={rotation as any} receiveShadow>
            <boxGeometry args={args} />
            <meshStandardMaterial color="#0f0f0f" roughness={1} />
        </mesh>
    );
}
