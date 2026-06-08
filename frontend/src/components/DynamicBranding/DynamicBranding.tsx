"use client";
import { useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

const THEMES: Record<string, Record<string, string>> = {
    default: {
        primary_color: "#4B8411",
        primary_color_dark: "#3a660d",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#4a4a4a",
        bg_color: "#fdfcf9",
    },
    valentines_day: {
        primary_color: "#e63f6f",
        primary_color_dark: "#c0294f",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#5a3040",
        bg_color: "#fff5f7",
    },
};

export default function DynamicBranding() {
    const { activeTheme } = useTheme();
    const [colors, setColors] = useState<Record<string, string>>(THEMES.default);
    const [themeId, setThemeId] = useState<string>("default");

    useEffect(() => {
        // Apply theme immediately if available for instant UI response
        if (activeTheme && THEMES[activeTheme]) {
            setColors(THEMES[activeTheme]);
            setThemeId(activeTheme);
        } else {
            setColors(THEMES.default);
            setThemeId("default");
        }

        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();

                    // Detect active seasonal theme
                    const activeThemeFromDb = data.active_theme && data.active_theme !== "default"
                        ? data.active_theme
                        : null;

                    // Only update if the db theme matches activeTheme to prevent race conditions
                    if ((activeThemeFromDb || "default") === activeTheme) {
                        if (activeThemeFromDb && THEMES[activeThemeFromDb]) {
                            setColors(THEMES[activeThemeFromDb]);
                            setThemeId(activeThemeFromDb);
                        } else {
                            // Use custom colors saved individually, fallback to defaults
                            const baseColors = { ...THEMES.default };
                            if (data.primary_color) baseColors.primary_color = data.primary_color;
                            if (data.primary_color_dark) baseColors.primary_color_dark = data.primary_color_dark;
                            if (data.secondary_color) baseColors.secondary_color = data.secondary_color;
                            if (data.text_primary) baseColors.text_primary = data.text_primary;
                            if (data.text_secondary) baseColors.text_secondary = data.text_secondary;
                            if (data.bg_color) baseColors.bg_color = data.bg_color;
                            setColors(baseColors);
                            setThemeId("default");
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching branding settings:", err);
            }
        };
        fetchSettings();
    }, [activeTheme]);

    const valentinesExtras = themeId === "valentines_day" ? `
        /* Valentine's Day extra accents */
        .btn-primary {
            background: linear-gradient(135deg, #e63f6f 0%, #c0294f 100%) !important;
            box-shadow: 0 4px 15px rgba(230, 63, 111, 0.35) !important;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #c0294f 0%, #9e1f3e 100%) !important;
            box-shadow: 0 6px 20px rgba(192, 41, 79, 0.45) !important;
            transform: translateY(-1px);
        }
        .btn-outline {
            border-color: #e63f6f !important;
            color: #e63f6f !important;
        }
        .btn-outline:hover {
            background-color: rgba(230, 63, 111, 0.08) !important;
        }
        a:hover {
            color: #e63f6f;
        }
    ` : '';

    return (
        <style dangerouslySetInnerHTML={{
            __html: `
                :root {
                    --primary-green: ${colors.primary_color};
                    --primary-green-dark: ${colors.primary_color_dark};
                    --secondary-white: ${colors.secondary_color};
                    --text-primary: ${colors.text_primary};
                    --text-secondary: ${colors.text_secondary};
                    --site-bg: ${colors.bg_color};
                    --theme-id: "${themeId}";
                }
                body {
                    background-color: var(--site-bg) !important;
                    overflow-x: hidden !important;
                    width: 100% !important;
                    position: relative !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                * {
                    box-sizing: border-box !important;
                }
                ${valentinesExtras}
            `
        }} />
    );
}
