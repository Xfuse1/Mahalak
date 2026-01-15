import React from "react";
import { useDrag, useDrop } from "react-dnd";
import useStore, { Item } from "../store/useStore";

const ITEM_TYPE = "CART_ITEM";

function DraggableItem({ item, index }: { item: Item; index: number }) {
    const [, drag] = useDrag(() => ({
        type: ITEM_TYPE,
        item: { id: item.id, index, name: item.name, price: item.price },
        collect: (m) => m
    }), [item, index]);

    return (
        <div ref={(node) => { drag(node); }} className="p-3 bg-white/5 rounded-xl border border-white/10 mb-2 flex justify-between items-center group hover:bg-white/10 transition-all cursor-grab active:cursor-grabbing">
            <div>
                <div className="font-bold text-sm group-hover:text-blue-400 transition-colors">{item.name}</div>
                <div className="text-[10px] text-slate-500 font-mono italic">${item.price}</div>
            </div>
            <button
                className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                onClick={() => useStore.getState().removeItem(item.id)}
            >
                Remove
            </button>
        </div>
    );
}

export default function Inventory() {
    const items = useStore((s) => s.inventory);
    const total = items.reduce((s, it) => s + it.price, 0);

    const [, drop] = useDrop(() => ({
        accept: ITEM_TYPE,
        drop: (d: any) => {
            useStore.getState().removeItem(d.id);
            useStore.getState().pushLog(`Removed ${d.name} from cart`);
        }
    }), []);

    return (
        <div className="flex flex-col h-full">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-4">
                Items auto-add on overlap
            </div>

            <div ref={(node) => { drop(node); }} className="flex-1 overflow-y-auto pr-2 custom-scroll max-h-[300px]">
                {items.length === 0 && (
                    <div className="py-10 text-center opacity-20 flex flex-col items-center gap-2">
                        <div className="w-10 h-10 border-2 border-dashed border-white rounded-lg" />
                        <div className="text-[10px] uppercase font-black tracking-widest">Cart Empty</div>
                    </div>
                )}
                {items.map((it, idx) => (
                    <DraggableItem key={it.id} item={it} index={idx} />
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Total Sum</div>
                <div className="text-lg font-black text-blue-400">${total}</div>
            </div>
        </div>
    );
}
