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

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xb8d4f0);
        scene.fog = new THREE.Fog(0xb8d4f0, 25, 70);

        // Camera setup (First Person POV - exactly like the image)
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 1.6, 3);

        // Renderer with better quality
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // Enhanced Lighting (brighter like supermarket)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 0.7);
        sunLight.position.set(15, 25, 15);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = -40;
        sunLight.shadow.camera.right = 40;
        sunLight.shadow.camera.top = 40;
        sunLight.shadow.camera.bottom = -40;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        scene.add(sunLight);

        // Ceiling lights array (like in the image)
        const ceilingLights = [];
        for (let i = -30; i < 50; i += 5) {
            for (let j = -8; j < 8; j += 4) {
                const light = new THREE.PointLight(0xfffef0, 0.6, 15);
                light.position.set(j, 5.8, i);
                scene.add(light);
                ceilingLights.push(light);

                // Light fixture (visible bulb)
                const bulbGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.8);
                const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe0 });
                const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
                bulb.position.copy(light.position);
                bulb.position.y = 5.7;
                scene.add(bulb);
            }
        }

        // Floor - white glossy tile (like supermarket)
        const floorGeometry = new THREE.PlaneGeometry(80, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.15,
            metalness: 0.05
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Floor tiles pattern
        const tileLinesMaterial = new THREE.LineBasicMaterial({ color: 0xe0e0e0 });
        for (let i = -40; i < 50; i += 1) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-40, 0.01, i),
                new THREE.Vector3(40, 0.01, i)
            ]);
            scene.add(new THREE.Line(lineGeometry, tileLinesMaterial));

            const lineGeometry2 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, 0.01, -50),
                new THREE.Vector3(i, 0.01, 50)
            ]);
            scene.add(new THREE.Line(lineGeometry2, tileLinesMaterial));
        }

        // Ceiling (gray like image)
        const ceilingGeometry = new THREE.PlaneGeometry(80, 100);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xd0d0d0 });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 6;
        scene.add(ceiling);

        // Ceiling beams (like the image - beige/tan color)
        const beamMaterial = new THREE.MeshStandardMaterial({ color: 0xdac490 });
        for (let i = -30; i < 50; i += 10) {
            const beam = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.4, 100),
                beamMaterial
            );
            beam.position.set(0, 5.8, i - 25);
            beam.castShadow = true;
            scene.add(beam);

            // Cross beams
            const crossBeam = new THREE.Mesh(
                new THREE.BoxGeometry(80, 0.3, 0.4),
                beamMaterial
            );
            crossBeam.position.set(0, 5.9, i);
            scene.add(crossBeam);
        }

        // Walls
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f8f8 });

        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 6), wallMaterial);
        backWall.position.set(0, 3, -50);
        backWall.receiveShadow = true;
        scene.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(100, 6), wallMaterial);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-40, 3, 0);
        scene.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(100, 6), wallMaterial);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(40, 3, 0);
        scene.add(rightWall);

        // Product library (MORE VARIETY)
        const productLibrary = [
            // Cereals (Red boxes - like Corn Flakes)
            { name: 'كورن فليكس', color: 0xff3333, label: 'CEREAL', price: 4.99, category: 'cereal' },
            { name: 'شوكو بوبس', color: 0xd32f2f, label: 'CHOCO', price: 5.49, category: 'cereal' },
            { name: 'رايس كريسبي', color: 0xe53935, label: 'RICE', price: 4.49, category: 'cereal' },

            // Milk & Dairy (Blue/White)
            { name: 'حليب كامل الدسم', color: 0x2196f3, label: 'MILK', price: 3.99, category: 'dairy' },
            { name: 'حليب قليل الدسم', color: 0x64b5f6, label: 'LIGHT', price: 3.49, category: 'dairy' },
            { name: 'لبن زبادي', color: 0xffffff, label: 'YOGURT', price: 2.99, category: 'dairy' },

            // Juices (Orange, Green, Yellow)
            { name: 'عصير برتقال', color: 0xff9800, label: 'ORANGE', price: 5.99, category: 'juice' },
            { name: 'عصير تفاح أخضر', color: 0x8bc34a, label: 'APPLE', price: 5.49, category: 'juice' },
            { name: 'عصير مانجو', color: 0xffeb3b, label: 'MANGO', price: 6.49, category: 'juice' },
            { name: 'عصير فراولة', color: 0xe91e63, label: 'BERRY', price: 5.99, category: 'juice' },

            // Canned goods (Yellow, Green, Red)
            { name: 'ذرة معلبة', color: 0xffd54f, label: 'CORN', price: 2.49, category: 'canned' },
            { name: 'فول معلب', color: 0x8bc34a, label: 'BEANS', price: 2.99, category: 'canned' },
            { name: 'طماطم معلبة', color: 0xf44336, label: 'TOMATO', price: 3.49, category: 'canned' },
            { name: 'فاصوليا خضراء', color: 0x66bb6a, label: 'GREEN', price: 2.79, category: 'canned' },

            // Snacks (Various colors)
            { name: 'شيبسي', color: 0xff5722, label: 'CHIPS', price: 3.99, category: 'snacks' },
            { name: 'بسكويت', color: 0xdaa520, label: 'COOKIE', price: 4.49, category: 'snacks' },
            { name: 'شوكولاتة', color: 0x5d4037, label: 'CHOCO', price: 5.99, category: 'snacks' },

            // Beverages (Red, Blue, Green cans)
            { name: 'كولا', color: 0xd32f2f, label: 'COLA', price: 1.99, category: 'soda' },
            { name: 'سبرايت', color: 0x4caf50, label: 'SPRITE', price: 1.99, category: 'soda' },
            { name: 'فانتا', color: 0xff9800, label: 'FANTA', price: 1.99, category: 'soda' },
            { name: 'مياه معدنية', color: 0x64b5f6, label: 'WATER', price: 0.99, category: 'water' },

            // Pasta & Rice (Yellow boxes)
            { name: 'معكرونة', color: 0xfdd835, label: 'PASTA', price: 3.49, category: 'grains' },
            { name: 'أرز أبيض', color: 0xfff9c4, label: 'RICE', price: 6.99, category: 'grains' },
            { name: 'سباغيتي', color: 0xffeb3b, label: 'SPAGH', price: 3.99, category: 'grains' },
        ];

        const clickableProducts: THREE.Object3D[] = [];

        // Enhanced product creation with realistic labels
        function createProduct(productInfo: any, canvas: HTMLCanvasElement) {
            const group = new THREE.Group();

            const geometry = new THREE.BoxGeometry(0.32, 0.48, 0.26);

            const ctx = canvas.getContext('2d');
            if (!ctx) return group;

            canvas.width = 512;
            canvas.height = 512;

            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, 512);
            const baseColor = `#${productInfo.color.toString(16).padStart(6, '0')}`;
            gradient.addColorStop(0, baseColor);
            gradient.addColorStop(1, adjustBrightness(baseColor, -30));
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);

            // Brand label background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillRect(40, 180, 432, 120);

            // Product label
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 72px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(productInfo.label, 256, 255);

            // Price tag (like supermarket sticker)
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(60, 350, 392, 100);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeRect(60, 350, 392, 100);

            ctx.fillStyle = '#d32f2f';
            ctx.font = 'bold 64px Arial';
            ctx.fillText(`$${productInfo.price}`, 256, 420);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            texture.colorSpace = THREE.SRGBColorSpace;

            // Explicitly define materials with specific type
            const materials = [
                new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ color: adjustBrightness(baseColor, -20), metalness: 0.1, roughness: 0.7 }),
                new THREE.MeshStandardMaterial({ color: adjustBrightness(baseColor, -20), metalness: 0.1, roughness: 0.7 }),
                new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
            ];

            const mesh = new THREE.Mesh(geometry, materials);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { ...productInfo, clickable: true };

            group.add(mesh);
            return group;
        }

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

        // Create realistic shelf (GRAY like the image)
        function createShelf(x: number, z: number, rotation: number, side: string) {
            const shelfGroup = new THREE.Group();

            const shelfMaterial = new THREE.MeshStandardMaterial({
                color: 0xa0a0a0,
                metalness: 0.5,
                roughness: 0.5
            });

            // Back panel (white like image)
            const backPanel = new THREE.Mesh(
                new THREE.BoxGeometry(7, 3.2, 0.05),
                new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
            );
            backPanel.position.set(0, 1.6, -0.35);
            backPanel.castShadow = true;
            backPanel.receiveShadow = true;
            shelfGroup.add(backPanel);

            // Vertical metal supports
            for (let i = 0; i < 6; i++) {
                const support = new THREE.Mesh(
                    new THREE.BoxGeometry(0.06, 3.2, 0.06),
                    shelfMaterial
                );
                support.position.set(-3.3 + i * 1.4, 1.6, 0);
                support.castShadow = true;
                shelfGroup.add(support);
            }

            // 6 shelf levels (MORE shelves like the image)
            const canvas = document.createElement('canvas');
            for (let level = 0; level < 6; level++) {
                const shelfBoard = new THREE.Mesh(
                    new THREE.BoxGeometry(7, 0.04, 0.7),
                    shelfMaterial
                );
                const yPos = 0.2 + level * 0.55;
                shelfBoard.position.set(0, yPos, 0);
                shelfBoard.castShadow = true;
                shelfBoard.receiveShadow = true;
                shelfGroup.add(shelfBoard);

                // Products on shelf (PACKED like the image)
                const productsPerRow = 18; // MORE products
                for (let i = 0; i < productsPerRow; i++) {
                    const productInfo = productLibrary[Math.floor(Math.random() * productLibrary.length)];
                    const product = createProduct(productInfo, canvas);

                    const xPos = -3.2 + (i * 0.38);
                    const zPos = side === 'front' ? 0.2 : -0.2;

                    product.position.set(xPos, yPos + 0.26, zPos);
                    if (Math.random() > 0.5) product.rotation.y = Math.PI;

                    shelfGroup.add(product);
                    clickableProducts.push(product.children[0]);
                }
            }

            shelfGroup.position.set(x, 0, z);
            shelfGroup.rotation.y = rotation;
            scene.add(shelfGroup);
        }

        // Create MANY aisles (like supermarket in image)
        const aisles = [
            { x: -10, name: 'Aisle 1' },
            { x: -3.5, name: 'Aisle 2' },
            { x: 3, name: 'Aisle 3' },
            { x: 9.5, name: 'Aisle 4' }
        ];

        aisles.forEach(aisle => {
            for (let i = -35; i < 40; i += 13) {
                createShelf(aisle.x, i, 0, 'front');
                createShelf(aisle.x, i, Math.PI, 'back');
            }
        });

        // Shopping cart (RED like the image - more detailed)
        const cartGroup = new THREE.Group();

        const cartMaterial = new THREE.MeshStandardMaterial({
            color: 0xe53935,
            metalness: 0.7,
            roughness: 0.3
        });

        // Main basket with wire frame
        const basketGeometry = new THREE.BoxGeometry(0.65, 0.45, 0.85);
        const basket = new THREE.Mesh(basketGeometry, cartMaterial);
        basket.castShadow = true;
        cartGroup.add(basket);

        // Wire frame lines (white stripes)
        const wireGeometry = new THREE.EdgesGeometry(basketGeometry);
        const wireMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        const wireLines = new THREE.LineSegments(wireGeometry, wireMaterial);
        basket.add(wireLines);

        // Handle bar
        const handleBar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.75),
            cartMaterial
        );
        handleBar.rotation.z = Math.PI / 2;
        handleBar.position.set(0, 0.22, -0.48);
        cartGroup.add(handleBar);

        // Wheels (black)
        const wheelGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.05);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });

        const wheelPositions = [
            [-0.28, -0.32, 0.38],
            [0.28, -0.32, 0.38],
            [-0.28, -0.32, -0.38],
            [0.28, -0.32, -0.38]
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(...(pos as [number, number, number]));
            wheel.castShadow = true;
            cartGroup.add(wheel);
        });

        cartGroup.position.set(0, 0.22, 0.9);
        camera.add(cartGroup);
        scene.add(camera);

        // Controls
        const keys: { [key: string]: boolean } = {};
        const moveSpeed = 0.12;
        let mouseX = 0;
        let targetRotationY = 0;
        let lastTime = performance.now();
        let frameCount = 0;

        window.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });

        let isPointerLocked = false;

        // Add click listener immediately to renderer
        const lockPointer = () => {
            if (!isPointerLocked && renderer.domElement) {
                renderer.domElement.requestPointerLock();
            }
        };
        renderer.domElement.addEventListener('click', lockPointer);

        const onPointerLockChange = () => {
            isPointerLocked = document.pointerLockElement === renderer.domElement;
        };
        document.addEventListener('pointerlockchange', onPointerLockChange);

        const onMouseMove = (e: MouseEvent) => {
            if (isPointerLocked) {
                targetRotationY -= e.movementX * 0.002;
            } else {
                mouseX = (e.clientX / window.innerWidth) * 2 - 1;
                targetRotationY = mouseX * 0.6;
            }
        };
        document.addEventListener('mousemove', onMouseMove);

        // Click to buy
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onWindowClick = (event: MouseEvent) => {
            // If we are pointer locked, the mouse is "center"
            if (isPointerLocked) {
                mouse.x = 0;
                mouse.y = 0;
            } else {
                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            }

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(clickableProducts);

            if (intersects.length > 0) {
                const product = intersects[0].object as THREE.Mesh;
                if (product.userData.clickable) {
                    const productInfo = product.userData;

                    if (total + productInfo.price <= money) {
                        setCart(prev => [...prev, productInfo]);
                        setTotal(prev => prev + productInfo.price);
                        setMessage(`✅ ${productInfo.name} - $${productInfo.price}`);

                        // Flash effect
                        const materials = product.material;
                        if (Array.isArray(materials)) {
                            // Store original colors
                            const origColors: (THREE.Color | null)[] = materials.map((m: THREE.Material) =>
                                (m instanceof THREE.MeshStandardMaterial && m.color) ? m.color.clone() : null
                            );

                            // Set flash color
                            materials.forEach((mat: THREE.Material) => {
                                if (mat instanceof THREE.MeshStandardMaterial && mat.color) {
                                    mat.color.setHex(0x00ff00);
                                }
                            });

                            setTimeout(() => {
                                materials.forEach((mat: THREE.Material, idx: number) => {
                                    const orig = origColors[idx];
                                    if (mat instanceof THREE.MeshStandardMaterial && mat.color && orig) {
                                        mat.color.copy(orig);
                                    }
                                });
                                setMessage('');
                            }, 400);
                        }
                    } else {
                        setMessage('❌ مال غير كافٍ!');
                        setTimeout(() => setMessage(''), 1500);
                    }
                }
            }
        };
        window.addEventListener('click', onWindowClick);

        // Animation
        let animationId: number;
        function animate() {
            animationId = requestAnimationFrame(animate);

            // FPS counter
            frameCount++;
            const currentTime = performance.now();
            if (currentTime >= lastTime + 1000) {
                setFps(frameCount);
                frameCount = 0;
                lastTime = currentTime;
            }

            // Movement
            const moveVector = new THREE.Vector3();

            if (keys['w'] || keys['arrowup']) moveVector.z -= moveSpeed;
            if (keys['s'] || keys['arrowdown']) moveVector.z += moveSpeed;
            if (keys['a'] || keys['arrowleft']) moveVector.x -= moveSpeed;
            if (keys['d'] || keys['arrowright']) moveVector.x += moveSpeed;

            moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
            camera.position.add(moveVector);

            // Boundaries
            camera.position.x = Math.max(-35, Math.min(35, camera.position.x));
            camera.position.z = Math.max(-45, Math.min(45, camera.position.z));

            // Smooth rotation
            camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.08;

            renderer.render(scene, camera);
        }

        animate();

        // Resize handler
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('click', onWindowClick);
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            document.removeEventListener('mousemove', onMouseMove);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            cancelAnimationFrame(animationId);
            renderer.dispose();
        };
    }, []); // Run only once on mount

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
                background: 'rgba(0,0,0,0.7)',
                color: '#0f0',
                padding: '8px 15px',
                borderRadius: '5px',
                fontFamily: 'monospace',
                fontSize: '14px',
                border: '1px solid #0f0'
            }}>
                FPS: {fps}
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    position: 'absolute',
                    top: '40%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.95)',
                    color: 'white',
                    padding: '30px 60px',
                    borderRadius: '20px',
                    fontSize: '32px',
                    fontWeight: 'bold',
                    zIndex: 100,
                    border: '4px solid #4caf50',
                    direction: 'rtl',
                    boxShadow: '0 10px 50px rgba(76,175,80,0.5)',
                    animation: 'pulse 0.5s ease-in-out'
                }}>
                    {message}
                </div>
            )}

            {/* Cart UI */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(15,15,15,0.95)',
                color: 'white',
                padding: '25px',
                borderRadius: '15px',
                fontFamily: 'Arial, sans-serif',
                minWidth: '340px',
                maxWidth: '420px',
                direction: 'rtl',
                border: '3px solid #e53935',
                boxShadow: '0 15px 50px rgba(0,0,0,0.7)',
                backdropFilter: 'blur(10px)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#e53935', fontSize: '30px', textAlign: 'center', textShadow: '0 2px 10px rgba(229,57,53,0.5)' }}>
                    🛒 عربة التسوق
                </h2>

                <div style={{
                    background: 'linear-gradient(135deg, #e53935 0%, #c62828 100%)',
                    padding: '18px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    textAlign: 'center',
                    boxShadow: '0 6px 20px rgba(229,57,53,0.5)',
                    border: '2px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px', opacity: 0.95, fontWeight: 'bold' }}>💰 المال المتاح</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>${money.toFixed(2)}</div>
                </div>

                {cart.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: '#888',
                        fontSize: '18px',
                        lineHeight: '1.8',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px'
                    }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px', filter: 'grayscale(100%)' }}>🛍️</div>
                        <div style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: '10px' }}>العربة فارغة</div>
                        <div style={{ fontSize: '15px', color: '#666' }}>اضغط على المنتجات لإضافتها</div>
                    </div>
                ) : (
                    <>
                        <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px', paddingRight: '5px' }}>
                            {cart.map((item, idx) => (
                                <div key={idx} style={{
                                    padding: '12px',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255,255,255,0.03)',
                                    marginBottom: '8px',
                                    borderRadius: '8px'
                                }}>
                                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.name}</span>
                                    <span style={{ color: '#4caf50', fontWeight: 'bold', background: 'rgba(76,175,80,0.1)', padding: '4px 8px', borderRadius: '4px' }}>${item.price.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            borderTop: '2px solid rgba(255,255,255,0.1)',
                            paddingTop: '20px',
                            marginTop: '10px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '24px',
                                fontWeight: 'bold',
                                marginBottom: '20px',
                                color: '#fff'
                            }}>
                                <span>الإجمالي:</span>
                                <span style={{ color: '#4caf50' }}>${total.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={handleCheckout}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: 'linear-gradient(90deg, #4caf50 0%, #43a047 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    marginBottom: '12px',
                                    boxShadow: '0 4px 15px rgba(76,175,80,0.3)',
                                    transition: 'transform 0.2s',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                            >
                                💳 الدفع الآن
                            </button>

                            <button
                                onClick={handleReset}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'rgba(244,67,54,0.1)',
                                    color: '#ef5350',
                                    border: '1px solid rgba(244,67,54,0.3)',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'background 0.2s'
                                }}
                            >
                                🗑️ إفراغ العربة
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Instructions */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                background: 'rgba(0,0,0,0.85)',
                color: 'white',
                padding: '20px',
                borderRadius: '15px',
                fontFamily: 'Arial, sans-serif',
                direction: 'rtl',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(5px)'
            }}>
                <div style={{ fontSize: '14px', lineHeight: '2.2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>WASD</span>
                        <strong>تحرك</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>MOUSE</span>
                        <strong>دوران الكاميرا</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: '#4caf50', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>CLICK</span>
                        <strong>شراء</strong>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckout && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1e1e1e 0%, #151515 100%)',
                        padding: '50px',
                        borderRadius: '25px',
                        textAlign: 'center',
                        maxWidth: '500px',
                        direction: 'rtl',
                        border: '2px solid #333',
                        boxShadow: '0 25px 80px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ fontSize: '80px', marginBottom: '20px' }}>✅</div>
                        <h1 style={{ color: '#4caf50', marginBottom: '10px', fontSize: '36px' }}>تمت العملية بنجاح!</h1>
                        <p style={{ color: '#888', fontSize: '18px', marginBottom: '40px' }}>لقد قمت بشراء المنتجات بنجاح</p>

                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px', marginBottom: '40px' }}>
                            <p style={{ fontSize: '20px', margin: '0', color: '#ccc' }}>
                                المبلغ المدفوع
                            </p>
                            <p style={{ fontSize: '48px', margin: '10px 0 0 0', fontWeight: 'bold', color: '#4caf50' }}>
                                ${total.toFixed(2)}
                            </p>
                        </div>

                        <button
                            onClick={handleReset}
                            style={{
                                padding: '18px 50px',
                                background: '#2196f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 15px rgba(33,150,243,0.3)',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e: any) => e.target.style.transform = 'scale(1.05)'}
                            onMouseOut={(e: any) => e.target.style.transform = 'scale(1)'}
                        >
                            متابعة التسوق ➜
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
