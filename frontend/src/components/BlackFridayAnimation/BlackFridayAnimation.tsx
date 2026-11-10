"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

/**
 * Black Friday theme effects:
 *  - Animated top strip (fire gradient + marquee + countdown)
 *  - Confetti + "% OFF" tags burst on page load
 *  - Confetti + flame burst on clicks in buttons/links/cards
 *  - Embers rising from the bottom of the screen (light, capped)
 * Everything is skipped in /admin and reduced for prefers-reduced-motion.
 */

const CONFETTI_COLORS = ["#e10600", "#ff2d1a", "#ffffff", "#111111", "#ffb300", "#ff5a36"];
const DISCOUNT_TAGS = ["-10%", "-20%", "-30%", "-40%", "-50%", "% OFF", "🔥", "💥"];
const CLICK_EMOJIS = ["🔥", "💥", "🔥", "%"];

// Black Friday 2026: 27/11/2026 (horário de Brasília)
const BF_START = new Date("2026-11-27T00:00:00-03:00").getTime();
const BF_END = new Date("2026-11-28T00:00:00-03:00").getTime();

function countdownLabel(now: number): string {
    if (now >= BF_END) return "BLACK FRIDAY ECOSOPIS 🔥 OFERTAS DE QUEIMAR";
    if (now >= BF_START) {
        const h = Math.floor((BF_END - now) / 3_600_000);
        const m = Math.floor(((BF_END - now) % 3_600_000) / 60_000);
        return `É HOJE! 🔥 TERMINA EM ${h}H ${String(m).padStart(2, "0")}MIN`;
    }
    const diff = BF_START - now;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return `FALTAM ${d}D ${String(h).padStart(2, "0")}H ${String(m).padStart(2, "0")}MIN PARA A BLACK FRIDAY`;
}

