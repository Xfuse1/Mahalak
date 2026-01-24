import Store3D from "@/components/game/3d/Store3D";
import Dashboard from "@/components/dashboard/Dashboard";

export default function SupermarketPage() {
    return (
        <main className="relative w-full h-screen overflow-hidden">
            <Store3D />
            <Dashboard />
        </main>
    );
}
