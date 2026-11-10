"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "default" | "valentines_day" | "aniversario_4_anos" | "pg_produtos_v2" | "outubro_rosa" | "black_friday";

interface ThemeContextValue {
    activeTheme: ThemeId;
    setActiveTheme: (theme: ThemeId) => void;
    /** true once the theme was read from /api/settings (or set by the admin) */
    resolved: boolean;
}

// Last known theme, read by the inline script in layout.tsx before first paint
const THEME_CACHE_KEY = "ecosopis_active_theme";
const cacheTheme = (theme: string) => {
    try { localStorage.setItem(THEME_CACHE_KEY, theme); } catch { /* ignore */ }
};

const ThemeContext = createContext<ThemeContextValue>({
    activeTheme: "default",
    setActiveTheme: () => {},
    resolved: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [activeTheme, setActiveThemeState] = useState<ThemeId>("default");
    const [resolved, setResolved] = useState(false);

    useEffect(() => {
        const fetchTheme = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    let theme: ThemeId = "default";
                    if (data.active_theme && data.active_theme !== "default" && data.active_theme !== "copa_do_mundo") {
                        theme = data.active_theme as ThemeId;
                    }
                    setActiveThemeState(theme);
                    cacheTheme(theme);
                    setResolved(true);
                }
            } catch (err) {
                console.error("Error fetching theme settings:", err);
            }
        };
        fetchTheme();
    }, []);

    const setActiveTheme = (theme: ThemeId) => {
        setActiveThemeState(theme);
        cacheTheme(theme);
        setResolved(true);
    };

    return (
        <ThemeContext.Provider value={{ activeTheme, setActiveTheme, resolved }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