export default function BlackFridayAnimation() {
    const { activeTheme } = useTheme();
    const pathname = usePathname() || "";
    const isAdmin = pathname.startsWith("/admin");
    const enabled = activeTheme === "black_friday" && !isAdmin;

    const containerRef = useRef<HTMLDivElement>(null);
    const [label, setLabel] = useState("");

    const reducedMotion = () =>
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Countdown text
    useEffect(() => {
        if (!enabled) return;
        const tick = () => setLabel(countdownLabel(Date.now()));
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, [enabled]);

    // ---------- particle helpers ----------
    const spawn = (opts: {
        x: number;
        y: number;
        content?: string;
        kind: "confetti" | "tag" | "emoji" | "ember";
        duration: number;
        dx: number;
        dy: number;
        rotate: number;
    }) => {
        const root = containerRef.current;
        if (!root) return;
        const el = document.createElement("div");
        el.className = `bf-p bf-${opts.kind}`;
        el.style.left = opts.x + "px";
        el.style.top = opts.y + "px";
        el.style.setProperty("--dx", opts.dx + "px");
        el.style.setProperty("--dy", opts.dy + "px");
        el.style.setProperty("--rot", opts.rotate + "deg");
        el.style.animationDuration = opts.duration + "ms";

        if (opts.kind === "confetti") {
            const w = Math.random() * 6 + 6;
            el.style.width = w + "px";
            el.style.height = w * (Math.random() > 0.5 ? 0.45 : 1) + "px";
            el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            if (Math.random() > 0.7) el.style.borderRadius = "50%";
        } else if (opts.kind === "ember") {
            const s = Math.random() * 4 + 3;
            el.style.width = s + "px";
            el.style.height = s + "px";
        } else {
            el.textContent = opts.content || "";
        }

        root.appendChild(el);
        setTimeout(() => el.remove(), opts.duration + 80);
    };

    // Load burst: confetti rain + discount tags
    useEffect(() => {
        if (!enabled || reducedMotion()) return;
        let timer: ReturnType<typeof setTimeout>;
        let waited = 0;
        // Wait until the full-screen brand loader is gone (max ~5s) so the burst is visible
        const loaderVisible = () => {
            const el = document.querySelector('[class*="BrandLoader_fullScreenWrapper"]') as HTMLElement | null;
            return !!el && el.offsetParent !== null && !el.className.includes("fadeOut");
        };
        const start = () => {
            if (loaderVisible() && waited < 5000) {
                waited += 200;
                timer = setTimeout(start, 200);
                return;
            }
            burst();
        };
        const burst = () => {
            const W = window.innerWidth;
            const H = window.innerHeight;
            const confettiCount = W < 768 ? 45 : 80;
            for (let i = 0; i < confettiCount; i++) {
                setTimeout(() => {
                    spawn({
                        kind: "confetti",
                        x: Math.random() * W,
                        y: -20,
                        dx: (Math.random() - 0.5) * 220,
                        dy: H + 60,
                        rotate: (Math.random() - 0.5) * 900,
                        duration: Math.random() * 1800 + 2600,
                    });
                }, Math.random() * 1600);
            }
            const tagCount = W < 768 ? 6 : 10;
            for (let i = 0; i < tagCount; i++) {
                setTimeout(() => {
                    spawn({
                        kind: "tag",
                        content: DISCOUNT_TAGS[Math.floor(Math.random() * DISCOUNT_TAGS.length)],
                        x: Math.random() * (W - 80) + 40,
                        y: -40,
                        dx: (Math.random() - 0.5) * 120,
                        dy: H + 80,
                        rotate: (Math.random() - 0.5) * 70,
                        duration: Math.random() * 1600 + 3200,
                    });
                }, Math.random() * 2200);
            }
        };
        timer = setTimeout(start, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Rising embers (continuous, capped, paused while tab hidden)
    useEffect(() => {
        if (!enabled || reducedMotion()) return;
        const id = setInterval(() => {
            if (document.hidden) return;
            const root = containerRef.current;
            if (!root || root.querySelectorAll(".bf-ember").length > 14) return;
            spawn({
                kind: "ember",
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 10,
                dx: (Math.random() - 0.5) * 120,
                dy: -(window.innerHeight * (Math.random() * 0.35 + 0.35)),
                rotate: 0,
                duration: Math.random() * 2500 + 3500,
            });
        }, 650);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Click burst on interactive elements
    useEffect(() => {
        if (!enabled || reducedMotion()) return;
        const onClick = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t || typeof t.closest !== "function") return;
            const interactive = t.closest("button, a, [class*='btn'], [class*='Card'], [class*='card']");
            if (!interactive) return;
            for (let i = 0; i < 14; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 90 + 40;
                spawn({
                    kind: "confetti",
                    x: e.clientX,
                    y: e.clientY,
                    dx: Math.cos(angle) * dist,
                    dy: Math.sin(angle) * dist + 60,
                    rotate: (Math.random() - 0.5) * 720,
                    duration: Math.random() * 500 + 800,
                });
            }
            for (let i = 0; i < 3; i++) {
                spawn({
                    kind: "emoji",
                    content: CLICK_EMOJIS[Math.floor(Math.random() * CLICK_EMOJIS.length)],
                    x: e.clientX,
                    y: e.clientY,
                    dx: (Math.random() - 0.5) * 90,
                    dy: -(Math.random() * 80 + 90),
                    rotate: (Math.random() - 0.5) * 40,
                    duration: Math.random() * 400 + 900,
                });
            }
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    if (!enabled) return null;

    const marqueeItems = [
        "🔥 BLACK FRIDAY ECOSOPIS",
        "DESCONTOS DE QUEIMAR",
        label,
        "🔥 BLACK FRIDAY ECOSOPIS",
        "APROVEITE ENQUANTO DURAR O ESTOQUE",
        label,
    ];

    const css = `
        .bf-strip {
            position: relative;
            overflow: hidden;
            background: #050505;
            color: #fff;
            border-bottom: 2px solid #e10600;
            height: 38px;
            display: flex;
            align-items: center;
            font-family: var(--font-header), sans-serif;
            font-weight: 800;
            font-size: 0.78rem;
            letter-spacing: 0.12em;
            z-index: 1001;
        }
        .bf-strip::before {
            /* flickering fire glow along the bottom edge */
            content: "";
            position: absolute;
            left: 0; right: 0; bottom: -8px;
            height: 26px;
            background:
                radial-gradient(ellipse 40px 18px at 10% 100%, rgba(255,90,20,.85), transparent 70%),
                radial-gradient(ellipse 60px 22px at 30% 100%, rgba(225,6,0,.9), transparent 70%),
                radial-gradient(ellipse 50px 20px at 52% 100%, rgba(255,140,0,.8), transparent 70%),
                radial-gradient(ellipse 70px 24px at 74% 100%, rgba(225,6,0,.9), transparent 70%),
                radial-gradient(ellipse 45px 18px at 92% 100%, rgba(255,90,20,.85), transparent 70%);
            filter: blur(3px);
            animation: bfFlicker 1.6s ease-in-out infinite alternate;
            pointer-events: none;
        }
        .bf-track {
            position: relative;
            display: flex;
            gap: 3rem;
            white-space: nowrap;
            animation: bfMarquee 28s linear infinite;
            padding-left: 100%;
        }
        .bf-track span { display: inline-flex; align-items: center; gap: .6rem; }
        .bf-track span::after { content: "✦"; color: #e10600; margin-left: 3rem; }

        .bf-layer { position: fixed; inset: 0; pointer-events: none; z-index: 99999; overflow: hidden; }
        .bf-p { position: fixed; pointer-events: none; user-select: none; will-change: transform, opacity; }
        .bf-confetti { animation-name: bfFall; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards; }
        .bf-tag {
            background: #e10600; color: #fff;
            font: 900 0.9rem/1 var(--font-header), sans-serif;
            padding: 6px 10px; border-radius: 6px;
            border: 2px solid #fff;
            box-shadow: 0 4px 14px rgba(225,6,0,.5);
            animation-name: bfFall; animation-timing-function: cubic-bezier(.3,.5,.4,1); animation-fill-mode: forwards;
        }
        .bf-emoji {
            font-size: 22px; font-weight: 900; color: #ff2d1a;
            text-shadow: 0 0 8px rgba(255,90,20,.8);
            animation-name: bfPop; animation-timing-function: ease-out; animation-fill-mode: forwards;
        }
        .bf-ember {
            border-radius: 50%;
            background: radial-gradient(circle, #fff3c4 0%, #ffb300 35%, #e10600 70%, transparent 100%);
            box-shadow: 0 0 10px 3px rgba(255,90,20,.55);
            animation-name: bfRise; animation-timing-function: ease-out; animation-fill-mode: forwards;
        }

        @keyframes bfMarquee { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes bfFlicker {
            0%   { opacity: .55; transform: scaleY(.85); }
            50%  { opacity: .95; transform: scaleY(1.1); }
            100% { opacity: .7;  transform: scaleY(.95); }
        }
        @keyframes bfFall {
            0%   { opacity: 0; transform: translate(-50%, 0) rotate(0deg); }
            8%   { opacity: 1; }
            85%  { opacity: 1; }
            100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) rotate(var(--rot)); }
        }
        @keyframes bfPop {
            0%   { opacity: 1; transform: translate(-50%, -50%) scale(.4); }
            25%  { opacity: 1; transform: translate(-50%, -50%) translateY(-20px) scale(1.3); }
            100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.6) rotate(var(--rot)); }
        }
        @keyframes bfRise {
            0%   { opacity: 0; transform: translate(0, 0) scale(1); }
            15%  { opacity: 1; }
            100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3); }
        }
        @media (prefers-reduced-motion: reduce) {
            .bf-track { animation: none; padding-left: 1rem; }
            .bf-strip::before { animation: none; }
        }
        @media (max-width: 768px) {
            .bf-strip { height: 32px; font-size: 0.68rem; }
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="bf-strip" data-black-friday-strip role="marquee" aria-label={label || "Black Friday Ecosopis"}>
                <div className="bf-track">
                    {marqueeItems.map((t, i) => (
                        <span key={i}>{t}</span>
                    ))}
                </div>
            </div>
            <div ref={containerRef} className="bf-layer" aria-hidden="true" />
        </>
    );
}
