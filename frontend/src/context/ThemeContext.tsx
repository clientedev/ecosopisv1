"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "default" | "valentines_day";

interface ThemeContextValue {
    activeTheme: ThemeId;
    setActiveTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    activeTheme: "default",
    setActiveTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [activeTheme, setActiveThemeState] = useState<ThemeId>("default");

    useEffect(() => {
        const fetchTheme = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    if (data.active_theme && data.active_theme !== "default") {
                        setActiveThemeState(data.active_theme as ThemeId);
                    }
                }
            } catch (err) {
                console.error("Error fetching theme settings:", err);
            }
        };
        fetchTheme();
    }, []);

    const setActiveTheme = (theme: ThemeId) => {
        setActiveThemeState(theme);
    };

    return (
        <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
