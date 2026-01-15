import Phaser from "phaser";
import { eventBus } from "./EventBus";
import { findPath } from "./pathfinder";
import NetworkClient from "./NetworkClient";

type SpawnItem = { id: string; name: string; price: number; x: number; y: number; tileX: number; tileY: number };
type NPC = {
    id: string;
    sprite: Phaser.Physics.Arcade.Sprite;
    state: "idle" | "shopping" | "toCheckout" | "inQueue" | "leaving";
    target?: { x: number; y: number };
    path?: { x: number; y: number }[];
    tick: number;
    cart: SpawnItem[];
};

const TILE = 40;

export default class GameScene extends Phaser.Scene {
    player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    itemsGroup!: Phaser.Physics.Arcade.Group;
    money: number = 100;
    gridWidth = 24;
    gridHeight = 16;
    walkableGrid: boolean[][] = [];
    npcs: Map<string, NPC> = new Map();
    network?: NetworkClient;
    itemSpawns: SpawnItem[] = [];
    checkoutPositions: { x: number; y: number }[] = [];
    queue: string[] = []; // npc ids

    constructor() {
        super({ key: "GameScene" });
    }

    preload() { }

    create() {
        // expose eventBus for NetworkClient if needed (global access sometimes used in this repo)
        if (typeof window !== "undefined") {
            (window as any).eventBus = eventBus;
        }

        // network
        this.network = new NetworkClient();
        this.network.connect();

        const width = this.scale.width;
        const height = this.scale.height;

        // initialize walkable grid (true = walkable)
        for (let x = 0; x < this.gridWidth; x++) {
            this.walkableGrid[x] = [];
            for (let y = 0; y < this.gridHeight; y++) this.walkableGrid[x][y] = true;
        }

        // floor & aisles draw
        this.add.rectangle(width / 2, height / 2, width - 20, height - 20, 0x071029).setStrokeStyle(2, 0x0b1220);

        // create aisles as blocked rectangles on grid (shelves)
        const shelves: { x: number; y: number; w: number; h: number }[] = [
            { x: 3, y: 2, w: 2, h: 12 },
            { x: 7, y: 2, w: 2, h: 12 },
            { x: 11, y: 2, w: 2, h: 12 },
            { x: 15, y: 2, w: 2, h: 12 },
            { x: 19, y: 2, w: 2, h: 12 }
        ];
        for (const s of shelves) {
            const rect = this.add.rectangle((s.x + s.w / 2) * TILE, (s.y + s.h / 2) * TILE, s.w * TILE - 6, s.h * TILE - 6, 0x12314a);
            rect.setStrokeStyle(2, 0x0b2540);
            // mark grid cells as non-walkable
            for (let gx = s.x; gx < s.x + s.w; gx++) {
                for (let gy = s.y; gy < s.y + s.h; gy++) {
                    if (gx >= 0 && gy >= 0 && gx < this.gridWidth && gy < this.gridHeight) {
                        this.walkableGrid[gx][gy] = false;
                    }
                }
            }
        }

        // register checkout counters at bottom-right
        this.checkoutPositions = [
            { x: (21) * TILE, y: (13) * TILE },
            { x: (22) * TILE, y: (13) * TILE }
        ];
        for (const c of this.checkoutPositions) {
            this.add.rectangle(c.x, c.y, TILE * 1.4, TILE * 1.6, 0xf59e0b).setStrokeStyle(2, 0x8a4b0e);
        }

        // create player
        const g = this.add.graphics();
        g.fillStyle(0xF59E0B, 1);
        g.fillRoundedRect(0, 0, 30, 40, 6);
        g.generateTexture("player-sprite", 30, 40);
        g.clear();

        this.player = this.physics.add.sprite(120, 120, "player-sprite");
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(22, 36).setOffset(4, 2);

        // items group
        this.itemsGroup = this.physics.add.group();

        // initial spawns (distributed near shelves)
        this.itemSpawns = [
            { id: "apple", name: "Apple", price: 2, x: 200, y: 140, tileX: 6, tileY: 3 },
            { id: "bread", name: "Bread", price: 4, x: 320, y: 320, tileX: 8, tileY: 8 },
            { id: "milk", name: "Milk", price: 3, x: 520, y: 240, tileX: 13, tileY: 6 },
            { id: "eggs", name: "Eggs", price: 5, x: 720, y: 420, tileX: 18, tileY: 10 },
            { id: "banana", name: "Banana", price: 2, x: 420, y: 520, tileX: 11, tileY: 13 },
            { id: "cereal", name: "Cereal", price: 6, x: 760, y: 180, tileX: 19, tileY: 4 }
        ];

        this.itemSpawns.forEach((s) => this.createItemSprite(s));

        // overlap pickup: player picks up
        this.physics.add.overlap(this.player, this.itemsGroup, (p, itemSprite) => {
            const meta = itemSprite.getData("meta") as SpawnItem;
            eventBus.emit("pickup", { item: { id: meta.id + "-" + Date.now(), name: meta.name, price: meta.price } });
            eventBus.emit("log", `Player picked up ${meta.name}`);
            itemSprite.destroy();
            this.network?.send({ type: "pickup", by: "player", item: meta.id });
        });

        // cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        // Re-check input availability for WASD
        if (this.input.keyboard) {
            this.input.keyboard.addKeys("W,A,S,D");
        }

        // camera
        this.cameras.main.setBounds(0, 0, this.gridWidth * TILE, this.gridHeight * TILE);
        this.cameras.main.startFollow(this.player, false, 0.08, 0.08);

        // spawn NPCs
        for (let i = 0; i < 3; i++) this.spawnNpc();

        // network message hook (simple sync)
        eventBus.on("network:message", (msg: any) => {
            if (msg.type === "state") {
                eventBus.emit("log", "Received state snapshot from server");
            }
        });

        // publish initial money
        eventBus.emit("money", this.money);
        eventBus.emit("log", "Game scene initialized");

        // Listen for commands from UI
        eventBus.on("cmd:spawnItem", () => {
            const x = Phaser.Math.Between(100, width - 100);
            const y = Phaser.Math.Between(100, height - 100);
            this.createItemSprite({ id: "added", name: "Mystery Item", price: 10, x, y, tileX: Math.floor(x / TILE), tileY: Math.floor(y / TILE) });
        });

        eventBus.on("cmd:setNpc", (count: number) => {
            // clear existing
            this.npcs.forEach(n => n.sprite.destroy());
            this.npcs.clear();
            for (let i = 0; i < count; i++) this.spawnNpc();
        });
    }

