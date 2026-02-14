"use client";

import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import Link from 'next/link';
import { useProductStore } from '../../../lib/stores/product-store';
import { useCartStore } from '../../../lib/stores/cart-store';
import { getProductsByStoreId } from '../../../lib/actions/products';
import { getSupermarketLayout } from '../../../lib/actions/layout';
import { getStoreByUserId } from '../../../lib/actions/stores';
import { useAuth } from '../../../lib/auth-context';
import { useLanguage } from '../../../lib/language-context';
import { logError } from '../../../lib/logger';
import { LayoutGrid } from 'lucide-react';

type SimProduct = {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    image_url?: string | null;
    store_id?: string;
    store_name?: string;
    color: number;
    label: string;
    pattern?: string;
};

type StoreProductRecord = {
    id?: string;
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    image_url?: string | null;
    store_id?: string;
    stores?: { name?: string } | null;
    simulator_section?: string;
};

type RuntimeShelf = {
    shelfId: string;
    type: string;
    position: { x: number; y: number; z: number };
    rotation?: { x?: number; y?: number; z?: number };
    object3D?: THREE.Group;
    placementCount?: number;
};

type RuntimePlacement = {
    placementId: string;
    shelfId: string;
    productId: string;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    quantity?: number;
};

type LayoutData = {
    shelves: RuntimeShelf[];
    placements?: RuntimePlacement[];
};

type TouchLookState = {
    dx: number;
    dy: number;
    lastX?: number;
};

type InstancedProductUserData = {
    clickable: boolean;
    instanceMetadata: SimProduct[];
};

function normalizeCategory(categoryValue?: string, sectionValue?: string) {
    // 1. Prioritize explicit simulator section if provided
    if (sectionValue) {
        const raw = sectionValue.toLowerCase();
        // Return matching internal IDs
        if (raw.includes('produce')) return 'produce';
        if (raw.includes('bakery')) return 'bakery';
        if (raw.includes('dairy')) return 'dairy';
        if (raw.includes('meat')) return 'meat';
        if (raw.includes('beauty')) return 'beauty';
        if (raw.includes('drink')) return 'drinks';
        if (raw.includes('snack')) return 'snacks';
        if (raw.includes('clean')) return 'cleaning';
        if (raw.includes('grocery')) return 'grocery';
    }

    // 2. Fallback to category-based inference
    const raw = (categoryValue || '').toLowerCase();
    if (raw.includes('produce') || raw.includes('veg') || raw.includes('fruit') || raw.includes('خضار') || raw.includes('فواكه')) {
        return 'produce';
    }
    if (raw.includes('bakery') || raw.includes('خبز') || raw.includes('مخبز')) {
        return 'bakery';
    }
    if (raw.includes('dairy') || raw.includes('لبن') || raw.includes('ألبان') || raw.includes('جبن')) {
        return 'dairy';
    }
    if (raw.includes('meat') || raw.includes('لحوم') || raw.includes('سمك')) {
        return 'meat';
    }
    if (raw.includes('beauty') || raw.includes('صحة') || raw.includes('جمال')) {
        return 'beauty';
    }
    if (raw.includes('drink') || raw.includes('مشروب')) {
        return 'drinks';
    }
    if (raw.includes('snack') || raw.includes('شيبس') || raw.includes('سناك')) {
        return 'snacks';
    }
    if (raw.includes('clean') || raw.includes('منظف')) {
        return 'cleaning';
    }
    return 'grocery';
}

function hashToColor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) & 0xffffff;
}

const fallbackPatterns = ['stripe', 'circle', 'curve', 'dots', 'grid', 'triangle', 'swirl'];

