import * as Phaser from "phaser";

export const products = [
  // Dairy Section
  { name: 'حليب كامل الدسم', price: 15, img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100&h=100&fit=crop', category: 'ألبان' },
  { name: 'حليب قليل الدسم', price: 14, img: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=100&h=100&fit=crop', category: 'ألبان' },
  { name: 'زبادي', price: 8, img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=100&h=100&fit=crop', category: 'ألبان' },
  { name: 'جبنة شيدر', price: 25, img: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=100&h=100&fit=crop', category: 'ألبان' },
  { name: 'جبنة موتزاريلا', price: 30, img: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=100&h=100&fit=crop', category: 'ألبان' },
  
  // Canned Goods
  { name: 'تونة معلبة', price: 12, img: 'https://images.unsplash.com/photo-1625937329935-d7c003cdb87e?w=100&h=100&fit=crop', category: 'معلبات' },
  { name: 'ذرة معلبة', price: 8, img: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=100&h=100&fit=crop', category: 'معلبات' },
  { name: 'فول معلب', price: 6, img: 'https://images.unsplash.com/photo-1585928034679-b2006d7fc9c0?w=100&h=100&fit=crop', category: 'معلبات' },
  { name: 'صلصة طماطم', price: 10, img: 'https://images.unsplash.com/photo-1587411768941-4057f2c5e4d8?w=100&h=100&fit=crop', category: 'معلبات' },
  
  // Beverages
  { name: 'عصير برتقال', price: 18, img: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=100&h=100&fit=crop', category: 'مشروبات' },
  { name: 'عصير تفاح', price: 16, img: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=100&h=100&fit=crop', category: 'مشروبات' },
  { name: 'كولا', price: 12, img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=100&h=100&fit=crop', category: 'مشروبات' },
  { name: 'ماء معدني', price: 5, img: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=100&h=100&fit=crop', category: 'مشروبات' },
  
  // Bakery
  { name: 'خبز أبيض', price: 5, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&h=100&fit=crop', category: 'مخبوزات' },
  { name: 'خبز بني', price: 6, img: 'https://images.unsplash.com/photo-1585478259715-876acc716a58?w=100&h=100&fit=crop', category: 'مخبوزات' },
  { name: 'كرواسون', price: 8, img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=100&h=100&fit=crop', category: 'مخبوزات' },
  
  // Cereals
  { name: 'كورن فليكس', price: 20, img: 'https://images.unsplash.com/photo-1590419690008-905895e8fe0d?w=100&h=100&fit=crop', category: 'حبوب' },
  { name: 'شوفان', price: 22, img: 'https://images.unsplash.com/photo-1574856344991-aaa31b6f4ce3?w=100&h=100&fit=crop', category: 'حبوب' },
  
  // Frozen
  { name: 'بيتزا مجمدة', price: 35, img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=100&h=100&fit=crop', category: 'مجمدات' },
  { name: 'برجر مجمد', price: 40, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&h=100&fit=crop', category: 'مجمدات' },
  { name: 'أيس كريم', price: 25, img: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=100&h=100&fit=crop', category: 'مجمدات' },
  
  // Cleaning
  { name: 'صابون سائل', price: 15, img: 'https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=100&h=100&fit=crop', category: 'منظفات' },
  { name: 'مسحوق غسيل', price: 30, img: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=100&h=100&fit=crop', category: 'منظفات' },
  { name: 'منظف أرضيات', price: 20, img: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=100&h=100&fit=crop', category: 'منظفات' },
];

export default class GameScene extends Phaser.Scene {
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd!: any;
    player!: Phaser.GameObjects.Rectangle;
    playerIcon!: Phaser.GameObjects.Text;
    npcGroup!: Phaser.Physics.Arcade.Group;
    npcIcons: { icon: Phaser.GameObjects.Text, body: any }[] = [];

    constructor() {
        super({ key: "GameScene" });
    }

    preload() {
        products.forEach((product, index) => {
            this.load.image(`product_${index}`, product.img);
        });
    }

    create() {
        const scene = this;
        const width = this.scale.width;
        const height = this.scale.height;

        // Create shelves with products
        const shelfPositions = [
            { x: 100, y: 150, products: products.slice(0, 5), name: '🥛 قسم الألبان' },
            { x: 280, y: 150, products: products.slice(5, 9), name: '🥫 قسم المعلبات' },
            { x: 460, y: 150, products: products.slice(9, 13), name: '🧃 قسم المشروبات' },
            { x: 100, y: 450, products: products.slice(13, 16), name: '🍞 قسم المخبوزات' },
            { x: 280, y: 450, products: products.slice(16, 18), name: '🥣 قسم الحبوب' },
            { x: 460, y: 450, products: products.slice(18, 21), name: '🍕 قسم المجمدات' },
            { x: 720, y: 300, products: products.slice(21, 24), name: '🧼 قسم المنظفات' },
        ];

        shelfPositions.forEach((shelf, shelfIndex) => {
            // Draw shelf background
            const shelfBg = scene.add.rectangle(shelf.x, shelf.y, 140, 200, 0x1e293b);
            shelfBg.setStrokeStyle(3, 0x334155);

            // Shelf header with name
            const shelfHeader = scene.add.rectangle(shelf.x, shelf.y - 110, 140, 30, 0x2563eb);
            const shelfLabel = scene.add.text(
                shelf.x,
                shelf.y - 110,
                shelf.name,
                {
                    fontSize: '11px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'center'
                }
            );
            shelfLabel.setOrigin(0.5);

            // Add products on shelf
            shelf.products.forEach((product, index) => {
                // Calculate absolute product index for image key
                let productIndex = 0;
                for (let i = 0; i < shelfIndex; i++) {
                    productIndex += shelfPositions[i].products.length;
                }
                productIndex += index;

                const yOffset = index * 38 - 60;

                // Product container
                const productContainer = scene.add.rectangle(
                    shelf.x,
                    shelf.y + yOffset,
                    120, 35,
                    0xf8fafc
                );
                productContainer.setStrokeStyle(1, 0xe2e8f0);
                productContainer.setInteractive({ useHandCursor: true });

                // Product image
                const productImg = scene.add.image(
                    shelf.x - 45,
                    shelf.y + yOffset,
                    `product_${productIndex}`
                );
                productImg.setDisplaySize(28, 28);

                // Product name
                const label = scene.add.text(
                    shelf.x - 15,
                    shelf.y + yOffset - 5,
                    product.name,
                    {
                        fontSize: '9px',
                        color: '#0f172a',
                        fontStyle: 'bold',
                        wordWrap: { width: 70 }
                    }
                );
                label.setOrigin(0, 0.5);

                // Price tag
                const priceTag = scene.add.text(
                    shelf.x - 15,
                    shelf.y + yOffset + 8,
                    `${product.price} ج.م`,
                    {
                        fontSize: '9px',
                        color: '#ffffff',
                        backgroundColor: '#10b981',
                        padding: { x: 4, y: 2 },
                        fontStyle: 'bold'
                    }
                );
                priceTag.setOrigin(0, 0.5);

                productContainer.on('pointerdown', () => {
                    // Emit event to React
                    this.game.events.emit('BUY_PRODUCT', product);

                    // Visual feedback
                    scene.tweens.add({
                        targets: [productContainer, label, priceTag, productImg],
                        alpha: 0,
                        scale: 0.5,
                        duration: 400,
                        ease: 'Power2',
                        onComplete: () => {
                            productContainer.destroy();
                            label.destroy();
                            priceTag.destroy();
                            productImg.destroy();
                        }
                    });
                });

                productContainer.on('pointerover', () => {
                    productContainer.setFillStyle(0xe2e8f0);
                });

                productContainer.on('pointerout', () => {
                    productContainer.setFillStyle(0xf8fafc);
                });
            });
        });

        // Player
        this.player = scene.add.rectangle(220, 400, 40, 40, 0xf59e0b);
        this.player.setStrokeStyle(3, 0xd97706);
        scene.physics.add.existing(this.player);
        (this.player.body as any).setCollideWorldBounds(true);

        // Add player icon
        this.playerIcon = scene.add.text(220, 400, '🚶', {
            fontSize: '28px'
        });
        this.playerIcon.setOrigin(0.5);

        // NPCs
        this.npcGroup = scene.physics.add.group();
        this.npcIcons = [];

        for (let i = 0; i < 3; i++) {
            const x = Phaser.Math.Between(100, width - 100);
            const y = Phaser.Math.Between(100, height - 100);

            const npc = scene.add.circle(x, y, 15, 0x3b82f6);
            npc.setStrokeStyle(2, 0x2563eb);
            scene.physics.add.existing(npc);
            this.npcGroup.add(npc);

            const npcIcon = scene.add.text(x, y, '🛒', {
                fontSize: '20px'
            });
            npcIcon.setOrigin(0.5);
            this.npcIcons.push({ icon: npcIcon, body: npc });

            // Random NPC movement
            scene.time.addEvent({
                delay: 2000,
                callback: () => {
                    if (npc.body) {
                        (npc.body as any).setVelocity(
                            Phaser.Math.Between(-50, 50),
                            Phaser.Math.Between(-50, 50)
                        );
                    }
                },
                loop: true
            });
        }

        // Controls
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        }
    }

    update() {
        if (!this.player || !this.player.body) return;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0);

        if (this.cursors.left.isDown || (this.wasd && this.wasd.A.isDown)) body.setVelocityX(-200);
        if (this.cursors.right.isDown || (this.wasd && this.wasd.D.isDown)) body.setVelocityX(200);
        if (this.cursors.up.isDown || (this.wasd && this.wasd.W.isDown)) body.setVelocityY(-200);
        if (this.cursors.down.isDown || (this.wasd && this.wasd.S.isDown)) body.setVelocityY(200);

        // Update player icon position
        this.playerIcon.setPosition(this.player.x, this.player.y);

        // Update NPC icons positions
        this.npcIcons.forEach(npc => {
            if (npc.body && npc.body.x) {
                npc.icon.setPosition(npc.body.x, npc.body.y);
            }
        });
    }
}
