"use client";
import { useEffect, useState } from 'react';

export default function DynamicBranding() {
    const [colors, setColors] = useState<Record<string, string>>({
        primary_color: "#4B8411",
        primary_color_dark: "#3a660d",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#4a4a4a",
        bg_color: "#fdfcf9"
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    const newColors = { ...colors };
                    let changed = false;
                    
                    if (data.primary_color) { newColors.primary_color = data.primary_color; changed = true; }
                    if (data.primary_color_dark) { newColors.primary_color_dark = data.primary_color_dark; changed = true; }
                    if (data.secondary_color) { newColors.secondary_color = data.secondary_color; changed = true; }
                    if (data.text_primary) { newColors.text_primary = data.text_primary; changed = true; }
                    if (data.text_secondary) { newColors.text_secondary = data.text_secondary; changed = true; }
                    if (data.bg_color) { newColors.bg_color = data.bg_color; changed = true; }
                    
                    if (changed) setColors(newColors);
                }
            } catch (err) {
                console.error("Error fetching branding settings:", err);
            }
        };
        fetchSettings();
    }, []);

    return (
        <style dangerouslySetInnerHTML={{
            __html: `
                :root {
                    --primary-green: ${colors.primary_color} !important;
                    --primary-green-dark: ${colors.primary_color_dark} !important;
                    --secondary-white: ${colors.secondary_color} !important;
                    --text-primary: ${colors.text_primary} !important;
                    --text-secondary: ${colors.text_secondary} !important;
                    --site-bg: ${colors.bg_color} !important;
                }
                body {
                    background-color: var(--site-bg) !important;
                }
            `
        }} />
    );
}
