"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ChatIA = dynamic(() => import("@/components/ChatIA/ChatIA"), { ssr: false });
const ScratchCardModal = dynamic(() => import("@/components/ScratchCardModal/ScratchCardModal"), { ssr: false });
const PromotionalPopup = dynamic(() => import("@/components/PromotionalPopup/PromotionalPopup"), { ssr: false });

import { usePathname } from "next/navigation";

let hasDeferredLoaded = false;

export default function DeferredComponents() {
    const pathname = usePathname();
    const [shouldLoad, setShouldLoad] = useState(hasDeferredLoaded);

    useEffect(() => {
        if (hasDeferredLoaded) return;

        const timer = setTimeout(() => {
            hasDeferredLoaded = true;
            setShouldLoad(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!shouldLoad || pathname?.startsWith("/link")) return null;

    return (
        <>
            <ChatIA />
            <ScratchCardModal />
            <PromotionalPopup />
        </>
    );
}
