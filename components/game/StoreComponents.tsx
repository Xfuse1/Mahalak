"use client";

import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";

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
                <boxGeometry args={[0.4, 0.6, 0.4]} />
                <meshStandardMaterial
                    color={hovered ? "#ffff00" : color}
                    roughness={0.3}
                    metalness={0.1}
                    emissive={hovered ? "#444400" : "#000000"}
                />
            </mesh>

            {/* Price Tag UI (Floating) */}
            <Html position={[0, 0.8, 0]} center transform sprite zIndexRange={[100, 0]}>
                <div className={`pointer-events-none transition-all duration-300 ${hovered ? 'opacity-100 scale-110' : 'opacity-0 scale-75'}`}>
                    <div className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur border border-white/20 whitespace-nowrap flex flex-col items-center">
                        <span className="font-bold">{name}</span>
                        <span className="text-green-400 font-mono">${price}</span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

export function Shelf({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* Base */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
                <boxGeometry args={[3, 0.2, 1]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            {/* Back Panel */}
            <mesh position={[0, 1.5, -0.4]} receiveShadow>
                <boxGeometry args={[3, 3, 0.1]} />
                <meshStandardMaterial color="#444" />
            </mesh>
            {/* Shelves */}
            {[0.8, 1.6, 2.4].map((y, i) => (
                <mesh key={i} position={[0, y, 0]} castShadow receiveShadow>
                    <boxGeometry args={[3, 0.1, 1]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
            ))}
        </group>
    );
}
