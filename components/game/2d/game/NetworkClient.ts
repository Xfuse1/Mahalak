// Minimal WebSocket client to sync with optional remote debugging server.
// The connection is enabled only if NEXT_PUBLIC_WS_URL is provided.

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

export default class NetworkClient {
    private socket?: WebSocket;
    private url: string;
    private reconnectMs = 2000;
    constructor(url = WS_URL) {
        this.url = url;
    }
    connect() {
        // do not attempt to connect if no URL is provided
        if (!this.url || this.url.length === 0) {
            console.info("[Net] NEXT_PUBLIC_WS_URL not set — network disabled");
            return;
        }
        if (this.socket) return;
        try {
            this.socket = new WebSocket(this.url);
            this.socket.onopen = () => {
                console.info("[Net] Connected to server", this.url);
            };
            this.socket.onmessage = (ev) => {
                try {
                    const payload = JSON.parse(ev.data);
                    (window as any).eventBus?.emit?.("network:message", payload);
                } catch (e) {
                    console.warn("Invalid network message", e);
                }
            };
            this.socket.onclose = () => {
                console.info("[Net] Disconnected, retrying in", this.reconnectMs);
                this.socket = undefined;
                setTimeout(() => this.connect(), this.reconnectMs);
            };
            this.socket.onerror = (e) => {
                console.warn("[Net] error", e);
                this.socket?.close();
            };
        } catch (e) {
            console.warn("[Net] connect failed", e);
        }
    }
    send(obj: any) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        try {
            this.socket.send(JSON.stringify(obj));
        } catch (e) {
            console.warn("network send error", e);
        }
    }
}
