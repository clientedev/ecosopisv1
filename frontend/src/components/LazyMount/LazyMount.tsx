"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * Só monta os filhos quando o elemento está perto da área visível.
 * Evita baixar vídeos de bolinhas/stories que estão fora da tela.
 * O wrapper ocupa 100% do pai (display:contents não tem caixa e o
 * IntersectionObserver nunca dispara nele).
 */
export default function LazyMount({ children, margin = "400px" }: { children: React.ReactNode; margin?: string }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === "undefined") { setShow(true); return; }
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); }
        }, { rootMargin: margin });
        io.observe(el);
        return () => io.disconnect();
    }, [margin]);

    return <div ref={ref} style={{ width: "100%", height: "100%" }}>{show ? children : null}</div>;
}
