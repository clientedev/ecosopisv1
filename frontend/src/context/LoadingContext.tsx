"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import BrandLoader from "@/components/BrandLoader/BrandLoader";

interface LoadingContextValue {
    isLoading: boolean;
    showLoading: () => void;
    hideLoading: () => void;
    withLoading: <T>(action: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue>({
    isLoading: false,
    showLoading: () => {},
    hideLoading: () => {},
    withLoading: async (fn) => fn(),
});

// Minimum splash duration (paired with 2.0x playbackRate in BrandLoader)
const INITIAL_MIN_DURATION = 1150;
const INITIAL_MAX_TIMEOUT = 1800;
const MANUAL_MIN_DURATION = 450;

/**
 * Calculates remaining milliseconds needed to meet a clean minimum display duration.
 */
function getRemainingMinDelay(startTime: number, minDuration: number): number {
    const elapsed = Date.now() - startTime;
    return Math.max(0, minDuration - elapsed);
}

/**
 * Gives critical fonts and initial frames a brief window to settle without
 * stalling the page behind slow external assets.
 */
async function ensureUnderlyingLoaded(): Promise<void> {
    if (typeof document === "undefined") return;

    try {
        if ("fonts" in document) {
            await Promise.race([
                (document as any).fonts.ready,
                new Promise<void>(resolve => setTimeout(resolve, 400)),
            ]);
        }

        const images = Array.from(document.querySelectorAll("img"));
        const pendingImages = images
            .filter(img => !img.complete && img.src && !img.src.includes("loading"))
            .slice(0, 6);

        if (pendingImages.length > 0) {
            await Promise.all(
                pendingImages.map(
                    img =>
                        new Promise<void>(resolve => {
                            if (img.complete) {
                                resolve();
                                return;
                            }
                            const done = () => resolve();
                            img.addEventListener("load", done, { once: true });
                            img.addEventListener("error", done, { once: true });
                            setTimeout(done, 600);
                        })
                )
            );
        }

        await new Promise<void>(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
    } catch {
        // Non-blocking fallback
    }
}

export function LoadingProvider({ children }: { children: ReactNode }) {
    // 1. Initial Site Load States (First open / Refresh)
    const [initialLoading, setInitialLoading] = useState(true);
    const [initialFadeOut, setInitialFadeOut] = useState(false);
    const initialStartTimeRef = useRef<number>(Date.now());

    // 2. Manual / Programmatic Loading States (Checkout, Processando Pedido, Fechar Compra)
    const [manualLoading, setManualLoading] = useState(false);
    const [manualFadeOut, setManualFadeOut] = useState(false);
    const manualStartTimeRef = useRef<number>(0);

    // Remove pre-rendered raw HTML splash if present
    const cleanRawHtmlPreloader = useCallback(() => {
        if (typeof document !== "undefined") {
            const rawEl = document.getElementById("ecosopis-preloader");
            if (rawEl) {
                rawEl.style.opacity = "0";
                rawEl.style.transition = "opacity 0.25s ease";
                setTimeout(() => rawEl.remove(), 250);
            }
        }
    }, []);

    // Initial Site Load Effect: Fast, smooth tree animation (max ~1.8s total).
    useEffect(() => {
        initialStartTimeRef.current = Date.now();
        let finished = false;

        const finishInitialLoad = () => {
            if (finished) return;
            finished = true;
            setInitialFadeOut(true);
            cleanRawHtmlPreloader();
            setTimeout(() => {
                setInitialLoading(false);
                setInitialFadeOut(false);
            }, 300);
        };

        const handleInitialReady = async () => {
            await ensureUnderlyingLoaded();
            const remaining = getRemainingMinDelay(initialStartTimeRef.current, INITIAL_MIN_DURATION);
            setTimeout(finishInitialLoad, remaining);
        };

        const hardCap = setTimeout(finishInitialLoad, INITIAL_MAX_TIMEOUT);

        if (typeof document !== "undefined") {
            if (document.readyState === "complete" || document.readyState === "interactive") {
                handleInitialReady();
            } else {
                window.addEventListener("DOMContentLoaded", handleInitialReady, { once: true });
            }
        }

        return () => {
            clearTimeout(hardCap);
            if (typeof window !== "undefined") {
                window.removeEventListener("DOMContentLoaded", handleInitialReady);
            }
        };
    }, [cleanRawHtmlPreloader]);

    // Programmatic Controls: For heavy operations (fechar compra, processando pedido, etc.)
    const showLoading = useCallback(() => {
        manualStartTimeRef.current = Date.now();
        setManualFadeOut(false);
        setManualLoading(true);
    }, []);

    const hideLoading = useCallback(() => {
        const remaining = getRemainingMinDelay(manualStartTimeRef.current || Date.now(), MANUAL_MIN_DURATION);

        setTimeout(() => {
            setManualFadeOut(true);
            setTimeout(() => {
                setManualLoading(false);
                setManualFadeOut(false);
            }, 300);
        }, remaining);
    }, []);

    const withLoading = useCallback(
        async <T,>(action: () => Promise<T>): Promise<T> => {
            showLoading();
            try {
                return await action();
            } finally {
                hideLoading();
            }
        },
        [showLoading, hideLoading]
    );

    const isAnyActive = initialLoading || manualLoading;

    // Body and document scroll lock during full screen loader to prevent scrolling before page is ready
    useEffect(() => {
        if (typeof document !== "undefined") {
            const html = document.documentElement;
            const body = document.body;
            if (isAnyActive) {
                body.style.overflow = "hidden";
                html.style.overflow = "hidden";
                body.style.touchAction = "none";
                html.style.touchAction = "none";
            } else {
                body.style.overflow = "";
                html.style.overflow = "";
                body.style.touchAction = "";
                html.style.touchAction = "";
            }
        }
    }, [isAnyActive]);

    return (
        <LoadingContext.Provider
            value={{
                isLoading: isAnyActive,
                showLoading,
                hideLoading,
                withLoading,
            }}
        >
            {/* Initial Splash Loader: First visit / reload */}
            {initialLoading && (
                <BrandLoader
                    splash
                    fullScreen={true}
                    fadeOut={initialFadeOut}
                />
            )}

            {/* Heavy Action / Checkout / Processando Pedido Loader */}
            {!initialLoading && manualLoading && (
                <BrandLoader
                    fullScreen={true}
                    fadeOut={manualFadeOut}
                />
            )}

            {children}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    return useContext(LoadingContext);
}
