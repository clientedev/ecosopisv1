"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";

const OUTUBRO_ROSA_EMOJIS = ["🎀", "🌸", "💗", "🩷", "🌺", "💕", "🎀"];

export default function OutubroRosaAnimation() {
    const { activeTheme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const emojiIdRef = useRef(0);

    useEffect(() => {
        if (activeTheme !== "outubro_rosa") return;
        const timer = setTimeout(() => {
            for (let i = 0; i < 22; i++) {
                const xPos = Math.random() * window.innerWidth;
                const delay = Math.random() * 3000;
                setTimeout(() => spawnSingle(xPos, window.innerHeight + 50, true), delay);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [activeTheme]);

    useEffect(() => {
        if (activeTheme !== "outubro_rosa") return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target || typeof target.closest !== "function") return;
            const isInteractive =
                target.tagName === "BUTTON" || target.closest("button") !== null ||
                target.tagName === "A" || target.closest("a") !== null ||
                target.classList.contains("btn-primary") || target.classList.contains("btn-outline") ||
                target.closest("[class*='btn']") !== null || target.closest("[class*='Card']") !== null;
            if (!isInteractive) return;
            const count = Math.floor(Math.random() * 5) + 4;
            for (let i = 0; i < count; i++) spawnSingle(e.clientX, e.clientY, false);
        };
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [activeTheme]);

    const spawnSingle = (x: number, y: number, isLoad: boolean) => {
        if (!containerRef.current) return;
        const id = ++emojiIdRef.current;
        const size = Math.random() * 20 + 16;
        const offsetX = (Math.random() - 0.5) * 160;
        const duration = isLoad ? Math.random() * 1800 + 2800 : Math.random() * 700 + 900;
        const rotation = (Math.random() - 0.5) * 60;
        const emoji = OUTUBRO_ROSA_EMOJIS[Math.floor(Math.random() * OUTUBRO_ROSA_EMOJIS.length)];
        const el = document.createElement("div");
        el.dataset.emojiId = String(id);
        el.style.position = "fixed";
        el.style.zIndex = "99999";
        el.style.pointerEvents = "none";
        el.style.userSelect = "none";
        el.style.fontSize = size + "px";
        if (isLoad) {
            el.style.left = x + "px";
            el.style.bottom = "-60px";
            el.style.transform = "translateX(-50%) rotate(" + rotation + "deg)";
            el.style.animation = "octubroRosaLoad " + duration + "ms cubic-bezier(0.1,0.7,0.1,1) forwards";
        } else {
            el.style.left = x + "px";
            el.style.top = y + "px";
            el.style.transform = "translate(-50%, -50%) rotate(" + rotation + "deg)";
            el.style.animation = "octubroRosaClick " + duration + "ms ease-out forwards";
        }
        el.style.setProperty("--offset-x", offsetX + "px");
        el.textContent = emoji;
        containerRef.current.appendChild(el);
        setTimeout(() => el.remove(), duration + 100);
    };

    const css = `
        @keyframes octubroRosaLoad {
            0%  { opacity:0; transform:translateX(-50%) translateY(0) scale(.5); }
            12% { opacity:.9; }
            88% { opacity:.9; }
            100%{ opacity:0; transform:translateX(calc(-50% + var(--offset-x))) translateY(-108vh) scale(1.1) rotate(200deg); }
        }
        @keyframes octubroRosaClick {
            0%  { opacity:1; transform:translate(-50%,-50%) scale(.4); }
            20% { opacity:1; transform:translate(-50%,-50%) translateY(-28px) scale(1.3) rotate(15deg); }
            100%{ opacity:0; transform:translate(-50%,-50%) translateY(-160px) translateX(var(--offset-x)) scale(.5); }
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div
                ref={containerRef}
                style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99999, overflow: "hidden" }}
                aria-hidden="true"
            />
        </>
    );
}