    update(time: number, delta: number) {
        const speed = 200;
        const kb = this.input.keyboard;
        const left = this.cursors.left.isDown || (kb && kb.addKey("A").isDown);
        const right = this.cursors.right.isDown || (kb && kb.addKey("D").isDown);
        const up = this.cursors.up.isDown || (kb && kb.addKey("W").isDown);
        const down = this.cursors.down.isDown || (kb && kb.addKey("S").isDown);

        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0);

        if (left) body.setVelocityX(-speed);
        if (right) body.setVelocityX(speed);
        if (up) body.setVelocityY(-speed);
        if (down) body.setVelocityY(speed);

        body.velocity.normalize().scale(speed);

        // update NPCs
        this.npcs.forEach((npc) => {
            npc.tick += delta;
            if (!npc.path || npc.path.length === 0) {
                // determine next behavior
                if (npc.state === "idle") {
                    npc.state = "shopping";
                    const items = this.itemsGroup.getChildren().map(s => s as Phaser.GameObjects.GameObject);
                    if (items.length > 0) {
                        const choice = Phaser.Math.Between(0, items.length - 1);
                        const chosen = (items[choice] as any);
                        const meta = chosen.getData("meta") as SpawnItem;
                        npc.target = { x: meta.tileX, y: meta.tileY };
                        npc.path = this.computePathToTile(npc.sprite.x, npc.sprite.y, npc.target.x, npc.target.y);
                    } else {
                        const tx = Phaser.Math.Between(1, this.gridWidth - 2);
                        const ty = Phaser.Math.Between(1, this.gridHeight - 2);
                        if (this.walkableAt(tx, ty)) {
                            npc.target = { x: tx, y: ty };
                            npc.path = this.computePathToTile(npc.sprite.x, npc.sprite.y, tx, ty);
                        }
                    }
                } else if (npc.state === "shopping") {
                    npc.state = "toCheckout";
                    npc.target = { x: Math.floor(this.checkoutPositions[0].x / TILE), y: Math.floor(this.checkoutPositions[0].y / TILE) };
                    npc.path = this.computePathToTile(npc.sprite.x, npc.sprite.y, npc.target.x, npc.target.y);
                } else if (npc.state === "toCheckout") {
                    npc.state = "inQueue";
                    this.queue.push(npc.id);
                } else if (npc.state === "inQueue") {
                    if (this.queue[0] === npc.id) {
                        const total = npc.cart.reduce((s, it) => s + it.price, 0);
                        npc.cart = [];
                        npc.state = "leaving";
                        npc.path = this.computePathToTile(npc.sprite.x, npc.sprite.y, 1, 1);
                        this.queue.shift();
                        eventBus.emit("log", `NPC ${npc.id} checked out for $${total}`);
                        this.network?.send({ type: "npc_checkout", id: npc.id, total });
                    }
                } else if (npc.state === "leaving") {
                    const dist = Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, TILE, TILE);
                    if (dist < 12) {
                        npc.sprite.destroy();
                        this.npcs.delete(npc.id);
                    }
                }
            } else {
                const next = npc.path[0];
                const targetPx = next.x * TILE + TILE / 2;
                const targetPy = next.y * TILE + TILE / 2;
                const speedNpc = 80;
                this.physics.moveTo(npc.sprite, targetPx, targetPy, speedNpc);
                const dist = Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, targetPx, targetPy);
                if (dist < 6) {
                    npc.sprite.setVelocity(0);
                    npc.path.shift();
                    const itemsNearby = this.itemsGroup.getChildren().filter((it: any) => {
                        const meta = it.getData("meta") as SpawnItem;
                        return meta.tileX === next.x && meta.tileY === next.y;
                    });
                    if (itemsNearby.length > 0 && npc.state === "shopping") {
                        const it = itemsNearby[0] as any;
                        const meta = it.getData("meta") as SpawnItem;
                        npc.cart.push(meta);
                        eventBus.emit("log", `NPC ${npc.id} picked ${meta.name}`);
                        it.destroy();
                        this.network?.send({ type: "npc_pickup", id: npc.id, item: meta.id });
                        if (npc.cart.length >= Phaser.Math.Between(1, 3)) {
                            npc.state = "toCheckout";
                            npc.path = undefined;
                        }
                    }
                }
            }
        });

        if (time % 1000 < delta) {
            this.network?.send({ type: "snapshot", items: this.itemsGroup.getChildren().length, npcs: this.npcs.size });
        }
    }

    createItemSprite(s: SpawnItem) {
        const key = `item-${s.id}-${Math.random().toString(36).slice(2, 9)}`;
        const ig = this.add.graphics();
        ig.fillStyle(0xffffff, 1);
        ig.fillCircle(0, 0, 14);
        ig.lineStyle(2, 0x222831);
        ig.strokeCircle(0, 0, 14);
        const color = Phaser.Display.Color.RandomRGB();
        ig.fillStyle(color.color, 1);
        ig.fillCircle(-5, -5, 6);
        ig.generateTexture(key, 28, 28);
        ig.destroy();

        const spr = this.physics.add.sprite(s.x, s.y, key);
        spr.setData("meta", s);
        spr.setImmovable(true);
        this.itemsGroup.add(spr);
    }

    spawnNpc() {
        const id = `npc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const g = this.add.graphics();
        g.fillStyle(0x60a5fa, 1);
        g.fillRoundedRect(0, 0, 28, 36, 6);
        g.generateTexture(`npc-${id}`, 28, 36);
        g.clear();
        const px = TILE * 2 + Phaser.Math.Between(-10, 10);
        const py = TILE * 2 + Phaser.Math.Between(-10, 10);
        const spr = this.physics.add.sprite(px, py, `npc-${id}`);
        spr.setCollideWorldBounds(true);
        const npc: NPC = { id, sprite: spr, state: "idle", tick: 0, cart: [] };
        this.npcs.set(id, npc);
        eventBus.emit("log", `Spawned NPC ${id}`);
        eventBus.emit("npc:changed", this.npcs.size);
    }

    computePathToTile(px: number, py: number, tx: number, ty: number) {
        const startX = Math.floor(px / TILE);
        const startY = Math.floor(py / TILE);
        const path = findPath({
            width: this.gridWidth,
            height: this.gridHeight,
            walkable: (x, y) => this.walkableAt(x, y)
        }, startX, startY, tx, ty);
        return path ?? undefined;
    }

    walkableAt(x: number, y: number) {
        if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) return false;
        return this.walkableGrid[x][y];
    }
}
