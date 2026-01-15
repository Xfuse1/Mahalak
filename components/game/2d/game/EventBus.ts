type Handler<T = any> = (payload: T) => void;

class EventBus {
    private listeners: Map<string, Handler<any>[]> = new Map();
    on<T = any>(event: string, handler: Handler<T>) {
        const arr = this.listeners.get(event) ?? [];
        arr.push(handler);
        this.listeners.set(event, arr);
        return () => this.off(event, handler);
    }
    off<T = any>(event: string, handler: Handler<T>) {
        const arr = this.listeners.get(event);
        if (!arr) return;
        this.listeners.set(event, arr.filter(h => h !== handler));
    }
    emit<T = any>(event: string, payload?: T) {
        const arr = this.listeners.get(event);
        if (!arr) return;
        for (const h of arr.slice()) h(payload as T);
    }
}

export const eventBus = new EventBus();

export type PickupEvent = { item: { id: string; name: string; price: number } };
