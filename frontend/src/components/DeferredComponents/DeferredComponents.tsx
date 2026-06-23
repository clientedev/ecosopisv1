"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ChatIA = dynamic(() => import("@/components/ChatIA/ChatIA"), { ssr: false });
const RouletteModal = dynamic(() => import("@/components/RouletteModal/RouletteModal"), { ssr: false });

let hasDeferredLoaded = false;

export default function DeferredComponents() {
    const [shouldLoad, setShouldLoad] = useState(hasDeferredLoaded);

    useEffect(() => {
        if (hasDeferredLoaded) return;

        const timer = setTimeout(() => {
            hasDeferredLoaded = true;
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
