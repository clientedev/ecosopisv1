"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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

    aniversario_4_anos: {
        primary_color: "#b8860b",
        primary_color_dark: "#8b6508",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#5a450c",
        bg_color: "#fffcf4",
    },
    pg_produtos_v2: {
        primary_color: "#4B8411",
        primary_color_dark: "#3a660d",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#4a4a4a",
        bg_color: "#fdfcf9",
    },
    outubro_rosa: {
        primary_color: "#d63b7c",
        primary_color_dark: "#a8275d",
        secondary_color: "#ffffff",
        text_primary: "#1a0a0f",
        text_secondary: "#5a2040",
        bg_color: "#fff5f8",
    },
    black_friday: {
        primary_color: "#e10600",
        primary_color_dark: "#a30000",
        secondary_color: "#ffffff",
        text_primary: "#f5f5f5",
        text_secondary: "#c9c9c9",
        bg_color: "#0b0b0b",
    },
};

// Admin panel keeps a light canvas during Black Friday (only the accent turns red)
const BLACK_FRIDAY_ADMIN = {
    primary_color: "#e10600",
    primary_color_dark: "#a30000",
    secondary_color: "#ffffff",
    text_primary: "#1a1a1a",
    text_secondary: "#4a4a4a",
    bg_color: "#fdfcf9",
};

