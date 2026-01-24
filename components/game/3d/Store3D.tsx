"use client";

import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useProductStore } from '@/lib/stores/product-store';
import { LayoutGrid } from 'lucide-react';

export default function SupermarketSimulator() {
    const mountRef = useRef<HTMLDivElement>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [money, setMoney] = useState(500);
    const [showCheckout, setShowCheckout] = useState(false);
    const toggleDashboard = useProductStore(state => state.toggleDashboard);
    const [message, setMessage] = useState('');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [fps, setFps] = useState(60);
    const [isLockedState, setIsLockedState] = useState(false);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const basketContentsRef = useRef<THREE.Group | null>(null);
    const npcRef = useRef<any>(null);

    // Refs for accessing latest state inside event listeners without re-binding
    const stateRef = useRef({ money, total });
    const lockPointerRef = useRef<() => void>(() => { });
    useEffect(() => { stateRef.current = { money, total }; }, [money, total]);

    // Initial State and Constants
    const moveSpeed = 0.15;

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a); // Darker background
        scene.fog = new THREE.Fog(0x0a0a0a, 40, 100); // Pushed back for more visibility

        // Camera setup
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 1.6, 40); // Start near cashier facing aisles

        // Renderer - Optimized for performance
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            precision: "lowp", // Faster than mediump
            stencil: false,
            depth: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Cap pixel ratio for speed
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap; // Fastest shadow type
        rendererRef.current = renderer;
        mountRef.current.appendChild(renderer.domElement);

        // Lighting - Reduced light count for extreme performance
        const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.2);
        scene.add(ambientLight);

        // One main directional light for global shadows
        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024; // Increased for better product shadows
        sunLight.shadow.mapSize.height = 1024;
        scene.add(sunLight);

        // Texture Generation (Realistic Brands & Variety)
        const productLibrary = [
            // --- PRODUCE ( الخضروات والفواكه ) ---
            { name: 'تفاح أحمر', color: 0xd32f2f, label: 'APPLE', price: 4.50, category: 'produce', pattern: 'circle' },
            { name: 'موز طازج', color: 0xffeb3b, label: 'BANANA', price: 3.00, category: 'produce', pattern: 'curve' },
            { name: 'برتقال', color: 0xff9800, label: 'ORANGE', price: 5.50, category: 'produce', pattern: 'circle' },
            { name: 'خيار', color: 0x2e7d32, label: 'CUCUMBER', price: 2.50, category: 'produce', pattern: 'stripe' },
            { name: 'طماطم', color: 0xe53935, label: 'TOMATO', price: 3.50, category: 'produce', pattern: 'circle' },

            // --- BAKERY ( المخبز ) ---
            { name: 'خبز صمون', color: 0xffcc80, label: 'BREAD', price: 2.00, category: 'bakery', pattern: 'stripe' },
            { name: 'كرواسون', color: 0xe6a15c, label: 'CROISSANT', price: 4.00, category: 'bakery', pattern: 'curve' },
            { name: 'كيكة شوكولاتة', color: 0x4e342e, label: 'CAKE', price: 25.00, category: 'bakery', pattern: 'block' },
            { name: 'كوكيز', color: 0x8d6e63, label: 'COOKIES', price: 8.00, category: 'bakery', pattern: 'dots' },

            // --- DAIRY & CHEESE ( الألبان والأجبان ) ---
            { name: 'حليب المراعي', color: 0x1e88e5, label: 'MILK', price: 6.50, category: 'dairy', pattern: 'stripe' },
            { name: 'زبادي طازج', color: 0xffffff, label: 'YOGURT', price: 2.00, category: 'dairy', pattern: 'circle' },
            { name: 'جبنة فيتا', color: 0xe3f2fd, label: 'FETA', price: 12.00, category: 'dairy', pattern: 'block' },
            { name: 'لبنة', color: 0xf5f5f5, label: 'LABNEH', price: 9.00, category: 'dairy', pattern: 'simple' },

            // --- MEAT & SEAFOOD ( اللحوم والأسماك ) ---
            { name: 'لحم بقري', color: 0xb71c1c, label: 'BEEF', price: 45.00, category: 'meat', pattern: 'block' },
            { name: 'دجاج طازج', color: 0xfff9c4, label: 'CHICKEN', price: 18.00, category: 'meat', pattern: 'curve' },
            { name: 'سمك سلمون', color: 0xffab91, label: 'SALMON', price: 60.00, category: 'meat', pattern: 'stripe' },

            // --- GROCERY ( المعلبات والبقالة الجافة ) ---
            { name: 'أرز بسمتي', color: 0xfff9c4, label: 'RICE', price: 40.00, category: 'grocery', pattern: 'grain' },
            { name: 'زيت زيتون', color: 0xafb42b, label: 'OIL', price: 22.00, category: 'grocery', pattern: 'drop' },
            { name: 'مكرونة', color: 0xffd54f, label: 'PASTA', price: 4.50, category: 'grocery', pattern: 'stripe' },
            { name: 'صلصة طماطم', color: 0xc62828, label: 'SAUCE', price: 3.50, category: 'grocery', pattern: 'circle' },

            // --- BEVERAGES & SNACKS ( المشروبات والوجبات الخفيفة ) ---
            { name: 'بيبسي', color: 0x1565c0, label: 'PEPSI', price: 3.00, category: 'drinks', pattern: 'circle' },
            { name: 'كوكاكولا', color: 0xb71c1c, label: 'COLA', price: 3.00, category: 'drinks', pattern: 'curve' },
            { name: 'عصير برتقال', color: 0xff9800, label: 'JUICE', price: 7.00, category: 'drinks', pattern: 'fresh' },
            { name: 'شيبس', color: 0xffeb3b, label: 'CHIPS', price: 5.00, category: 'snacks', pattern: 'dots' },

            // --- HEALTH & BEAUTY ( الصحة والجمال ) ---
            { name: 'شامبو', color: 0x5c6bc0, label: 'SHAMPOO', price: 18.00, category: 'beauty', pattern: 'wave' },
            { name: 'عطر نسائي', color: 0xf06292, label: 'PERFUME', price: 120.00, category: 'beauty', pattern: 'curve' },
            { name: 'معجون أسنان', color: 0x81d4fa, label: 'COLGATE', price: 11.00, category: 'beauty', pattern: 'stripe' },

            // --- HOUSEHOLD CARE ( المنظفات ) ---
            { name: 'مطهر أرضيات', color: 0x4caf50, label: 'DETTOL', price: 24.00, category: 'cleaning', pattern: 'swirl' },
            { name: 'تيد غسيل', color: 0x1565c0, label: 'TIDE', price: 55.00, category: 'cleaning', pattern: 'block' },
            { name: 'منظف زجاج', color: 0x03a9f4, label: 'GLASS', price: 15.00, category: 'cleaning', pattern: 'simple' }
        ];

        const productAssets = new Map();
        const clickableProducts: THREE.Mesh[] = [];

        function adjustBrightness(hex: string, percent: number) {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255))
                .toString(16).slice(1);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // --- Helper: Generate Premium Marble Texture (for Floor) ---
        function createMarbleTexture() {
            const mCanvas = document.createElement('canvas');
            mCanvas.width = 1024; mCanvas.height = 1024;
            const mCtx = mCanvas.getContext('2d')!;

            // Base White/Light Grey
            mCtx.fillStyle = '#f5f5f5';
            mCtx.fillRect(0, 0, 1024, 1024);

            // Large Marble Veins
            mCtx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
            mCtx.lineWidth = 1;
            for (let i = 0; i < 20; i++) {
                mCtx.beginPath();
                let x = Math.random() * 1024;
                let y = 0;
                mCtx.moveTo(x, y);
                for (let j = 0; j < 10; j++) {
                    x += (Math.random() - 0.5) * 150;
                    y += 100;
                    mCtx.lineTo(x, y);
                }
                mCtx.stroke();
            }

            // Fine Noise
            for (let i = 0; i < 50000; i++) {
                const lum = Math.random() * 15;
                mCtx.fillStyle = `rgba(${200 + lum}, ${200 + lum}, ${200 + lum}, 0.05)`;
                mCtx.fillRect(Math.random() * 1024, Math.random() * 1024, 1, 1);
            }

            // Tile Lines (Grout)
            mCtx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
            mCtx.lineWidth = 4;
            for (let i = 0; i <= 1024; i += 256) {
                mCtx.beginPath(); mCtx.moveTo(i, 0); mCtx.lineTo(i, 1024); mCtx.stroke();
                mCtx.beginPath(); mCtx.moveTo(0, i); mCtx.lineTo(1024, i); mCtx.stroke();
            }

            const tex = new THREE.CanvasTexture(mCanvas);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }
        const marbleTex = createMarbleTexture();

        // --- Helper: Generate Premium Organic Wood Texture (Walnut style) ---
        function createWoodTexture() {
            const wCanvas = document.createElement('canvas');
            wCanvas.width = 1024; wCanvas.height = 1024;
            const wCtx = wCanvas.getContext('2d')!;

            // Base Warm Wood Tone
            wCtx.fillStyle = '#3d1f0e';
            wCtx.fillRect(0, 0, 1024, 1024);

            // Layered Grain Lines (Wavy)
            for (let i = 0; i < 800; i++) {
                const lum = Math.random() * 50;
                wCtx.strokeStyle = `rgba(${lum + 10}, ${lum / 2 + 5}, 0, 0.2)`;
                wCtx.lineWidth = 1 + Math.random() * 3;

                let x = Math.random() * 1024;
                wCtx.beginPath();
                wCtx.moveTo(x, 0);
                for (let j = 0; j < 10; j++) {
                    x += Math.sin(j + i) * 10; // Wavy effect
                    wCtx.lineTo(x, j * 102);
                }
                wCtx.stroke();
            }

            // Wood Knots (Organic details)
            for (let i = 0; i < 15; i++) {
                const kX = Math.random() * 1024;
                const kY = Math.random() * 1024;
                const kR = 5 + Math.random() * 15;

                const grad = wCtx.createRadialGradient(kX, kY, 0, kX, kY, kR * 5);
                grad.addColorStop(0, 'rgba(20, 10, 0, 0.4)');
                grad.addColorStop(1, 'rgba(61, 31, 14, 0)');

                wCtx.fillStyle = grad;
                wCtx.beginPath();
                wCtx.ellipse(kX, kY, kR, kR * 4, Math.random() * Math.PI, 0, Math.PI * 2);
                wCtx.fill();
            }

            const tex = new THREE.CanvasTexture(wCanvas);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }
        const woodTex = createWoodTexture();

        // --- Helper: Generate Leaf Texture ---
        function createLeafTexture() {
            const lCanvas = document.createElement('canvas');
            lCanvas.width = 128; lCanvas.height = 256;
            const lCtx = lCanvas.getContext('2d')!;

            // Background green
            const grad = lCtx.createLinearGradient(0, 0, 128, 0);
            grad.addColorStop(0, '#1b5e20');
            grad.addColorStop(0.5, '#2e7d32');
            grad.addColorStop(1, '#1b5e20');
            lCtx.fillStyle = grad;
            lCtx.fillRect(0, 0, 128, 256);

            // Veins
            lCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            lCtx.lineWidth = 2;
            lCtx.beginPath();
            lCtx.moveTo(64, 0); lCtx.lineTo(64, 256); // Main vein
            lCtx.stroke();

            for (let i = 0; i < 20; i++) {
                const y = i * 15;
                lCtx.beginPath();
                lCtx.moveTo(64, y);
                lCtx.lineTo(128, y - 20);
                lCtx.moveTo(64, y);
                lCtx.lineTo(0, y - 20);
                lCtx.stroke();
            }

            const tex = new THREE.CanvasTexture(lCanvas);
            return tex;
        }
        const leafTex = createLeafTexture();

        // --- Helper: Generate Premium Stone Texture (Fine Grain) ---
        function createStoneTexture() {
            const sCanvas = document.createElement('canvas');
            sCanvas.width = 1024; sCanvas.height = 1024;
            const sCtx = sCanvas.getContext('2d')!;

            // Base Dark Slate/Charcoal
            sCtx.fillStyle = '#121212';
            sCtx.fillRect(0, 0, 1024, 1024);

            // Organic Banding (Travertine effect)
            for (let i = 0; i < 50; i++) {
                const y = Math.random() * 1024;
                sCtx.fillStyle = `rgba(30, 30, 30, ${Math.random() * 0.2})`;
                sCtx.fillRect(0, y, 1024, 2 + Math.random() * 10);
            }

            // Fine Stone Pores & Noise
            for (let i = 0; i < 100000; i++) {
                const lum = Math.random() * 25;
                sCtx.fillStyle = `rgba(${lum}, ${lum}, ${lum}, 0.15)`;
                sCtx.fillRect(Math.random() * 1024, Math.random() * 1024, 1, 1);
            }

            // Subtle Vertical Cracks/Detail
            sCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            for (let i = 0; i < 5; i++) {
                sCtx.beginPath();
                let x = Math.random() * 1024;
                sCtx.moveTo(x, 0);
                for (let j = 0; j < 10; j++) {
                    x += (Math.random() - 0.5) * 20;
                    sCtx.lineTo(x, j * 102);
                }
                sCtx.stroke();
            }

            const tex = new THREE.CanvasTexture(sCanvas);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }
        const stoneTex = createStoneTexture();

        // --- Premium Art Gallery Textures (Original AI Arts) ---
        const texLoader = new THREE.TextureLoader();
        const artTex1 = texLoader.load('/images/art_emerald.png');
        const artTex2 = texLoader.load('/images/art_saffron.png');
        const artTex3 = texLoader.load('/images/art_midnight.png');

        if (ctx) {
            productLibrary.forEach(info => {
                const baseColor = `#${info.color.toString(16).padStart(6, '0')}`;

                // Base
                ctx.fillStyle = baseColor;
                ctx.fillRect(0, 0, 256, 256);

                // --- Procedural Branding Patterns ---
                ctx.fillStyle = adjustBrightness(baseColor, -15);

                // Specific category icons/motifs
                if (info.category === 'drinks') {
                    ctx.fillRect(80, 20, 96, 100); // Bottle shape silhouette
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(128, 60, 20, 0, Math.PI * 2); ctx.fill();
                } else if (info.category === 'produce') {
                    ctx.beginPath(); ctx.arc(128, 80, 50, 0, Math.PI * 2); ctx.fill(); // Fruit shape
                } else if (info.category === 'dairy') {
                    ctx.fillRect(90, 30, 76, 100); // Milk carton
                }

                ctx.fillStyle = adjustBrightness(baseColor, -15);

                switch (info.pattern) {
                    case 'stripe':
                        for (let i = 0; i < 256; i += 40) ctx.fillRect(i, 0, 20, 256);
                        break;
                    case 'grid':
                        for (let i = 0; i < 256; i += 30) {
                            ctx.fillRect(i, 0, 2, 256);
                            ctx.fillRect(0, i, 256, 2);
                        }
                        break;
                    case 'circle':
                        ctx.beginPath();
                        ctx.arc(128, 128, 90, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                    case 'curve':
                        ctx.beginPath();
                        ctx.ellipse(128, 128, 140, 80, Math.PI / 4, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                    case 'swirl':
                        ctx.beginPath();
                        ctx.arc(128, 128, 100, 0, Math.PI * 2);
                        ctx.strokeStyle = adjustBrightness(baseColor, 30);
                        ctx.lineWidth = 20;
                        ctx.stroke();
                        break;
                    case 'triangle':
                        ctx.beginPath();
                        ctx.moveTo(128, 40);
                        ctx.lineTo(216, 200);
                        ctx.lineTo(40, 200);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    case 'dots':
                        for (let x = 32; x < 256; x += 64) {
                            for (let y = 32; y < 256; y += 64) {
                                ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
                            }
                        }
                        break;
                }

                // --- Label area ---
                // Skip large labels for produce, use a tiny "sticker" instead
                if (info.category !== 'produce') {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(10, 140, 236, 80);

                    // Text (Main Title)
                    ctx.fillStyle = '#111';
                    ctx.font = 'bold 32px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(info.label, 128, 175);

                    // Subtext / Brand Detail
                    ctx.font = '14px sans-serif';
                    ctx.fillText('PREMIUM QUALITY', 128, 195);

                    // Barcode simulation
                    ctx.fillStyle = '#000';
                    for (let i = 0; i < 30; i++) {
                        if (Math.random() > 0.3) {
                            ctx.fillRect(180 + i * 2, 205, 1, 15);
                        }
                    }
                } else {
                    // Small price sticker for produce
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(60, 60, 30, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#111';
                    ctx.font = 'bold 20px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(info.label.substring(0, 3), 60, 68);
                }

                // Price tag (Smaller/Simpler for produce)
                const isProduce = info.category === 'produce';
                ctx.fillStyle = isProduce ? 'rgba(255,235,59,0.8)' : '#ffeb3b';
                ctx.beginPath();
                const prX = isProduce ? 220 : 210;
                const prY = isProduce ? 220 : 200;
                ctx.arc(prX, prY, isProduce ? 25 : 35, 0, Math.PI * 2);
                ctx.fill();

                if (!isProduce) {
                    ctx.strokeStyle = '#fbc02d';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                ctx.fillStyle = '#c62828';
                ctx.font = isProduce ? 'bold 16px sans-serif' : 'bold 22px sans-serif';
                ctx.fillText(`$${info.price.toFixed(2)}`, prX, prY + 8);

                const tex = new THREE.CanvasTexture(canvas);
                tex.anisotropy = 4;

                const mat = new THREE.MeshPhysicalMaterial({
                    map: tex.clone(),
                    roughness: 0.2,
                    metalness: 0.1,
                    clearcoat: info.category === 'drinks' || info.category === 'beauty' ? 0.8 : 0.2,
                    clearcoatRoughness: 0.1
                });
                productAssets.set(info.name, mat);
            });
        }

        // --- Floor ---
        const floorGeometry = new THREE.PlaneGeometry(100, 120);
        const floorTexture = marbleTex.clone();
        floorTexture.repeat.set(10, 12);
        const floorMaterial = new THREE.MeshPhysicalMaterial({
            map: floorTexture,
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // --- Premium Aisle Runners (Carpets) ---
        const runnerMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1.0 });
        const aislesX = [-21, -7, 7, 21];
        aislesX.forEach(x => {
            const runner = new THREE.Mesh(new THREE.PlaneGeometry(6, 100), runnerMat);
            runner.rotation.x = -Math.PI / 2;
            runner.position.set(x, 0.01, 0); // Just above marble
            scene.add(runner);
        });
        // Lobby Runner
        const lobbyRunner = new THREE.Mesh(new THREE.PlaneGeometry(70, 10), runnerMat);
        lobbyRunner.rotation.x = -Math.PI / 2;
        lobbyRunner.position.set(0, 0.01, 44);
        scene.add(lobbyRunner);

        const ceilingGroup = new THREE.Group();
        const slatMat = new THREE.MeshPhysicalMaterial({
            map: woodTex,
            roughness: 0.5,
            metalness: 0.1,
            clearcoat: 0.3
        });
        const slatGeom = new THREE.BoxGeometry(80, 0.15, 0.4);

        // Wood slats on ceiling for high-end look
        for (let i = -60; i < 60; i += 1.5) {
            const slat = new THREE.Mesh(slatGeom, slatMat);
            slat.position.set(0, 5.85, i);
            ceilingGroup.add(slat);
        }
        scene.add(ceilingGroup);

        // Structural Pillars (Architectural Elements)
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });
        const pillarGeom = new THREE.BoxGeometry(2, 6, 2);
        const pillarPositions = [
            [-20, 3, -20], [20, 3, -20],
            [-20, 3, 20], [20, 3, 20],
        ];

        // --- Helper: Premium Organic Designer Plant ---
        function createPremiumPlant(x: number, z: number) {
            const plantGroup = new THREE.Group();

            // Pot: Premium Organic Wood Designer Pot
            const potMat = new THREE.MeshPhysicalMaterial({
                map: woodTex,
                roughness: 0.6,
                metalness: 0.05,
                clearcoat: 0.2
            });
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 1.0, 16), potMat);
            pot.position.y = 0.5;
            pot.castShadow = true;
            plantGroup.add(pot);

            // Soil
            const soil = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), new THREE.MeshStandardMaterial({ color: 0x110800 }));
            soil.rotation.x = -Math.PI / 2;
            soil.position.y = 1.01;
            plantGroup.add(soil);

            // Organic Drooping Leaves
            const leafMat = new THREE.MeshStandardMaterial({
                map: leafTex,
                side: THREE.DoubleSide,
                alphaTest: 0.5,
                roughness: 0.4
            });

            for (let i = 0; i < 18; i++) {
                const leafGroup = new THREE.Group();
                const height = 0.8 + Math.random() * 1.2;
                const width = 0.4 + Math.random() * 0.3;

                // Leaf Geometry: Slightly curved plane
                const leaf = new THREE.Mesh(new THREE.PlaneGeometry(width, height), leafMat);
                leaf.position.y = height / 2;

                const angle = (i / 18) * Math.PI * 2;
                const dist = 0.1 + Math.random() * 0.15;

                leafGroup.position.set(Math.cos(angle) * dist, 1.0, Math.sin(angle) * dist);
                leafGroup.rotation.y = angle;
                // Randomized drooping angle
                leafGroup.rotation.z = 0.8 + Math.random() * 1.2;
                leafGroup.add(leaf);

                plantGroup.add(leafGroup);
            }

            plantGroup.position.set(x, 0, z);
            scene.add(plantGroup);
        }

        pillarPositions.forEach(([x, y, z]) => {
            const pillar = new THREE.Mesh(pillarGeom, pillarMat);
            pillar.position.set(x, y, z);
            scene.add(pillar);

            // Add Premium Plant with Wooden Pot
            // Offset shifted to avoid pillar overlap and centered better
            const offsetX = x < 0 ? 2.5 : -2.5;
            createPremiumPlant(x + offsetX, z);
        });

        const shelfGroupTemplate = new THREE.Group();
        const shelfMat = new THREE.MeshPhysicalMaterial({
            map: woodTex,
            roughness: 0.4,
            metalness: 0.05,
            clearcoat: 0.4,
            clearcoatRoughness: 0.2
        });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.8 }); // Metal pillars
        const railMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5 }); // Price rail
        const backPanelMat = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.9 });
        const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe0b3, emissiveIntensity: 4 });

        // Back Panel (now at the center/back of the group)
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 0.05), backPanelMat);
        backPanel.position.set(0, 1.6, 0);
        shelfGroupTemplate.add(backPanel);

        // Thick Premium Framing (Left/Right)
        const frameGeom = new THREE.BoxGeometry(0.25, 3.6, 0.8);
        const leftFrame = new THREE.Mesh(frameGeom, shelfMat);
        leftFrame.position.set(-3.5, 1.8, 0.3);
        const rightFrame = new THREE.Mesh(frameGeom, shelfMat);
        rightFrame.position.set(3.5, 1.8, 0.3);
        shelfGroupTemplate.add(leftFrame, rightFrame);

        // Shelf Header (Top signage area)
        const headerGeom = new THREE.BoxGeometry(7.2, 0.4, 0.85);
        const header = new THREE.Mesh(headerGeom, shelfMat);
        header.position.set(0, 3.5, 0.3);
        shelfGroupTemplate.add(header);

        // Header LED
        const headerLight = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.02, 0.6), ledMat);
        headerLight.position.set(0, 3.25, 0.3);
        shelfGroupTemplate.add(headerLight);

        // Bottom LED Glow (Floating Shelf Effect)
        const bottomGlow = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.02, 0.1), ledMat);
        bottomGlow.position.set(0, 0.05, 0.65);
        shelfGroupTemplate.add(bottomGlow);

        // Shelves and Rails (facing Z+ direction)
        const shelfBoardGeom = new THREE.BoxGeometry(6.9, 0.06, 0.65);
        const railGeom = new THREE.BoxGeometry(6.9, 0.1, 0.03);
        const ledGeom = new THREE.BoxGeometry(6.8, 0.02, 0.05);

        for (let lvl = 0; lvl < 6; lvl++) {
            const yPos = 0.2 + lvl * 0.55;

            // Shelf Board - offset forward from back panel
            const b = new THREE.Mesh(shelfBoardGeom, shelfMat);
            b.position.set(0, yPos, 0.35);
            b.castShadow = true;
            b.receiveShadow = true;
            shelfGroupTemplate.add(b);

            // Front Rail
            const rail = new THREE.Mesh(railGeom, railMat);
            rail.position.set(0, yPos, 0.68);
            shelfGroupTemplate.add(rail);

            // LED strip
            if (lvl > 0) {
                const led = new THREE.Mesh(ledGeom, ledMat);
                led.position.set(0, yPos - 0.04, 0.6);
                shelfGroupTemplate.add(led);
            }
        }

        // --- Central Display Island ---
        function createDisplayIsland(x: number, z: number) {
            const island = new THREE.Group();
            const baseGeom = new THREE.CylinderGeometry(2.5, 2.5, 0.8, 8); // Smaller radius (2.5 instead of 4)
            const base = new THREE.Mesh(baseGeom, shelfMat);
            base.position.y = 0.4;
            island.add(base);

            const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 8), shelfMat); // Smaller tier
            tier2.position.y = 1.1;
            island.add(tier2);

            // Featured Products on the island
            const featuredInfo = productLibrary.find(p => p.category === 'drinks');
            for (let i = 0; i < 8; i++) { // Reduced count for smaller size
                const angle = (i / 8) * Math.PI * 2;
                const p = createProductMesh(featuredInfo);
                if (p) {
                    p.position.set(Math.cos(angle) * 1.8, 1.1 + 0.24, Math.sin(angle) * 1.8);
                    island.add(p);
                    clickableProducts.push(p);
                }
            }
            island.position.set(x, 0, z);
            scene.add(island);

            // Highlight Light for the island
            const islandLight = new THREE.PointLight(0xfff5e6, 30, 20);
            islandLight.position.set(x, 5.0, z);
            scene.add(islandLight);
        }

        createDisplayIsland(0, 0);

        function createProductMesh(info: any) {
            if (!info) return null;

            let geom;
            const category = info.category;

            if (category === 'produce') {
                if (info.name.includes('موز')) {
                    // Banana: Curved ellipsoid approximation using Capsule
                    geom = new THREE.CapsuleGeometry(0.08, 0.4, 4, 12);
                } else if (info.name.includes('خيار')) {
                    // Cucumber: Long cylinder
                    geom = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12);
                } else {
                    // Apples, Oranges, Tomatoes
                    geom = new THREE.SphereGeometry(0.18, 16, 12);
                }
            } else if (category === 'drinks' || category === 'cleaning' || info.name.includes('زيت')) {
                // Bottles/Cylinders
                geom = new THREE.CylinderGeometry(0.18, 0.18, 0.55, 16);
            } else if (category === 'dairy' && info.name.includes('حليب')) {
                // Milk carton style
                geom = new THREE.BoxGeometry(0.25, 0.6, 0.25);
            } else if (category === 'bakery' && info.name.includes('كيك')) {
                // Cake/Round box
                geom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
            } else {
                // Default box for snacks, grocery, etc.
                geom = new THREE.BoxGeometry(0.32, 0.48, 0.22);
            }

            const mesh = new THREE.Mesh(geom, productAssets.get(info.name));

            // Add details
            if (category === 'produce') {
                if (!info.name.includes('موز') && !info.name.includes('خيار')) {
                    // Add a tiny brown stalk for spherical fruits
                    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
                    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.08), stalkMat);
                    stalk.position.y = 0.18;
                    mesh.add(stalk);
                }
            } else if (category === 'drinks' || category === 'cleaning' || info.name.includes('زيت')) {
                const capMat = new THREE.MeshPhysicalMaterial({ color: 0x333333, roughness: 0.1, metalness: 0.5 });
                const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), capMat);
                cap.position.y = 0.3;
                mesh.add(cap);
            }

            mesh.userData = { ...info, clickable: true };
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        // --- Helper: Create Department Sign ---
        function createDepartmentSign(textAr: string, textEn: string, x: number, y: number, z: number, rotationY: number = 0) {
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 1024;
            signCanvas.height = 256;
            const sCtx = signCanvas.getContext('2d')!;

            // Background - Premium Dark Gold Glossy
            const grad = sCtx.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0, '#222');
            grad.addColorStop(0.5, '#444');
            grad.addColorStop(1, '#222');
            sCtx.fillStyle = grad;
            sCtx.fillRect(0, 0, 1024, 256);

            // Border
            sCtx.strokeStyle = '#aa8833';
            sCtx.lineWidth = 15;
            sCtx.strokeRect(10, 10, 1004, 236);

            // Text Arabic
            sCtx.fillStyle = '#aa8833';
            sCtx.font = 'bold 80px sans-serif';
            sCtx.textAlign = 'center';
            sCtx.direction = 'rtl';
            sCtx.fillText(textAr, 512, 110);

            // Text English
            sCtx.font = '50px sans-serif';
            sCtx.fillText(textEn, 512, 180);

            const tex = new THREE.CanvasTexture(signCanvas);
            const signGeom = new THREE.PlaneGeometry(6, 1.5);
            const signMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
            const signMesh = new THREE.Mesh(signGeom, signMat);

            // Mounting Group
            const group = new THREE.Group();
            group.add(signMesh);

            // Add hanging wires
            const wireMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
            const wireGeom = new THREE.CylinderGeometry(0.02, 0.02, 3);
            const w1 = new THREE.Mesh(wireGeom, wireMat);
            const w2 = new THREE.Mesh(wireGeom, wireMat);
            w1.position.set(-2.5, 1.5, 0);
            w2.position.set(2.5, 1.5, 0);
            group.add(w1, w2);

            group.position.set(x, y, z);
            group.rotation.y = rotationY;
            scene.add(group);
        }

        function createPopulatedShelf(x: number, z: number, rotation: number, categoryList: string[]) {
            const shelf = shelfGroupTemplate.clone();
            const categories = productLibrary.filter(p => categoryList.includes(p.category));

            for (let lvl = 0; lvl < 6; lvl++) {
                // Populate random products from categories
                for (let xOff = -3; xOff <= 3; xOff += 0.8) {
                    const info = categories[Math.floor(Math.random() * categories.length)];
                    const mesh = createProductMesh(info);
                    if (mesh) {
                        const xPos = xOff + (Math.random() - 0.5) * 0.1;
                        const zPos = 0.4 + (Math.random() - 0.5) * 0.05;
                        const randRot = (Math.random() - 0.5) * 0.2;
                        mesh.position.set(xPos, 0.2 + lvl * 0.55 + 0.26, zPos);
                        mesh.rotation.y = randRot;
                        shelf.add(mesh);
                        clickableProducts.push(mesh);
                    }
                }
            }
            shelf.position.set(x, 0, z);
            shelf.rotation.y = rotation;
            scene.add(shelf);
        }

        // --- SPECIALIZED SUPERMARKET DEPARTMENTS ---

        // 1. Produce Section (خضروات وفواكه) - Wooden tables and warm light
        function createProduceSection(x: number, z: number) {
            const produceGroup = new THREE.Group();
            const tableMat = woodTex.clone();
            tableMat.repeat.set(2, 2);
            const woodMaterial = new THREE.MeshStandardMaterial({ map: tableMat, roughness: 0.8 });

            // Create slanted wooden tables
            for (let i = -1; i <= 1; i++) {
                const table = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 2.5), woodMaterial);
                table.position.set(i * 5, 0.4, 0);
                table.rotation.x = -0.2; // Slanted
                produceGroup.add(table);

                // Add products on top
                const items = productLibrary.filter(p => p.category === 'produce');
                for (let px = -1.5; px <= 1.5; px += 0.6) {
                    for (let pz = -0.8; pz <= 0.8; pz += 0.6) {
                        const info = items[Math.floor(Math.random() * items.length)];
                        const p = createProductMesh(info);
                        if (p) {
                            p.position.set(i * 5 + px, 0.9, pz);
                            produceGroup.add(p);
                            clickableProducts.push(p);
                        }
                    }
                }
            }

            // Warm produce lighting
            const warmLight = new THREE.PointLight(0xffcc88, 30, 15);
            warmLight.position.set(0, 4, 0);
            produceGroup.add(warmLight);

            produceGroup.position.set(x, 0, z);
            scene.add(produceGroup);
        }

        // 2. Bakery (المخبز) - Glass and wood
        function createBakerySection(x: number, z: number) {
            const bakeryGroup = new THREE.Group();
            const counterMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.5 });
            const glassMat = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.3, transmission: 0.9, roughness: 0.1 });

            const counter = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 1.5), counterMat);
            counter.position.y = 0.6;
            bakeryGroup.add(counter);

            const glassTop = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 1.5), glassMat);
            glassTop.position.y = 1.6;
            bakeryGroup.add(glassTop);

            // Baked products inside/on top
            const items = productLibrary.filter(p => p.category === 'bakery');
            for (let bx = -3.5; bx <= 3.5; bx += 1) {
                const info = items[Math.floor(Math.random() * items.length)];
                const p = createProductMesh(info);
                if (p) {
                    p.position.set(bx, 1.3, 0);
                    bakeryGroup.add(p);
                    clickableProducts.push(p);
                }
            }

            // Delicious warm glow
            const bakeryLight = new THREE.PointLight(0xffa726, 20, 10);
            bakeryLight.position.set(0, 3, 0);
            bakeryGroup.add(bakeryLight);

            bakeryGroup.position.set(x, 0, z);
            scene.add(bakeryGroup);
        }

        // 3. Dairy & Cheese (الألبان والأجبان) - Open Fridges
        function createDairySection(x: number, z: number, rotation: number) {
            const dairyGroup = new THREE.Group();
            const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
            const coldLightMat = new THREE.MeshStandardMaterial({ color: 0x81d4fa, emissive: 0x81d4fa, emissiveIntensity: 2 });

            const base = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 1), fridgeMat);
            base.position.y = 1.5;
            dairyGroup.add(base);

            // Cold LED strips
            const led = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.1, 0.1), coldLightMat);
            led.position.set(0, 2.8, 0.5);
            dairyGroup.add(led);

            // Layout products
            const items = productLibrary.filter(p => p.category === 'dairy');
            for (let lvl = 0; lvl < 4; lvl++) {
                for (let dx = -4.5; dx <= 4.5; dx += 0.8) {
                    const info = items[Math.floor(Math.random() * items.length)];
                    const p = createProductMesh(info);
                    if (p) {
                        p.position.set(dx, 0.5 + lvl * 0.7, 0.4);
                        dairyGroup.add(p);
                        clickableProducts.push(p);
                    }
                }
            }

            dairyGroup.position.set(x, 0, z);
            dairyGroup.rotation.y = rotation;
            scene.add(dairyGroup);
        }

        // 4. Meat & Seafood (اللحوم والأسماك) - Glass Counter
        function createMeatSection(x: number, z: number) {
            const meatGroup = new THREE.Group();
            const counterMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
            const counter = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 2), counterMat);
            counter.position.y = 0.55;
            meatGroup.add(counter);

            const glass = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 1.8), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.4, transmission: 0.8 }));
            glass.position.y = 1.4;
            meatGroup.add(glass);

            const items = productLibrary.filter(p => p.category === 'meat');
            for (let mx = -4; mx <= 4; mx += 1.5) {
                const info = items[Math.floor(Math.random() * items.length)];
                const p = createProductMesh(info);
                if (p) {
                    p.scale.set(1.5, 1, 1.5); // Meat chunks look bigger
                    p.position.set(mx, 1.2, 0);
                    meatGroup.add(p);
                    clickableProducts.push(p);
                }
            }

            meatGroup.position.set(x, 0, z);
            scene.add(meatGroup);
        }

        // 5. Health & Beauty (الصحة والجمال) - Bright Glass Shelves
        function createBeautySection(x: number, z: number, rotation: number) {
            const beautyGroup = new THREE.Group();
            const glassShelfMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, transmission: 0.5 });
            const backMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

            const back = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.1), backMat);
            back.position.y = 2;
            beautyGroup.add(back);

            for (let i = 0; i < 5; i++) {
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.6), glassShelfMat);
                shelf.position.y = 0.2 + i * 0.8;
                shelf.position.z = 0.3;
                beautyGroup.add(shelf);

                // Add beauty products
                const items = productLibrary.filter(p => p.category === 'beauty');
                for (let bx = -3.5; bx <= 3.5; bx += 0.7) {
                    const info = items[Math.floor(Math.random() * items.length)];
                    const p = createProductMesh(info);
                    if (p) {
                        p.position.set(bx, 0.2 + i * 0.8 + 0.25, 0.3);
                        beautyGroup.add(p);
                        clickableProducts.push(p);
                    }
                }

                // Bright white LED for each shelf
                const led = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 5 }));
                led.position.set(0, 0.2 + i * 0.8 + 0.78, 0.55);
                beautyGroup.add(led);
            }

            beautyGroup.position.set(x, 0, z);
            beautyGroup.rotation.y = rotation;
            scene.add(beautyGroup);
        }

        // --- NEW STORE LAYOUT WITH SIGNS ---

        // 1. Bakery (المخبز)
        createBakerySection(-20, 42);
        createDepartmentSign("قسم المخبز", "BAKERY", -20, 4.5, 42);

        // 2. Produce (الخضروات والفواكه)
        createProduceSection(-15, 20);
        createDepartmentSign("الخضروات والفواكه", "FRESH PRODUCE", -15, 4.5, 20);

        // 3. Dairy & Cheese (الألبان والأجبان)
        createDairySection(-28, 0, Math.PI / 2);
        createDairySection(-28, -12, Math.PI / 2);
        createDepartmentSign("الألبان والأجبان", "DAIRY & CHEESE", -25, 4.5, -6, Math.PI / 2);

        // 4. Meat & Seafood (اللحوم والأسماك)
        createMeatSection(0, -45);
        createDepartmentSign("اللحوم والأسماك", "MEAT & SEAFOOD", 0, 4.5, -42);

        // 5. Health & Beauty (الصحة والجمال)
        createBeautySection(28, 0, -Math.PI / 2);
        createBeautySection(28, 12, -Math.PI / 2);
        createDepartmentSign("الصحة والجمال", "HEALTH & BEAUTY", 25, 4.5, 6, -Math.PI / 2);

        // 6. Grocery & Cleaning (البقالة والمنظفات) - Adjusted spacing to avoid island overlap
        const mainAisles = [
            { x: -10, categories: ['grocery'], labelAr: "البقالة", labelEn: "GROCERY" },
            { x: 10, categories: ['drinks', 'snacks'], labelAr: "المشروبات والوجبات الخفيفة", labelEn: "DRINKS & SNACKS" },
            { x: 20, categories: ['cleaning', 'grocery'], labelAr: "المنظفات والورقيات", labelEn: "CLEANING" }
        ];

        mainAisles.forEach(aisle => {
            for (let z = -35; z <= 35; z += 12) {
                createPopulatedShelf(aisle.x, z, 0, aisle.categories);
                createPopulatedShelf(aisle.x, z, Math.PI, aisle.categories);
            }
            createDepartmentSign(aisle.labelAr, aisle.labelEn, aisle.x, 4.5, 0);
        });

        // Cashier Sign
        createDepartmentSign("منطقة المحاسبة", "CHECKOUT", 0, 4.5, 48);

        // Cashier already remains at createCashier(0, 48)

        // --- CASHIER AREA (Professional Design & Animated NPC) ---
        function createCashier(x: number, z: number) {
            const cashierGroup = new THREE.Group();
            const counterMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.1, metalness: 0.5 }); // Sleek Noir
            const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.3, 1.2), counterMat);
            base.position.y = 0.65;
            cashierGroup.add(base);

            // Top Panel (Polished Marble)
            const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.1, 1.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }));
            top.position.y = 1.35;
            cashierGroup.add(top);

            // 2. Conveyor Belt
            const belt = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
            belt.position.set(-1.0, 1.31, 0);
            cashierGroup.add(belt);

            // 3. Modern POS Register
            const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            screen.position.set(2.2, 1.7, 0.5);
            screen.rotation.y = -Math.PI / 8;
            cashierGroup.add(screen);

            // Designer Signage
            const signBoard = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x221108, roughness: 0.3 }));
            signBoard.position.set(0, 4.5, 0);
            cashierGroup.add(signBoard);

            // LED Light above sign
            const signLight = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.05, 0.3), ledMat);
            signLight.position.set(0, 4.0, 0);
            cashierGroup.add(signLight);

            cashierGroup.position.set(x, 0, z);
            scene.add(cashierGroup);

            // Designer Pendant Light (Ring)
            const ringGeom = new THREE.TorusGeometry(1.5, 0.05, 8, 32);
            const ring = new THREE.Mesh(ringGeom, ledMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(x, 5.0, z);
            scene.add(ring);

            const pLight = new THREE.PointLight(0xfff5e6, 20, 15);
            pLight.position.set(x, 4.5, z);
            scene.add(pLight);

            // --- ADDING NPC (Cashier Personnel) ---
            const npcGroup = new THREE.Group(); // ANIMATED REPLACEMENT START
            function createCashierNPC(nx: number, nz: number) { // NPC_REBUILD_START
                // improved materials
                const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xffdbac, roughness: 0.75 });
                const shirtMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.5 });
                const uniformMat = new THREE.MeshPhysicalMaterial({ color: 0x2e7d32, roughness: 0.8 });
                const hairMat = new THREE.MeshStandardMaterial({ color: 0x221105, roughness: 0.9 });

                // Head
                const hGroup = new THREE.Group();
                const face = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.08, 4, 12), skinMat);
                face.position.y = 1.68;
                hGroup.add(face);

                // facial features
                const eyeGeom = new THREE.SphereGeometry(0.012, 8, 8);
                const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
                const lEye = new THREE.Mesh(eyeGeom, eyeMat); lEye.position.set(-0.03, 1.7, 0.085);
                const rEye = new THREE.Mesh(eyeGeom, eyeMat); rEye.position.set(0.03, 1.7, 0.085);
                hGroup.add(lEye, rEye);

                // Friendly Smile
                const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 12, Math.PI), eyeMat);
                mouth.position.set(0, 1.63, 0.085); mouth.rotation.x = 0.4;
                hGroup.add(mouth);

                const hair = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
                hair.position.y = 1.72;
                hGroup.add(hair);

                npcGroup.add(hGroup);

                // body
                const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.22), shirtMat);
                torso.position.y = 1.35;
                npcGroup.add(torso);

                const apron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.02), uniformMat);
                apron.position.set(0, 1.25, 0.12);
                npcGroup.add(apron);

                const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 16, Math.PI), shirtMat);
                collar.rotation.x = Math.PI / 2;
                collar.position.y = 1.63;
                npcGroup.add(collar);

                // Improved Arms with Joints for Animation
                const armGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.28);
                const lArm = new THREE.Mesh(armGeom, shirtMat);
                lArm.position.set(-0.25, 1.5, 0); lArm.rotation.z = 0.25;
                npcGroup.add(lArm);

                const rArmJoint = new THREE.Group();
                rArmJoint.position.set(0.25, 1.5, 0);
                const rArm = new THREE.Mesh(armGeom, shirtMat);
                rArm.position.y = -0.14;
                rArmJoint.add(rArm);
                rArmJoint.rotation.x = -1.1;
                npcGroup.add(rArmJoint);

                // hands
                const handGeom = new THREE.SphereGeometry(0.05, 8, 8);
                const lHand = new THREE.Mesh(handGeom, skinMat); lHand.position.set(-0.3, 1.25, 0.08); // MARKER_HANDS
                const rHand = new THREE.Mesh(handGeom, skinMat); rHand.position.set(0.3, 1.4, 0.3);
                npcGroup.add(lHand, rHand);

                npcGroup.position.set(nx, 0.1, nz);
                npcGroup.rotation.y = Math.PI;

                // Bind to animation refs
                npcRef.current = { group: npcGroup, head: hGroup, rArm: rArmJoint };
            }

            createCashierNPC(0, 0.5);
            cashierGroup.add(npcGroup);
        }

        // Place Cashier Desk near entrance/start
        createCashier(0, 48); // Centered at the "front"

        // --- Walls with Architectural Premium Decor ---
        const wallBaseMat = new THREE.MeshPhysicalMaterial({
            map: stoneTex,
            roughness: 0.9,
            metalness: 0.1,
            reflectivity: 0.2
        });
        const bronzeMat = new THREE.MeshPhysicalMaterial({
            color: 0x814c1e,
            metalness: 1.0,
            roughness: 0.2,
            clearcoat: 0.5
        });
        const goldMat = new THREE.MeshPhysicalMaterial({
            color: 0xaa8833,
            metalness: 1.0,
            roughness: 0.1,
            clearcoat: 1.0
        });

        function createArchitecturalFeature(parent: THREE.Group, type: "bronze" | "wood" | "light" | "art", index: number = 0) {
            const featureY = 0.5; // Centered eye-level height (relative to wall group)

            if (type === "bronze") {
                // Large Bronze Reflective Panel
                const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.2), bronzeMat);
                panel.position.set(0, featureY, 0.1);
                parent.add(panel);

                // Slim gold border
                const border = new THREE.Mesh(new THREE.BoxGeometry(8.4, 5.4, 0.05), goldMat);
                border.position.set(0, featureY, 0.05);
                parent.add(border);
            } else if (type === "art") {
                // SMALLER, MORE REFINED SQUARE ART PIECE
                const arts = [artTex1, artTex2, artTex3];
                const frameSize = 5.0;
                const paintSize = 4.7;

                const frame = new THREE.Mesh(new THREE.BoxGeometry(frameSize, frameSize, 0.15), goldMat);
                frame.position.set(0, featureY, 0.1);
                parent.add(frame);

                const painting = new THREE.Mesh(
                    new THREE.PlaneGeometry(paintSize, paintSize),
                    new THREE.MeshStandardMaterial({ map: arts[index % 3], roughness: 0.2 })
                );
                painting.position.set(0, featureY, 0.2);
                parent.add(painting);

                // Tight Spotlight for Small Art
                const sLight = new THREE.SpotLight(0xfff5e6, 40, 15, Math.PI / 6, 0.8);
                sLight.position.set(0, featureY + 3, 3);
                sLight.target = painting;
                parent.add(sLight);
            } else if (type === "wood") {
                // Vertical Slat Section
                for (let i = -4; i < 4; i += 0.45) {
                    const m = new THREE.MeshPhysicalMaterial({
                        map: woodTex,
                        roughness: 0.5,
                        clearcoat: 0.3
                    });
                    const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 5, 0.3), m);
                    s.position.set(i, featureY, 0.15);
                    parent.add(s);
                }
            } else {
                // Vertical Light Trough (Glowing Slot)
                const trough = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.2), ledMat);
                trough.position.set(0, 0, 0.1);
                parent.add(trough);
            }

            // Removed sconce point lights (Save resources)
            const sconceBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x050505 }));
            sconceBox.position.set(0, 2.5, 0.3);
            parent.add(sconceBox);
        }

        function createArchitecturalWall(width: number, height: number, depth: number, x: number, y: number, z: number, rotationY: number) {
            const wallGroup = new THREE.Group();

            // Slabs & Reveals
            let featureIdx = 0;
            for (let i = -width / 2; i < width / 2; i += 12) {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(11.8, height, depth), wallBaseMat);
                panel.position.set(i + 6, 0, 0);
                wallGroup.add(panel);

                // Gold inlay strip between slabs
                const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, depth + 0.05), goldMat);
                inlay.position.set(i + 12, 0, 0.02);
                wallGroup.add(inlay);

                // Add Features in a rhythm: Art -> Wood -> Bronze -> Light
                if (Math.abs(i) % 48 === 0) {
                    const featAnchor = new THREE.Group();
                    featAnchor.position.x = i + 6;
                    createArchitecturalFeature(featAnchor, "art", featureIdx++);
                    wallGroup.add(featAnchor);
                } else if (Math.abs(i) % 36 === 0) {
                    const featAnchor = new THREE.Group();
                    featAnchor.position.x = i + 6;
                    createArchitecturalFeature(featAnchor, "wood");
                    wallGroup.add(featAnchor);
                } else if (Math.abs(i) % 24 === 0) {
                    const featAnchor = new THREE.Group();
                    featAnchor.position.x = i + 6;
                    createArchitecturalFeature(featAnchor, "bronze");
                    wallGroup.add(featAnchor);
                } else {
                    const featAnchor = new THREE.Group();
                    featAnchor.position.x = i + 6;
                    createArchitecturalFeature(featAnchor, "light");
                    wallGroup.add(featAnchor);
                }
            }

            wallGroup.position.set(x, y, z);
            wallGroup.rotation.y = rotationY;
            scene.add(wallGroup);
        }

        // Left & Right Walls with Pure Architectural Style
        createArchitecturalWall(120, 6, 0.1, -35, 3, 0, Math.PI / 2);
        createArchitecturalWall(120, 6, 0.1, 35, 3, 0, -Math.PI / 2);

        // Back Wall: Central Brand Area "MAHALAK"
        const backWallGroup = new THREE.Group();
        const backBase = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 0.1), wallBaseMat);
        backWallGroup.add(backBase);

        // Brand Feature Plate
        const plate = new THREE.Mesh(new THREE.BoxGeometry(15, 4, 0.2), wallBaseMat);
        plate.position.set(0, 3.5, 0.11);
        backWallGroup.add(plate);

        // Gold Logo Placeholder (Large Rectangle)
        const logo = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 0.1), goldMat);
        logo.position.set(0, 3.5, 0.22);
        backWallGroup.add(logo);

        // Backlit Halo
        const halo = new THREE.PointLight(0xaa8833, 3, 25);
        halo.position.set(0, 3.5, 1.5);
        backWallGroup.add(halo);

        backWallGroup.position.set(0, 3, -55);
        scene.add(backWallGroup);

        // Entrance Welcome Sign (Behind Cashier)
        const welcomeGroup = new THREE.Group();
        const wBase = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 0.1), shelfMat);
        welcomeGroup.add(wBase);

        const wLogo = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 0.05), goldMat);
        wLogo.position.z = 0.1;
        welcomeGroup.add(wLogo);

        const wLight = new THREE.PointLight(0xfff5e6, 2, 15);
        wLight.position.set(0, 0, 2);
        welcomeGroup.add(wLight);

        welcomeGroup.position.set(0, 3.5, 49.8);
        scene.add(welcomeGroup);

        // --- REALISTIC SHOPPING CART MODEL ---
        const cartGroup = new THREE.Group();
        const cartMetalMat = new THREE.MeshStandardMaterial({
            color: 0xf5f5f5, // Much lighter, chrome-like silver
            metalness: 1.0,
            roughness: 0.1,
            envMapIntensity: 1.0
        });
        const plasticHandleMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5 }); // Red handle

        // 1. Support Frame (The "Chassis")
        const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.7), cartMetalMat);
        frameBottom.position.set(0, -0.35, -0.1);
        cartGroup.add(frameBottom);

        const verticalBarGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.6);
        const bars = [
            [-0.22, -0.05, 0.25], [0.22, -0.05, 0.25], // Back bars near user
            [-0.22, -0.05, -0.45], [0.22, -0.05, -0.45] // Front bars
        ];
        bars.forEach(([bx, by, bz]) => {
            const bar = new THREE.Mesh(verticalBarGeom, cartMetalMat);
            bar.position.set(bx, by, bz);
            cartGroup.add(bar);
        });

        // 2. Open Wire Basket (Grid Design)
        const basketGroup = new THREE.Group();
        for (let h = 0; h <= 0.4; h += 0.08) {
            const barF = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.02), cartMetalMat);
            const barB = barF.clone();
            const barL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.75), cartMetalMat);
            const barR = barL.clone();
            barF.position.set(0, h, -0.375);
            barB.position.set(0, h, 0.375);
            barL.position.set(-0.275, h, 0);
            barR.position.set(0.275, h, 0);
            basketGroup.add(barF, barB, barL, barR);
        }

        const wireGeom = new THREE.BoxGeometry(0.01, 0.4, 0.01);
        for (let x = -0.275; x <= 0.275; x += 0.05) {
            const wF = new THREE.Mesh(wireGeom, cartMetalMat);
            wF.position.set(x, 0.2, -0.375);
            const wB = wF.clone();
            wB.position.z = 0.375;
            basketGroup.add(wF, wB);
        }
        for (let z = -0.375; z <= 0.375; z += 0.05) {
            const wL = new THREE.Mesh(wireGeom, cartMetalMat);
            wL.position.set(-0.275, 0.2, z);
            const wR = wL.clone();
            wR.position.x = 0.275;
            basketGroup.add(wL, wR);
        }

        const basketBottom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.01, 0.75), new THREE.MeshStandardMaterial({ color: 0x888888, wireframe: true }));
        basketBottom.position.y = 0;
        basketGroup.add(basketBottom);

        const basketContents = new THREE.Group();
        basketContents.position.y = 0.1;
        basketGroup.add(basketContents);
        basketContentsRef.current = basketContents;

        basketGroup.position.set(0, -0.1, -0.1);
        cartGroup.add(basketGroup);

        // 3. Handle (Slimmed down for natural perspective)
        const handleSupportL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.4, 0.012), cartMetalMat);
        handleSupportL.position.set(-0.25, 0.45, 0.35);
        handleSupportL.rotation.x = 0.6;
        const handleSupportR = handleSupportL.clone();
        handleSupportR.position.x = 0.25;
        cartGroup.add(handleSupportL, handleSupportR);

        const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 16), plasticHandleMat);
        handleBar.rotation.z = Math.PI / 2;
        handleBar.position.set(0, 0.6, 0.45);
        cartGroup.add(handleBar);

        // 4. Wheels
        const wheelGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wheelPositions = [[-0.2, -0.4, 0.15], [0.2, -0.4, 0.15], [-0.2, -0.4, -0.45], [0.2, -0.4, -0.45]];
        wheelPositions.forEach(([wx, wy, wz]) => {
            const w = new THREE.Mesh(wheelGeom, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(wx, wy, wz);
            cartGroup.add(w);
        });

        cartGroup.position.set(0, -0.85, -1.2); // Pushed further and lower for natural feel
        camera.add(cartGroup);
        scene.add(camera);

        const keys: { [key: string]: boolean } = {};
        let targetRotationY = 0;

        const moveVec = new THREE.Vector3();
        const Y_AXIS = new THREE.Vector3(0, 1, 0);

        let animationId: number;
        let lastTime = performance.now();
        let frameCount = 0;

        function animate() {
            animationId = requestAnimationFrame(animate);

            // FPS Counter
            frameCount++;
            const t = performance.now();
            if (t >= lastTime + 1000) { setFps(frameCount); frameCount = 0; lastTime = t; }

            // Movement logic
            moveVec.set(0, 0, 0);
            if (keys['KeyW'] || keys['ArrowUp']) moveVec.z -= moveSpeed;
            if (keys['KeyS'] || keys['ArrowDown']) moveVec.z += moveSpeed;

            // Rotation logic via Keyboard (A / D or Arrows) - replaces strafing
            if (keys['KeyA'] || keys['ArrowLeft']) targetRotationY += 0.03;
            if (keys['KeyD'] || keys['ArrowRight']) targetRotationY -= 0.03;

            if (moveVec.lengthSq() > 0) {
                moveVec.normalize().multiplyScalar(moveSpeed);
                moveVec.applyAxisAngle(Y_AXIS, camera.rotation.y);
                camera.position.add(moveVec);

                camera.position.y = 1.6 + Math.sin(t * 0.01) * 0.03;
                camera.position.x = Math.max(-28, Math.min(28, camera.position.x));
                camera.position.z = Math.max(-42, Math.min(55, camera.position.z));
            } else {
                camera.position.y = 1.6;
            }

            // Apply smoothing to horizontal rotation
            if (Math.abs(targetRotationY - camera.rotation.y) > 0.001) {
                camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.15;
            }

            // NPC Lively Animation
            if (npcRef.current) {
                const time = t * 0.001;
                // Subtle breathing
                npcRef.current.group.position.y = Math.sin(time * 2) * 0.01;
                // Looking around
                npcRef.current.head.rotation.y = Math.sin(time * 0.5) * 0.2;
                npcRef.current.head.rotation.x = Math.sin(time * 0.8) * 0.1;
                // Hand movement on POS
                npcRef.current.rArm.rotation.x = -1.0 + Math.sin(time * 4) * 0.05;
            }

            // Lock vertical look (Pitch) and reset cart position
            camera.rotation.x = 0;
            cartGroup.rotation.set(0, 0, 0);
            cartGroup.position.set(0, -0.85, -1.2);

            camera.rotation.order = 'YXZ';
            renderer.render(scene, camera);
        }

        animate();

        const onKeyDown = (e: KeyboardEvent) => keys[e.code] = true;
        const onKeyUp = (e: KeyboardEvent) => keys[e.code] = false;

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // Start game logic (replaces pointer lock)
        const startGame = () => {
            setIsLockedState(true);
        };
        lockPointerRef.current = startGame;

        // Click to start when overlay is visible
        const onCanvasClick = (e: MouseEvent) => {
            if (!isLockedState && e.target === renderer.domElement) {
                startGame();
            }
        };
        renderer.domElement.addEventListener('click', onCanvasClick);

        const onMouseMove = (e: MouseEvent) => {
            // Update 2D cursor position
            setMousePos({ x: e.clientX, y: e.clientY });

            // Check for hover
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(clickableProducts, false);
            setIsHovering(intersects.length > 0);
        };
        document.addEventListener('mousemove', onMouseMove);

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const handleClick = (e: MouseEvent) => {
            // Only handle clicks on the canvas
            if (e.target !== renderer.domElement) return;

            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(clickableProducts, false);

            if (intersects.length > 0) {
                const mesh = intersects[0].object as THREE.Mesh;
                if (mesh.userData.clickable && mesh.userData.price) {
                    const p = mesh.userData;
                    // Access current state via ref
                    const { money: currentMoney, total: currentTotal } = stateRef.current;

                    if (currentTotal + p.price <= currentMoney) {
                        setCart(c => [...c, p]);
                        setTotal(t => t + p.price);
                        setMessage(`+ ${p.name}`);
                        setTimeout(() => setMessage(''), 1000);

                        const oldMat = mesh.material;
                        mesh.material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                        setTimeout(() => mesh.material = oldMat, 150);
                    } else {
                        setMessage("! رصيد غير كاف");
                        setTimeout(() => setMessage(''), 1000);
                    }
                }
            }
        }
        window.addEventListener('mousedown', handleClick);

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mousedown', handleClick);
            renderer.domElement.removeEventListener('click', onCanvasClick);
            document.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animationId);
            mountRef.current?.removeChild(renderer.domElement);
            renderer.dispose();
        }
    }, []);

    const handleCheckout = () => {
        if (total === 0) return;
        setMoney(m => m - total);
        setCart([]);
        setTotal(0);
        setShowCheckout(true);
    };

    const handleReset = () => {
        setCart([]);
        setTotal(0);
        setShowCheckout(false);
    };

    // --- Sync 3D Cart Visualization ---
    useEffect(() => {
        const group = basketContentsRef.current;
        if (!group) return;

        // Clear previous visual items
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }

        // Add visual products to 3D basket
        cart.forEach((item, index) => {
            // Simplified mini-mesh for performance
            const geom = item.category === 'produce'
                ? new THREE.SphereGeometry(0.08, 8, 8)
                : new THREE.BoxGeometry(0.12, 0.15, 0.1);

            const mat = new THREE.MeshStandardMaterial({
                color: item.color || 0xffffff,
                roughness: 0.5
            });

            const mesh = new THREE.Mesh(geom, mat);

            // Random-ish stacking inside the basket
            const rx = (Math.random() - 0.5) * 0.4;
            const ry = Math.floor(index / 4) * 0.15; // Stack upwards
            const rz = (Math.random() - 0.5) * 0.6;

            mesh.position.set(rx, ry, rz);
            mesh.rotation.set(Math.random(), Math.random(), Math.random());
            group.add(mesh);
        });
    }, [cart]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

            {/* FPS Counter */}
            <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                color: '#0f0',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                textShadow: '1px 1px 2px #000'
            }}>
                FPS: {fps}
            </div>

            {/* Management Dashboard Trigger */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                zIndex: 50
            }}>
                <button
                    onClick={() => toggleDashboard(true)}
                    style={{
                        background: '#4A90E2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 15px rgba(74, 144, 226, 0.4)',
                        fontFamily: 'sans-serif',
                        direction: 'rtl'
                    }}
                >
                    <LayoutGrid size={20} />
                    لوحة الإدارة
                </button>
            </div>

            {/* Dynamic 2D Cursor/Pointer */}
            <div style={{
                position: 'fixed',
                left: mousePos.x,
                top: mousePos.y,
                width: isHovering ? '36px' : '24px',
                height: isHovering ? '36px' : '24px',
                border: isHovering ? '3px solid #ffbb33' : '2px solid rgba(255,255,255,0.8)',
                borderRadius: '50%',
                backgroundColor: isHovering ? 'rgba(255, 187, 51, 0.2)' : 'transparent',
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)',
                transition: 'width 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.2s',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isHovering ? '0 0 15px rgba(255, 187, 51, 0.4)' : 'none'
            }}>
                <div style={{
                    width: isHovering ? '6px' : '4px',
                    height: isHovering ? '6px' : '4px',
                    backgroundColor: isHovering ? '#fff' : 'rgba(255,255,255,0.8)',
                    borderRadius: '50%',
                    boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                }} />
            </div>

            {/* Hidden system cursor to use our custom one */}
            <style>{`
                canvas { cursor: none !important; }
            `}</style>

            {/* Message */}
            {message && (
                <div style={{
                    position: 'absolute',
                    top: '40%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                    fontSize: '32px',
                    fontWeight: 'bold',
                    pointerEvents: 'none'
                }}>
                    {message}
                </div>
            )}

            {/* Cart UI - Glassmorphism */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: 'white',
                padding: '20px',
                borderRadius: '16px',
                width: '320px',
                direction: 'rtl',
                fontFamily: 'sans-serif',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
            }}>
                <h2 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px', color: '#e53935' }}>
                    🛒 الكاشير
                </h2>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '18px' }}>
                    <span>الرصيد:</span>
                    <span style={{ color: '#4caf50', fontWeight: 'bold' }}>${money.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '18px' }}>
                    <span>المجموع:</span>
                    <span style={{ color: '#ffeb3b', fontWeight: 'bold' }}>${total.toFixed(2)}</span>
                </div>

                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', marginBottom: '15px' }}>
                    {cart.map((item, i) => (
                        <div key={i} style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.9 }}>
                            • {item.name} - ${item.price}
                        </div>
                    ))}
                    {cart.length === 0 && <div style={{ textAlign: 'center', opacity: 0.5 }}>السلة فارغة</div>}
                </div>

                <button onClick={handleCheckout} style={{
                    width: '100%', padding: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px'
                }}>
                    دفع الحساب
                </button>
                <button onClick={handleReset} style={{
                    width: '100%', padding: '8px', background: 'transparent', color: '#ef5350', border: '1px solid #ef5350', borderRadius: '6px', cursor: 'pointer', marginTop: '10px'
                }}>
                    إفراغ
                </button>
            </div>

            {showCheckout && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
                }}>
                    <div style={{ background: '#222', padding: '40px', borderRadius: '20px', textAlign: 'center', border: '2px solid #4caf50' }}>
                        <h1 style={{ color: '#4caf50', margin: 0 }}>شكراً لزيارتكم!</h1>
                        <p style={{ color: '#ccc', margin: '20px 0' }}>تم خصم المبلغ بنجاح</p>
                        <button onClick={() => setShowCheckout(false)} style={{
                            padding: '10px 30px', background: '#2196f3', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontSize: '18px'
                        }}>
                            متابعة
                        </button>
                    </div>
                </div>
            )}

            {/* Click to Play Overlay */}
            {!isLockedState && (
                <div
                    onClick={() => {
                        lockPointerRef.current();
                    }}
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', zIndex: 100,
                        cursor: 'pointer', backdropFilter: 'blur(4px)'
                    }}
                >
                    <div style={{
                        background: 'rgba(255,255,255,0.1)', padding: '30px', borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', color: 'white'
                    }}>
                        <h2 style={{ margin: '0 0 10px 0' }}>اضغط للبدء</h2>
                        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>استخدم WASD أو الأسهم للحركة</p>
                        <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>استخدم الماوس لاختيار المنتجات</p>
                    </div>
                </div>
            )}
        </div>
    );
}
