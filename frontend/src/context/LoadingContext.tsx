"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
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

// Safety cap in case autoplay or media events are blocked by browser power-saving mode
const INITIAL_SAFETY_TIMEOUT = 4200;
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
    const pathname = usePathname();
    // A árvore só aparece quando o site abre/recarrega na página inicial ("/")
    const isHomeEntry = pathname === "/";
    // 1. Initial Site Load States (First open / Refresh)
    const [initialLoading, setInitialLoading] = useState(isHomeEntry);
    const [initialFadeOut, setInitialFadeOut] = useState(false);
    const initialFinishedRef = useRef(false);
    const cycleCompletedRef = useRef(false);
    const pageReadyRef = useRef(false);

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

    const finishInitialLoad = useCallback(() => {
        if (initialFinishedRef.current) return;
        initialFinishedRef.current = true;
        setInitialFadeOut(true);
        cleanRawHtmlPreloader();
        setTimeout(() => {
            setInitialLoading(false);
            setInitialFadeOut(false);
        }, 300);
    }, [cleanRawHtmlPreloader]);

    const handleTreeCycleComplete = useCallback(() => {
        cycleCompletedRef.current = true;
        if (pageReadyRef.current) {
            finishInitialLoad();
        }
    }, [finishInitialLoad]);

    // Initial Site Load Effect: Completes strictly 1 tree animation cycle once DOM/assets are ready.
    useEffect(() => {
        if (!isHomeEntry) {
            initialFinishedRef.current = true;
            cleanRawHtmlPreloader();
            setInitialLoading(false);
            return;
        }
        const handleInitialReady = async () => {
            await ensureUnderlyingLoaded();
            pageReadyRef.current = true;
            if (cycleCompletedRef.current) {
                finishInitialLoad();
            }
        };

        const safetyCap = setTimeout(finishInitialLoad, INITIAL_SAFETY_TIMEOUT);

        if (typeof document !== "undefined") {
            if (document.readyState === "complete" || document.readyState === "interactive") {
                handleInitialReady();
            } else {
                window.addEventListener("DOMContentLoaded", handleInitialReady, { once: true });
            }
        }

        return () => {
            clearTimeout(safetyCap);
            if (typeof window !== "undefined") {
                window.removeEventListener("DOMContentLoaded", handleInitialReady);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finishInitialLoad]);

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
                    onCycleComplete={handleTreeCycleComplete}
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
