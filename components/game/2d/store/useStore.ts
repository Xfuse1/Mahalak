import { create } from "zustand";

export type Item = { id: string; name: string; price: number };

type State = {
    money: number;
    inventory: Item[];
    logs: string[];
    npcCount: number;
    setMoney: (m: number) => void;
    addItem: (it: Item) => void;
    removeItem: (id: string) => void;
    clearInventory: () => void;
    pushLog: (s: string) => void;
    setNpcCount: (n: number) => void;
};

const useStore = create<State>((set, get) => ({
    money: 100,
    inventory: [],
    logs: [],
    npcCount: 3,
    setMoney: (m) => set({ money: m }),
    addItem: (it) => set({ inventory: [...get().inventory, it] }),
    removeItem: (id) => set({ inventory: get().inventory.filter(i => i.id !== id) }),
    clearInventory: () => set({ inventory: [] }),
    pushLog: (s) => set({ logs: [...get().logs, `[${new Date().toLocaleTimeString()}] ${s}`].slice(-200) }),
    setNpcCount: (n) => set({ npcCount: n })
}));

export default useStore;
