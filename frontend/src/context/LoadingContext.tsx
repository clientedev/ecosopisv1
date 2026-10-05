"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

        // 3. Give two animation frames for React DOM paint and styles to settle
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
    const searchParams = useSearchParams();

    // 1. Initial Site Load States
    const [initialLoading, setInitialLoading] = useState(true);
    const [initialFadeOut, setInitialFadeOut] = useState(false);
    const initialStartTimeRef = useRef<number>(Date.now());

    // 2. Route Navigation Transition States
    const [isNavigating, setIsNavigating] = useState(false);
    const [navFadeOut, setNavFadeOut] = useState(false);
    const navStartTimeRef = useRef<number>(0);
    const prevPathRef = useRef(pathname);
    const navTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 3. Manual / Programmatic Loading States
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

    // 1. Initial Site Load Effect: Plays full loop AND waits for everything underneath
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

    // 2. Route Navigation: Intercept same-origin link clicks
    useEffect(() => {
        const handleAnchorClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest("a");
            if (!target) return;

            const href = target.getAttribute("href");
            const targetAttr = target.getAttribute("target");

            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("javascript:") ||
                targetAttr === "_blank" ||
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey
            ) {
                return;
            }

            try {
                const currentUrl = new URL(window.location.href);
                const nextUrl = new URL(href, window.location.href);

                if (
                    nextUrl.origin === currentUrl.origin &&
                    (nextUrl.pathname !== currentUrl.pathname || nextUrl.search !== currentUrl.search)
                ) {
                    navStartTimeRef.current = Date.now();
                    setNavFadeOut(false);
                    setIsNavigating(true);

                    // Safety timeout (max 10s if route navigation gets stuck)
                    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
                    navTimeoutRef.current = setTimeout(() => {
                        setNavFadeOut(true);
                        setTimeout(() => {
                            setIsNavigating(false);
                            setNavFadeOut(false);
                        }, 400);
                    }, 10000);
                }
            } catch {
                // If parsing fails, allow default browser navigation
            }
        };

        document.addEventListener("click", handleAnchorClick, { capture: true });
        return () => {
            document.removeEventListener("click", handleAnchorClick, { capture: true });
            if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
        };
    }, []);

    // Dismiss route transition ONLY AFTER full loop completes and background page is ready
    useEffect(() => {
        if (prevPathRef.current !== pathname) {
            prevPathRef.current = pathname;

            if (isNavigating) {
                const completeNavigation = async () => {
                    // Make sure new page DOM, fonts, and images are loaded underneath
                    await ensureUnderlyingLoaded();

                    // Calculate remaining time so the tree GIF completes its full cycle
                    const remaining = getDelayUntilCycleEnd(navStartTimeRef.current || Date.now());

                    setTimeout(() => {
                        setNavFadeOut(true);
                        setTimeout(() => {
                            setIsNavigating(false);
                            setNavFadeOut(false);
                        }, 400);
                    }, remaining);
                };

                completeNavigation();
            }
        }
    }, [pathname, searchParams, isNavigating]);

    // 3. Programmatic Controls: Always finish full loop before hiding
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

    const isAnyActive = initialLoading || isNavigating || manualLoading;

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
            {/* Initial Splash Loader */}
            {initialLoading && (
                <BrandLoader
                    fullScreen={true}
                    fadeOut={initialFadeOut}
                />
            )}

            {/* Navigation Loader */}
            {!initialLoading && isNavigating && (
                <BrandLoader
                    fullScreen={true}
                    fadeOut={navFadeOut}
                />
            )}

            {/* Manual Programmatic Loader */}
            {!initialLoading && !isNavigating && manualLoading && (
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