function pickPattern(seed: string) {
    const idx = Math.abs(seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % fallbackPatterns.length;
    return fallbackPatterns[idx];
}

function isLayoutData(value: unknown): value is LayoutData {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as { shelves?: unknown; placements?: unknown };
    return Array.isArray(candidate.shelves) && (candidate.placements === undefined || Array.isArray(candidate.placements));
}

export default function SupermarketSimulator() {
    const mountRef = useRef<HTMLDivElement>(null);
    const { items: cartItems, addItem, decrementItem, clear } = useCartStore();
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const isArabic = language === 'ar';
    const fallbackProductName = isArabic ? 'منتج' : 'Product';
    const dragToAddMessage = isArabic ? 'اسحب لأسفل للإضافة' : 'Drag down to add';
    const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems]);
    const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
    const [money, setMoney] = useState(500);
    const [showCheckout, setShowCheckout] = useState(false);
    const toggleDashboard = useProductStore(state => state.toggleDashboard);
    const [message, setMessage] = useState('');
    const [isCartMinimized, setIsCartMinimized] = useState(true); // Start minimized/as button
    const [catalog, setCatalog] = useState<SimProduct[]>([]);
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [hoveredProduct, setHoveredProduct] = useState<SimProduct | null>(null);
    const hoverIdRef = useRef<string | null>(null);
    const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [fps, setFps] = useState(60);
    const [isLockedState, setIsLockedState] = useState(false);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const basketContentsRef = useRef<THREE.Group | null>(null);

    // Refs for accessing latest state inside event listeners without re-binding
    const stateRef = useRef({ money, total, isLocked: isLockedState });
    const lockPointerRef = useRef<(posX?: number, posZ?: number) => void>(() => { });
    const heldProductRef = useRef<SimProduct | null>(null);
    const heldMeshRef = useRef<THREE.Mesh | null>(null);
    const layoutDataRef = useRef<LayoutData | null>(null);
    useEffect(() => { stateRef.current = { money, total, isLocked: isLockedState }; }, [money, total, isLockedState]);

    const keysRef = useRef<Record<string, boolean>>({});
    const moveSpeed = 0.1; // Slightly increased for responsiveness

    // Mobile Control States
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }, []);

    const joystickRef = useRef({ x: 0, y: 0, active: false });
    const touchLookRef = useRef<TouchLookState>({ dx: 0, dy: 0 });

    const departments = useMemo(() => ([
        { id: 'produce', label: t('الخضروات والفواكه', 'Fresh Produce'), icon: '🍎', x: 20, z: 15 },
        { id: 'bakery', label: t('المخبز الطازج', 'Fresh Bakery'), icon: '🍞', x: -20, z: 15 },
        { id: 'dairy', label: t('الألبان والأجبان', 'Dairy & Cheese'), icon: '🥛', x: 20, z: -15 },
        { id: 'meat', label: t('اللحوم والأسماك', 'Meat & Seafood'), icon: '🥩', x: -20, z: -15 },
        { id: 'beauty', label: t('الصحة والجمال', 'Health & Beauty'), icon: '🧴', x: 0, z: -35 },
        { id: 'grocery', label: t('البقالة العامة', 'General Grocery'), icon: '🥫', x: 0, z: 10 }
    ]), [t]);

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                // Fetch User Store & Layout (For Seller Preview)
                let fetchedLayout: LayoutData | null = null;
                let products: StoreProductRecord[] = [];

                if (user?.id) {
                    try {
                        const userStore = await getStoreByUserId(user.id);
                        if (userStore) {
                            // Fetch only this store's products
                            const storeProducts = await getProductsByStoreId(userStore.id);
                            products = Array.isArray(storeProducts) ? (storeProducts as StoreProductRecord[]) : [];
                            const layoutRes = await getSupermarketLayout(userStore.id, user.id);
                            if (layoutRes.success && isLayoutData(layoutRes.data)) {
                                fetchedLayout = layoutRes.data;
                            }
                        }
                    } catch (_err) {
                        // Failed to fetch user store
                    }
                }

                layoutDataRef.current = fetchedLayout;

                if (!active) return;

                const normalized = Array.isArray(products) ? products.slice(0, 160).map((product: StoreProductRecord, index: number) => {
                    const name = product?.name || fallbackProductName;
                    const id = product?.id || `product_${index}`;
                    const category = normalizeCategory(product?.category, product?.simulator_section);
                    const color = hashToColor(`${id}_${name}`);

                    return {
                        id,
                        name,
                        description: product?.description || '',
                        price: Number(product?.price || 0),
                        category,
                        image_url: product?.image_url || null,
                        store_id: product?.store_id,
                        store_name: product?.stores?.name || '',
                        color,
                        label: name.slice(0, 16),
                        pattern: pickPattern(id)
                    } satisfies SimProduct;
                }) : [];

                setCatalog(normalized);
            } catch (error) {
                logError('[simulator] Failed to load data:', error);
                if (active) {
                    setCatalog([]);
                }
            } finally {
                if (active) {
                    setCatalogLoaded(true);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [fallbackProductName, user?.id]);

    useEffect(() => {
        if (!mountRef.current || !catalogLoaded) return;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const clickableObjs: THREE.Object3D[] = []; // Unified list for raycasting

        // To collect instances for radical optimization
        const productInstancingMap = new Map<string, {
            geometry: THREE.BufferGeometry,
            material: THREE.Material,
            matrices: THREE.Matrix4[],
            metadata: SimProduct[]
        }>();

        const shelfInstancingMap = new Map<string, {
            geometry: THREE.BufferGeometry,
            material: THREE.Material,
            matrices: THREE.Matrix4[]
        }>();
        const obstacles: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [];

        const addObstacle = (centerX: number, centerZ: number, width: number, depth: number) => {
            obstacles.push({
                minX: centerX - width / 2,
                maxX: centerX + width / 2,
                minZ: centerZ - depth / 2,
                maxZ: centerZ + depth / 2
            });
        };

        const addObstacleFromObject = (object: THREE.Object3D) => {
            object.updateWorldMatrix(true, true);
            const box = new THREE.Box3().setFromObject(object);
            if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.z)) {
                return;
            }
            const width = box.max.x - box.min.x;
            const depth = box.max.z - box.min.z;
            if (width <= 0 || depth <= 0) {
                return;
            }
            const centerX = (box.min.x + box.max.x) / 2;
            const centerZ = (box.min.z + box.max.z) / 2;
            addObstacle(centerX, centerZ, width, depth);
        };

        const addShelfObstacle = (x: number, z: number, rotation: number) => {
            const shelfWidth = 7.25;
            const shelfDepth = 0.85;
            const dir = Math.sign(Math.cos(rotation)) || 1;
            const centerZ = z + dir * 0.3;
            addObstacle(x, centerZ, shelfWidth, shelfDepth);
        };

        const isPointBlocked = (x: number, z: number) => (
            obstacles.some((obs) => (
                x >= obs.minX &&
                x <= obs.maxX &&
                z >= obs.minZ &&
                z <= obs.maxZ
            ))
        );

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a); // Darker background
        scene.fog = new THREE.Fog(0x0a0a0a, 40, 100); // Pushed back for more visibility

        // Camera setup
        const containerWidth = mountRef.current.clientWidth || window.innerWidth;
        const containerHeight = mountRef.current.clientHeight || window.innerHeight;
        const camera = new THREE.PerspectiveCamera(70, containerWidth / containerHeight, 0.1, 100);
        camera.position.set(0, 1.6, 40); // Start near cashier facing aisles

        const width = mountRef.current.clientWidth || window.innerWidth;
        const height = mountRef.current.clientHeight || window.innerHeight;

        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Renderer - Optimized for performance
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            precision: isMobileDevice ? "highp" : "mediump", // High precision might help mobile if shadows are off
            stencil: false,
            depth: true
        });
        renderer.setSize(width, height);
        // Drastic Resolution Boost for Mobile Performance
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileDevice ? 0.75 : 1.5));
        renderer.shadowMap.enabled = !isMobileDevice; // Disable shadows on mobile for speed and to fix black spots
        renderer.shadowMap.type = THREE.BasicShadowMap;
        rendererRef.current = renderer;
        renderer.domElement.tabIndex = 0; // Make focusable
        renderer.domElement.style.outline = 'none';
        mountRef.current.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xfff5e6, isMobileDevice ? 1.8 : 1.2);
        scene.add(ambientLight);

        // One main directional light
        const sunLight = new THREE.DirectionalLight(0xfff5e6, isMobileDevice ? 0.8 : 1.0);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = !isMobileDevice;
        if (sunLight.castShadow) {
            sunLight.shadow.mapSize.width = 1024;
            sunLight.shadow.mapSize.height = 1024;
        }
        scene.add(sunLight);

        // Texture Generation (Realistic Brands & Variety)
        const productLibrary = catalog;
        const categoryPools = new Map<string, SimProduct[]>();

        function shuffleInPlace<T>(list: T[]) {
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [list[i], list[j]] = [list[j], list[i]];
            }
        }

        productLibrary.forEach((product) => {
            if (!categoryPools.has(product.category)) {
                categoryPools.set(product.category, []);
            }
            categoryPools.get(product.category)!.push(product);
        });

        categoryPools.forEach((pool) => shuffleInPlace(pool));

        function pickFromCategory(category: string) {
            const pool = categoryPools.get(category);
            if (!pool || pool.length === 0) return undefined;
            return pool.pop();
        }

        function pickFromCategories(categories: string[]) {
            const available = categories.filter((category) => (categoryPools.get(category)?.length ?? 0) > 0);
            if (available.length === 0) return undefined;
            const selected = available[Math.floor(Math.random() * available.length)];
            return pickFromCategory(selected);
        }

        const productAssets = new Map<string, THREE.Material>();
        const textureCache = new Map<string, THREE.Texture>();
        const fallbackTextures: THREE.Texture[] = [];
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');

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
        const artTex1 = textureLoader.load('/images/art_emerald.png');
        const artTex2 = textureLoader.load('/images/art_saffron.png');
        const artTex3 = textureLoader.load('/images/art_midnight.png');

        function createFallbackTexture(info: SimProduct) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                return new THREE.CanvasTexture(canvas);
            }

            const baseColor = `#${info.color.toString(16).padStart(6, '0')}`;

            // Base
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, 256, 256);

            // --- Procedural Branding Patterns ---
            ctx.fillStyle = adjustBrightness(baseColor, -15);

            // Specific category icons/motifs
            if (info.category === 'drinks') {
                ctx.fillRect(80, 20, 96, 100);
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(128, 60, 20, 0, Math.PI * 2); ctx.fill();
            } else if (info.category === 'produce') {
                ctx.beginPath(); ctx.arc(128, 80, 50, 0, Math.PI * 2); ctx.fill();
            } else if (info.category === 'dairy') {
                ctx.fillRect(90, 30, 76, 100);
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
            if (info.category !== 'produce') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(10, 140, 236, 80);

                ctx.fillStyle = '#111';
                ctx.font = 'bold 24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(info.label, 128, 172);

                ctx.font = '12px sans-serif';
                ctx.fillText('PREMIUM QUALITY', 128, 194);
            } else {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(60, 60, 30, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(info.label.substring(0, 3), 60, 66);
            }

            const isProduce = info.category === 'produce';
            ctx.fillStyle = isProduce ? 'rgba(255,235,59,0.8)' : '#ffeb3b';
            ctx.beginPath();
            const prX = isProduce ? 220 : 210;
            const prY = isProduce ? 220 : 200;
            ctx.arc(prX, prY, isProduce ? 25 : 35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#c62828';
            ctx.font = isProduce ? 'bold 14px sans-serif' : 'bold 18px sans-serif';
            ctx.fillText(`${info.price.toFixed(2)} EGP`, prX, prY + 6);

            const tex = new THREE.CanvasTexture(canvas);
            tex.anisotropy = 4;
            return tex;
        }

        function applyTexture(material: THREE.Material, texture: THREE.Texture) {
            (material as THREE.MeshStandardMaterial).map = texture;
            material.needsUpdate = true;
        }

        function loadProductTexture(url: string, material: THREE.Material, fallback: THREE.Texture) {
            if (!url) return;
            const cached = textureCache.get(url);
            if (cached) {
                applyTexture(material, cached);
                return;
            }
            textureLoader.load(
                url,
                (tex) => {
                    tex.anisotropy = 4;
                    textureCache.set(url, tex);
                    applyTexture(material, tex);
                },
                undefined,
                () => {
                    applyTexture(material, fallback);
                },
            );
        }

        productLibrary.forEach((info) => {
            const fallback = createFallbackTexture(info);
            fallbackTextures.push(fallback);
            const mat = isMobileDevice
                ? new THREE.MeshStandardMaterial({
                    map: fallback,
                    roughness: 0.3,
                    metalness: 0.1,
                })
                : new THREE.MeshPhysicalMaterial({
                    map: fallback,
                    roughness: 0.2,
                    metalness: 0.1,
                    clearcoat: info.category === 'drinks' || info.category === 'beauty' ? 0.8 : 0.2,
                    clearcoatRoughness: 0.1,
                });

            productAssets.set(info.id, mat);

            if (info.image_url) {
                loadProductTexture(info.image_url, mat, fallback);
            }
        });

        // --- Floor ---
        const floorGeometry = new THREE.PlaneGeometry(100, 120);
        const floorTexture = marbleTex.clone();
        floorTexture.repeat.set(10, 12);
        const floorMaterial = isMobileDevice
            ? new THREE.MeshStandardMaterial({
                map: floorTexture,
                color: 0xffffff,
                roughness: 0.2,
                metalness: 0.0
            })
            : new THREE.MeshPhysicalMaterial({
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

        const slatMat = new THREE.MeshPhysicalMaterial({
            map: woodTex,
            roughness: 0.5,
            metalness: 0.1,
            clearcoat: 0.1
        });
        const slatGeom = new THREE.BoxGeometry(80, 0.15, 0.4);

        // Optimization: Use InstancedMesh for the ceiling (80 slats = 1 draw call)
        const slatCount = Math.floor(120 / 1.5);
        const ceilingMesh = new THREE.InstancedMesh(slatGeom, slatMat, slatCount);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < slatCount; i++) {
            dummy.position.set(0, 5.85, -60 + i * 1.5);
            dummy.updateMatrix();
            ceilingMesh.setMatrixAt(i, dummy.matrix);
        }
        scene.add(ceilingMesh);

        // Structural Pillars (Architectural Elements)
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });
        const pillarGeom = new THREE.BoxGeometry(2, 6, 2);
        const pillarPositions = [
            [-26, 3, -31], [26, 3, -31],
            [-26, 3, 31], [26, 3, 31],
        ];

        // --- Helper: Realistic Hand Model (Subtle version) ---
        function createHandModel() {
            const handGroup = new THREE.Group();
            const skinMat = new THREE.MeshPhysicalMaterial({
                color: 0xffdbac,
                roughness: 0.8,
                metalness: 0.0
            });

            // Palm - Thinner and more subtle
            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), skinMat);
            palm.position.z = -0.05;
            handGroup.add(palm);

            // Fingers - Thinner and curved for gripping
            const fingerGeom = new THREE.CapsuleGeometry(0.012, 0.06, 4, 8);
            for (let i = 0; i < 4; i++) {
                const finger = new THREE.Mesh(fingerGeom, skinMat);
                // Positioned to wrap around a handle
                finger.position.set(-0.04 + i * 0.026, -0.01, -0.1);
                finger.rotation.x = -1.2; // Gripping curve
                handGroup.add(finger);
            }

            // Thumb - Gripping naturally
            const thumb = new THREE.Mesh(fingerGeom, skinMat);
            thumb.position.set(0.06, 0.01, -0.04);
            thumb.rotation.set(0, -0.5, 0.8);
            handGroup.add(thumb);

            // Wrist / Short Forearm (Partial)
            const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), skinMat);
            wrist.position.set(0, 0, 0.06);
            wrist.rotation.x = 0.4;
            handGroup.add(wrist);

            return handGroup;
        }

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
            addObstacleFromObject(plantGroup);
            scene.add(plantGroup);
        }

        const dummyWorld = new THREE.Object3D();
        scene.add(dummyWorld); // Used to calculate world matrices for instancing

        pillarPositions.forEach(([x, y, z]) => {
            const pillar = new THREE.Mesh(pillarGeom, pillarMat);
            pillar.position.set(x, y, z);
            scene.add(pillar);
            addObstacleFromObject(pillar);

            // Skip Plants on Mobile (Very heavy draw calls)
            if (!isMobileDevice) {
                const offsetZ = z < 0 ? 3 : -3;
                createPremiumPlant(x, z + offsetZ);
            }
        });

        const shelfMat = isMobileDevice
            ? new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5, metalness: 0.0 })
            : new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.4, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.2 });

        const railMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5 });
        const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe0b3, emissiveIntensity: 4 });

        // Helper to register shelf parts for instancing
        function registerShelfPart(name: string, geom: THREE.BufferGeometry, mat: THREE.Material, localMatrix: THREE.Matrix4, worldMatrix: THREE.Matrix4) {
            if (!shelfInstancingMap.has(name)) {
                shelfInstancingMap.set(name, { geometry: geom, material: mat, matrices: [] });
            }
            const worldPart = worldMatrix.clone().multiply(localMatrix);
            shelfInstancingMap.get(name)!.matrices.push(worldPart);
        }

        const shelfBoardGeom = new THREE.BoxGeometry(6.9, 0.06, 0.65);
        const shelfRailGeom = new THREE.BoxGeometry(6.9, 0.1, 0.03);
        const shelfFrameGeom = new THREE.BoxGeometry(0.25, 3.6, 0.8);
        const shelfHeaderGeom = new THREE.BoxGeometry(7.2, 0.4, 0.85);

        function recordShelfInstances(worldMatrix: THREE.Matrix4) {
            const m = new THREE.Matrix4();

            // Frame Left & Right
            registerShelfPart('frame_l', shelfFrameGeom, shelfMat, m.makeTranslation(-3.5, 1.8, 0.3), worldMatrix);
            registerShelfPart('frame_r', shelfFrameGeom, shelfMat, m.makeTranslation(3.5, 1.8, 0.3), worldMatrix);

            // Header
            registerShelfPart('header', shelfHeaderGeom, shelfMat, m.makeTranslation(0, 3.5, 0.3), worldMatrix);
            registerShelfPart('header_led', new THREE.BoxGeometry(6.8, 0.02, 0.6), ledMat, m.makeTranslation(0, 3.25, 0.3), worldMatrix);

            // Boards & Rails
            for (let lvl = 0; lvl < 6; lvl++) {
                const yPos = 0.2 + lvl * 0.55;
                registerShelfPart('board_' + lvl, shelfBoardGeom, shelfMat, m.makeTranslation(0, yPos, 0.35), worldMatrix);
                registerShelfPart('rail_' + lvl, shelfRailGeom, railMat, m.makeTranslation(0, yPos, 0.68), worldMatrix);
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
            for (let i = 0; i < 8; i++) {
                const info = pickFromCategory('drinks');
                if (!info) break;
                const angle = (i / 8) * Math.PI * 2;
                dummyWorld.position.set(x + Math.cos(angle) * 1.8, 0.8, z + Math.sin(angle) * 1.8);
                dummyWorld.rotation.set(0, 0, 0);
                dummyWorld.updateMatrixWorld(true);
                registerProductInstance(info, dummyWorld.matrixWorld);
            }
            island.position.set(x, 0, z);
            addObstacleFromObject(island);
            scene.add(island);

            // Highlight Light for the island
            const islandLight = new THREE.PointLight(0xfff5e6, 30, 20);
            islandLight.position.set(x, 5.0, z);
            scene.add(islandLight);
        }

        createDisplayIsland(0, 0);

        /**
         * REGISTERS A PRODUCT INSTANCE
         * Instead of creating a mesh, it records the transform and info
         */
        function registerProductInstance(info: SimProduct | undefined, worldMatrix: THREE.Matrix4) {
            if (!info || !productAssets.has(info.id)) return;

            if (!productInstancingMap.has(info.id)) {
                let geom;
                const segments = isMobileDevice ? 8 : 16;
                if (info.category === 'produce') {
                    geom = new THREE.SphereGeometry(0.18, segments, segments);
                } else if (info.category === 'drinks' || info.category === 'cleaning') {
                    geom = new THREE.CylinderGeometry(0.18, 0.18, 0.55, segments);
                } else if (info.category === 'dairy') {
                    geom = new THREE.BoxGeometry(0.25, 0.6, 0.25);
                } else if (info.category === 'bakery') {
                    geom = new THREE.CylinderGeometry(0.3, 0.3, 0.25, segments);
                } else {
                    geom = new THREE.BoxGeometry(0.32, 0.48, 0.22);
                }
                geom.computeBoundingBox();
                const box = geom.boundingBox;
                const height = box ? box.max.y - box.min.y : 0.48;
                geom.translate(0, height / 2, 0);

                productInstancingMap.set(info.id, {
                    geometry: geom,
                    material: productAssets.get(info.id)!,
                    matrices: [],
                    metadata: []
                });
            }

            const entry = productInstancingMap.get(info.id)!;
            entry.matrices.push(worldMatrix.clone());
            entry.metadata.push({ ...info });
        }

        // --- Helper: Create Department Sign ---
        function createDepartmentSign(textAr: string, textEn: string, x: number, y: number, z: number, rotationY: number = 0) {
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 1024;
            signCanvas.height = 256;
            const sCtx = signCanvas.getContext('2d')!;
            const signText = isArabic ? textAr : textEn;

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

            // Text
            sCtx.fillStyle = '#aa8833';
            sCtx.font = 'bold 80px sans-serif';
            sCtx.textAlign = 'center';
            sCtx.direction = isArabic ? 'rtl' : 'ltr';
            sCtx.fillText(signText, 512, 150);

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
            const hasItems = categoryList.some((category) => (categoryPools.get(category)?.length ?? 0) > 0);

            const shelfDummy = new THREE.Object3D();
            shelfDummy.position.set(x, 0, z);
            shelfDummy.rotation.y = rotation;
            shelfDummy.updateMatrixWorld(true);
            addShelfObstacle(x, z, rotation);

            if (!hasItems) {
                recordShelfInstances(shelfDummy.matrixWorld);
                return;
            }

            for (let lvl = 0; lvl < 6; lvl++) {
                for (let xOff = -3; xOff <= 3; xOff += 0.8) {
                    const info = pickFromCategories(categoryList);
                    if (!info) {
                        continue;
                    }
                    const xPos = xOff + (Math.random() - 0.5) * 0.1;
                    const zPos = 0.4 + (Math.random() - 0.5) * 0.05;
                    const randRot = (Math.random() - 0.5) * 0.2;

                    dummyWorld.position.set(xPos, 0.24 + lvl * 0.55, zPos);
                    dummyWorld.rotation.y = randRot;
                    dummyWorld.updateMatrix();

                    const worldMat = shelfDummy.matrixWorld.clone().multiply(dummyWorld.matrix);
                    registerProductInstance(info, worldMat);
                }
            }
            recordShelfInstances(shelfDummy.matrixWorld);
        }

        // --- SPECIALIZED SUPERMARKET DEPARTMENTS ---

        // 1. Produce Section (خضروات وفواكه) - Wooden tables and warm light
        function createProduceSection(x: number, z: number) {
            const produceGroup = new THREE.Group();
            produceGroup.position.set(x, 0, z);
            const tableMat = woodTex.clone();
            tableMat.repeat.set(2, 2);
            const woodMaterial = new THREE.MeshStandardMaterial({ map: tableMat, roughness: 0.8 });

            // Create slanted wooden tables
            for (let i = -1; i <= 1; i++) {
                const table = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 2.5), woodMaterial);
                table.position.set(i * 5, 0.4, 0);
                table.rotation.x = -0.2; // Slanted
                produceGroup.add(table);
                addObstacleFromObject(table);

                for (let px = -1.5; px <= 1.5; px += 0.6) {
                    for (let pz = -0.8; pz <= 0.8; pz += 0.6) {
                        const info = pickFromCategory('produce');
                        if (!info) {
                            continue;
                        }
                        dummyWorld.position.set(x + i * 5 + px, 0.8, z + pz);
                        dummyWorld.rotation.set(0, 0, 0);
                        dummyWorld.updateMatrixWorld(true);
                        registerProductInstance(info, dummyWorld.matrixWorld);
                    }
                }
            }

            // Warm produce lighting
            const warmLight = new THREE.PointLight(0xffcc88, 30, 15);
            warmLight.position.set(0, 4, 0);
            produceGroup.add(warmLight);

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
            for (let bx = -3.5; bx <= 3.5; bx += 1) {
                const info = pickFromCategory('bakery');
                if (!info) {
                    break;
                }
                dummyWorld.position.set(x + bx, 1.2, z);
                dummyWorld.rotation.set(0, 0, 0);
                dummyWorld.updateMatrixWorld(true);
                registerProductInstance(info, dummyWorld.matrixWorld);
            }

            // Delicious warm glow
            const bakeryLight = new THREE.PointLight(0xffa726, 20, 10);
            bakeryLight.position.set(0, 3, 0);
            bakeryGroup.add(bakeryLight);

            bakeryGroup.position.set(x, 0, z);
            addObstacleFromObject(bakeryGroup);
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

            const dairyDummy = new THREE.Object3D();
            dairyDummy.position.set(x, 0, z);
            dairyDummy.rotation.y = rotation;
            dairyDummy.updateMatrixWorld(true);

            for (let lvl = 0; lvl < 4; lvl++) {
                for (let dx = -4.5; dx <= 4.5; dx += 0.8) {
                    const info = pickFromCategory('dairy');
                    if (!info) {
                        continue;
                    }
                    dummyWorld.position.set(dx, 0.425 + lvl * 0.7, 0.4);
                    dummyWorld.rotation.set(0, 0, 0);
                    dummyWorld.updateMatrix();
                    const worldMat = dairyDummy.matrixWorld.clone().multiply(dummyWorld.matrix);
                    registerProductInstance(info, worldMat);
                }
            }

            dairyGroup.position.set(x, 0, z);
            dairyGroup.rotation.y = rotation;
            addObstacleFromObject(dairyGroup);
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

            for (let mx = -4; mx <= 4; mx += 1.5) {
                const info = pickFromCategory('meat');
                if (!info) {
                    break;
                }
                dummyWorld.position.set(x + mx, 1.1, z);
                dummyWorld.rotation.set(0, 0, 0);
                dummyWorld.updateMatrixWorld(true);
                registerProductInstance(info, dummyWorld.matrixWorld);
            }

            meatGroup.position.set(x, 0, z);
            addObstacleFromObject(meatGroup);
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
                const beautyDummy = new THREE.Object3D();
                beautyDummy.position.set(x, 0, z);
                beautyDummy.rotation.y = rotation;
                beautyDummy.updateMatrixWorld(true);

                for (let bx = -3.5; bx <= 3.5; bx += 0.7) {
                    const info = pickFromCategory('beauty');
                    if (!info) {
                        continue;
                    }
                    dummyWorld.position.set(bx, 0.275 + i * 0.8, 0.3);
                    dummyWorld.rotation.set(0, 0, 0);
                    dummyWorld.updateMatrix();
                    const worldMat = beautyDummy.matrixWorld.clone().multiply(dummyWorld.matrix);
                    registerProductInstance(info, worldMat);
                }

                // Bright white LED for each shelf
                const led = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 5 }));
                led.position.set(0, 0.2 + i * 0.8 + 0.78, 0.55);
                beautyGroup.add(led);
            }

            beautyGroup.position.set(x, 0, z);
            beautyGroup.rotation.y = rotation;
            addObstacleFromObject(beautyGroup);
            scene.add(beautyGroup);
        }

        // --- DYNAMIC STORE LAYOUT FROM DB ---

        function renderDynamicShelf(shelf: RuntimeShelf) {
            const group = new THREE.Group();
            const { x, y, z } = shelf.position;
            const rotY = shelf.rotation ? shelf.rotation.y : 0; // Map editor Y rotation

            // Visuals based on type
            if (shelf.type === 'traditional_shelf' || shelf.type === 'grocery_shelf') {
                // Shelf Structure (Metal/Wood)
                for (let i = 0; i < 5; i++) {
                    const plate = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.6), shelfMat);
                    plate.position.y = 0.2 + i * 0.6;
                    group.add(plate);
                }
                const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.6), shelfMat);
                sideL.position.set(-3.5, 1.5, 0);
                const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.6), shelfMat);
                sideR.position.set(3.5, 1.5, 0);
                group.add(sideL, sideR);

            } else if (shelf.type === 'glass_counter') {
                // Bakery/Meat Counter style
                const counter = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 1.2), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
                counter.position.y = 0.55;
                group.add(counter);
                const glass = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 1.2), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.3, color: 0x88ccff }));
                glass.position.y = 1.4;
                group.add(glass);

            } else if (shelf.type === 'slanted_table') {
                // Produce Table
                const table = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 2.5), new THREE.MeshStandardMaterial({ map: woodTex }));
                table.position.y = 0.6;
                table.rotation.x = 0.2;
                group.add(table);

            } else if (shelf.type === 'open_fridge') {
                // Fridge
                const base = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                base.position.y = 1.5;
                group.add(base);
                const light = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xccffff }));
                light.position.set(0, 2.8, 0.4);
                group.add(light);
            } else {
                // Default Box
                const box = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 1), shelfMat);
                box.position.y = 0.25;
                group.add(box);
            }

            // Apply Transform
            group.position.set(x, 0, z); // Force Y=0 for floor placement
            group.rotation.y = rotY;

            // Add to scene & collisions
            addObstacleFromObject(group);
            scene.add(group);

            // Store reference for product placement
            shelf.object3D = group;
        }

        function renderDynamicProduct(placement: RuntimePlacement, shelves: RuntimeShelf[]) {
            const shelf = shelves.find((s) => s.shelfId === placement.shelfId);
            if (!shelf || !shelf.object3D) return;

            const productInfo = catalog.find((p) => p.id === placement.productId);
            if (!productInfo) return;

            // Auto-Layout Logic
            // We attach directly to the shelf group so local coords work!
            // But verify if we can add to the group after it's in scene? Yes.

            // We need to know "slot index" of this product on this shelf
            // Map logic:
            if (!shelf.placementCount) shelf.placementCount = 0;
            const idx = shelf.placementCount++;

            // Simple grid layout based on shelf type
            let lx = 0, ly = 0, lz = 0;

            if (shelf.type === 'traditional_shelf') {
                const itemsPerShelf = 8;
                const shelfLevel = Math.floor(idx / itemsPerShelf);
                const slot = idx % itemsPerShelf;

                lx = -3.0 + slot * 0.8;
                ly = 0.25 + shelfLevel * 0.6;
                lz = 0;
            } else if (shelf.type === 'glass_counter') {
                const itemsPerRow = 8;
                const row = Math.floor(idx / itemsPerRow);
                const slot = idx % itemsPerRow;
                lx = -3.0 + slot * 0.8;
                ly = 1.25 + row * 0.4; // Inside glass
                lz = 0;
            } else if (shelf.type === 'slanted_table') {
                const itemsPerRow = 6;
                const row = Math.floor(idx / itemsPerRow);
                const slot = idx % itemsPerRow;
                lx = -2.5 + slot * 1.0;
                ly = 0.9 + row * 0.3;
                lz = -0.5 + row * 0.5;
            } else {
                // Default
                const itemsPerShelf = 8;
                lx = -3.0 + (idx % itemsPerShelf) * 0.8;
                ly = 0.6 + Math.floor(idx / itemsPerShelf) * 0.5;
            }

            // Create Instance/Mesh
            dummyWorld.position.set(lx, ly, lz);
            dummyWorld.rotation.set(0, (Math.random() - 0.5) * 0.5, 0); // Random slight rotation
            dummyWorld.updateMatrix();

            // Transform to world space
            const worldMat = shelf.object3D.matrixWorld.clone().multiply(dummyWorld.matrix);
            registerProductInstance(productInfo, worldMat);
        }

        const layoutData = layoutDataRef.current;

        if (layoutData?.shelves?.length) {
            layoutData.shelves.forEach((s) => renderDynamicShelf(s));
            if (layoutData.placements) {
                layoutData.placements.forEach((p) => renderDynamicProduct(p, layoutData.shelves));
            }

            // Still add Cashier and Dept Signs if needed, or rely on user adding them?
            // For now, keep the Default Cashier at front
            createDepartmentSign("منطقة المحاسبة", "CHECKOUT", 0, 4.5, 48);

        } else {
            // --- FALLBACK: DEFAULT PROCEDURAL LAYOUT ---

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

            // 6. Grocery & Cleaning (البقالة والمنظفات)
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
        }

        // --- FINALIZE INSTANCING (THE RADICAL PERFORMANCE BOOST) ---
        productInstancingMap.forEach((entry, name) => {
            const count = entry.matrices.length;
            const imesh = new THREE.InstancedMesh(entry.geometry, entry.material, count);
            for (let i = 0; i < count; i++) {
                imesh.setMatrixAt(i, entry.matrices[i]);
            }
            imesh.instanceMatrix.needsUpdate = true;
            imesh.castShadow = !isMobileDevice;
            imesh.receiveShadow = !isMobileDevice;

            // Store metadata on userData for safe typed retrieval later.
            imesh.userData = {
                clickable: true,
                instanceMetadata: entry.metadata,
            } satisfies InstancedProductUserData;

            scene.add(imesh);
            clickableObjs.push(imesh);
        });

        shelfInstancingMap.forEach((entry, name) => {
            const count = entry.matrices.length;
            const imesh = new THREE.InstancedMesh(entry.geometry, entry.material, count);
            for (let i = 0; i < count; i++) {
                imesh.setMatrixAt(i, entry.matrices[i]);
            }
            imesh.instanceMatrix.needsUpdate = true;
            imesh.castShadow = !isMobileDevice;
            imesh.receiveShadow = !isMobileDevice;
            scene.add(imesh);
        });

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
            addObstacleFromObject(cashierGroup);
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
            const featureY = 0.5;

            if (type === "bronze") {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.2), bronzeMat);
                panel.position.set(0, featureY, 0.1);
                parent.add(panel);

                if (!isMobileDevice) {
                    const border = new THREE.Mesh(new THREE.BoxGeometry(8.4, 5.4, 0.05), goldMat);
                    border.position.set(0, featureY, 0.05);
                    parent.add(border);
                }
            } else if (type === "art") {
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

                if (!isMobileDevice) {
                    const sLight = new THREE.SpotLight(0xfff5e6, 40, 15, Math.PI / 6, 0.8);
                    sLight.position.set(0, featureY + 3, 3);
                    sLight.target = painting;
                    parent.add(sLight);
                }
            } else if (type === "wood") {
                if (isMobileDevice) {
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.2), shelfMat);
                    panel.position.set(0, featureY, 0.1);
                    parent.add(panel);
                } else {
                    for (let i = -4; i < 4; i += 0.45) {
                        const m = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.5, clearcoat: 0.3 });
                        const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 5, 0.3), m);
                        s.position.set(i, featureY, 0.15);
                        parent.add(s);
                    }
                }
            } else {
                const trough = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.2), ledMat);
                trough.position.set(0, 0, 0.1);
                parent.add(trough);
            }
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
                if (!isMobileDevice) { // Skip borders on mobile
                    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, depth + 0.05), goldMat);
                    inlay.position.set(i + 12, 0, 0.02);
                    wallGroup.add(inlay);
                }

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
            addObstacleFromObject(wallGroup);
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
        addObstacleFromObject(backWallGroup);
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
        addObstacleFromObject(welcomeGroup);
        scene.add(welcomeGroup);

        // --- SHOPPING CART MODEL (Optimized for Device) ---
        const cartGroup = new THREE.Group();
        const cartMetalMat = new THREE.MeshStandardMaterial({
            color: 0xf5f5f5,
            metalness: 1.0,
            roughness: 0.1,
            envMapIntensity: 1.0
        });
        const plasticHandleMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5 }); // Efficient Cart Model for Mobile vs High-Poly for Desktop
        const basketContents = new THREE.Group();
        basketContents.position.y = 0.1;
        basketContentsRef.current = basketContents;

        if (isMobileDevice) {
            // 1. Generate high-performance wireframe texture
            const basketCanvas = document.createElement('canvas');
            basketCanvas.width = 64; basketCanvas.height = 64;
            const bCtx = basketCanvas.getContext('2d')!;
            bCtx.strokeStyle = '#aaaaaa';
            bCtx.lineWidth = 4;
            bCtx.strokeRect(0, 0, 64, 64);
            bCtx.lineWidth = 2;
            bCtx.moveTo(0, 32); bCtx.lineTo(64, 32);
            bCtx.moveTo(32, 0); bCtx.lineTo(32, 64);
            bCtx.stroke();
            const basketTex = new THREE.CanvasTexture(basketCanvas);
            basketTex.repeat.set(8, 6);
            basketTex.wrapS = basketTex.wrapT = THREE.RepeatWrapping;

            const mobileBasketMat = new THREE.MeshStandardMaterial({
                map: basketTex,
                transparent: true,
                opacity: 0.8,
                color: 0xffffff,
                side: THREE.DoubleSide
            });

            // 2. Realistic Basket Shape for Mobile
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.9), mobileBasketMat);
            body.position.set(0, 0.15, 0);
            cartGroup.add(body);
            body.add(basketContents);

            // 3. Modern Handlebar Frame
            const hL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.02), cartMetalMat);
            hL.position.set(-0.35, 0.35, 0.45); hL.rotation.x = 0.5;
            const hR = hL.clone(); hR.position.x = 0.35;
            cartGroup.add(hL, hR);

            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.04), plasticHandleMat);
            handle.position.set(0, 0.5, 0.55);
            cartGroup.add(handle);
        } else {
            // High-Poly Wireframe
            const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.7), cartMetalMat);
            frameBottom.position.set(0, -0.35, -0.1);
            cartGroup.add(frameBottom);

            const verticalBarGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.6);
            const bars = [[-0.22, -0.05, 0.25], [0.22, -0.05, 0.25], [-0.22, -0.05, -0.45], [0.22, -0.05, -0.45]];
            bars.forEach(([bx, by, bz]) => {
                const bar = new THREE.Mesh(verticalBarGeom, cartMetalMat);
                bar.position.set(bx, by, bz);
                cartGroup.add(bar);
            });

            const basketGroup = new THREE.Group();
            for (let h = 0; h <= 0.4; h += 0.08) {
                const barF = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.02), cartMetalMat);
                const barB = barF.clone();
                const barL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.75), cartMetalMat);
                const barR = barL.clone();
                barF.position.set(0, h, -0.375); barB.position.set(0, h, 0.375);
                barL.position.set(-0.275, h, 0); barR.position.set(0.275, h, 0);
                basketGroup.add(barF, barB, barL, barR);
            }
            const wireGeom = new THREE.BoxGeometry(0.01, 0.4, 0.01);
            for (let x = -0.275; x <= 0.275; x += 0.05) {
                const wF = new THREE.Mesh(wireGeom, cartMetalMat); wF.position.set(x, 0.2, -0.375);
                const wB = wF.clone(); wB.position.z = 0.375;
                basketGroup.add(wF, wB);
            }
            for (let z = -0.375; z <= 0.375; z += 0.05) {
                const wL = new THREE.Mesh(wireGeom, cartMetalMat); wL.position.set(-0.275, 0.2, z);
                const wR = wL.clone(); wR.position.x = 0.275;
                basketGroup.add(wL, wR);
            }
            basketGroup.add(basketContents);
            cartGroup.add(basketGroup);

            const handleSupportL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.4, 0.012), cartMetalMat);
            handleSupportL.position.set(-0.25, 0.45, 0.35);
            handleSupportL.rotation.x = 0.6;
            const handleSupportR = handleSupportL.clone();
            handleSupportR.position.x = 0.25;
            cartGroup.add(handleSupportL, handleSupportR);

            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.03), plasticHandleMat);
            handle.position.set(0, 0.52, 0.48);
            cartGroup.add(handle);
        }

        cartGroup.position.set(0, -0.85, -1.2); // Pushed further and lower for natural feel
        camera.add(cartGroup);
        scene.add(camera);

        const keys = keysRef.current;
        let targetRotationY = 0;

        const moveVec = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const Y_AXIS = new THREE.Vector3(0, 1, 0);

        const cartHalfWidth = isMobileDevice ? 0.35 : 0.275;
        const cartFrontExtent = isMobileDevice ? 0.45 : 0.375;
        const cartFrontDistance = Math.abs(cartGroup.position.z) + cartFrontExtent;

        const isCartBlockedAt = (x: number, z: number) => {
            const frontX = x + forward.x * cartFrontDistance;
            const frontZ = z + forward.z * cartFrontDistance;

            if (isPointBlocked(frontX, frontZ)) {
                return true;
            }

            const leftX = frontX + right.x * cartHalfWidth;
            const leftZ = frontZ + right.z * cartHalfWidth;
            if (isPointBlocked(leftX, leftZ)) {
                return true;
            }

            const rightX = frontX - right.x * cartHalfWidth;
            const rightZ = frontZ - right.z * cartHalfWidth;
            if (isPointBlocked(rightX, rightZ)) {
                return true;
            }

            return false;
        };

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

            // 1. Keyboard Movement
            if (keys['KeyW'] || keys['ArrowUp']) moveVec.z -= moveSpeed;
            if (keys['KeyS'] || keys['ArrowDown']) moveVec.z += moveSpeed;

            // 2. Joystick Movement (Mobile)
            if (joystickRef.current.active) {
                moveVec.z -= joystickRef.current.y * moveSpeed;
                moveVec.x += joystickRef.current.x * moveSpeed;
            }

            // Rotation logic 
            // 1. Keyboard Rotation (A / D or Arrows)
            if (keys['KeyA'] || keys['ArrowLeft']) targetRotationY += 0.03;
            if (keys['KeyD'] || keys['ArrowRight']) targetRotationY -= 0.03;

            // 2. Touch Look (Mobile)
            if (touchLookRef.current.dx !== 0) {
                targetRotationY -= touchLookRef.current.dx * 0.005;
                touchLookRef.current.dx = 0; // Consumption
            }

            if (moveVec.lengthSq() > 0) {
                // Limit speed if moving diagonally
                if (moveVec.lengthSq() > moveSpeed * moveSpeed) {
                    moveVec.normalize().multiplyScalar(moveSpeed);
                }
                moveVec.applyAxisAngle(Y_AXIS, camera.rotation.y);
                forward.set(0, 0, -1).applyAxisAngle(Y_AXIS, camera.rotation.y);
                right.set(1, 0, 0).applyAxisAngle(Y_AXIS, camera.rotation.y);
                const nextX = camera.position.x + moveVec.x;
                const nextZ = camera.position.z + moveVec.z;
                let finalX = camera.position.x;
                let finalZ = camera.position.z;

                if (!isCartBlockedAt(nextX, nextZ)) {
                    finalX = nextX;
                    finalZ = nextZ;
                } else {
                    if (!isCartBlockedAt(nextX, camera.position.z)) {
                        finalX = nextX;
                    }
                    if (!isCartBlockedAt(finalX, nextZ)) {
                        finalZ = nextZ;
                    }
                }

                const clampedX = Math.max(-28, Math.min(28, finalX));
                const clampedZ = Math.max(-42, Math.min(55, finalZ));
                if (!isCartBlockedAt(clampedX, clampedZ)) {
                    camera.position.x = clampedX;
                    camera.position.z = clampedZ;
                }
                camera.position.y = 1.6 + Math.sin(t * 0.01) * 0.03;
            } else {
                camera.position.y = 1.6;
            }

            // Apply smoothing to horizontal rotation
            if (Math.abs(targetRotationY - camera.rotation.y) > 0.001) {
                camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.15;
            }


            // Lock vertical look (Pitch) and reset cart position
            camera.rotation.x = 0;
            cartGroup.rotation.set(0, 0, 0);
            cartGroup.position.set(0, -0.85, -1.2);

            // Handle Held Mesh Position (Drag & Drop Visual) - Follow Cursor
            if (heldMeshRef.current) {
                // Map [-1, 1] mouse range to a comfortable 'in-hand' 3D range
                const dragPosX = mouse.x * 0.5;
                const dragPosY = mouse.y * 0.4 - 0.1;
                heldMeshRef.current.position.set(dragPosX, dragPosY, -0.6);

                // Dynamic tilt for 'weighty' feel
                heldMeshRef.current.rotation.set(0.2 - mouse.y * 0.2, -mouse.x * 0.3, 0);
            }


            camera.rotation.order = 'YXZ';
            renderer.render(scene, camera);
        }

        animate();

        const onKeyDown = (e: KeyboardEvent) => {
            keysRef.current[e.code] = true;
        };
        const onKeyUp = (e: KeyboardEvent) => {
            keysRef.current[e.code] = false;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // Start game logic (replaces pointer lock)
        const startGame = (posX?: number, posZ?: number) => {
            if (posX !== undefined && posZ !== undefined) {
                camera.position.set(posX, 1.6, posZ);
                // Face the center of the aisle 
                camera.lookAt(0, 1.6, 0);
                targetRotationY = camera.rotation.y;
            }
            setIsLockedState(true);
            renderer.domElement.focus();
        };
        lockPointerRef.current = (posX?: number, posZ?: number) => startGame(posX, posZ);

        // Click to start when overlay is visible
        const onCanvasClick = (e: MouseEvent) => {
            if (!stateRef.current.isLocked) {
                startGame();
            }
        };
        renderer.domElement.addEventListener('click', onCanvasClick);

        const onMove = (clientX: number, clientY: number) => {
            // Update 2D cursor position
            lastPointerRef.current = { x: clientX, y: clientY };
            setMousePos({ x: clientX, y: clientY });

            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();

            // Check for hover using container-relative coords
            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(clickableObjs, false);
            const intersect = intersects[0];
            let nextHover: SimProduct | null = null;

            if (intersect) {
                const mesh = intersect.object as THREE.Mesh;
                if (mesh instanceof THREE.InstancedMesh && intersect.instanceId !== undefined) {
                    const metadata = (mesh.userData as Partial<InstancedProductUserData>).instanceMetadata;
                    nextHover = metadata?.[intersect.instanceId] || null;
                } else if (mesh.userData?.clickable) {
                    nextHover = mesh.userData as SimProduct;
                }
            }

            const nextId = nextHover?.id || null;
            if (hoverIdRef.current !== nextId) {
                hoverIdRef.current = nextId;
                setHoveredProduct(nextHover);
            }

            setIsHovering(Boolean(nextHover));
        };

        const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];

                // 1. If holding product, handle drag 
                if (heldProductRef.current) {
                    e.preventDefault();
                    onMove(touch.clientX, touch.clientY);
                    return;
                }

                // 2. Otherwise, check for swipe-to-look
                if (touchLookRef.current.dx === 0) { // Only if not currently processing
                    const previousX = touchLookRef.current.lastX ?? touch.clientX;
                    const dx = touch.clientX - previousX;
                    touchLookRef.current.dx = dx;
                }
                touchLookRef.current.lastX = touch.clientX;
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onTouchMove, { passive: false });


        const onDown = (clientX: number, clientY: number) => {
            // Generous check: if locked, we handle it
            if (!stateRef.current.isLocked) return;

            lastPointerRef.current = { x: clientX, y: clientY };
            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();

            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(clickableObjs, false);

            if (intersects.length > 0) {
                const intersect = intersects[0];
                const mesh = intersect.object as THREE.Mesh;

                if (mesh.userData.clickable) {
                    let p: SimProduct | null = null;
                    // If it's an InstancedMesh, retrieve metadata by id
                    if (mesh instanceof THREE.InstancedMesh && intersect.instanceId !== undefined) {
                        const metadata = (mesh.userData as Partial<InstancedProductUserData>).instanceMetadata;
                        p = metadata?.[intersect.instanceId] || null;
                    } else {
                        p = mesh.userData as SimProduct;
                    }

                    if (p && p.price) {
                        heldProductRef.current = p;

                        // Create a temporary visual for holding 
                        // (Use original assets to create a single mesh)
                        const visualGeom = mesh.geometry.clone();
                        const visualMat = mesh.material;
                        const visualClone = new THREE.Mesh(visualGeom, visualMat);
                        visualClone.scale.set(0.3, 0.3, 0.3);
                        camera.add(visualClone);
                        heldMeshRef.current = visualClone;

                        // Visual feedback (Brief flash on the instance?) 
                        // Unfortunately InstancedMesh color updates are tricky, so we rely on the pickup animation
                    }
                }
            }
        };

        const handleMouseDown = (e: MouseEvent) => onDown(e.clientX, e.clientY);
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                touchLookRef.current.lastX = touch.clientX;
                onDown(touch.clientX, touch.clientY);
            }
        };

        const onUp = (clientX?: number, clientY?: number) => {
            if (!heldProductRef.current) return;

            const pointer = clientX !== undefined && clientY !== undefined
                ? { x: clientX, y: clientY }
                : lastPointerRef.current;
            if (pointer && mountRef.current) {
                const rect = mountRef.current.getBoundingClientRect();
                mouse.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;
            }

            const p = heldProductRef.current;
            const { money: currentMoney, total: currentTotal } = stateRef.current;

            // Manual Drop Check: Only add to cart if released over the lower half (Cart area)
            // mouse.y range is [-1, 1], -1 is bottom. -0.2 and below is roughly the cart/bottom HUD area.
            if (mouse.y < -0.2) {
                addItem({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    category: p.category,
                    image_url: p.image_url || null,
                    store_id: p.store_id,
                    store_name: p.store_name,
                    description: p.description
                });
                setMessage(`+ ${p.name}`);
                setTimeout(() => setMessage(''), 1000);
            } else {
                // If it was a quick click and we are on mobile or simple mode, add it anyway?
                // Actually, let's stick to the button for clarity.
                setMessage(dragToAddMessage);
                setTimeout(() => setMessage(''), 800);
            }

            // Cleanup
            if (heldMeshRef.current) {
                camera.remove(heldMeshRef.current);
                heldMeshRef.current = null;
            }
            heldProductRef.current = null;
        };

        const handleMouseUp = (e: MouseEvent) => onUp(e.clientX, e.clientY);
        const handleTouchEnd = () => {
            const last = lastPointerRef.current;
            onUp(last?.x, last?.y);
        };

        renderer.domElement.addEventListener('mousedown', handleMouseDown);
        renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchend', handleTouchEnd);

        const handleResize = () => {
            if (!mountRef.current) return;
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
        window.addEventListener('resize', handleResize);

        const disposedTextures = new Set<THREE.Texture>();
        const disposedMaterials = new Set<THREE.Material>();
        const disposedGeometries = new Set<THREE.BufferGeometry>();

        const disposeTexture = (texture?: THREE.Texture | null) => {
            if (!texture || disposedTextures.has(texture)) return;
            disposedTextures.add(texture);
            texture.dispose();
        };

        const disposeGeometry = (geometry?: THREE.BufferGeometry | null) => {
            if (!geometry || disposedGeometries.has(geometry)) return;
            disposedGeometries.add(geometry);
            geometry.dispose();
        };

        const materialTextureKeys = [
            'map',
            'alphaMap',
            'aoMap',
            'bumpMap',
            'displacementMap',
            'emissiveMap',
            'envMap',
            'lightMap',
            'metalnessMap',
            'normalMap',
            'roughnessMap',
            'specularMap',
            'clearcoatMap',
            'clearcoatNormalMap',
            'clearcoatRoughnessMap',
            'iridescenceMap',
            'iridescenceThicknessMap',
            'sheenColorMap',
            'sheenRoughnessMap',
            'specularColorMap',
            'specularIntensityMap',
            'thicknessMap',
            'transmissionMap',
        ] as const;

        const disposeMaterial = (material?: THREE.Material | null) => {
            if (!material || disposedMaterials.has(material)) return;
            disposedMaterials.add(material);

            const matWithMaps = material as THREE.Material & Record<string, unknown>;
            materialTextureKeys.forEach((key) => {
                const value = matWithMaps[key];
                if (value instanceof THREE.Texture) {
                    disposeTexture(value);
                }
            });

            material.dispose();
        };

        return () => {
            cancelAnimationFrame(animationId);

            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchend', handleTouchEnd);
            renderer.domElement.removeEventListener('mousedown', handleMouseDown);
            renderer.domElement.removeEventListener('touchstart', handleTouchStart);
            renderer.domElement.removeEventListener('click', onCanvasClick);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onTouchMove);

            if (heldMeshRef.current) {
                camera.remove(heldMeshRef.current);
                disposeGeometry(heldMeshRef.current.geometry);
                heldMeshRef.current = null;
            }
            heldProductRef.current = null;

            scene.traverse((obj) => {
                const node = obj as THREE.Object3D & {
                    geometry?: THREE.BufferGeometry;
                    material?: THREE.Material | THREE.Material[];
                };

                if (node.geometry) {
                    disposeGeometry(node.geometry);
                }

                if (Array.isArray(node.material)) {
                    node.material.forEach((material) => disposeMaterial(material));
                } else {
                    disposeMaterial(node.material);
                }
            });

            textureCache.forEach((texture) => disposeTexture(texture));
            textureCache.clear();

            fallbackTextures.forEach((texture) => disposeTexture(texture));
            [
                marbleTex,
                woodTex,
                leafTex,
                stoneTex,
                artTex1,
                artTex2,
                artTex3,
            ].forEach((texture) => disposeTexture(texture));

            productAssets.forEach((material) => disposeMaterial(material));
            productAssets.clear();

            scene.clear();
            camera.clear();

            if (mountRef.current?.contains(renderer.domElement)) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.renderLists.dispose();
            (renderer as THREE.WebGLRenderer & { forceContextLoss?: () => void }).forceContextLoss?.();
            renderer.dispose();
            rendererRef.current = null;
        }
    }, [catalogLoaded, dragToAddMessage, isArabic]);

    const handleCheckout = () => {
        if (total === 0) return;
        setMoney(m => m - total);
        clear();
        setShowCheckout(true);
    };

    const handleReset = () => {
        clear();
        setShowCheckout(false);
    };

    const handleRemoveItem = (id: string) => {
        decrementItem(id);
    };

    // --- Sync 3D Cart Visualization ---
    useEffect(() => {
        const group = basketContentsRef.current;
        if (!group) return;

        const disposeCartItem = (object: THREE.Object3D) => {
            const node = object as THREE.Object3D & {
                geometry?: THREE.BufferGeometry;
                material?: THREE.Material | THREE.Material[];
            };

            if (node.geometry) {
                node.geometry.dispose();
            }

            if (Array.isArray(node.material)) {
                node.material.forEach((material) => material.dispose());
            } else {
                node.material?.dispose();
            }
        };

        // Clear previous visual items
        while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
            disposeCartItem(child);
        }

        let renderIndex = 0;
        cartItems.forEach((item) => {
            const count = item.quantity || 1;
            for (let i = 0; i < count; i++) {
                const geom = item.category === 'produce'
                    ? new THREE.SphereGeometry(0.08, 8, 8)
                    : new THREE.BoxGeometry(0.12, 0.15, 0.1);

                const mat = new THREE.MeshStandardMaterial({
                    color: hashToColor(item.id),
                    roughness: 0.5
                });

                const mesh = new THREE.Mesh(geom, mat);

                const rx = (Math.random() - 0.5) * 0.4;
                const ry = Math.floor(renderIndex / 4) * 0.15;
                const rz = (Math.random() - 0.5) * 0.6;

                mesh.position.set(rx, ry, rz);
                mesh.rotation.set(Math.random(), Math.random(), Math.random());
                group.add(mesh);
                renderIndex += 1;
            }
        });

        return () => {
            while (group.children.length > 0) {
                const child = group.children[0];
                group.remove(child);
                disposeCartItem(child);
            }
        };
    }, [cartItems]);

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            background: '#000',
            zIndex: 0
        }}>
            <div ref={mountRef} style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1
            }} />

            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    color: '#0f0',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 2px #000',
                    zIndex: 100
                }}>
                    FPS: {fps}
                </div>
            )}

            {/* Specialization Badge - Centered and Responsive */}
            <div style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(31, 71, 139, 0.95)',
                padding: '6px 14px',
                borderRadius: '30px',
                border: '1px solid rgba(74, 144, 226, 0.6)',
                color: 'white',
                fontSize: 'clamp(10px, 2.5vw, 13px)', // Responsive font size
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 100,
                fontFamily: 'sans-serif',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                maxWidth: '90vw',
                overflow: 'hidden'
            }}>
                <span style={{ color: '#4A90E2', fontSize: '10px' }}>●</span>
                <span style={{ display: 'flex', gap: '5px' }}>
                    <span className="badge-desktop">{t('محاكاة السوبرماركت |', 'SUPERMARKET SIMULATION |')}</span>
                    <span>{t('سوبرماركت فقط', 'Supermarket Only')}</span>
                </span>
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

            {/* Responsive UI Styles */}
            <style>{`
                canvas { cursor: none !important; }
                @media (max-width: 600px) {
                    .badge-desktop { display: none; }
                }
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

            {hoveredProduct && isLockedState && (
                <div style={{
                    position: 'absolute',
                    top: 80,
                    right: 20,
                    width: 300,
                    background: 'rgba(0,0,0,0.75)',
                    color: 'white',
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    zIndex: 120,
                    direction: isArabic ? 'rtl' : 'ltr',
                    fontFamily: 'sans-serif'
                }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: '#111',
                            flexShrink: 0,
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            <img
                                src={hoveredProduct.image_url || '/placeholder.svg'}
                                alt={hoveredProduct.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: '1.4' }}>
                                {hoveredProduct.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#bdbdbd', marginTop: '4px' }}>
                                {hoveredProduct.store_name || t('المتجر', 'Store')}
                            </div>
                            <div style={{
                                fontSize: '12px',
                                color: '#9e9e9e',
                                marginTop: '8px',
                                lineHeight: '1.5',
                                maxHeight: '3.6em',
                                overflow: 'hidden'
                            }}>
                                {hoveredProduct.description || t('بدون وصف', 'No description')}
                            </div>
                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 'bold', color: '#ffeb3b', fontSize: '16px' }}>
                                    {hoveredProduct.price.toFixed(2)} EGP
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        addItem({
                                            id: hoveredProduct.id,
                                            name: hoveredProduct.name,
                                            price: hoveredProduct.price,
                                            category: hoveredProduct.category,
                                            image_url: hoveredProduct.image_url || null,
                                            store_id: hoveredProduct.store_id,
                                            store_name: hoveredProduct.store_name,
                                            description: hoveredProduct.description
                                        });
                                        setMessage(`+ ${hoveredProduct.name}`);
                                        setTimeout(() => setMessage(''), 1000);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{
                                        background: '#4caf50',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 10px rgba(76, 175, 80, 0.3)'
                                    }}
                                >
                                    {t('إضافة للسلة', 'Add to Cart')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cart UI - Floating Button or Glassmorphism Card */}
            {isCartMinimized ? (
                // Floating Action Button (FAB) + Back to Site Button
                <div style={{
                    position: 'absolute',
                    bottom: 25,
                    right: 25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    zIndex: 110
                }}>
                    {/* Back to Site Button */}
                    <Link
                        href="/"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '14px 18px',
                            borderRadius: '999px',
                            background: 'rgba(31, 71, 139, 0.95)',
                            border: '2px solid rgba(255,255,255,0.3)',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            cursor: 'pointer'
                        }}
                    >
                        {t('🏠 العودة للموقع', '🏠 Back to Site')}
                    </Link>

                    {/* Cart FAB */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCartMinimized(false);
                        }}
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(229, 57, 53, 0.95)',
                            color: 'white',
                            border: '2px solid rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            fontSize: '24px',
                            position: 'relative'
                        }}
                        title={t('فتح السلة', 'Open Cart')}
                    >
                        🛒
                        {cartCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: -5,
                                right: -5,
                                background: '#4caf50',
                                color: 'white',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                border: '2px solid #222'
                            }}>
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>
            ) : (
                // Full Cart Card
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '20px',
                    width: 'calc(100% - 40px)',
                    maxWidth: '350px',
                    direction: isArabic ? 'rtl' : 'ltr',
                    fontFamily: 'sans-serif',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    zIndex: 110
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                        <h2 style={{ margin: 0, color: '#e53935', fontSize: '22px' }}>{t('🛒 السلة', '🛒 Cart')}</h2>
                        <button
                            onClick={() => setIsCartMinimized(true)}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: 'white',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '18px' }}>
                        <span style={{ opacity: 0.8 }}>{t('المجموع:', 'Total:')}</span>
                        <span style={{ color: '#ffeb3b', fontWeight: 'bold' }}>{total.toFixed(2)} EGP</span>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '20px' }}>
                        {cartItems.map((item) => (
                            <div key={item.id} style={{ fontSize: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px', opacity: 0.9 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>• {item.name}</span>
                                    <span style={{ color: '#ffeb3b', fontSize: '12px' }}>{item.price} EGP</span>
                                    <span style={{ color: '#9e9e9e', fontSize: '12px' }}>x{item.quantity}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                                    style={{ background: 'rgba(239, 83, 80, 0.2)', color: '#ef5350', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}
                                >
                                    {t('إرجاع', 'Remove')}
                                </button>
                            </div>
                        ))}
                        {cartItems.length === 0 && <div style={{ textAlign: 'center', opacity: 0.5, padding: '10px' }}>{t('السلة فارغة', 'Cart is empty')}</div>}
                    </div>

                    <button onClick={handleCheckout} style={{
                        width: '100%', padding: '14px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 10px rgba(76, 175, 80, 0.3)'
                    }}>
                        {t('تأكيد ودفع الحساب', 'Checkout and Pay')}
                    </button>
                    <button onClick={handleReset} style={{
                        width: '100%', padding: '10px', background: 'transparent', color: '#ef5350', border: '1px solid rgba(239, 83, 80, 0.5)', borderRadius: '10px', cursor: 'pointer', marginTop: '12px', fontSize: '14px'
                    }}>
                        {t('إفراغ السلة', 'Clear Cart')}
                    </button>
                </div>
            )}

            {showCheckout && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
                }}>
                    <div style={{ background: '#222', padding: '40px', borderRadius: '20px', textAlign: 'center', border: '2px solid #4caf50' }}>
                        <h1 style={{ color: '#4caf50', margin: 0 }}>{t('شكراً لزيارتكم!', 'Thanks for visiting!')}</h1>
                        <p style={{ color: '#ccc', margin: '20px 0' }}>{t('تم خصم المبلغ بنجاح', 'Payment deducted successfully')}</p>
                        <button onClick={() => setShowCheckout(false)} style={{
                            padding: '10px 30px', background: '#2196f3', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontSize: '18px'
                        }}>
                            {t('متابعة', 'Continue')}
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Navigation Arrows (Bottom Left) */}
            {isMobile && isLockedState && (
                <div style={{
                    position: 'absolute',
                    bottom: 30,
                    left: 20,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 50px)',
                    gap: '10px',
                    zIndex: 200,
                    direction: 'ltr'
                }}>
                    <div />
                    <button
                        onTouchStart={(e) => { e.preventDefault(); joystickRef.current.active = true; joystickRef.current.y = 1; }}
                        onTouchEnd={() => { joystickRef.current.active = false; joystickRef.current.y = 0; }}
                        style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', border: '2px solid #fff', borderRadius: '8px', color: '#fff', fontSize: '20px' }}
                    >▲</button>
                    <div />

                    <button
                        onTouchStart={(e) => { e.preventDefault(); joystickRef.current.active = true; joystickRef.current.x = -1; }}
                        onTouchEnd={() => { joystickRef.current.active = false; joystickRef.current.x = 0; }}
                        style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', border: '2px solid #fff', borderRadius: '8px', color: '#fff', fontSize: '20px' }}
                    >◀</button>
                    <button
                        onTouchStart={(e) => { e.preventDefault(); joystickRef.current.active = true; joystickRef.current.y = -1; }}
                        onTouchEnd={() => { joystickRef.current.active = false; joystickRef.current.y = 0; }}
                        style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', border: '2px solid #fff', borderRadius: '8px', color: '#fff', fontSize: '20px' }}
                    >▼</button>
                    <button
                        onTouchStart={(e) => { e.preventDefault(); joystickRef.current.active = true; joystickRef.current.x = 1; }}
                        onTouchEnd={() => { joystickRef.current.active = false; joystickRef.current.x = 0; }}
                        style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', border: '2px solid #fff', borderRadius: '8px', color: '#fff', fontSize: '20px' }}
                    >▶</button>
                </div>
            )}

            {/* Click to Play / Teleport Overlay */}
            {!isLockedState && (
                <div
                    onClick={() => {
                        lockPointerRef.current();
                    }}
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', zIndex: 100,
                        cursor: 'pointer', backdropFilter: 'blur(8px)'
                    }}
                >
                    <div style={{
                        background: 'rgba(255,255,255,0.1)', padding: '30px', borderRadius: '30px',
                        border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', color: 'white',
                        maxWidth: '90vw', width: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h2 style={{ margin: '0 0 10px 0', color: '#4A90E2' }}>{t('أهلاً بك في المتجر الذكي', 'Welcome to the Smart Store')}</h2>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.8 }}>
                            {t('اختر قسماً للانتقال إليه فوراً، أو اضغط في أي مكان للبدء من المدخل:', 'Choose a section for instant teleport, or click anywhere to start from the entrance:')}
                        </p>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '15px',
                            marginTop: '10px'
                        }}>
                            {departments.map(dept => (
                                <button
                                    key={dept.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        lockPointerRef.current(dept.x, dept.z);
                                    }}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white',
                                        padding: '15px 10px',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        backdropFilter: 'blur(5px)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(74, 144, 226, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    <span style={{ fontSize: '28px' }}>{dept.icon}</span>
                                    <span style={{ fontWeight: 'bold' }}>{dept.label}</span>
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: '25px', fontSize: '12px', opacity: 0.6 }}>
                            {isMobile
                                ? t('استخدم عصا التحكم للحركة، واسحب في أي مكان للنظر', 'Use the joystick to move and drag anywhere to look')
                                : t('استخدم WASD أو الأسهم للحركة، والماوس للنظر', 'Use WASD or arrow keys to move, and mouse to look')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
