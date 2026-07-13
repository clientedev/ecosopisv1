"use client";

import { useEffect, useState } from "react";
import styles from "../dashboard/dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { useTheme, ThemeId } from "@/context/ThemeContext";

const getCountryCode = (name: string): string => {
    if (!name) return "un";
    const normalized = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const codeMap: Record<string, string> = {
        brasil: "br",
        brazil: "br",
        alemanha: "de",
        germany: "de",
        argentina: "ar",
        franca: "fr",
        france: "fr",
        italia: "it",
        italy: "it",
        espanha: "es",
        spain: "es",
        inglaterra: "gb",
        england: "gb",
        belgica: "be",
        belgium: "be",
        holanda: "nl",
        netherlands: "nl",
        "paises baixos": "nl",
        portugal: "pt",
        uruguai: "uy",
        uruguay: "uy",
        croacia: "hr",
        croatia: "hr",
        japao: "jp",
        japan: "jp",
        marrocos: "ma",
        morocco: "ma",
        senegal: "sn",
        "estados unidos": "us",
        usa: "us",
        eua: "us",
        mexico: "mx",
        canada: "ca",
        colombia: "co",
        escocia: "gb-sct",
        scotland: "gb-sct",
        chile: "cl",
        equador: "ec",
        ecuador: "ec",
        paraguai: "py",
        paraguay: "py",
        peru: "pe",
        venezuela: "ve",
        bolivia: "bo",
        "costa rica": "cr",
        camaroes: "cm",
        cameroon: "cm",
        gana: "gh",
        ghana: "gh",
        suica: "ch",
        switzerland: "ch",
        "coreia do sul": "kr",
        "south korea": "kr",
        coreia: "kr",
        "arabia saudita": "sa",
        "saudi arabia": "sa",
        polonia: "pl",
        poland: "pl",
        suecia: "se",
        sweden: "se",
        dinamarca: "dk",
        denmark: "dk",
        australia: "au",
        servia: "rs",
        serbia: "rs",
        tunisia: "tn",
        ira: "ir",
        iran: "ir",
        gales: "gb-wls",
        wales: "gb-wls",
        ucrania: "ua",
        ukraine: "ua",
        turquia: "tr",
        turkey: "tr",
        austria: "at",
        grecia: "gr",
        greece: "gr",
        egito: "eg",
        egypt: "eg",
        nigeria: "ng",
        china: "cn",
        russia: "ru",
        catar: "qa",
        qatar: "qa",
    };
    return codeMap[normalized] || "un";
};

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
    {
        id: "copa_do_mundo",
        name: "Copa do Mundo",
        description: "Tema verde, amarelo e azul em comemoração à Copa do Mundo. Torça com bolão de palpites nos jogos do Brasil!",
        emoji: "🇧🇷",
        primary: "#107c41",
        primaryDark: "#0a522b",
        bg: "#fafcf5",
        accent: "#F7C815",
        tags: ["Sazonal", "Esportes", "Copa do Mundo"],
        features: ["Cores verde e amarelo", "Efeitos flutuantes de bandeiras e bolas de futebol", "Palpites com prêmios de descontos"],
    },
    {
        id: "aniversario_4_anos",
        name: "Aniversário Ecosopis - 4 Anos",
        description: "Comemoração especial dos 4 anos da Ecosopis! Visual festivo e sofisticado em tons de dourado e champagne, com animações especiais de confetes e balões.",
        emoji: "🎉",
        primary: "#b8860b",
        primaryDark: "#8b6508",
        bg: "#fffcf4",
        accent: "#f3e1b6",
        tags: ["Sazonal", "Dourado", "Aniversário"],
        features: ["Cores douradas premium", "Animação de balões e confetes festivos", "Design comemorativo de luxo"],
    },
];

