"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminComprasRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace("/admin/pedidos"); }, []);
    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <p>Redirecionando para Pedidos...</p>
        </div>
    );
}
