"use client";

import { useEffect, useState } from "react";
import styles from "../dashboard/dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { useTheme, ThemeId } from "@/context/ThemeContext";

interface ThemeDefinition {
    id: ThemeId;
    name: string;
    description: string;
    emoji: string;
    primary: string;
    primaryDark: string;
    bg: string;
    accent: string;
    tags: string[];
    features: string[];
}

const THEME_DEFINITIONS: ThemeDefinition[] = [
    {
        id: "default",
        name: "Tema Padrão",
        description: "O tema verde natural da Ecosopis. Transmite saúde, natureza e ciência botânica.",
        emoji: "🌿",
        primary: "#4B8411",
        primaryDark: "#3a660d",
        bg: "#fdfcf9",
        accent: "#c8e6a0",
        tags: ["Padrão", "Verde", "Natural"],
        features: ["Cores da marca", "Design limpo", "Foco em conversão"],
    },
    {
        id: "valentines_day",
        name: "Dia dos Namorados",
        description: "Tema romântico em tons de rosa e vermelho. Perfeito para campanhas de Dia dos Namorados.",
        emoji: "💕",
        primary: "#e63f6f",
        primaryDark: "#c0294f",
        bg: "#fff5f7",
        accent: "#ffd1dc",
        tags: ["Sazonal", "Rosa", "Romântico"],
        features: ["Cores rosa vibrante", "Animação de corações nos botões", "Fundo rosado suave"],
    },
];

