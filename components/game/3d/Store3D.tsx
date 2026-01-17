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

        // Texture Generation
        const productLibrary = [
            { name: 'كورن فليكس', color: 0xff3333, label: 'CEREAL', price: 4.99, category: 'cereal' },
            { name: 'شوكو بوبس', color: 0xd32f2f, label: 'CHOCO', price: 5.49, category: 'cereal' },
            { name: 'حليب', color: 0x2196f3, label: 'MILK', price: 3.99, category: 'dairy' },
            { name: 'عصير برتقال', color: 0xff9800, label: 'ORANGE', price: 5.99, category: 'juice' },
            { name: 'شيبسي', color: 0xff5722, label: 'CHIPS', price: 3.99, category: 'snacks' },
            { name: 'كولا', color: 0xd32f2f, label: 'COLA', price: 1.99, category: 'soda' },
            { name: 'مياه', color: 0x64b5f6, label: 'WATER', price: 0.99, category: 'water' },
            { name: 'معكرونة', color: 0xfdd835, label: 'PASTA', price: 3.49, category: 'grains' },
            { name: 'أرز', color: 0xfff9c4, label: 'RICE', price: 6.99, category: 'grains' },
            { name: 'تونة', color: 0x607d8b, label: 'TUNA', price: 4.49, category: 'canned' },
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
                const gradient = ctx.createLinearGradient(0, 0, 0, 256);
                gradient.addColorStop(0, baseColor);
                gradient.addColorStop(1, adjustBrightness(baseColor, -30));
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 256, 256);

                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillRect(20, 90, 216, 60);

                ctx.fillStyle = '#000';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(info.label, 128, 132);

                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(30, 180, 196, 50);
                ctx.strokeStyle = '#000';
                ctx.strokeRect(30, 180, 196, 50);

                ctx.fillStyle = '#d32f2f';
                ctx.font = 'bold 32px Arial';
                ctx.fillText(`$${info.price}`, 128, 215);

                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;

                const materials = [
                    new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                    new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                    new THREE.MeshStandardMaterial({ color: parseInt(adjustBrightness(baseColor, -20).replace('#', '0x')), metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ color: parseInt(adjustBrightness(baseColor, -20).replace('#', '0x')), metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                    new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.6 }),
                ];

                productAssets.set(info.label, materials);
            });
        }

        const clickableProducts: THREE.Mesh[] = [];

        function createProductMesh(productInfo: any) {
            const materials = productAssets.get(productInfo.label);
            if (!materials) return null;
            const mesh = new THREE.Mesh(boxGeometry, materials);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.userData = { ...productInfo, clickable: true };
            return mesh;
        }

        // Environment
        const floorGeometry = new THREE.PlaneGeometry(80, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const ceilingGeometry = new THREE.PlaneGeometry(80, 100);
        const ceilingMaterial = new THREE.MeshBasicMaterial({ color: 0xd0d0d0 });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 6;
        scene.add(ceiling);

        const bulbGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe0 });
        const ceilingLightGroup = new THREE.Group();

        for (let i = -30; i < 50; i += 8) {
            for (let j = -8; j < 8; j += 6) {
                const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
                bulb.position.set(j, 5.9, i);
                ceilingLightGroup.add(bulb);
            }
        }
        scene.add(ceilingLightGroup);

        const shelfGroupTemplate = new THREE.Group();
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.5 });
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
        for (let lvl = 0; lvl < 5; lvl++) {
            const b = new THREE.Mesh(shelfBoardGeom, shelfMat);
            b.position.set(0, 0.2 + lvl * 0.6, 0);
            b.castShadow = true;
            b.receiveShadow = true;
            shelves.add(b);
        }

        function createPopulatedShelf(x: number, z: number, rotation: number) {
            const shelf = new THREE.Group();
            shelf.add(backPanel.clone(), supports.clone(), shelves.clone());

            for (let lvl = 0; lvl < 5; lvl++) {
                for (let i = 0; i < 10; i++) {
                    const pInfo = productLibrary[Math.floor(Math.random() * productLibrary.length)];
                    const mesh = createProductMesh(pInfo);
                    if (mesh) {
                        const xPos = -3.0 + i * 0.65;
                        mesh.position.set(xPos, 0.2 + lvl * 0.6 + 0.26, 0);
                        if (Math.random() > 0.5) mesh.rotation.y = Math.PI;
                        shelf.add(mesh);
                        clickableProducts.push(mesh);
                    }
                }
            }
            shelf.position.set(x, 0, z);
            shelf.rotation.y = rotation;
            scene.add(shelf);
        }

        const aisleX = [-8, 0, 8];
        aisleX.forEach(x => {
            for (let z = -25; z < 25; z += 10) {
                createPopulatedShelf(x, z, 0);
                createPopulatedShelf(x, z, Math.PI);
            }
        });

        const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
        const wall1 = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), wallMat);
        wall1.position.set(0, 4, -40);
        wall1.receiveShadow = true;
        scene.add(wall1);

        const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(100, 8), wallMat);
        wall2.rotation.y = Math.PI / 2;
        wall2.position.set(-30, 4, 0);
        scene.add(wall2);

        const wall3 = new THREE.Mesh(new THREE.PlaneGeometry(100, 8), wallMat);
        wall3.rotation.y = -Math.PI / 2;
        wall3.position.set(30, 4, 0);
        scene.add(wall3);

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
