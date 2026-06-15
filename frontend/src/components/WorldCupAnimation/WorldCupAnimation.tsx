"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";

const WORLD_CUP_EMOJIS = ["🇧🇷", "⚽", "🏆", "💚", "💛"];

export default function WorldCupAnimation() {
    const { activeTheme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const emojiIdRef = useRef(0);

    // 1. Spawning on Load
    useEffect(() => {
        if (activeTheme !== "copa_do_mundo") return;

        // Spawn 16-20 emojis scattered across the bottom on load
        const initialCount = 18;
        const spawnInitial = () => {
            for (let i = 0; i < initialCount; i++) {
                const xPos = Math.random() * window.innerWidth;
                const yPos = window.innerHeight + 50;
                // Add staggered delay to make it flow nicely
                const delay = Math.random() * 2500;
                setTimeout(() => {
                    spawnSingleEmoji(xPos, yPos, true);
                }, delay);
            }
        };

        // Small delay to ensure container is fully ready
        const timer = setTimeout(spawnInitial, 300);
        return () => clearTimeout(timer);
    }, [activeTheme]);

    // 2. Spawning on Click
    useEffect(() => {
        if (activeTheme !== "copa_do_mundo") return;

        const handleDocClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target || typeof target.closest !== "function") return;

            // Trigger when clicking buttons, links, inputs, labels, cards or the page in general
            const isInteractive =
                target.tagName === "BUTTON" ||
                target.closest("button") !== null ||
                target.tagName === "A" ||
                target.closest("a") !== null ||
                target.classList.contains("btn-primary") ||
                target.classList.contains("btn-outline") ||
                target.closest("[class*='btn']") !== null ||
                target.closest("[class*='card']") !== null ||
                target.closest("[class*='Card']") !== null ||
                target.tagName === "INPUT" ||
                target.closest("input") !== null;

            if (!isInteractive) return;

            // Spawn 4 to 7 emojis per click
            const count = Math.floor(Math.random() * 4) + 4;
            for (let i = 0; i < count; i++) {
                spawnSingleEmoji(e.clientX, e.clientY, false);
            }
        };

        document.addEventListener("click", handleDocClick);
        return () => document.removeEventListener("click", handleDocClick);
    }, [activeTheme]);

    const spawnSingleEmoji = (x: number, y: number, isLoadSpawn: boolean) => {
        if (!containerRef.current) return;

        const id = ++emojiIdRef.current;
        const size = Math.random() * 22 + 18; // 18px to 40px
        const offsetX = (Math.random() - 0.5) * (isLoadSpawn ? 150 : 100); // Horizontal drift
        const duration = isLoadSpawn
            ? Math.random() * 1500 + 2500 // 2.5s - 4.0s for slow rising on load
            : Math.random() * 600 + 800;  // 0.8s - 1.4s for quick click burst
            
        const rotation = (Math.random() - 0.5) * 50;
        const emoji = WORLD_CUP_EMOJIS[Math.floor(Math.random() * WORLD_CUP_EMOJIS.length)];

        const element = document.createElement("div");
        element.dataset.emojiId = String(id);
        
        // CSS position fixed:
        // - Load spawn: rises from the very bottom (y = window.innerHeight) to above the screen
        // - Click spawn: rises from the click position up by ~150px and fades out
        if (isLoadSpawn) {
            element.style.cssText = `
                position: fixed;
                left: ${x}px;
                bottom: -60px;
                font-size: ${size}px;
                pointer-events: none;
                z-index: 99999;
                user-select: none;
                transform: translateX(-50%) rotate(${rotation}deg);
                animation: worldCupRiseLoad ${duration}ms cubic-bezier(0.1, 0.7, 0.1, 1.0) forwards;
                --offset-x: ${offsetX}px;
                will-change: transform, opacity;
            `;
        } else {
            element.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                font-size: ${size}px;
                pointer-events: none;
                z-index: 99999;
                user-select: none;
                transform: translate(-50%, -50%) rotate(${rotation}deg);
                animation: worldCupRiseClick ${duration}ms ease-out forwards;
                --offset-x: ${offsetX}px;
                will-change: transform, opacity;
            `;
        }
        
        element.textContent = emoji;
        containerRef.current.appendChild(element);

        setTimeout(() => {
            element.remove();
        }, duration + 100);
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes worldCupRiseLoad {
                        0% {
                            opacity: 0;
                            transform: translateX(-50%) translateY(0px) rotate(0deg) scale(0.6);
                        }
                        15% {
                            opacity: 0.85;
                        }
                        90% {
                            opacity: 0.85;
                        }
                        100% {
                            opacity: 0;
                            transform: translateX(calc(-50% + var(--offset-x))) translateY(-105vh) rotate(180deg) scale(1.1);
                        }
                    }
                    @keyframes worldCupRiseClick {
                        0% {
                            opacity: 1;
                            transform: translate(-50%, -50%) translateY(0px) translateX(0px) scale(0.5);
                        }
                        20% {
                            opacity: 1;
                            transform: translate(-50%, -50%) translateY(-25px) translateX(calc(var(--offset-x) * 0.3)) scale(1.2) rotate(10deg);
                        }
                        100% {
                            opacity: 0;
                            transform: translate(-50%, -50%) translateY(-150px) translateX(var(--offset-x)) scale(0.6) rotate(-20deg);
                        }
                    }
                `
            }} />
            <div
                ref={containerRef}
                style={{
                    position: "fixed",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 99999,
                    overflow: "hidden",
                }}
                aria-hidden="true"
            />
        </>
    );
}
