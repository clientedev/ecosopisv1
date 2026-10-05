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

// Full animation cycle duration of the tree video/GIF (in milliseconds)
const CYCLE_DURATION = 3725;

/**
 * Calculates remaining milliseconds needed so the animation completes
 * its current (or next) full cycle from the moment it started.
 */
function getDelayUntilCycleEnd(startTime: number): number {
    const elapsed = Date.now() - startTime;
    const completedCycles = Math.max(1, Math.ceil(elapsed / CYCLE_DURATION));
    const targetTime = startTime + completedCycles * CYCLE_DURATION;
    return Math.max(0, targetTime - Date.now());
}

/**
 * Ensures critical assets in the document underneath are fully loaded and ready
 * before revealing the page to avoid layout shifts or broken placeholders.
 */
async function ensureUnderlyingLoaded(): Promise<void> {
    if (typeof document === "undefined") return;

    try {
        // 1. Wait for document fonts
        if ("fonts" in document) {
            await (document as any).fonts.ready;
        }

        // 2. Wait for pending images in viewport (up to first 12 images)
        const images = Array.from(document.querySelectorAll("img"));
        const pendingImages = images
            .filter(img => !img.complete && img.src && !img.src.includes("loading"))
            .slice(0, 12);

        if (pendingImages.length > 0) {
            await Promise.all(
                pendingImages.map(
                    img =>
                        new Promise<void>(resolve => {
                            if (img.complete) {
                                resolve();
                                return;
                            }
                            img.onload = () => resolve();
                            img.onerror = () => resolve();
                            setTimeout(resolve, 2500); // Safety fallback
                        })
                )
            );
        }

        // 3. Give animation frames for React DOM paint and styles to settle
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
                rawEl.style.transition = "opacity 0.4s ease";
                setTimeout(() => rawEl.remove(), 400);
            }
        }
    }, []);

    // Initial Site Load Effect: Plays full loop AND waits for everything underneath to settle
    useEffect(() => {
        initialStartTimeRef.current = Date.now();

        const handleInitialReady = async () => {
            await ensureUnderlyingLoaded();

            // Wait for the full loop of the animation to finish
            const remaining = getDelayUntilCycleEnd(initialStartTimeRef.current);

            setTimeout(() => {
                setInitialFadeOut(true);
                cleanRawHtmlPreloader();
                setTimeout(() => {
                    setInitialLoading(false);
                    setInitialFadeOut(false);
                }, 400);
            }, remaining);
        };

        if (typeof document !== "undefined") {
            if (document.readyState === "complete") {
                handleInitialReady();
            } else {
                window.addEventListener("load", handleInitialReady, { once: true });
                const safety = setTimeout(handleInitialReady, 6000);
                return () => {
                    window.removeEventListener("load", handleInitialReady);
                    clearTimeout(safety);
                };
            }
        }
    }, [cleanRawHtmlPreloader]);

    // Programmatic Controls: For heavy operations (fechar compra, processando pedido, etc.)
    const showLoading = useCallback(() => {
        manualStartTimeRef.current = Date.now();
        setManualFadeOut(false);
        setManualLoading(true);
    }, []);

    const hideLoading = useCallback(() => {
        const remaining = getDelayUntilCycleEnd(manualStartTimeRef.current || Date.now());

        setTimeout(() => {
            setManualFadeOut(true);
            setTimeout(() => {
                setManualLoading(false);
                setManualFadeOut(false);
            }, 400);
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

    // Body scroll lock during full screen loader to prevent scrolling before page is ready
    useEffect(() => {
        if (typeof document !== "undefined") {
            if (isAnyActive) {
                document.body.style.overflow = "hidden";
            } else {
                document.body.style.overflow = "";
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