export default function AdminTemas() {
    const { activeTheme, setActiveTheme } = useTheme();
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [currentTheme, setCurrentTheme] = useState<ThemeId>(activeTheme);

    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [matchScores, setMatchScores] = useState<Record<number, { score_a: string; score_b: string }>>({});
    const [matchFeedback, setMatchFeedback] = useState<Record<number, string>>({});
    const [modalActionLoading, setModalActionLoading] = useState<number | null>(null);

    const fetchMatches = async () => {
        setLoadingMatches(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/world-cup/matches", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMatches(data);
                const scores: Record<number, { score_a: string; score_b: string }> = {};
                data.forEach((m: any) => {
                    scores[m.id] = {
                        score_a: m.score_a !== null ? String(m.score_a) : "",
                        score_b: m.score_b !== null ? String(m.score_b) : ""
                    };
                });
                setMatchScores(scores);
            }
        } catch (err) {
            console.error("Error fetching matches:", err);
        } finally {
            setLoadingMatches(false);
        }
    };

    useEffect(() => {
        if (isManageModalOpen) {
            fetchMatches();
        }
    }, [isManageModalOpen]);

    const handleFinalizeMatch = async (matchId: number) => {
        const score = matchScores[matchId];
        if (!score || score.score_a === "" || score.score_b === "") {
            setMatchFeedback(prev => ({ ...prev, [matchId]: "Preencha ambos os placares" }));
            return;
        }
        const score_a = parseInt(score.score_a);
        const score_b = parseInt(score.score_b);
        if (isNaN(score_a) || isNaN(score_b)) {
            setMatchFeedback(prev => ({ ...prev, [matchId]: "Valores inválidos" }));
            return;
        }

        setModalActionLoading(matchId);
        setMatchFeedback(prev => ({ ...prev, [matchId]: "" }));
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/world-cup/matches/${matchId}/finalize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ score_a, score_b })
            });
            if (res.ok) {
                setMatchFeedback(prev => ({ ...prev, [matchId]: "✓ Finalizado com sucesso!" }));
                fetchMatches();
            } else {
                const err = await res.json();
                setMatchFeedback(prev => ({ ...prev, [matchId]: `Erro: ${err.detail || "tente novamente"}` }));
            }
        } catch {
            setMatchFeedback(prev => ({ ...prev, [matchId]: "Erro de conexão" }));
        } finally {
            setModalActionLoading(null);
        }
    };

    const handleResetSystem = async () => {
        if (!confirm("Tem certeza que deseja resetar todos os palpites e resultados da Copa?")) return;
        setModalActionLoading(-1);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/world-cup/matches/reset", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                alert("Sistema de palpites resetado!");
                fetchMatches();
            } else {
                alert("Erro ao resetar.");
            }
        } catch {
            alert("Erro de conexão.");
        } finally {
            setModalActionLoading(null);
        }
    };

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
                                                flexDirection: "column",
                                                gap: "8px",
                                                padding: "0.75rem",
                                                borderRadius: "10px",
                                                background: `${theme.primary}12`,
                                                border: `1.5px solid ${theme.primary}40`,
                                                color: theme.primaryDark,
                                                fontWeight: 700,
                                                fontSize: "0.88rem",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
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
                                                {theme.id === "copa_do_mundo" && (
                                                    <button
                                                        onClick={() => setIsManageModalOpen(true)}
                                                        style={{
                                                            width: "100%",
                                                            padding: "0.6rem",
                                                            borderRadius: "8px",
                                                            border: "1.5px solid #002776",
                                                            background: "white",
                                                            color: "#002776",
                                                            fontWeight: 700,
                                                            fontSize: "0.82rem",
                                                            cursor: "pointer",
                                                            transition: "all 0.2s",
                                                        }}
                                                    >
                                                        ⚽ Gerenciar Palpites
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                                                {theme.id === "copa_do_mundo" && (
                                                    <button
                                                        onClick={() => setIsManageModalOpen(true)}
                                                        style={{
                                                            width: "100%",
                                                            padding: "0.6rem",
                                                            borderRadius: "8px",
                                                            border: "1.5px solid #002776",
                                                            background: "white",
                                                            color: "#002776",
                                                            fontWeight: 700,
                                                            fontSize: "0.82rem",
                                                            cursor: "pointer",
                                                            transition: "all 0.2s",
                                                        }}
                                                    >
                                                        ⚽ Gerenciar Palpites
                                                    </button>
                                                )}
                                            </div>
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
                {/* Guesses Management Modal */}
                {isManageModalOpen && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "1rem"
                    }}>
                        <div style={{
                            background: "white",
                            borderRadius: "20px",
                            padding: "2rem",
                            maxWidth: "600px",
                            width: "100%",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                            maxHeight: "90vh",
                            overflowY: "auto",
                            position: "relative"
                        }}>
                            <button
                                onClick={() => setIsManageModalOpen(false)}
                                style={{
                                    position: "absolute",
                                    top: "20px",
                                    right: "20px",
                                    background: "none",
                                    border: "none",
                                    fontSize: "1.5rem",
                                    cursor: "pointer",
                                    color: "#666"
                                }}
                            >
                                ✕
                            </button>

                            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                ⚽ Gerenciar Resultados da Copa
                            </h2>
                            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem" }}>
                                Digite os placares oficiais dos jogos e salve. Isso validará os palpites, gerará os cupons de desconto para quem acertou e liberará o próximo jogo.
                            </p>

                            {loadingMatches ? (
                                <div style={{ textAlign: "center", padding: "2rem" }}>Carregando dados dos jogos...</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                    {matches.map((match) => {
                                        const score = matchScores[match.id] || { score_a: "", score_b: "" };
                                        const feedback = matchFeedback[match.id];
                                        const isLoading = modalActionLoading === match.id;
                                        
                                        return (
                                            <div
                                                key={match.id}
                                                style={{
                                                    background: match.is_unlocked ? "white" : "#f5f5f5",
                                                    border: "1px solid #e0e0e0",
                                                    borderRadius: "12px",
                                                    padding: "1.25rem",
                                                    position: "relative"
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#888" }}>
                                                        Jogo {match.id}
                                                    </span>
                                                    <span style={{
                                                        fontSize: "0.7rem",
                                                        fontWeight: 700,
                                                        color: match.is_finalized ? "#107c41" : match.is_unlocked ? "#d97706" : "#666",
                                                        textTransform: "uppercase"
                                                    }}>
                                                        {match.is_finalized ? "✓ Finalizado" : match.is_unlocked ? "Aberto para placar" : "🔒 Bloqueado"}
                                                    </span>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", fontWeight: 600, color: "#333" }}>
                                                        <img src="https://flagcdn.com/w40/br.png" alt="br" style={{ width: "20px", height: "auto", borderRadius: "2px", boxShadow: "0 1px 2px rgba(0,0,0,0.15)", verticalAlign: "middle" }} />
                                                        <span>Brasil vs {match.team_b}</span>
                                                        <img 
                                                            src={(() => {
                                                                const code = getCountryCode(match.team_b);
                                                                return code.includes("-") 
                                                                    ? `https://flagcdn.com/${code}.svg` 
                                                                    : `https://flagcdn.com/w40/${code}.png`;
                                                            })()} 
                                                            alt={match.team_b} 
                                                            style={{ width: "20px", height: "auto", borderRadius: "2px", boxShadow: "0 1px 2px rgba(0,0,0,0.15)", verticalAlign: "middle" }} 
                                                        />
                                                    </div>

                                                    {match.is_unlocked ? (
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                disabled={match.is_finalized || isLoading}
                                                                value={score.score_a}
                                                                onChange={(e) => setMatchScores(prev => ({
                                                                    ...prev,
                                                                    [match.id]: { ...score, score_a: e.target.value }
                                                                }))}
                                                                style={{
                                                                    width: "45px",
                                                                    padding: "4px",
                                                                    borderRadius: "6px",
                                                                    border: "1px solid #ccc",
                                                                    textAlign: "center",
                                                                    fontWeight: "bold"
                                                                }}
                                                            />
                                                            <span style={{ fontSize: "0.85rem", color: "#666" }}>x</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                disabled={match.is_finalized || isLoading}
                                                                value={score.score_b}
                                                                onChange={(e) => setMatchScores(prev => ({
                                                                    ...prev,
                                                                    [match.id]: { ...score, score_b: e.target.value }
                                                                }))}
                                                                style={{
                                                                    width: "45px",
                                                                    padding: "4px",
                                                                    borderRadius: "6px",
                                                                    border: "1px solid #ccc",
                                                                    textAlign: "center",
                                                                    fontWeight: "bold"
                                                                }}
                                                            />

                                                            {!match.is_finalized && (
                                                                <button
                                                                    onClick={() => handleFinalizeMatch(match.id)}
                                                                    disabled={isLoading}
                                                                    style={{
                                                                        border: "none",
                                                                        background: "#107c41",
                                                                        color: "white",
                                                                        fontWeight: 700,
                                                                        fontSize: "0.78rem",
                                                                        padding: "6px 12px",
                                                                        borderRadius: "6px",
                                                                        cursor: "pointer",
                                                                        transition: "opacity 0.2s"
                                                                    }}
                                                                >
                                                                    {isLoading ? "Salvando" : "Salvar Placar"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: "0.8rem", color: "#666", fontStyle: "italic" }}>
                                                            Aguardando Jogo 1 ser finalizado.
                                                        </div>
                                                    )}
                                                </div>

                                                {feedback && (
                                                    <div style={{
                                                        fontSize: "0.78rem",
                                                        marginTop: "6px",
                                                        fontWeight: 600,
                                                        color: feedback.startsWith("✓") ? "#107c41" : "#d32f2f"
                                                    }}>
                                                        {feedback}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Reset button inside modal */}
                            <div style={{
                                marginTop: "2rem",
                                borderTop: "1px solid #eee",
                                paddingTop: "1rem",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <button
                                    onClick={handleResetSystem}
                                    disabled={modalActionLoading === -1}
                                    style={{
                                        border: "none",
                                        background: "#d32f2f",
                                        color: "white",
                                        padding: "8px 14px",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        borderRadius: "8px",
                                        cursor: "pointer"
                                    }}
                                >
                                    {modalActionLoading === -1 ? "Resetando..." : "Resetar Palpites e Jogos"}
                                </button>

                                <button
                                    onClick={() => setIsManageModalOpen(false)}
                                    style={{
                                        border: "1px solid #ccc",
                                        background: "white",
                                        color: "#333",
                                        padding: "8px 14px",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        borderRadius: "8px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
