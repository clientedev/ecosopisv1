"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";

interface Heart {
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
    rotation: number;
    emoji: string;
    duration: number;
}

const HEART_EMOJIS = ["❤️", "💕", "💗", "💖", "💝", "🌹", "💞"];

export default function HeartAnimation() {
    const { activeTheme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const heartIdRef = useRef(0);

    useEffect(() => {
        if (activeTheme !== "valentines_day") return;

        const spawnHearts = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isButton =
                target.tagName === "BUTTON" ||
                target.closest("button") !== null ||
                target.classList.contains("btn-primary") ||
                target.classList.contains("btn-outline") ||
                target.closest(".btn-primary") !== null ||
                target.closest(".btn-outline") !== null ||
                (target.tagName === "A" &&
                    (target.classList.contains("btn-primary") ||
                        target.classList.contains("btn-outline")));

            // Detect navigation, menu drawer, or header action clicks
            const isMenuClick =
                target.closest("header") !== null ||
                target.closest("nav") !== null ||
                target.closest("[class*='menu']") !== null ||
                target.closest("[class*='Menu']") !== null ||
                target.closest("[class*='nav']") !== null ||
                target.closest("[class*='Nav']") !== null ||
                target.closest("[class*='actionIcon']") !== null ||
                target.closest("[class*='mobileBottomNav']") !== null;

            const isLink = target.tagName === "A" || target.closest("a") !== null;

            if (!isButton && !(isLink && isMenuClick)) return;

            const count = Math.floor(Math.random() * 4) + 4; // 4-7 hearts per click

            for (let i = 0; i < count; i++) {
                spawnSingleHeart(e.clientX, e.clientY);
            }
        };

        document.addEventListener("click", spawnHearts);
        return () => document.removeEventListener("click", spawnHearts);
    }, [activeTheme]);

    const spawnSingleHeart = (x: number, y: number) => {
        if (!containerRef.current) return;

        const id = ++heartIdRef.current;
        const size = Math.random() * 22 + 16; // 16px - 38px
        const offsetX = (Math.random() - 0.5) * 80; // spread horizontally
        const duration = Math.random() * 700 + 900; // 900ms - 1600ms
        const rotation = (Math.random() - 0.5) * 40;
        const emoji = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];

        const heart = document.createElement("div");
        heart.dataset.heartId = String(id);
        heart.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            font-size: ${size}px;
            pointer-events: none;
            z-index: 99999;
            user-select: none;
            transform: translate(-50%, -50%) rotate(${rotation}deg);
            animation: heartFloat ${duration}ms ease-out forwards;
            --offset-x: ${offsetX}px;
            will-change: transform, opacity;
        `;
        heart.textContent = emoji;

        containerRef.current.appendChild(heart);

        setTimeout(() => {
            heart.remove();
        }, duration + 100);
    };

    // Always render container, hearts will only spawn when theme is active
    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes heartFloat {
                        0% {
                            opacity: 1;
                            transform: translate(-50%, -50%) translateY(0px) translateX(0px) rotate(var(--r, 0deg)) scale(0.4);
                        }
                        20% {
                            opacity: 1;
                            transform: translate(-50%, -50%) translateY(-20px) translateX(calc(var(--offset-x) * 0.3)) scale(1.1);
                        }
                        100% {
                            opacity: 0;
                            transform: translate(-50%, -50%) translateY(-120px) translateX(var(--offset-x)) scale(0.6);
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