export default function AdminTemas() {
    const { activeTheme, setActiveTheme } = useTheme();
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [currentTheme, setCurrentTheme] = useState<ThemeId>(activeTheme);

    useEffect(() => {
        setCurrentTheme(activeTheme);
    }, [activeTheme]);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleActivate = async (themeId: ThemeId) => {
        if (themeId === currentTheme) return;
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ active_theme: themeId }),
            });
            if (res.ok) {
                setCurrentTheme(themeId);
                setActiveTheme(themeId);
                showToast(
                    themeId === "default"
                        ? "✅ Tema padrão restaurado com sucesso!"
                        : `✅ Tema "${THEME_DEFINITIONS.find(t => t.id === themeId)?.name}" ativado!`,
                    "success"
                );
            } else {
                showToast("❌ Erro ao salvar tema. Tente novamente.", "error");
            }
        } catch {
            showToast("❌ Erro de conexão.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.dashboard} style={{ height: "100vh", overflow: "hidden", display: "flex" }}>
            <AdminSidebar activePath="/admin/temas" />

            <main className={styles.mainContent} style={{ flex: 1, overflowY: "auto" }}>
                <header className={styles.header}>
                    <h1>🎨 Temas do Site</h1>
                </header>

                {/* Toast notification */}
                {toast && (
                    <div style={{
                        position: "fixed",
                        top: "24px",
                        right: "24px",
                        background: toast.type === "success" ? "#1a7f3c" : "#c0392b",
                        color: "white",
                        padding: "14px 22px",
                        borderRadius: "12px",
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        zIndex: 9999,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                        animation: "slideInRight 0.3s ease",
                    }}>
                        {toast.msg}
                    </div>
                )}

                <div style={{ padding: "2rem" }}>
                    {/* Info banner */}
                    <div style={{
                        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                        border: "1px solid #bae6fd",
                        borderRadius: "12px",
                        padding: "1rem 1.5rem",
                        marginBottom: "2rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "0.9rem",
                        color: "#075985",
                    }}>
                        <span style={{ fontSize: "1.4rem" }}>ℹ️</span>
                        <div>
                            <strong>Como funciona:</strong> Ative um tema para mudar instantaneamente as cores do site para todos os visitantes.
                            Quando desativado, o site retorna ao visual padrão da Ecosopis.
                            Tema atual: <strong>{THEME_DEFINITIONS.find(t => t.id === currentTheme)?.name}</strong>
                        </div>
                    </div>

                    {/* Theme cards grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                        gap: "1.5rem",
                    }}>
                        {THEME_DEFINITIONS.map((theme) => {
                            const isActive = currentTheme === theme.id;
                            return (
                                <div
                                    key={theme.id}
                                    style={{
                                        background: "white",
                                        borderRadius: "20px",
                                        overflow: "hidden",
                                        border: isActive
                                            ? `2.5px solid ${theme.primary}`
                                            : "2px solid #f0f0f0",
                                        boxShadow: isActive
                                            ? `0 8px 30px ${theme.primary}33`
                                            : "0 2px 12px rgba(0,0,0,0.06)",
                                        transition: "all 0.3s ease",
                                        position: "relative",
                                    }}
                                >
                                    {/* Active badge */}
                                    {isActive && (
                                        <div style={{
                                            position: "absolute",
                                            top: "14px",
                                            right: "14px",
                                            background: theme.primary,
                                            color: "white",
                                            fontSize: "0.7rem",
                                            fontWeight: 700,
                                            padding: "4px 10px",
                                            borderRadius: "20px",
                                            letterSpacing: "0.5px",
                                            textTransform: "uppercase",
                                            zIndex: 2,
                                        }}>
                                            ✓ ATIVO
                                        </div>
                                    )}

                                    {/* Color preview bar */}
                                    <div style={{
                                        height: "110px",
                                        background: theme.bg,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "12px",
                                        position: "relative",
                                        overflow: "hidden",
                                    }}>
                                        {/* Decorative background circles */}
                                        <div style={{
                                            position: "absolute",
                                            width: "160px",
                                            height: "160px",
                                            borderRadius: "50%",
                                            background: theme.accent,
                                            opacity: 0.4,
                                            top: "-40px",
                                            left: "-40px",
                                        }} />
                                        <div style={{
                                            position: "absolute",
                                            width: "100px",
                                            height: "100px",
                                            borderRadius: "50%",
                                            background: theme.primary,
                                            opacity: 0.15,
                                            bottom: "-30px",
                                            right: "-20px",
                                        }} />

                                        {/* Color swatches */}
                                        <div style={{ display: "flex", gap: "8px", alignItems: "center", zIndex: 1 }}>
                                            {[theme.primary, theme.primaryDark, theme.bg, theme.accent].map((color, i) => (
                                                <div
                                                    key={i}
                                                    title={color}
                                                    style={{
                                                        width: i === 0 ? "52px" : "36px",
                                                        height: i === 0 ? "52px" : "36px",
                                                        borderRadius: "50%",
                                                        background: color,
                                                        border: "3px solid white",
                                                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                                                        transition: "transform 0.2s",
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {/* Big emoji */}
                                        <div style={{
                                            fontSize: "2.5rem",
                                            position: "absolute",
                                            right: "20px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            zIndex: 1,
                                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                                        }}>
                                            {theme.emoji}
                                        </div>
                                    </div>

                                    {/* Card content */}
                                    <div style={{ padding: "1.25rem 1.5rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
                                                {theme.name}
                                            </h3>
                                        </div>

                                        <p style={{
                                            fontSize: "0.85rem",
                                            color: "#666",
                                            lineHeight: 1.5,
                                            marginBottom: "1rem",
                                        }}>
                                            {theme.description}
                                        </p>

                                        {/* Tags */}
                                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "1rem" }}>
                                            {theme.tags.map(tag => (
                                                <span key={tag} style={{
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600,
                                                    padding: "3px 10px",
                                                    borderRadius: "20px",
                                                    background: `${theme.primary}18`,
                                                    color: theme.primaryDark,
                                                    border: `1px solid ${theme.primary}30`,
                                                }}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Features list */}
                                        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.25rem 0" }}>
                                            {theme.features.map(f => (
                                                <li key={f} style={{
                                                    fontSize: "0.82rem",
                                                    color: "#444",
                                                    padding: "3px 0",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "7px",
                                                }}>
                                                    <span style={{ color: theme.primary, fontWeight: 700 }}>✓</span>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>

                                        {/* Action button */}
                                        {isActive ? (
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "8px",
                                                padding: "0.75rem",
                                                borderRadius: "10px",
                                                background: `${theme.primary}12`,
                                                border: `1.5px solid ${theme.primary}40`,
                                                color: theme.primaryDark,
                                                fontWeight: 700,
                                                fontSize: "0.88rem",
                                            }}>
                                                <span>✓</span> Tema Ativo
                                                {theme.id !== "default" && (
                                                    <button
                                                        onClick={() => handleActivate("default")}
                                                        disabled={saving}
                                                        style={{
                                                            marginLeft: "auto",
                                                            background: "none",
                                                            border: "1.5px solid #999",
                                                            borderRadius: "8px",
                                                            padding: "4px 12px",
                                                            fontSize: "0.78rem",
                                                            cursor: "pointer",
                                                            color: "#555",
                                                            fontWeight: 600,
                                                            transition: "all 0.2s",
                                                        }}
                                                    >
                                                        {saving ? "..." : "Desativar"}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleActivate(theme.id)}
                                                disabled={saving}
                                                style={{
                                                    width: "100%",
                                                    padding: "0.75rem",
                                                    borderRadius: "10px",
                                                    border: "none",
                                                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
                                                    color: "white",
                                                    fontWeight: 700,
                                                    fontSize: "0.9rem",
                                                    cursor: saving ? "not-allowed" : "pointer",
                                                    opacity: saving ? 0.7 : 1,
                                                    transition: "all 0.2s",
                                                    boxShadow: `0 4px 14px ${theme.primary}44`,
                                                }}
                                            >
                                                {saving ? "Salvando..." : `${theme.emoji} Ativar ${theme.name}`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Preview section */}
                    <div style={{
                        marginTop: "2.5rem",
                        background: "white",
                        borderRadius: "16px",
                        padding: "1.5rem",
                        border: "1px solid #f0f0f0",
                    }}>
                        <h3 style={{ fontWeight: 700, marginBottom: "1rem", color: "#1a1a1a" }}>
                            🔍 Preview do Tema Atual
                        </h3>
                        {(() => {
                            const theme = THEME_DEFINITIONS.find(t => t.id === currentTheme)!;
                            return (
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                                    <div style={{
                                        padding: "0.6rem 1.5rem",
                                        borderRadius: "8px",
                                        background: theme.primary,
                                        color: "white",
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                    }}>
                                        Botão Principal
                                    </div>
                                    <div style={{
                                        padding: "0.6rem 1.5rem",
                                        borderRadius: "8px",
                                        border: `2px solid ${theme.primary}`,
                                        color: theme.primary,
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                        background: "transparent",
                                    }}>
                                        Botão Outline
                                    </div>
                                    <div style={{
                                        padding: "0.5rem 1rem",
                                        borderRadius: "20px",
                                        background: theme.accent,
                                        color: theme.primaryDark,
                                        fontWeight: 600,
                                        fontSize: "0.8rem",
                                    }}>
                                        Badge / Tag
                                    </div>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "0.5rem 1rem",
                                        borderRadius: "8px",
                                        background: theme.bg,
                                        border: "1px solid #e0e0e0",
                                        fontSize: "0.85rem",
                                        color: "#333",
                                    }}>
                                        <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: theme.bg, border: "1px solid #ccc" }} />
                                        Fundo: <strong>{theme.bg}</strong>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <style>{`
                    @keyframes slideInRight {
                        from { opacity: 0; transform: translateX(40px); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                `}</style>
            </main>
        </div>
    );
}
