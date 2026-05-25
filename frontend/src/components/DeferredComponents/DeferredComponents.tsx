"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ChatIA = dynamic(() => import("@/components/ChatIA/ChatIA"), { ssr: false });
const RouletteModal = dynamic(() => import("@/components/RouletteModal/RouletteModal"), { ssr: false });

export default function DeferredComponents() {
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        // Delay mounting ChatIA and RouletteModal by 2 seconds to optimize FCP/LCP
        const timer = setTimeout(() => {
            setShouldLoad(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!shouldLoad) return null;

    return (
        <>
            <ChatIA />
            <RouletteModal />
        </>
    );
}
