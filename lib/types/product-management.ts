export type SectionType =
    | 'BAKERY'
    | 'DAIRY'
    | 'PRODUCE'
    | 'MEAT'
    | 'BEAUTY'
    | 'GROCERY'
    | 'DRINKS'
    | 'CLEANING'
    | 'CHECKOUT'
    | 'OTHER';

export type ProductShape = 'box' | 'cylinder' | 'sphere' | 'capsule';

export interface Product {
    id: string;
    nameAR: string;
    nameEN: string;
    category: SectionType;
    shape: ProductShape;
    dimensions: number[]; // [width, height, depth] or [radius, height] or [radius]
    color: string;
    textureURL?: string;
    price: number;
    barcode?: string;
    pattern?: string;
}

export type ShelfType =
    | 'wooden_table'
    | 'slanted_table'
    | 'open_fridge'
    | 'glass_counter'
    | 'traditional_shelf'
    | 'glass_shelf';

export interface Shelf {
    shelfId: string;
    sectionEN: SectionType;
    sectionAR: string;
    type: ShelfType;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    capacity: number;
}

export interface Placement {
    placementId: string;
    shelfId: string;
    productId: string;
    position: { x: number; y: number; z: number }; // Relative to shelf
    rotation: { x: number; y: number; z: number };
    quantity: number;
}

export interface SectionInfo {
    id: SectionType;
    nameAR: string;
    nameEN: string;
    icon: string;
    color: string;
}
