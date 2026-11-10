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

const CONFETTI_COLORS = ["#111111", "#c8102e", "#e8233f", "#ff8a3d", "#ffc14d", "#ffffff"];

// Black Friday 2026: 27/11/2026 (horário de Brasília)
const BF_START = new Date("2026-11-27T00:00:00-03:00").getTime();
const BF_END = new Date("2026-11-28T00:00:00-03:00").getTime();

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

    const spawnConfetti = (x: number, y: number, dx: number, dy: number, duration: number, cannon = false) => {
        const root = layerRef.current;
        if (!root) return;
        const el = document.createElement("div");
        el.className = cannon ? "bf-confetti bf-cannon" : "bf-confetti";
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

    // Fire spark / emoji particle (rising, glowing)
    const spawnSpark = (x: number, y: number, dx: number, dy: number, duration: number, emoji?: string) => {
        const root = layerRef.current;
        if (!root) return;
        const el = document.createElement("div");
        el.className = emoji ? "bf-fire-emoji" : "bf-spark";
        if (emoji) el.textContent = emoji;
        else {
            const s = Math.random() * 4 + 4;
            el.style.width = s + "px";
            el.style.height = s + "px";
        }
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--dy", dy + "px");
        el.style.animationDuration = duration + "ms";
        root.appendChild(el);
        setTimeout(() => el.remove(), duration + 80);
    };

    // Entry burst: confetti cannons + fire sparks every time the splash finishes
    useEffect(() => {
        if (!enabled || reducedMotion()) return;
        let timer: ReturnType<typeof setTimeout>;
        let waited = 0;
        const splashVisible = () => !!document.querySelector('[data-brand-splash]:not([data-fading])');
        const start = () => {
            if (splashVisible() && waited < 9000) {
                waited += 150;
                timer = setTimeout(start, 150);
                return;
            }
            const W = window.innerWidth;
            const H = window.innerHeight;
            const mobile = W < 768;
            // Two confetti cannons from the bottom corners
            const perSide = mobile ? 26 : 42;
            for (let side = 0; side < 2; side++) {
                for (let i = 0; i < perSide; i++) {
                    setTimeout(() => {
                        const x = side === 0 ? -6 : W + 6;
                        const dirX = side === 0 ? 1 : -1;
                        const dx = dirX * (Math.random() * W * 0.55 + W * 0.15);
                        const dy = -(Math.random() * H * 0.55 + H * 0.3);
                        spawnConfetti(x, H + 6, dx, dy, Math.random() * 900 + 2100, true);
                    }, Math.random() * 350);
                }
            }
            // Fire sparks rising from the bottom center
            const sparks = mobile ? 18 : 30;
            for (let i = 0; i < sparks; i++) {
                setTimeout(() => {
                    spawnSpark(W / 2 + (Math.random() - 0.5) * W * 0.5, H + 4, (Math.random() - 0.5) * 220, -(Math.random() * H * 0.5 + H * 0.25), Math.random() * 900 + 1300);
                }, Math.random() * 500);
            }
            // A few flames
            const flames = mobile ? 4 : 7;
            for (let i = 0; i < flames; i++) {
                setTimeout(() => {
                    spawnSpark(Math.random() * W * 0.8 + W * 0.1, H + 10, (Math.random() - 0.5) * 120, -(Math.random() * H * 0.35 + H * 0.3), Math.random() * 700 + 1500, "🔥");
                }, 120 + Math.random() * 500);
            }
        };
        timer = setTimeout(start, 200);
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
        .bf-spark {
            position: fixed; pointer-events: none; border-radius: 50%; opacity: 0;
            background: radial-gradient(circle, #fff1c4 0%, #ffb347 40%, #e8233f 75%, transparent 100%);
            box-shadow: 0 0 10px 3px rgba(255, 110, 40, .6);
            will-change: transform, opacity;
            animation-name: bfRise; animation-timing-function: cubic-bezier(.2,.7,.3,1); animation-fill-mode: forwards;
        }
        .bf-fire-emoji {
            position: fixed; pointer-events: none; font-size: 22px; opacity: 0;
            filter: drop-shadow(0 0 6px rgba(255, 100, 30, .7));
            will-change: transform, opacity;
            animation-name: bfRise; animation-timing-function: cubic-bezier(.2,.7,.3,1); animation-fill-mode: forwards;
        }
        .bf-cannon { animation-name: bfCannon; animation-timing-function: linear; }
        @keyframes bfCannon {
            0%   { opacity: 0; transform: translate(-50%, 0) rotate(0deg); }
            6%   { opacity: 1; }
            45%  { transform: translate(calc(-50% + var(--dx) * 0.7), var(--dy)) rotate(calc(var(--rot) * 0.5)); }
            85%  { opacity: .95; }
            100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(var(--dy) * 0.25)) rotate(var(--rot)); }
        }
        @keyframes bfRise {
            0%   { opacity: 0; transform: translate(-50%, 0) scale(.6); }
            12%  { opacity: 1; }
            70%  { opacity: .9; }
            100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(1.1); }
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
