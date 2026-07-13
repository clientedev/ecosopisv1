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
    copa_do_mundo: {
        primary_color: "#107c41",
        primary_color_dark: "#0a522b",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#002776",
        bg_color: "#fafcf5",
    },
    aniversario_4_anos: {
        primary_color: "#b8860b",
        primary_color_dark: "#8b6508",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#5a450c",
        bg_color: "#fffcf4",
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

    // Set data-theme attribute on <html> element for global CSS targeting
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeId);
        return () => {
            document.documentElement.removeAttribute('data-theme');
        };
    }, [themeId]);

    const valentinesExtras = themeId === "valentines_day" ? `
        /* ============================================
           VALENTINES DAY THEME - COMPREHENSIVE OVERRIDES
           ============================================ */

        /* --- Buttons --- */
        .btn-primary {
            background: linear-gradient(135deg, #e63f6f 0%, #c0294f 100%) !important;
            box-shadow: 0 4px 15px rgba(230, 63, 111, 0.35) !important;
            border-color: #e63f6f !important;
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

        /* --- Logo: shift green hue to pink/rose --- */
        html[data-theme="valentines_day"] img[alt="ECOSOPIS Logo"] {
            filter: hue-rotate(249deg) saturate(1.6) brightness(1.1) !important;
            transition: filter 0.4s ease;
        }

        /* --- Announcement Bar --- */
        html[data-theme="valentines_day"] [data-valentines-announcement] {
            background-color: #e63f6f !important;
        }

        /* --- Cart badge --- */
        html[data-theme="valentines_day"] [class*="cartBadge"] {
            background: #e63f6f !important;
        }

        /* --- Cart status bar (shipping threshold bar) --- */
        html[data-theme="valentines_day"] [data-cart-status-bar] {
            background-color: #fff0f3 !important;
            border-color: #f9c0d0 !important;
            color: #9e1f3e !important;
        }

        /* --- Highlight nav link (QUERO REVENDER) --- */
        html[data-theme="valentines_day"] [class*="highlightNavLink"] {
            color: #e63f6f !important;
            border-color: #e63f6f !important;
        }
        html[data-theme="valentines_day"] [class*="highlightNavLink"]:hover {
            background: rgba(230, 63, 111, 0.1) !important;
        }

        /* --- LIA AI nav link --- */
        html[data-theme="valentines_day"] [class*="liaLink"] {
            color: #e63f6f !important;
        }

        /* --- Links on hover --- */
        a:hover {
            color: #e63f6f;
        }

        /* --- Section badges / pills --- */
        html[data-theme="valentines_day"] [class*="sectionBadge"],
        html[data-theme="valentines_day"] [class*="scientificBadge"],
        html[data-theme="valentines_day"] .scientific-badge {
            background: rgba(230, 63, 111, 0.15) !important;
            color: #c0294f !important;
            border-color: rgba(230, 63, 111, 0.3) !important;
        }

        /* --- Stat cards icons --- */
        html[data-theme="valentines_day"] [class*="statIcon"] {
            color: #e63f6f !important;
        }
        html[data-theme="valentines_day"] [class*="statCard"] h3 {
            color: #e63f6f !important;
        }

        /* --- History section highlight --- */
        html[data-theme="valentines_day"] [class*="historyHighlight"] {
            color: #e63f6f !important;
        }

        /* --- Rank badges --- */
        html[data-theme="valentines_day"] [class*="rankBadgeTop1"] {
            background: linear-gradient(135deg, #e63f6f, #c0294f) !important;
        }
        html[data-theme="valentines_day"] [class*="rankBadgeHeart"] {
            background: linear-gradient(135deg, #c0294f, #9e1f3e) !important;
        }

        /* --- Reviews stars / tags --- */
        html[data-theme="valentines_day"] [class*="reviewStars"] {
            color: #e63f6f !important;
        }

        /* --- Diagnostic / Goal cards --- */
        html[data-theme="valentines_day"] [class*="diagnosticCard"]:hover {
            border-color: #e63f6f !important;
            box-shadow: 0 8px 30px rgba(230,63,111,0.2) !important;
        }
        html[data-theme="valentines_day"] [class*="diagnosticIcon"] {
            color: #e63f6f !important;
        }
        html[data-theme="valentines_day"] [class*="diagnosticAction"] {
            color: #e63f6f !important;
        }

        /* --- Carousel pink film overlay --- */
        html[data-theme="valentines_day"] [data-valentines-overlay] {
            display: block !important;
        }

        /* --- Avatar / user menu --- */
        html[data-theme="valentines_day"] [class*="avatar"] {
            background: linear-gradient(135deg, #e63f6f, #c0294f) !important;
        }

        /* --- Search tags / suggestion pills --- */
        html[data-theme="valentines_day"] [class*="desktopSuggestionTag"]:hover {
            background: rgba(230, 63, 111, 0.12) !important;
            border-color: #e63f6f !important;
            color: #e63f6f !important;
        }

        /* --- Mobile nav active/hover --- */
        html[data-theme="valentines_day"] [class*="mobileNavItem"]:hover {
            color: #e63f6f !important;
        }
        html[data-theme="valentines_day"] [class*="mobileLiaItem"] {
            color: #e63f6f !important;
        }

        /* --- Global green text fallback --- */
        html[data-theme="valentines_day"] [style*="color: #2d5a27"],
        html[data-theme="valentines_day"] [style*="color: #4B8411"],
        html[data-theme="valentines_day"] [style*="color: #166534"] {
            color: #c0294f !important;
        }
    ` : '';

    const copaMundoExtras = themeId === "copa_do_mundo" ? `
        /* ============================================
           WORLD CUP THEME - COMPREHENSIVE OVERRIDES
           ============================================ */

        /* --- Buttons --- */
        .btn-primary {
            background: linear-gradient(135deg, #107c41 0%, #0a522b 100%) !important;
            box-shadow: 0 4px 15px rgba(16, 124, 65, 0.35) !important;
            border-color: #107c41 !important;
            color: #ffffff !important;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #0a522b 0%, #083d20 100%) !important;
            box-shadow: 0 6px 20px rgba(10, 82, 43, 0.45) !important;
            border-color: #0a522b !important;
            transform: translateY(-1px);
        }
        .btn-outline {
            border-color: #107c41 !important;
            color: #107c41 !important;
        }
        .btn-outline:hover {
            background-color: rgba(16, 124, 65, 0.08) !important;
        }

        /* --- Logo filter --- */
        html[data-theme="copa_do_mundo"] img[alt="ECOSOPIS Logo"] {
            filter: hue-rotate(60deg) saturate(1.4) brightness(1.0) !important;
            transition: filter 0.4s ease;
        }

        /* --- Announcement Bar --- */
        html[data-theme="copa_do_mundo"] [class*="announcementBar"] {
            background-color: #002776 !important;
            color: #F7C815 !important;
        }

        /* --- Cart badge --- */
        html[data-theme="copa_do_mundo"] [class*="cartBadge"] {
            background: #F7C815 !important;
            color: #000000 !important;
            font-weight: bold !important;
        }

        /* --- Highlight nav link --- */
        html[data-theme="copa_do_mundo"] [class*="highlightNavLink"] {
            color: #107c41 !important;
            border-color: #107c41 !important;
        }
        html[data-theme="copa_do_mundo"] [class*="highlightNavLink"]:hover {
            background: rgba(16, 124, 65, 0.1) !important;
        }

        /* --- Section badges / pills --- */
        html[data-theme="copa_do_mundo"] [class*="sectionBadge"],
        html[data-theme="copa_do_mundo"] [class*="scientificBadge"],
        html[data-theme="copa_do_mundo"] .scientific-badge {
            background: rgba(247, 200, 21, 0.2) !important;
            color: #0a522b !important;
            border-color: rgba(16, 124, 65, 0.3) !important;
        }

        /* --- Reviews stars --- */
        html[data-theme="copa_do_mundo"] [class*="reviewStars"] {
            color: #F7C815 !important;
        }

        /* --- Custom styling for specific headers/cards --- */
        html[data-theme="copa_do_mundo"] [class*="historyHighlight"] {
            color: #107c41 !important;
        }

        html[data-theme="copa_do_mundo"] [class*="statIcon"] {
            color: #107c41 !important;
        }

        html[data-theme="copa_do_mundo"] [class*="statCard"] h3 {
            color: #107c41 !important;
        }
    ` : '';

    const aniversario4AnosExtras = themeId === "aniversario_4_anos" ? `
        /* ============================================
           ANNIVERSARY THEME - COMPREHENSIVE OVERRIDES
           ============================================ */

        /* --- Buttons --- */
        .btn-primary {
            background: linear-gradient(135deg, #b8860b 0%, #8b6508 100%) !important;
            box-shadow: 0 4px 15px rgba(184, 134, 11, 0.35) !important;
            border-color: #b8860b !important;
            color: #ffffff !important;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #8b6508 0%, #684a04 100%) !important;
            box-shadow: 0 6px 20px rgba(139, 101, 8, 0.45) !important;
            border-color: #8b6508 !important;
            transform: translateY(-1px);
        }
        .btn-outline {
            border-color: #b8860b !important;
            color: #b8860b !important;
        }
        .btn-outline:hover {
            background-color: rgba(184, 134, 11, 0.08) !important;
        }

        /* --- Logo filter --- */
        html[data-theme="aniversario_4_anos"] img[alt="ECOSOPIS Logo"] {
            filter: hue-rotate(330deg) saturate(1.4) brightness(1.0) !important;
            transition: filter 0.4s ease;
        }

        /* --- Announcement Bar --- */
        html[data-theme="aniversario_4_anos"] [class*="announcementBar"] {
            background: linear-gradient(135deg, #b8860b 0%, #8b6508 100%) !important;
            color: #ffffff !important;
        }

        /* --- Cart badge --- */
        html[data-theme="aniversario_4_anos"] [class*="cartBadge"] {
            background: #b8860b !important;
            color: #ffffff !important;
        }

        /* --- Highlight nav link --- */
        html[data-theme="aniversario_4_anos"] [class*="highlightNavLink"] {
            color: #b8860b !important;
            border-color: #b8860b !important;
        }
        html[data-theme="aniversario_4_anos"] [class*="highlightNavLink"]:hover {
            background: rgba(184, 134, 11, 0.1) !important;
        }

        /* --- LIA AI nav link --- */
        html[data-theme="aniversario_4_anos"] [class*="liaLink"] {
            color: #b8860b !important;
        }

        /* --- Links on hover --- */
        a:hover {
            color: #b8860b;
        }

        /* --- Section badges / pills --- */
        html[data-theme="aniversario_4_anos"] [class*="sectionBadge"],
        html[data-theme="aniversario_4_anos"] [class*="scientificBadge"],
        html[data-theme="aniversario_4_anos"] .scientific-badge {
            background: rgba(184, 134, 11, 0.15) !important;
            color: #8b6508 !important;
            border-color: rgba(184, 134, 11, 0.3) !important;
        }

        /* --- Stat cards icons --- */
        html[data-theme="aniversario_4_anos"] [class*="statIcon"] {
            color: #b8860b !important;
        }
        html[data-theme="aniversario_4_anos"] [class*="statCard"] h3 {
            color: #b8860b !important;
        }

        /* --- History section highlight --- */
        html[data-theme="aniversario_4_anos"] [class*="historyHighlight"] {
            color: #b8860b !important;
        }

        /* --- Rank badges --- */
        html[data-theme="aniversario_4_anos"] [class*="rankBadgeTop1"] {
            background: linear-gradient(135deg, #d4af37, #b8860b) !important;
        }
        html[data-theme="aniversario_4_anos"] [class*="rankBadgeAnniversary"] {
            background: linear-gradient(135deg, #b8860b, #8b6508) !important;
        }

        /* --- Reviews stars --- */
        html[data-theme="aniversario_4_anos"] [class*="reviewStars"] {
            color: #b8860b !important;
        }

        /* --- Diagnostic / Goal cards --- */
        html[data-theme="aniversario_4_anos"] [class*="diagnosticCard"]:hover {
            border-color: #b8860b !important;
            box-shadow: 0 8px 30px rgba(184,134,11,0.2) !important;
        }
        html[data-theme="aniversario_4_anos"] [class*="diagnosticIcon"] {
            color: #b8860b !important;
        }
        html[data-theme="aniversario_4_anos"] [class*="diagnosticAction"] {
            color: #b8860b !important;
        }

        /* --- Carousel gold/champagne overlay --- */
        html[data-theme="aniversario_4_anos"] [data-anniversary-overlay] {
            display: block !important;
        }

        /* --- Avatar / user menu --- */
        html[data-theme="aniversario_4_anos"] [class*="avatar"] {
            background: linear-gradient(135deg, #b8860b, #8b6508) !important;
        }

        /* --- Search suggestions --- */
        html[data-theme="aniversario_4_anos"] [class*="desktopSuggestionTag"]:hover {
            background: rgba(184, 134, 11, 0.12) !important;
            border-color: #b8860b !important;
            color: #b8860b !important;
        }

        /* --- Mobile nav active --- */
        html[data-theme="aniversario_4_anos"] [class*="mobileNavItem"]:hover {
            color: #b8860b !important;
        }
        html[data-theme="aniversario_4_anos"] [class*="mobileLiaItem"] {
            color: #b8860b !important;
        }

        /* --- Global green text fallback --- */
        html[data-theme="aniversario_4_anos"] [style*="color: #2d5a27"],
        html[data-theme="aniversario_4_anos"] [style*="color: #4B8411"],
        html[data-theme="aniversario_4_anos"] [style*="color: #166534"] {
            color: #8b6508 !important;
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
                [data-valentines-overlay] {
                    display: none;
                }
                [data-anniversary-overlay] {
                    display: none;
                }
                @keyframes floatHeart {
                    0%   { transform: translateY(0) scale(1); opacity: 0.85; }
                    50%  { transform: translateY(-45vh) scale(1.15) rotate(12deg); opacity: 0.6; }
                    100% { transform: translateY(-100vh) scale(0.8) rotate(-8deg); opacity: 0; }
                }
                ${valentinesExtras}
                ${copaMundoExtras}
                ${aniversario4AnosExtras}
            `
        }} />
    );
}
