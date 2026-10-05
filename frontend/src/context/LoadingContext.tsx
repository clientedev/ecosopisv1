"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import BrandLoader from "@/components/BrandLoader/BrandLoader";

interface LoadingContextValue {
    isLoading: boolean;
    showLoading: (message?: string) => void;
    hideLoading: () => void;
    withLoading: <T>(action: () => Promise<T>, message?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue>({
    isLoading: false,
    showLoading: () => {},
    hideLoading: () => {},
    withLoading: async (fn) => fn(),
});

export function LoadingProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Initial site load states
    const [initialLoading, setInitialLoading] = useState(true);
    const [initialFadeOut, setInitialFadeOut] = useState(false);

    // Route navigation transition states
    const [isNavigating, setIsNavigating] = useState(false);
    const [navFadeOut, setNavFadeOut] = useState(false);

    // Programmatic / manual loading states
    const [manualLoading, setManualLoading] = useState(false);
    const [manualFadeOut, setManualFadeOut] = useState(false);
    const [manualMessage, setManualMessage] = useState<string | undefined>(undefined);

    const prevPathRef = useRef(pathname);
    const navigationTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    // 1. Initial Page Load Handler
    useEffect(() => {
        const startTime = Date.now();
        const MIN_DISPLAY_TIME = 1000; // ensures smooth brand visual without abrupt flash

        const handleReady = async () => {
            try {
                // Wait for document fonts if available
                if (typeof document !== "undefined" && "fonts" in document) {
                    await (document as any).fonts.ready;
                }
            } catch {
                // Ignore font loading errors
            }

            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

            setTimeout(() => {
                setInitialFadeOut(true);
                cleanRawHtmlPreloader();
                setTimeout(() => {
                    setInitialLoading(false);
                    setInitialFadeOut(false);
                }, 450);
            }, remaining);
        };

        if (typeof document !== "undefined") {
            if (document.readyState === "complete") {
                handleReady();
            } else {
                window.addEventListener("load", handleReady, { once: true });
                // Fallback safety timeout
                const safetyTimer = setTimeout(handleReady, 3000);
                return () => {
                    window.removeEventListener("load", handleReady);
                    clearTimeout(safetyTimer);
                };
            }
        }
    }, [cleanRawHtmlPreloader]);

    // 2. Route Change Interception (Client-side Navigation)
    useEffect(() => {
        const handleAnchorClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest("a");
            if (!target) return;

            const href = target.getAttribute("href");
            const targetAttr = target.getAttribute("target");

            // Ignore external, download, anchor hash, or modified clicks (Ctrl, Cmd, Shift)
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

            // Check if same origin and actually navigating to another path
            try {
                const currentUrl = new URL(window.location.href);
                const nextUrl = new URL(href, window.location.href);

                if (
                    nextUrl.origin === currentUrl.origin &&
                    (nextUrl.pathname !== currentUrl.pathname || nextUrl.search !== currentUrl.search)
                ) {
                    setNavFadeOut(false);
                    setIsNavigating(true);

                    // Safety timeout if navigation takes too long or errors
                    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
                    navigationTimerRef.current = setTimeout(() => {
                        setNavFadeOut(true);
                        setTimeout(() => {
                            setIsNavigating(false);
                            setNavFadeOut(false);
                        }, 300);
                    }, 4000);
                }
            } catch {
                // If invalid URL, proceed naturally
            }
        };

        document.addEventListener("click", handleAnchorClick, { capture: true });
        return () => {
            document.removeEventListener("click", handleAnchorClick, { capture: true });
            if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
        };
    }, []);

    // Dismiss route transition loader when pathname or searchParams change
    useEffect(() => {
        if (prevPathRef.current !== pathname) {
            prevPathRef.current = pathname;
            if (isNavigating) {
                // Give small frame for component to render then fade out
                const timer = setTimeout(() => {
                    setNavFadeOut(true);
                    setTimeout(() => {
                        setIsNavigating(false);
                        setNavFadeOut(false);
                    }, 350);
                }, 150);
                return () => clearTimeout(timer);
            }
        }
    }, [pathname, searchParams, isNavigating]);

    // 3. Programmatic Controls
    const showLoading = useCallback((message?: string) => {
        setManualMessage(message);
        setManualFadeOut(false);
        setManualLoading(true);
    }, []);

    const hideLoading = useCallback(() => {
        setManualFadeOut(true);
        setTimeout(() => {
            setManualLoading(false);
            setManualFadeOut(false);
            setManualMessage(undefined);
        }, 350);
    }, []);

    const withLoading = useCallback(
        async <T,>(action: () => Promise<T>, message?: string): Promise<T> => {
            showLoading(message);
            try {
                return await action();
            } finally {
                hideLoading();
            }
        },
        [showLoading, hideLoading]
    );

    const isAnyActive = initialLoading || isNavigating || manualLoading;

    // Body scroll lock during full screen loader
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
