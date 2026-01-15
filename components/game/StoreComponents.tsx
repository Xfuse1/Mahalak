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
            mesh.current.scale.setScalar(1.2);
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
                    metalness={0.7}
                    emissive={hovered ? color : "#000000"}
                    emissiveIntensity={hovered ? 0.8 : 0}
                />
            </mesh>

            <Html position={[0, 0.6, 0]} center transform sprite zIndexRange={[100, 0]}>
                <div className={`pointer-events-none transition-all duration-300 ${hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                    <div className="bg-indigo-600 text-white text-[10px] px-3 py-1.5 rounded-xl shadow-2xl border-2 border-white font-black whitespace-nowrap flex flex-col items-center">
                        <span className="uppercase tracking-widest leading-none mb-1">{name}</span>
                        <span className="text-yellow-400 font-mono italic font-black text-sm">${price}</span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

export function Shelf({ position, rotation = [0, 0, 0], width = 8, label = "" }: { position: [number, number, number], rotation?: [number, number, number], width?: number, label?: string }) {
    return (
        <group position={position} rotation={rotation as any}>
            {/* Hanging Sign */}
            {label && (
                <group position={[0, 5, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[width * 0.4, 0.8, 0.1]} />
                        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
                    </mesh>
                    <Text
                        position={[0, 0, 0.06]}
                        fontSize={0.3}
                        color="black"
                        anchorX="center"
                        anchorY="middle"
                        fontWeight="900"
                    >
                        {label.toUpperCase()}
                    </Text>
                    {/* Glowing Accent Bar */}
                    <mesh position={[0, -0.4, 0]}>
                        <boxGeometry args={[width * 0.4, 0.05, 0.1]} />
                        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={10} />
                    </mesh>
                </group>
            )}

            {/* Kickplate / Base */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
                <boxGeometry args={[width, 0.2, 1.2]} />
                <meshStandardMaterial color="#050505" metalness={1} roughness={0.1} />
            </mesh>

            {/* Backing Board (Real store style) */}
            <mesh position={[0, 2, 0]} receiveShadow>
                <boxGeometry args={[width - 0.1, 4, 0.1]} />
                <meshStandardMaterial color="#222" />
            </mesh>

            {/* Multiple Shelf Tiers (Double sided feeling but single mesh here) */}
            {[0.8, 1.8, 2.8, 3.8].map((y, i) => (
                <group key={i} position={[0, y, 0]}>
                    {/* Front Half Shelf */}
                    <mesh position={[0, 0, 0.45]} castShadow receiveShadow>
                        <boxGeometry args={[width - 0.2, 0.05, 0.9]} />
                        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.1} />
                    </mesh>
                    {/* Price Tag Rail */}
                    <mesh position={[0, -0.05, 0.91]}>
                        <boxGeometry args={[width - 0.2, 0.1, 0.02]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                </group>
            ))}

            {/* Structural Uprights */}
            {[-width / 2, width / 2].map((x, i) => (
                <mesh key={i} position={[x, 2, 0]} castShadow>
                    <boxGeometry args={[0.2, 4.2, 1.2]} />
                    <meshStandardMaterial color="#000" metalness={1} />
                </mesh>
            ))}
        </group>
    );
}

export function Wall({ position, rotation = [0, 0, 0], args = [10, 10, 1] }: { position: [number, number, number], rotation?: [number, number, number], args?: [number, number, number] }) {
    return (
        <mesh position={position} rotation={rotation as any} receiveShadow>
            <boxGeometry args={args} />
            <meshStandardMaterial color="#0f0f15" roughness={0.8} />
        </mesh>
    );
}
