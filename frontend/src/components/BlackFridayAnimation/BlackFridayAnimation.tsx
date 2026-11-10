"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

/**
 * Black Friday (clean) effects:
 *  - Slim black strip on top: "BLACK FRIDAY" + small flickering flame + countdown
 *  - Light confetti once per session, right after the entry splash
 *  - Small confetti burst when clicking primary buttons (add to cart, buy)
 * Skipped in /admin and for prefers-reduced-motion.
 */

const CONFETTI_COLORS = ["#111111", "#c8102e", "#c8102e", "#b89b5e", "#d9d9d9"];

// Black Friday 2026: 27/11/2026 (horário de Brasília)
const BF_START = new Date("2026-11-27T00:00:00-03:00").getTime();
const BF_END = new Date("2026-11-28T00:00:00-03:00").getTime();
const ENTRY_CONFETTI_KEY = "ecosopis_bf_confetti_seen";

function countdownLabel(now: number): string {
    if (now >= BF_END) return "Ofertas por tempo limitado";
    if (now >= BF_START) {
        const h = Math.floor((BF_END - now) / 3_600_000);
        const m = Math.floor(((BF_END - now) % 3_600_000) / 60_000);
        return `É hoje · termina em ${h}h ${String(m).padStart(2, "0")}min`;
    }
    const diff = BF_START - now;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return `Começa em ${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}min`;
}

const reducedMotion = () =>
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function BlackFridayAnimation() {
    const { activeTheme } = useTheme();
    const pathname = usePathname() || "";
    const enabled = activeTheme === "black_friday" && !pathname.startsWith("/admin");

    const layerRef = useRef<HTMLDivElement>(null);
    const [label, setLabel] = useState("");

    useEffect(() => {
        if (!enabled) return;
        const tick = () => setLabel(countdownLabel(Date.now()));
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, [enabled]);

    const spawnConfetti = (x: number, y: number, dx: number, dy: number, duration: number) => {
        const root = layerRef.current;
        if (!root) return;
        const el = document.createElement("div");
        el.className = "bf-confetti";
        const w = Math.random() * 4 + 5;
        el.style.width = w + "px";
        el.style.height = w * (Math.random() > 0.5 ? 0.4 : 1) + "px";
        el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--dy", dy + "px");
        el.style.setProperty("--rot", (Math.random() - 0.5) * 720 + "deg");
        el.style.animationDuration = duration + "ms";
        root.appendChild(el);
        setTimeout(() => el.remove(), duration + 80);
    };

    // Entry confetti: once per session, after the splash is gone
    useEffect(() => {
        if (!enabled || reducedMotion()) return;
        try {
            if (sessionStorage.getItem(ENTRY_CONFETTI_KEY)) return;
        } catch { /* storage blocked: still show once per mount */ }

        let timer: ReturnType<typeof setTimeout>;
        let waited = 0;
        const splashVisible = () => !!document.querySelector('[data-brand-splash]:not([data-fading])');
        const start = () => {
            if (splashVisible() && waited < 8000) {
                waited += 200;
                timer = setTimeout(start, 200);
                return;
            }
            try { sessionStorage.setItem(ENTRY_CONFETTI_KEY, "1"); } catch { /* ignore */ }
            const W = window.innerWidth;
            const H = window.innerHeight;
            const count = W < 768 ? 28 : 45;
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    spawnConfetti(Math.random() * W, -12, (Math.random() - 0.5) * 140, H * (Math.random() * 0.4 + 0.6), Math.random() * 1500 + 2800);
                }, Math.random() * 1400);
            }
        };
        timer = setTimeout(start, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Small burst on primary actions only
    useEffect(() => {
        if (!enabled || reducedMotion()) return;
        const onClick = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t || typeof t.closest !== "function") return;
            if (!t.closest(".btn-primary, [class*='addToCartBtn'], [class*='buyNowBtn'], [class*='checkoutBtn']")) return;
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
                const d = Math.random() * 50 + 35;
                spawnConfetti(e.clientX, e.clientY, Math.cos(a) * d, Math.sin(a) * d + 70, Math.random() * 400 + 750);
            }
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    if (!enabled) return null;

    const css = `
        .bf-strip {
            background: #0d0d0d;
            color: #f2f2f2;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            padding: 0 16px;
            font-family: var(--font-body), sans-serif;
            font-size: 0.78rem;
            letter-spacing: 0.06em;
            white-space: nowrap;
            overflow: hidden;
        }
        .bf-strip-title {
            display: inline-flex; align-items: center; gap: 7px;
            font-family: var(--font-logo), var(--font-header), serif;
            font-weight: 700;
            letter-spacing: 0.22em;
            font-size: 0.8rem;
        }
        .bf-strip-sep { width: 1px; height: 14px; background: rgba(255,255,255,.25); }
        .bf-strip-count { color: #bdbdbd; }
        .bf-flame { width: 11px; height: 14px; transform-origin: 50% 100%; animation: bfFlame 1.4s ease-in-out infinite; }

        .bf-layer { position: fixed; inset: 0; pointer-events: none; z-index: 99998; overflow: hidden; }
        .bf-confetti {
            position: fixed; pointer-events: none; border-radius: 1px; opacity: 0;
            will-change: transform, opacity;
            animation-name: bfFall; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards;
        }
        @keyframes bfFall {
            0%   { opacity: 0; transform: translate(-50%, 0) rotate(0deg); }
            10%  { opacity: .95; }
            80%  { opacity: .9; }
            100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) rotate(var(--rot)); }
        }
        @keyframes bfFlame {
            0%, 100% { transform: scale(1, 1) rotate(-2deg); opacity: .95; }
            30%      { transform: scale(.92, 1.08) rotate(2deg); opacity: 1; }
            60%      { transform: scale(1.04, .94) rotate(-1deg); opacity: .85; }
        }
        @media (max-width: 640px) {
            .bf-strip { font-size: 0.7rem; gap: 10px; height: 32px; }
            .bf-strip-title { font-size: 0.72rem; letter-spacing: 0.16em; }
        }
        @media (prefers-reduced-motion: reduce) { .bf-flame { animation: none; } }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="bf-strip" data-black-friday-strip role="note" aria-label={`Black Friday Ecosopis. ${label}`}>
                <span className="bf-strip-title">
                    <svg className="bf-flame" viewBox="0 0 12 16" aria-hidden="true">
                        <path d="M6 0C6.6 3 10 5.2 10 9.6 10 13 8.2 16 6 16S2 13.9 2 10.8c0-2 1-3.3 1.9-4.2.1 1.4.7 2.3 1.5 2.6C5 6.6 4.9 3.4 6 0Z" fill="#c8102e" />
                        <path d="M6 8.5c.4 1.4 2 2.3 2 4.1C8 14.1 7.1 15 6 15s-2-.8-2-2.1c0-1 .6-1.6 1.1-2 .1.6.4 1 .8 1.1-.2-1.3-.2-2.4.1-3.5Z" fill="#ff7a59" />
                    </svg>
                    BLACK FRIDAY
                </span>
                <span className="bf-strip-sep" aria-hidden="true" />
                <span className="bf-strip-count">{label}</span>
            </div>
            <div ref={layerRef} className="bf-layer" aria-hidden="true" />
        </>
    );
}
