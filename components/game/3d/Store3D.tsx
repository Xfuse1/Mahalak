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

    // Refs for accessing latest state inside event listeners without re-binding
    const stateRef = useRef({ money, total });
    useEffect(() => { stateRef.current = { money, total }; }, [money, total]);

    // Initial State and Constants
    const moveSpeed = 0.15;

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xb8d4f0);
        scene.fog = new THREE.Fog(0xb8d4f0, 20, 60);

        // Camera setup
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 80);
        camera.position.set(0, 1.6, 3);

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
        mountRef.current.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
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
        const boxGeometry = new THREE.BoxGeometry(0.32, 0.48, 0.26);

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
        const ctx = canvas.getContext('2d', { willReadFrequently: false });

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
                        ctx.moveTo(128, 20);
                        ctx.lineTo(20, 240);
                        ctx.lineTo(236, 240);
                        ctx.fill();
                        break;
                    default:
                        // Top/Bottom bars usually look good
                        ctx.fillRect(0, 0, 256, 50);
                        ctx.fillRect(0, 206, 256, 50);
                }

                // Label Background
                ctx.fillStyle = 'white';
                // Rounded rect
                ctx.beginPath();
                ctx.roundRect(20, 80, 216, 96, 10);
                ctx.fill();

                // Text
                ctx.fillStyle = '#111';
                ctx.font = 'bold 42px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(info.label, 128, 130);

                // Subtext / Weight
                ctx.fillStyle = '#666';
                ctx.font = '20px sans-serif';
                ctx.fillText(info.category.toUpperCase(), 128, 160);

                // Price Tag (Sticker look)
                ctx.fillStyle = '#ffecb3';
                ctx.beginPath();
                ctx.arc(200, 200, 45, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#d32f2f';
                ctx.font = 'bold 24px Arial';
                ctx.fillText(`$${Math.floor(info.price)}`, 200, 195);
                ctx.font = '16px Arial';
                ctx.fillText(`.${(info.price % 1).toFixed(2).substring(2)}`, 200, 215);

                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;

                const materials = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.4,
                    metalness: 0.1,
                    envMapIntensity: 0.5
                });

                productAssets.set(info.label, materials);
            });
        }

        const clickableProducts: THREE.Mesh[] = [];

        function createProductMesh(productInfo: any) {
            const material = productAssets.get(productInfo.label);
            if (!material) return null;

            // Optimization: Clone Geometry? No, reusing global geometry is better.
            const mesh = new THREE.Mesh(boxGeometry, material);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            // Add random slight rotation to look realistic
            mesh.rotation.y = (Math.random() - 0.5) * 0.1;
            mesh.userData = { ...productInfo, clickable: true };
            return mesh;
        }

        // Environment
        const floorGeometry = new THREE.PlaneGeometry(80, 120);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const ceilingGeometry = new THREE.PlaneGeometry(80, 120);
        const ceilingMaterial = new THREE.MeshBasicMaterial({ color: 0xd0d0d0 });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 6;
        scene.add(ceiling);

        // Optimized Lights - Row of lights over aisles
        const bulbGeometry = new THREE.BoxGeometry(0.6, 0.1, 80);
        const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe0 });
        const ceilingLightGroup = new THREE.Group();

        // Lights aligned with aisles
        [-16, -5, 5, 16].forEach(x => {
            const strip = new THREE.Mesh(bulbGeometry, bulbMaterial);
            strip.position.set(x, 5.9, 0);
            ceilingLightGroup.add(strip);
        });
        scene.add(ceilingLightGroup);

        const shelfGroupTemplate = new THREE.Group();
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
        const backPanelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });

        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 0.05), backPanelMat);
        backPanel.position.set(0, 1.6, -0.35);
        backPanel.castShadow = true;

        const supports = new THREE.Group();
        const supportGeom = new THREE.BoxGeometry(0.06, 3.2, 0.06);
        for (let i = 0; i < 4; i++) {
            const s = new THREE.Mesh(supportGeom, shelfMat);
            s.position.set(-3.3 + i * 2.2, 1.6, 0);
            supports.add(s);
        }

        const shelves = new THREE.Group();
        const shelfBoardGeom = new THREE.BoxGeometry(7, 0.04, 0.7);
        for (let lvl = 0; lvl < 6; lvl++) {
            const b = new THREE.Mesh(shelfBoardGeom, shelfMat);
            b.position.set(0, 0.2 + lvl * 0.55, 0); // Tighter shelves (6 levels)
            b.castShadow = true;
            b.receiveShadow = true;
            shelves.add(b);
        }

        function createPopulatedShelf(x: number, z: number, rotation: number, categories: string[]) {
            const shelf = new THREE.Group();
            shelf.add(backPanel.clone(), supports.clone(), shelves.clone());

            const allowedProducts = productLibrary.filter(p => categories.includes(p.category));
            if (allowedProducts.length === 0) return shelf;

            for (let lvl = 0; lvl < 6; lvl++) {
                const rowProduct = allowedProducts[Math.floor(Math.random() * allowedProducts.length)];
                // DENSE PACkING
                const rowCount = 18;

                for (let i = 0; i < rowCount; i++) {
                    const mesh = createProductMesh(rowProduct);
                    if (mesh) {
                        const xPos = -3.2 + i * 0.38;
                        // Small offsets for "stock" look
                        const zOffset = (Math.random() * 0.04) - 0.02;
                        mesh.position.set(xPos, 0.2 + lvl * 0.55 + 0.26, zOffset);
                        // Match shelf rotation
                        mesh.rotation.y += rotation;
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
        });

        const cartGroup = new THREE.Group();
        const cartMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, metalness: 0.6, roughness: 0.4 });
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
            if (keys['w'] || keys['arrowup']) moveVec.z -= moveSpeed;
            if (keys['s'] || keys['arrowdown']) moveVec.z += moveSpeed;
            if (keys['a'] || keys['arrowleft']) moveVec.x -= moveSpeed;
            if (keys['d'] || keys['arrowright']) moveVec.x += moveSpeed;

            if (moveVec.lengthSq() > 0) {
                moveVec.normalize().multiplyScalar(moveSpeed);
                moveVec.applyAxisAngle(Y_AXIS, camera.rotation.y);
                camera.position.add(moveVec);
                camera.position.y = 1.6 + Math.sin(t * 0.01) * 0.03;
                // Boundaries
                camera.position.x = Math.max(-28, Math.min(28, camera.position.x));
                camera.position.z = Math.max(-38, Math.min(35, camera.position.z));
            } else {
                camera.position.y = 1.6;
            }

            if (Math.abs(targetRotationY - camera.rotation.y) > 0.001) {
                camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.15;
            }

            renderer.render(scene, camera);
        }

        animate();

        window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

        let isLocked = false;
        // Lock pointer on click
        const lockPointer = () => renderer.domElement.requestPointerLock();
        renderer.domElement.addEventListener('click', lockPointer);

        const onPointerLockChange = () => isLocked = document.pointerLockElement === renderer.domElement;
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
            window.removeEventListener('mousedown', handleClick);
            window.removeEventListener('keydown', (e: any) => keys[e.key.toLowerCase()] = true); // Wait, lambda ref won't work for cleanup usually but here keys is persistent closure.
            // Actually, for cleaner cleanup we should name the handlers, but simple removal of non-named works if using signals or if we dont care about keys leak (window based). 
            // Best to just clean up the big ones:
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            document.removeEventListener('mousemove', onMouseMove);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
            cancelAnimationFrame(animationId);
        }

    }, []); // Empty dependency array as we use refs for state

    const handleCheckout = () => {
        if (total > 0 && total <= money) {
            setMoney(money - total);
            setShowCheckout(true);
        }
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

            {/* Cart UI */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '20px',
                borderRadius: '12px',
                width: '300px',
                direction: 'rtl',
                fontFamily: 'sans-serif',
                border: '1px solid #444'
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
                    {cart.length === 0 ? <div style={{ textAlign: 'center', color: '#888' }}>العربة فارغة</div> :
                        cart.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px' }}>
                                <span>{item.name}</span>
                                <span>${item.price}</span>
                            </div>
                        ))
                    }
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

        </div>
    );
}