export default function DynamicBranding() {
    const { activeTheme } = useTheme();
    const pathname = usePathname() || '';
    const isAdmin = pathname.startsWith('/admin');
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

    useEffect(() => {
        if (isAdmin) document.documentElement.setAttribute('data-theme-scope', 'admin');
        else document.documentElement.removeAttribute('data-theme-scope');
    }, [isAdmin]);

    const effectiveColors = themeId === 'black_friday' && isAdmin ? BLACK_FRIDAY_ADMIN : colors;

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

    const pgProdutosV2Extras = themeId === "pg_produtos_v2" ? `
        /* ============================================
           PG DE PRODUTOS V2 (PREMIUM CLEAN GREEN) OVERRIDES
           ============================================ */
        .btn-primary {
            background: linear-gradient(135deg, #4B8411 0%, #3a660d 100%) !important;
            box-shadow: 0 4px 14px rgba(75, 132, 17, 0.25) !important;
            border-color: #4B8411 !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            letter-spacing: 0.03em !important;
            border-radius: 6px !important;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #3a660d 0%, #294a08 100%) !important;
            box-shadow: 0 6px 18px rgba(58, 102, 13, 0.35) !important;
            transform: translateY(-1px);
        }
        .btn-outline {
            border-color: #4B8411 !important;
            color: #4B8411 !important;
            border-radius: 6px !important;
        }
        .btn-outline:hover {
            background-color: rgba(75, 132, 17, 0.08) !important;
        }


        html[data-theme="pg_produtos_v2"] [class*="cartBadge"] {
            background: #4B8411 !important;
            color: #ffffff !important;
        }

        html[data-theme="pg_produtos_v2"] [class*="sectionBadge"],
        html[data-theme="pg_produtos_v2"] [class*="scientificBadge"],
        html[data-theme="pg_produtos_v2"] .scientific-badge {
            background: #edf7e6 !important;
            color: #3a660d !important;
            border: 1px solid #cce8b5 !important;
            font-weight: 700 !important;
            font-size: 0.72rem !important;
            letter-spacing: 0.04em !important;
            border-radius: 4px !important;
        }
    ` : '';

    const octubroRosaExtras = themeId === "outubro_rosa" ? `
        /* ============================================
           OUTUBRO ROSA THEME - COMPREHENSIVE OVERRIDES
           ============================================ */

        /* --- Buttons --- */
        .btn-primary {
            background: linear-gradient(135deg, #d63b7c 0%, #a8275d 100%) !important;
            box-shadow: 0 4px 15px rgba(214, 59, 124, 0.35) !important;
            border-color: #d63b7c !important;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #a8275d 0%, #861d49 100%) !important;
            box-shadow: 0 6px 20px rgba(168, 39, 93, 0.45) !important;
            transform: translateY(-1px);
        }
        .btn-outline {
            border-color: #d63b7c !important;
            color: #d63b7c !important;
        }
        .btn-outline:hover {
            background-color: rgba(214, 59, 124, 0.08) !important;
        }

        /* --- Logo: shift green hue to pink/rose --- */
        html[data-theme="outubro_rosa"] img[alt="ECOSOPIS Logo"] {
            filter: hue-rotate(249deg) saturate(1.5) brightness(1.05) !important;
            transition: filter 0.4s ease;
        }

        /* --- Cart badge --- */
        html[data-theme="outubro_rosa"] [class*="cartBadge"] {
            background: #d63b7c !important;
        }

        /* --- Cart status bar --- */
        html[data-theme="outubro_rosa"] [data-cart-status-bar] {
            background-color: #fff0f4 !important;
            border-color: #f5c0d0 !important;
            color: #861d49 !important;
        }

        /* --- Highlight nav link --- */
        html[data-theme="outubro_rosa"] [class*="highlightNavLink"] {
            color: #d63b7c !important;
            border-color: #d63b7c !important;
        }
        html[data-theme="outubro_rosa"] [class*="highlightNavLink"]:hover {
            background: rgba(214, 59, 124, 0.1) !important;
        }

        /* --- LIA AI nav link --- */
        html[data-theme="outubro_rosa"] [class*="liaLink"] {
            color: #d63b7c !important;
        }

        /* --- Links on hover --- */
        a:hover { color: #d63b7c; }

        /* --- Section badges / pills --- */
        html[data-theme="outubro_rosa"] [class*="sectionBadge"],
        html[data-theme="outubro_rosa"] [class*="scientificBadge"],
        html[data-theme="outubro_rosa"] .scientific-badge {
            background: rgba(214, 59, 124, 0.12) !important;
            color: #a8275d !important;
            border-color: rgba(214, 59, 124, 0.3) !important;
        }

        /* --- Stat cards icons --- */
        html[data-theme="outubro_rosa"] [class*="statIcon"] { color: #d63b7c !important; }
        html[data-theme="outubro_rosa"] [class*="statCard"] h3 { color: #d63b7c !important; }

        /* --- History section highlight --- */
        html[data-theme="outubro_rosa"] [class*="historyHighlight"] { color: #d63b7c !important; }

        /* --- Rank badges --- */
        html[data-theme="outubro_rosa"] [class*="rankBadgeTop1"] {
            background: linear-gradient(135deg, #d63b7c, #a8275d) !important;
        }

        /* --- Reviews stars --- */
        html[data-theme="outubro_rosa"] [class*="reviewStars"] { color: #d63b7c !important; }

        /* --- Diagnostic / Goal cards --- */
        html[data-theme="outubro_rosa"] [class*="diagnosticCard"]:hover {
            border-color: #d63b7c !important;
            box-shadow: 0 8px 30px rgba(214,59,124,0.2) !important;
        }
        html[data-theme="outubro_rosa"] [class*="diagnosticIcon"] { color: #d63b7c !important; }
        html[data-theme="outubro_rosa"] [class*="diagnosticAction"] { color: #d63b7c !important; }

        /* --- Outubro Rosa announcement bar --- */
        html[data-theme="outubro_rosa"] [data-outubro-rosa-announcement] {
            background: linear-gradient(90deg, #d63b7c 0%, #a8275d 50%, #d63b7c 100%) !important;
            background-size: 200% 100% !important;
            animation: octubroRosaShimmer 3s ease infinite !important;
        }

        /* --- Pink ribbon banner --- */
        html[data-theme="outubro_rosa"] [data-outubro-rosa-overlay] {
            display: block !important;
        }

        /* --- Avatar / user menu --- */
        html[data-theme="outubro_rosa"] [class*="avatar"] {
            background: linear-gradient(135deg, #d63b7c, #a8275d) !important;
        }

        /* --- Search tags / suggestion pills --- */
        html[data-theme="outubro_rosa"] [class*="desktopSuggestionTag"]:hover {
            background: rgba(214, 59, 124, 0.1) !important;
            border-color: #d63b7c !important;
            color: #d63b7c !important;
        }

        /* --- Mobile nav active/hover --- */
        html[data-theme="outubro_rosa"] [class*="mobileNavItem"]:hover { color: #d63b7c !important; }
        html[data-theme="outubro_rosa"] [class*="mobileLiaItem"] { color: #d63b7c !important; }

        /* --- Global green text fallback --- */
        html[data-theme="outubro_rosa"] [style*="color: #2d5a27"],
        html[data-theme="outubro_rosa"] [style*="color: #4B8411"],
        html[data-theme="outubro_rosa"] [style*="color: #166534"] {
            color: #a8275d !important;
        }

        /* --- Product card border on hover --- */
        html[data-theme="outubro_rosa"] [class*="productCard"]:hover,
        html[data-theme="outubro_rosa"] [class*="card"]:hover {
            border-color: rgba(214,59,124,0.3) !important;
            box-shadow: 0 4px 24px rgba(214,59,124,0.15) !important;
        }

        @keyframes octubroRosaShimmer {
            0%   { background-position: 100% 0; }
            100% { background-position: -100% 0; }
        }
    ` : '';

    const BF = 'html[data-theme="black_friday"]';
    const SHOP = 'html[data-theme="black_friday"]:not([data-theme-scope="admin"])';
    // Light "surfaces" inside the dark storefront (cards, drawers, modals, forms...).
    // CSS-module classes look like "File_localName__hash": match on the local name's ending
    // ("…card__", "…Card__") so children such as "CartDrawer_checkoutBtn__x" are not caught.
    const SURFACE = [
        '[class*="_card__"]', '[class*="Card__"]', '[class*="_drawer__"]', '[class*="Drawer__"]',
        '[class*="_modal__"]', '[class*="Modal__"]', '[class*="_dropdown__"]', '[class*="Dropdown__"]',
        '[class*="_popup__"]', '[class*="Popup__"]', '[class*="_form__"]', '[class*="Form__"]',
        'form', 'input', 'textarea', 'select',
    ].map(sel => `${SHOP} ${sel}:not([class*="Grid"]):not([class*="grid"]):not([class*="section"]):not([class*="Section"]):not([class*="container"]):not([class*="Container"]):not([class*="wrapper"]):not([class*="Wrapper"]):not([class*="List"]):not([class*="list"])`).join(',\n');

    const blackFridayExtras = themeId === "black_friday" ? `
        /* ============================================
           BLACK FRIDAY THEME - BLACK & RED
           ============================================ */

        /* --- Buttons (everywhere, incl. admin) --- */
        .btn-primary {
            background: linear-gradient(135deg, #ff1a0d 0%, #e10600 45%, #a30000 100%) !important;
            box-shadow: 0 4px 18px rgba(225, 6, 0, 0.45) !important;
            border-color: #e10600 !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            letter-spacing: 0.04em;
            position: relative !important;
            overflow: hidden !important;
        }
        .btn-primary::after {
            content: "";
            position: absolute; top: 0; left: -120%;
            width: 60%; height: 100%;
            background: linear-gradient(110deg, transparent, rgba(255,255,255,.35), transparent);
            animation: bfShine 3.2s ease-in-out infinite;
            pointer-events: none;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #e10600 0%, #a30000 100%) !important;
            box-shadow: 0 6px 26px rgba(255, 60, 0, 0.6) !important;
            transform: translateY(-1px);
        }
        .btn-outline {
            border-color: #e10600 !important;
            color: #e10600 !important;
        }
        .btn-outline:hover { background-color: rgba(225, 6, 0, 0.12) !important; }
        a:hover { color: #ff2d1a; }

        /* --- Dark canvas (storefront only) --- */
        ${SHOP} body { color: #f5f5f5; }
        ${SHOP} [class*="section"], ${SHOP} [class*="Section"] {
            background-color: transparent !important;
            background-image: none !important;
        }

        /* --- Light surfaces keep dark text --- */
        ${SURFACE} {
            --text-primary: #111111;
            --text-secondary: #444444;
            color: #111111;
        }

        /* --- Cart drawer --- */
        ${BF} [class*="CartDrawer_checkoutBtn"] {
            background: linear-gradient(135deg, #ff1a0d 0%, #a30000 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 6px 20px rgba(225, 6, 0, 0.4) !important;
        }
        ${BF} [class*="CartDrawer_checkoutBtn"]:hover { background: #a30000 !important; }

        /* --- Brand loader --- */
        ${SHOP} [class*="BrandLoader_fullScreenWrapper"] { background-color: #000000 !important; }
        ${SHOP} [class*="BrandLoader_gifMedia"] { filter: invert(1) grayscale(1) brightness(1.15); }

        /* --- Header --- */
        ${SHOP} header {
            background-color: #000000 !important;
            border-bottom: 2px solid #e10600 !important;
            --text-primary: #f5f5f5;
            color: #f5f5f5;
        }
        ${SHOP} header nav a, ${SHOP} header [class*="navLink"], ${SHOP} header [class*="icon"],
        ${SHOP} header button:not(.btn-primary) {
            color: #f5f5f5 !important;
        }
        ${SHOP} header nav a:hover, ${SHOP} header [class*="navLink"]:hover { color: #ff2d1a !important; }
        ${SHOP} header input {
            background: #1a1a1a !important;
            color: #f5f5f5 !important;
            border-color: #333 !important;
        }
        ${SHOP} header input::placeholder { color: #8a8a8a !important; }
        ${SHOP} [class*="Header_desktopSearchBand"] {
            background-color: #0b0b0b !important;
            border-bottom: 1px solid #2a0000 !important;
        }
        ${SHOP} [class*="Header_desktopSearchInputWrapper"] {
            background-color: #1a1a1a !important;
            border-color: #3a0a0a !important;
        }
        ${SHOP} [class*="Header_desktopSearchInputWrapper"]:focus-within { border-color: #e10600 !important; }
        ${SHOP} [class*="Header_desktopSearchField"] { background: transparent !important; color: #f5f5f5 !important; }
        ${SHOP} [class*="Header_desktopSearchIcon"] { color: #e10600 !important; }
        ${SHOP} [class*="Header_desktopSuggestion"] { color: #bdbdbd !important; }
        ${SHOP} [class*="Header_desktopSuggestionTag"] { color: #f5f5f5 !important; }
        ${SHOP} [class*="Header_scrolledSearchBtn"] {
            background: #e10600 !important;
            color: #ffffff !important;
            border-color: #e10600 !important;
        }
        ${SHOP} img[alt="ECOSOPIS Logo"] {
            filter: brightness(0) invert(1) !important;
            transition: filter 0.4s ease;
        }

        /* --- Page heroes / titles on the dark canvas --- */
        ${SHOP} [class*="CatalogHero"], ${SHOP} [class*="pageHero"] {
            background: radial-gradient(ellipse at 50% 0%, #3a0000 0%, #0b0b0b 70%) !important;
            border-bottom: 1px solid #2a0000 !important;
        }
        ${SHOP} [class*="heroTitle"], ${SHOP} [class*="catalogTitle"], ${SHOP} [class*="pageTitle"] { color: #ffffff !important; }
        ${SHOP} [class*="heroSubtitle"], ${SHOP} [class*="pageSubtitle"] { color: #c9c9c9 !important; }
        ${SHOP} [class*="heroBadge"] {
            background: #e10600 !important;
            color: #ffffff !important;
            border-color: #e10600 !important;
        }
        ${SHOP} [class*="countText"] { color: #9a9a9a !important; }
        ${SHOP} [class*="catPill"]:not([class*="catPillActive"]) {
            background: #151515 !important;
            color: #e5e5e5 !important;
            border-color: #333 !important;
        }
        ${SHOP} [class*="catPill"]:not([class*="catPillActive"]):hover { border-color: #e10600 !important; color: #ffffff !important; }
        ${SHOP} [class*="catPillActive"] { background: #e10600 !important; color: #fff !important; border-color: #e10600 !important; }

        /* --- Product detail page --- */
        ${SHOP} [class*="page_productName"] { color: #ffffff !important; }
        ${SHOP} [class*="page_description"] { color: #c9c9c9 !important; }
        ${SHOP} [class*="page_price"] { color: #ff2d1a !important; }
        ${SHOP} [class*="page_quantityWrapper"] { background: #151515 !important; border-color: #333 !important; }
        ${SHOP} [class*="page_quantityBtn"] { background: #1f1f1f !important; color: #ffffff !important; }
        ${SHOP} [class*="page_quantityBtn"]:hover:not(:disabled) { background: #e10600 !important; }
        ${SHOP} [class*="page_quantityValue"] { color: #ffffff !important; }
        ${SHOP} [class*="page_addToCartBtn"] {
            background: transparent !important; color: #ffffff !important; border: 2px solid #e10600 !important;
        }
        ${SHOP} [class*="page_addToCartBtn"]:hover { background: #e10600 !important; }
        ${SHOP} [class*="page_buyNowBtn"] {
            background: linear-gradient(135deg, #ff1a0d 0%, #a30000 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 6px 22px rgba(225, 6, 0, 0.45) !important;
        }
        ${SHOP} [class*="page_chatHeaderInline"], ${SHOP} [class*="page_readMore"],
        ${SHOP} [class*="page_cardContent"] h3, ${SHOP} [class*="page_textBlock"] h2 { color: #ff2d1a !important; }

        /* --- Sobre --- */
        ${SHOP} [class*="page_aboutContainer"] { color: #d6d6d6 !important; }
        ${SHOP} [class*="page_aboutContainer"] [class*="page_hero"] {
            background: linear-gradient(rgba(0, 0, 0, 0.72), rgba(110, 0, 0, 0.72)),
                url('/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png') center / cover !important;
        }
        ${SHOP} [class*="page_aboutContainer"] [class*="page_textBlock"] p { color: #c9c9c9 !important; }
        ${SHOP} [class*="page_aboutContainer"] [class*="page_values"] { background: #111111 !important; }
        ${SHOP} [class*="page_aboutContainer"] [class*="page_ctaButton"] { background-color: #e10600 !important; }
        ${SHOP} [class*="page_aboutContainer"] [class*="page_tag"] { background: rgba(225, 6, 0, 0.12) !important; color: #e10600 !important; }

        /* --- Cart / checkout: keep a light, legible canvas; only accents go red --- */
        ${SHOP} [class*="page_carrinhoContainer"] {
            --text-primary: #111111;
            --text-secondary: #444444;
            color: #111111;
        }
        ${SHOP} [class*="page_carrinhoContainer"] h1, ${SHOP} [class*="page_carrinhoContainer"] h2,
        ${SHOP} [class*="page_carrinhoContainer"] h3 { color: #111111; }
        ${SHOP} [class*="page_stepActive"] { color: #e10600 !important; }
        ${SHOP} [class*="page_stepNum"][class*="page_stepActive"], ${SHOP} [class*="page_stepActive"] [class*="page_stepNum"] { background: #e10600 !important; color: #fff !important; }
        ${SHOP} [class*="page_miniItemPrice"], ${SHOP} [class*="page_itemPrice"], ${SHOP} [class*="page_totalValue"] { color: #e10600 !important; }

        /* --- Footer --- */
        ${SHOP} footer {
            background-color: #000000 !important;
            border-top: 2px solid #e10600 !important;
            --text-primary: #f5f5f5;
            --text-secondary: #bdbdbd;
            color: #bdbdbd;
        }
        ${SHOP} footer h1, ${SHOP} footer h2, ${SHOP} footer h3, ${SHOP} footer h4 { color: #ffffff !important; }
        ${SHOP} footer a { color: #d6d6d6 !important; }
        ${SHOP} footer a:hover { color: #ff2d1a !important; }

        /* --- Mobile bottom nav --- */
        ${SHOP} [class*="MobileBottomNav_bottomNav"] {
            background: #000000 !important;
            border-top: 1px solid #e10600 !important;
        }
        ${SHOP} [class*="MobileBottomNav_navItem"] { color: #d6d6d6 !important; }
        ${SHOP} [class*="MobileBottomNav_active"] { color: #ff2d1a !important; }
        ${SHOP} [class*="mobileNavItem"] { color: #e5e5e5 !important; }
        ${SHOP} [class*="mobileNavItem"]:hover, ${SHOP} [class*="mobileLiaItem"] { color: #ff2d1a !important; }

        /* --- Product cards --- */
        ${SHOP} [class*="ProductCard_card"] {
            border: 1px solid #222 !important;
            transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease !important;
        }
        ${SHOP} [class*="ProductCard_card"]:hover {
            border-color: #e10600 !important;
            box-shadow: 0 0 0 1px #e10600, 0 10px 34px rgba(225, 6, 0, 0.35) !important;
            transform: translateY(-3px);
        }
        ${BF} [class*="saleBadge"] {
            background: linear-gradient(135deg, #ff1a0d, #a30000) !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            letter-spacing: .03em;
            animation: bfBadgeFire 1.4s ease-in-out infinite alternate;
        }
        ${BF} [class*="saleBadge"]::before { content: "🔥 "; }
        ${BF} [class*="productBadge"], ${BF} [class*="recommendedLabel"] {
            background: #000000 !important;
            color: #ffffff !important;
            border: 1px solid #e10600 !important;
        }
        ${BF} [class*="ProductCard_price"], ${BF} [class*="salePrice"] { color: #e10600 !important; }

        /* --- Badges / pills / accents --- */
        ${BF} [class*="cartBadge"] { background: #e10600 !important; color: #fff !important; }
        ${BF} [class*="highlightNavLink"] { color: #ff2d1a !important; border-color: #e10600 !important; }
        ${BF} [class*="highlightNavLink"]:hover { background: rgba(225, 6, 0, 0.15) !important; }
        ${BF} [class*="liaLink"] { color: #ff2d1a !important; }
        ${BF} [class*="sectionBadge"], ${BF} [class*="scientificBadge"], ${BF} .scientific-badge {
            background: #e10600 !important;
            color: #ffffff !important;
            border-color: #e10600 !important;
        }
        ${BF} [class*="statIcon"], ${BF} [class*="statCard"] h3,
        ${BF} [class*="historyHighlight"], ${BF} [class*="reviewStars"],
        ${BF} [class*="diagnosticIcon"], ${BF} [class*="diagnosticAction"] { color: #e10600 !important; }
        ${BF} [class*="rankBadgeTop1"] { background: linear-gradient(135deg, #e10600, #a30000) !important; }
        ${BF} [class*="diagnosticCard"]:hover {
            border-color: #e10600 !important;
            box-shadow: 0 8px 30px rgba(225, 6, 0, 0.3) !important;
        }
        ${BF} [class*="avatar"] { background: linear-gradient(135deg, #e10600, #000000) !important; }
        ${BF} [class*="desktopSuggestionTag"]:hover {
            background: rgba(225, 6, 0, 0.12) !important;
            border-color: #e10600 !important;
            color: #e10600 !important;
        }
        ${BF} [data-cart-status-bar] {
            background-color: #140000 !important;
            border-color: #e10600 !important;
            color: #ffd2cc !important;
        }
        ${BF} [data-black-friday-overlay] { display: block !important; }

        /* --- Green leftovers become red --- */
        ${BF} :is([style^="color: #2d5a27"], [style*="; color: #2d5a27"], [style^="color: #4B8411"], [style*="; color: #4B8411"],
                  [style^="color: #166534"], [style*="; color: #166534"], [style^="color: rgb(75, 132, 17)"], [style*="; color: rgb(75, 132, 17)"]) {
            color: #e10600 !important;
        }
        /* Product stars (lucide, inline fill) */
        ${BF} svg[fill="#4B8411"] { fill: #e10600 !important; color: #e10600 !important; stroke: #e10600 !important; }
        ${BF} [class*="rankBadgeStar"] {
            background: linear-gradient(135deg, #1a1a1a, #000000) !important;
            color: #ffffff !important;
            border: 1px solid #e10600 !important;
            box-shadow: 0 4px 18px rgba(225, 6, 0, 0.35) !important;
        }
        ${BF} [style*="background-color: #4B8411"], ${BF} [style*="background: #4B8411"],
        ${BF} [style*="background-color: rgb(75, 132, 17)"] { background-color: #e10600 !important; }

        /* --- Scrollbar & selection --- */
        ${SHOP} ::selection { background: #e10600; color: #fff; }
        ${SHOP} ::-webkit-scrollbar { width: 10px; }
        ${SHOP} ::-webkit-scrollbar-track { background: #0b0b0b; }
        ${SHOP} ::-webkit-scrollbar-thumb { background: #e10600; border-radius: 10px; }

        @keyframes bfShine {
            0%, 60% { left: -120%; }
            100%    { left: 140%; }
        }
        @keyframes bfBadgeFire {
            0%   { box-shadow: 0 0 6px 1px rgba(255, 90, 20, .55); transform: scale(1); }
            100% { box-shadow: 0 0 16px 4px rgba(255, 40, 0, .85); transform: scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
            .btn-primary::after, ${BF} [class*="saleBadge"] { animation: none !important; }
        }
    ` : '';

    return (
        <style dangerouslySetInnerHTML={{
            __html: `
                :root {
                    --primary-green: ${effectiveColors.primary_color};
                    --primary-green-dark: ${effectiveColors.primary_color_dark};
                    --secondary-white: ${effectiveColors.secondary_color};
                    --text-primary: ${effectiveColors.text_primary};
                    --text-secondary: ${effectiveColors.text_secondary};
                    --site-bg: ${effectiveColors.bg_color};
                    --theme-id: "${themeId}";
                }
                body {
                    background-color: var(--site-bg) !important;
                    overflow-x: clip !important;
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
                [data-outubro-rosa-overlay] {
                    display: none;
                }
                [data-black-friday-overlay] {
                    display: none;
                }
                @keyframes floatHeart {
                    0%   { transform: translateY(0) scale(1); opacity: 0.85; }
                    50%  { transform: translateY(-45vh) scale(1.15) rotate(12deg); opacity: 0.6; }
                    100% { transform: translateY(-100vh) scale(0.8) rotate(-8deg); opacity: 0; }
                }
                ${valentinesExtras}
                ${aniversario4AnosExtras}
                ${pgProdutosV2Extras}
                ${octubroRosaExtras}
                ${blackFridayExtras}
            `
        }} />
    );
}
