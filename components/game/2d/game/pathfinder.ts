// Simple grid A* pathfinder tailored for the game's grid
export type Grid = {
    width: number;
    height: number;
    walkable: (x: number, y: number) => boolean;
};

type Node = { x: number; y: number; g: number; f: number; cameFrom?: Node };

function heuristic(ax: number, ay: number, bx: number, by: number) {
    // Manhattan
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function findPath(grid: Grid, sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] | null {
    if (!grid.walkable(tx, ty)) return null;
    const open: Map<string, Node> = new Map();
    const closed: Set<string> = new Set();
    const key = (x: number, y: number) => `${x},${y}`;

    const start: Node = { x: sx, y: sy, g: 0, f: heuristic(sx, sy, tx, ty) };
    open.set(key(sx, sy), start);

    const neighborsOffsets = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0]
    ];

    while (open.size > 0) {
        // pick node with lowest f
        let currentKey: string | null = null;
        let currentNode: Node | null = null;
        for (const [k, v] of open.entries()) {
            if (!currentNode || v.f < currentNode.f) {
                currentKey = k;
                currentNode = v;
            }
        }
        if (!currentNode || currentKey === null) break;

        if (currentNode.x === tx && currentNode.y === ty) {
            // reconstruct path
            const path: { x: number; y: number }[] = [];
            let n: Node | undefined = currentNode;
            while (n) {
                path.push({ x: n.x, y: n.y });
                n = n.cameFrom;
            }
            path.reverse();
            return path;
        }

        open.delete(currentKey);
        closed.add(currentKey);

        for (const [ox, oy] of neighborsOffsets) {
            const nx = currentNode.x + ox;
            const ny = currentNode.y + oy;
            const nk = key(nx, ny);
            if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
            if (!grid.walkable(nx, ny)) continue;
            if (closed.has(nk)) continue;

            const gScore = currentNode.g + 1;
            const existing = open.get(nk);
            if (!existing || gScore < existing.g) {
                const neighbor: Node = {
                    x: nx,
                    y: ny,
                    g: gScore,
                    f: gScore + heuristic(nx, ny, tx, ty),
                    cameFrom: currentNode
                };
                open.set(nk, neighbor);
            }
        }
    }

    return null;
}
