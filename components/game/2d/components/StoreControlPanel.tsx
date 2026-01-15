import React from "react";
import useStore from "../store/useStore";
import { eventBus } from "../game/EventBus";

export default function StoreControlPanel() {
    const npcCount = useStore((s) => s.npcCount);
    const pushLog = useStore((s) => s.pushLog);
    const setNpcCount = useStore((s) => s.setNpcCount);

    const spawnItem = () => {
        eventBus.emit("cmd:spawnItem", {});
        pushLog("Spawn item command sent");
    };

    const toggleNpc = () => {
        const next = npcCount > 0 ? 0 : 3;
        setNpcCount(next);
        eventBus.emit("cmd:setNpc", next);
        pushLog(`Set NPC count to ${next}`);
    };

    return (
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mt-6">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Command Center</div>
            <div className="grid grid-cols-2 gap-3">
                <button
                    className="bg-blue-600/20 text-blue-400 border border-blue-600/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                    onClick={spawnItem}
                >
                    Spawn Item
                </button>
                <button
                    className="bg-purple-600/20 text-purple-400 border border-purple-600/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all active:scale-95"
                    onClick={toggleNpc}
                >
                    {npcCount > 0 ? "Purge NPCs" : "Summon NPCs"}
                </button>
            </div>
        </div>
    );
}
