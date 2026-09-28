"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminBolaoRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/dashboard");
    }, [router]);

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
            <p>Redirecionando para o painel administrativo...</p>
        </div>
    );
}
