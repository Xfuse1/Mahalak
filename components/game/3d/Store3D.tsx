"use client";

import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

export default function SupermarketSimulator() {
    const mountRef = useRef<HTMLDivElement>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [money, setMoney] = useState(500);
    const [showCheckout, setShowCheckout] = useState(false);
    const [message, setMessage] = useState('');
    const [fps, setFps] = useState(60);
    const [isLockedState, setIsLockedState] = useState(false);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    // Refs for accessing latest state inside event listeners without re-binding
    const stateRef = useRef({ money, total });
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

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            precision: "mediump"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        rendererRef.current = renderer;
        mountRef.current.appendChild(renderer.domElement);

        // Lighting - Significantly brighter for a vibrant hypermarket feel
        const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.5);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.0); // Stronger sun
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 100;
        sunLight.shadow.camera.left = -30;
        sunLight.shadow.camera.right = 30;
        sunLight.shadow.camera.top = 30;
        sunLight.shadow.camera.bottom = -30;
        scene.add(sunLight);

        // Texture Generation (Realistic Brands & Variety)
        const productLibrary = [
            // --- DAIRY & FRIDGE ---
            { name: 'حليب المراعي', color: 0x1e88e5, label: 'ALMARAI', price: 6.50, category: 'dairy', pattern: 'stripe' },
            { name: 'حليب نادك', color: 0xffffff, label: 'NADEC', price: 6.00, category: 'dairy', pattern: 'simple' },
            { name: 'زبادي', color: 0xe3f2fd, label: 'YOGURT', price: 2.50, category: 'dairy', pattern: 'circle' },
            { name: 'جبنة شيدر', color: 0xffc107, label: 'CHEDDAR', price: 12.00, category: 'dairy', pattern: 'block' },
            { name: 'زبدة', color: 0xffeb3b, label: 'BUTTER', price: 8.50, category: 'dairy', pattern: 'simple' },
            { name: 'كريمة طبخ', color: 0xf48fb1, label: 'CREAM', price: 14.00, category: 'dairy', pattern: 'curve' },

            // --- DRINKS ---
            { name: 'كوكاكولا', color: 0xb71c1c, label: 'COLA', price: 3.00, category: 'drinks', pattern: 'curve' },
            { name: 'بيبسي', color: 0x1565c0, label: 'PEPSI', price: 3.00, category: 'drinks', pattern: 'circle' },
            { name: 'سفن اب', color: 0x2e7d32, label: '7UP', price: 3.00, category: 'drinks', pattern: 'simple' },
            { name: 'عصير برتقال', color: 0xff9800, label: 'ORANGE', price: 7.00, category: 'drinks', pattern: 'fresh' },
            { name: 'عصير تفاح', color: 0x8bc34a, label: 'APPLE', price: 6.50, category: 'drinks', pattern: 'fresh' },
            { name: 'مياه معدنية', color: 0x81d4fa, label: 'WATER', price: 1.50, category: 'drinks', pattern: 'simple' },
            { name: 'مشروب طاقة', color: 0x212121, label: 'POWER', price: 12.00, category: 'drinks', pattern: 'bolt' },
            { name: 'ايس تي', color: 0x8d6e63, label: 'ICE TEA', price: 5.00, category: 'drinks', pattern: 'leaf' },

            // --- SNACKS & CANDY ---
            { name: 'شيبسي ملح', color: 0xffd600, label: 'CHIPS', price: 5.00, category: 'snacks', pattern: 'circle' },
            { name: 'شيبسي حار', color: 0xd32f2f, label: 'HOT', price: 5.00, category: 'snacks', pattern: 'fire' },
            { name: 'دوريتوس', color: 0xbf360c, label: 'NACHO', price: 6.00, category: 'snacks', pattern: 'triangle' },
            { name: 'بسكويت شاي', color: 0xd7ccc8, label: 'BISCUIT', price: 3.50, category: 'snacks', pattern: 'grid' },
            { name: 'شوكولاتة', color: 0x3e2723, label: 'CHOCO', price: 4.00, category: 'snacks', pattern: 'flow' },
            { name: 'ويفر', color: 0xffcc80, label: 'WAFER', price: 3.00, category: 'snacks', pattern: 'stripe' },
            { name: 'فشار', color: 0xfff59d, label: 'POP', price: 4.50, category: 'snacks', pattern: 'dots' },

            // --- BREAKFAST ---
            { name: 'كورن فليكس', color: 0xff5722, label: 'CORN', price: 18.00, category: 'breakfast', pattern: 'rooster' },
            { name: 'كوكو بوبس', color: 0x5d4037, label: 'COCO', price: 19.00, category: 'breakfast', pattern: 'coco' },
            { name: 'شوفان', color: 0x8d6e63, label: 'OATS', price: 15.00, category: 'breakfast', pattern: 'grain' },
            { name: 'مربى فراولة', color: 0xc2185b, label: 'JAM', price: 11.00, category: 'breakfast', pattern: 'fruit' },
            { name: 'عسل طبيعي', color: 0xffb300, label: 'HONEY', price: 35.00, category: 'breakfast', pattern: 'hex' },

            // --- PANTRY ---
            { name: 'أرز بسمتي', color: 0xffecb3, label: 'RICE', price: 45.00, category: 'pantry', pattern: 'grain' },
            { name: 'مكرونة', color: 0xffd54f, label: 'PASTA', price: 5.00, category: 'pantry', pattern: 'wheat' },
            { name: 'زيت ذرة', color: 0xffeb3b, label: 'OIL', price: 28.00, category: 'pantry', pattern: 'drop' },
            { name: 'سمن نباتي', color: 0x4caf50, label: 'GHEE', price: 32.00, category: 'pantry', pattern: 'cow' },
            { name: 'صلصة طماطم', color: 0xb71c1c, label: 'TOMATO', price: 4.00, category: 'pantry', pattern: 'red_circle' },
            { name: 'تونة', color: 0x90a4ae, label: 'TUNA', price: 7.50, category: 'pantry', pattern: 'fish' },
            { name: 'فول مدمس', color: 0x795548, label: 'BEANS', price: 3.50, category: 'pantry', pattern: 'bean' },
            { name: 'سكر', color: 0xf5f5f5, label: 'SUGAR', price: 14.00, category: 'pantry', pattern: 'sugar' },
            { name: 'دقيق', color: 0xffffff, label: 'FLOUR', price: 12.00, category: 'pantry', pattern: 'wheat' },
            { name: 'ملح', color: 0xe0f7fa, label: 'SALT', price: 2.00, category: 'pantry', pattern: 'crystal' },

            // --- HOUSEHOLD & CLEANING ---
            { name: 'مسحوق غسيل', color: 0x1565c0, label: 'TIDE', price: 45.00, category: 'household', pattern: 'swirl' },
            { name: 'سائل جلي', color: 0x76ff03, label: 'FAIRY', price: 12.00, category: 'household', pattern: 'bubble' },
            { name: 'منعم ملابس', color: 0xec407a, label: 'SOFT', price: 18.00, category: 'household', pattern: 'flower' },
            { name: 'شامبو', color: 0x5c6bc0, label: 'SHAMPOO', price: 16.00, category: 'household', pattern: 'wave' },
            { name: 'صابون', color: 0xffcdd2, label: 'SOAP', price: 4.00, category: 'household', pattern: 'clean' },
            { name: 'مناديل', color: 0xffffff, label: 'TISSUE', price: 22.00, category: 'household', pattern: 'soft' }
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

                // Label area
                ctx.fillStyle = '#fff';
                ctx.fillRect(20, 160, 216, 60);

                // Text
                ctx.fillStyle = '#000';
                ctx.font = 'bold 36px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(info.label, 128, 205);

                // Price tag
                ctx.fillStyle = '#ffeb3b';
                ctx.beginPath();
                ctx.arc(200, 220, 40, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#c62828';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(`$${info.price}`, 200, 220);

                const tex = new THREE.CanvasTexture(canvas);
                const mat = new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.3 });
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

            // Pot: High-End Polished Gold Designer Pot
            const potMat = new THREE.MeshPhysicalMaterial({
                color: 0xaa8833, // Gold
                metalness: 1.0,
                roughness: 0.1,
                clearcoat: 1.0
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

            // Add a subtle point light to make the gold pot and plant pop
            const pLight = new THREE.PointLight(0xfff5e6, 5, 8);
            pLight.position.set(x, 3, z);
            scene.add(pLight);
        }

        pillarPositions.forEach(([x, y, z]) => {
            const pillar = new THREE.Mesh(pillarGeom, pillarMat);
            pillar.position.set(x, y, z);
            scene.add(pillar);

            // Add Premium Plant with Gold Pot for visual pop
            createPremiumPlant(x, z + 2);
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
            const baseGeom = new THREE.CylinderGeometry(4, 4, 0.8, 8); // Octagonal base
            const base = new THREE.Mesh(baseGeom, shelfMat);
            base.position.y = 0.4;
            island.add(base);

            const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.6, 8), shelfMat);
            tier2.position.y = 1.1;
            island.add(tier2);

            // Featured Products on the island
            const featuredInfo = productLibrary.find(p => p.category === 'drinks');
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const p = createProductMesh(featuredInfo);
                if (p) {
                    p.position.set(Math.cos(angle) * 3, 1.1 + 0.24, Math.sin(angle) * 3);
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
            const geom = new THREE.BoxGeometry(0.35, 0.48, 0.3);
            const mesh = new THREE.Mesh(geom, productAssets.get(info.name));
            mesh.userData = { ...info, clickable: true };
            return mesh;
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

        // FULL STORE LAYOUT
        const aisleLayouts = [
            // Left Wall (Single Sided)
            { x: -28, zStart: -45, zEnd: 45, type: 'wall_right', categories: ['household', 'pantry'] },
            // Aisle 1 (Double)
            { x: -14, zStart: -40, zEnd: 40, type: 'aisle', categories: ['dairy', 'drinks', 'breakfast'] },
            // Aisle 2 (Double)
            { x: 0, zStart: -40, zEnd: 40, type: 'aisle', categories: ['snacks', 'pantry'] },
            // Aisle 3 (Double)
            { x: 14, zStart: -40, zEnd: 40, type: 'aisle', categories: ['drinks', 'household'] },
            // Right Wall (Single Sided)
            { x: 28, zStart: -45, zEnd: 45, type: 'wall_left', categories: ['pantry', 'dairy'] }
        ];

        aisleLayouts.forEach(layout => {
            // Continuous Shelves (Small step to avoid gaps)
            for (let z = layout.zStart; z < layout.zEnd; z += 7.1) {

                if (layout.type === 'aisle') {
                    createPopulatedShelf(layout.x, z, 0, layout.categories);
                    createPopulatedShelf(layout.x, z, Math.PI, layout.categories);
                } else if (layout.type === 'wall_right') {
                    // Wall on left, facing right (0 rotation)
                    createPopulatedShelf(layout.x, z, 0, layout.categories);
                } else if (layout.type === 'wall_left') {
                    // Wall on right, facing left (PI rotation)
                    createPopulatedShelf(layout.x, z, Math.PI, layout.categories);
                }
            }

            // ADD AISLE POINT LIGHTS (Brighter walkways)
            const aisleLight = new THREE.PointLight(0xfff5e6, 15, 30);
            aisleLight.position.set(layout.x, 5, 0);
            scene.add(aisleLight);
        });

        // End-Caps (Shelves at the ends of aisles)
        const endCapZ = [-41.2, 41.2];
        [-14, 0, 14].forEach(x => {
            endCapZ.forEach(z => {
                const categories = ['snacks', 'drinks'];
                const rotation = z > 0 ? 0 : Math.PI;
                // Rotate to face the walkway at the ends
                createPopulatedShelf(x, z, rotation + Math.PI / 2, categories);
            });
        });

        // --- CASHIER AREA (Executive Design) ---
        function createCashier(x: number, z: number) {
            const cashierGroup = new THREE.Group();

            // 1. Executive Counter
            const counterMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }); // Dark wood/matte
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

            // High-End Up-Down Sconce (Elegant Black & Gold)
            const sconceBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x050505 }));
            sconceBox.position.set(0, 2.5, 0.3);
            parent.add(sconceBox);

            const upLight = new THREE.PointLight(0xfff5e6, 8, 10);
            upLight.position.set(0, 3, 0.4);
            parent.add(upLight);

            const downLight = new THREE.PointLight(0xfff5e6, 8, 10);
            downLight.position.set(0, 2, 0.4);
            parent.add(downLight);
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

        const cartGroup = new THREE.Group();
        const cartMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }); // Metallic Dark Grey
        const basket = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), cartMat);
        basket.castShadow = true;
        cartGroup.add(basket);

        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0, 0.2, -0.45);
        cartGroup.add(handle);

        cartGroup.position.set(0, -0.6, -1);
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
            if (keys['KeyA'] || keys['ArrowLeft']) moveVec.x -= moveSpeed;
            if (keys['KeyD'] || keys['ArrowRight']) moveVec.x += moveSpeed;

            if (moveVec.lengthSq() > 0) {
                moveVec.normalize().multiplyScalar(moveSpeed);
                moveVec.applyAxisAngle(Y_AXIS, camera.rotation.y);
                camera.position.add(moveVec);
                camera.position.y = 1.6 + Math.sin(t * 0.01) * 0.03;
                // Boundaries (Increased Z to allow reaching cashier at 48)
                camera.position.x = Math.max(-28, Math.min(28, camera.position.x));
                camera.position.z = Math.max(-42, Math.min(55, camera.position.z));
            } else {
                camera.position.y = 1.6;
            }

            if (Math.abs(targetRotationY - camera.rotation.y) > 0.001) {
                camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.15;
            }

            renderer.render(scene, camera);
        }

        animate();

        const onKeyDown = (e: KeyboardEvent) => keys[e.code] = true;
        const onKeyUp = (e: KeyboardEvent) => keys[e.code] = false;

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        let isLocked = false;
        // Lock pointer on click - with error handling
        const lockPointer = () => {
            try {
                const promise = renderer.domElement.requestPointerLock() as any;
                if (promise && typeof promise.catch === 'function') {
                    promise.catch((err: any) => {
                        // Suppress pointer lock errors as they are common and usually non-fatal
                        console.warn("Pointer lock request failed:", err);
                    });
                }
            } catch (err) {
                console.warn("Browser blocked pointer lock request:", err);
            }
        };

        renderer.domElement.addEventListener('click', lockPointer);

        const onPointerLockChange = () => {
            const locked = document.pointerLockElement === renderer.domElement;
            isLocked = locked;
            setIsLockedState(locked);
        };
        document.addEventListener('pointerlockchange', onPointerLockChange);

        const onMouseMove = (e: MouseEvent) => {
            if (isLocked) targetRotationY -= e.movementX * 0.0022;
        };
        document.addEventListener('mousemove', onMouseMove);

        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0);

        const handleClick = () => {
            if (!isLocked) return;
            raycaster.setFromCamera(center, camera);
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
            document.removeEventListener('pointerlockchange', onPointerLockChange);
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

            {/* Crosshair */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px',
                background: 'rgba(255,255,255,0.8)',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                pointerEvents: 'none',
                boxShadow: '0 0 4px #000'
            }} />

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
                    onClick={async (e) => {
                        const target = e.currentTarget;
                        if (document.pointerLockElement) return;

                        try {
                            if (rendererRef.current) {
                                // Some browsers return a promise, some don't.
                                const result = rendererRef.current.domElement.requestPointerLock();
                                if (result && typeof result.catch === 'function') {
                                    await result.catch((err: any) => {
                                        if (err.name !== 'NotAllowedError' && err.name !== 'SecurityError') {
                                            console.error("Pointer lock error:", err);
                                        }
                                    });
                                }
                            }
                        } catch (err) {
                            console.warn("Pointer lock request ignored or failed:", err);
                        }
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
                        <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>حرك الماوس للنظر حولك</p>
                    </div>
                </div>
            )}
        </div>
    );
}
