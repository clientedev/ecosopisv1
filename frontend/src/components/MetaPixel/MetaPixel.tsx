"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { captureAttribution, initMetaPixel, setMetaIdentity, trackPageView } from "@/lib/metaPixel";

/**
 * Carrega o Meta Pixel uma vez e dispara PageView a cada navegação.
 * Também grava a origem da visita (UTM/fbclid) para atribuir vendas no CRM.
 * O painel /admin não é rastreado.
 */
export default function MetaPixel() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useAuth() as any;
    const lastTracked = useRef<string>("");

    useEffect(() => {
        setMetaIdentity(user ? { email: user.email, phone: user.phone, id: user.id } : null);
    }, [user]);

    useEffect(() => {
        if (!pathname || pathname.startsWith("/admin")) return;
        const key = `${pathname}?${searchParams?.toString() || ""}`;
        if (lastTracked.current === key) return;
        lastTracked.current = key;
        captureAttribution();
        initMetaPixel();
        trackPageView();
    }, [pathname, searchParams]);

    return null;
}
