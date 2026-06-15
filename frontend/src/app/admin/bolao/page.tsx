"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { Users, Trophy, ChevronDown, ChevronUp, Plus, RefreshCw, AlertTriangle } from "lucide-react";

const getCountryFlagEmoji = (name: string): string => {
    if (!name) return "🏳️";
    const normalized = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const flagMap: Record<string, string> = {
        brasil: "🇧🇷",
        brazil: "🇧🇷",
        alemanha: "🇩🇪",
        germany: "🇩🇪",
        argentina: "🇦🇷",
        franca: "🇫🇷",
        france: "🇫🇷",
        italia: "🇮🇹",
        italy: "🇮🇹",
        espanha: "🇪🇸",
        spain: "🇪🇸",
        inglaterra: "🇬🇧",
        england: "🇬🇧",
        belgica: "🇧🇪",
        belgium: "🇧🇪",
        holanda: "🇳🇱",
        netherlands: "🇳🇱",
        "paises baixos": "🇳🇱",
        portugal: "🇵🇹",
        uruguai: "🇺🇾",
        uruguay: "🇺🇾",
        croacia: "🇭🇷",
        croatia: "🇭🇷",
        japao: "🇯🇵",
        japan: "🇯🇵",
        marrocos: "🇲🇦",
        morocco: "🇲🇦",
        senegal: "🇸🇳",
        "estados unidos": "🇺🇸",
        usa: "🇺🇸",
        eua: "🇺🇸",
        mexico: "🇲🇽",
        canada: "🇨🇦",
        colombia: "🇨🇴",
        chile: "🇨🇱",
        equador: "🇪🇨",
        ecuador: "🇪🇨",
        paraguai: "🇵🇾",
        paraguay: "🇵🇾",
        peru: "🇵🇪",
        venezuela: "🇻🇪",
        bolivia: "🇧🇴",
        "costa rica": "🇨🇷",
        camaroes: "🇨🇲",
        cameroon: "🇨🇲",
        gana: "🇬🇭",
        ghana: "🇬🇭",
        suica: "🇨🇭",
        switzerland: "🇨🇭",
        "coreia do sul": "🇰🇷",
        "south korea": "🇰🇷",
        coreia: "🇰🇷",
        "arabia saudita": "🇸🇦",
        "saudi arabia": "🇸🇦",
        polonia: "🇵🇱",
        poland: "🇵🇱",
        suecia: "🇸🇪",
        sweden: "🇸🇪",
        dinamarca: "🇩🇰",
        denmark: "🇩🇰",
        australia: "🇦🇺",
        servia: "🇷🇸",
        serbia: "🇷🇸",
        tunisia: "🇹🇳",
        ira: "🇮🇷",
        iran: "🇮🇷",
        gales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
        wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
        ucrania: "🇺🇦",
        ukraine: "🇺🇦",
        turquia: "🇹🇷",
        turkey: "🇹🇷",
        austria: "🇦🇹",
        grecia: "🇬🇷",
        greece: "🇬🇷",
        egito: "🇪🇬",
        egypt: "🇪🇬",
        nigeria: "🇳🇬",
        china: "🇨🇳",
        russia: "🇷🇺",
        catar: "🇶🇦",
        qatar: "🇶🇦",
    };
    return flagMap[normalized] || "🏳️";
};

export default function AdminBolao() {
    const router = useRouter();
    const [matches, setMatches] = useState<any[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(true);
    const [matchScores, setMatchScores] = useState<Record<number, { score_a: string; score_b: string }>>({});
    const [matchFeedback, setMatchFeedback] = useState<Record<number, string>>({});
    const [modalActionLoading, setModalActionLoading] = useState<number | null>(null);
    const [expandedGuesses, setExpandedGuesses] = useState<Record<number, boolean>>({});
    const [guesses, setGuesses] = useState<Record<number, any[]>>({});
    const [loadingGuesses, setLoadingGuesses] = useState<Record<number, boolean>>({});
    const [isAddingMatch, setIsAddingMatch] = useState(false);
    const [newMatch, setNewMatch] = useState({ team_b: "", stadium: "", match_time: "", is_unlocked: false });
    const [addingLoading, setAddingLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [editingMatch, setEditingMatch] = useState<any | null>(null);
    const [discountPct, setDiscountPct] = useState<number>(10);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const getToken = () => {
        if (typeof window !== "undefined") return localStorage.getItem("token");
        return null;
    };

    const fetchMatches = async () => {
        setLoadingMatches(true);
        try {
            const token = getToken();
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
            } else if (res.status === 401) {
                router.push("/admin");
            }
        } catch (err) {
            console.error("Error fetching matches:", err);
        } finally {
            setLoadingMatches(false);
        }
    };

    const fetchDiscount = async () => {
        try {
            const res = await fetch("/api/world-cup/config");
            if (res.ok) {
                const data = await res.json();
                setDiscountPct(data.bolao_discount_percentage || 10);
            }
        } catch {}
    };

    useEffect(() => {
        const token = getToken();
        if (!token) { router.push("/admin"); return; }
        fetchMatches();
        fetchDiscount();
    }, []);

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
            const token = getToken();
            const res = await fetch(`/api/world-cup/matches/${matchId}/finalize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ score_a, score_b })
            });
            if (res.ok) {
                showToast("✅ Jogo finalizado! Cupons gerados para quem acertou.", "success");
                setMatchFeedback(prev => ({ ...prev, [matchId]: "✓ Finalizado! Cupons gerados." }));
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

    const handleUnlockMatch = async (matchId: number, unlock: boolean) => {
        const token = getToken();
        try {
            const res = await fetch(`/api/world-cup/matches/${matchId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ is_unlocked: unlock })
            });
            if (res.ok) {
                showToast(unlock ? "🔓 Jogo liberado para palpites!" : "🔒 Jogo bloqueado.", unlock ? "success" : "error");
                fetchMatches();
            }
        } catch { showToast("Erro de conexão.", "error"); }
    };

    const handleDeleteMatch = async (matchId: number) => {
        if (!confirm("Tem certeza que deseja excluir este jogo e todos os palpites?")) return;
        const token = getToken();
        try {
            const res = await fetch(`/api/world-cup/matches/${matchId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                showToast("Jogo excluído.", "success");
                fetchMatches();
            }
        } catch { showToast("Erro de conexão.", "error"); }
    };

    const handleResetSystem = async () => {
        if (!confirm("Resetar TODOS os palpites e resultados da Copa? Esta ação não pode ser desfeita.")) return;
        setModalActionLoading(-1);
        try {
            const token = getToken();
            const res = await fetch("/api/world-cup/matches/reset", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                showToast("Sistema de palpites resetado!", "success");
                fetchMatches();
            } else {
                showToast("Erro ao resetar.", "error");
            }
        } catch { showToast("Erro de conexão.", "error"); }
        finally { setModalActionLoading(null); }
    };

    const handleAddMatch = async () => {
        if (!newMatch.team_b.trim() || !newMatch.match_time) {
            showToast("Preencha o adversário e a data/hora do jogo.", "error");
            return;
        }
        setAddingLoading(true);
        try {
            const token = getToken();
            const res = await fetch("/api/world-cup/matches", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    team_a: "Brasil",
                    team_b: newMatch.team_b,
                    stadium: newMatch.stadium || null,
                    match_time: new Date(newMatch.match_time).toISOString(),
                    is_unlocked: newMatch.is_unlocked
                })
            });
            if (res.ok) {
                showToast("✅ Jogo adicionado com sucesso!", "success");
                setIsAddingMatch(false);
                setNewMatch({ team_b: "", stadium: "", match_time: "", is_unlocked: false });
                fetchMatches();
            } else {
                const err = await res.json();
                showToast(`Erro: ${err.detail || "tente novamente"}`, "error");
            }
        } catch { showToast("Erro de conexão.", "error"); }
        finally { setAddingLoading(false); }
    };

    const handleUpdateMatch = async () => {
        if (!editingMatch) return;
        const token = getToken();
        try {
            const res = await fetch(`/api/world-cup/matches/${editingMatch.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    team_b: editingMatch.team_b,
                    stadium: editingMatch.stadium,
                    match_time: new Date(editingMatch.match_time_local).toISOString()
                })
            });
            if (res.ok) {
                showToast("✅ Jogo atualizado!", "success");
                setEditingMatch(null);
                fetchMatches();
            } else {
                showToast("Erro ao atualizar jogo.", "error");
            }
        } catch { showToast("Erro de conexão.", "error"); }
    };

    const fetchGuesses = async (matchId: number) => {
        setLoadingGuesses(prev => ({ ...prev, [matchId]: true }));
        try {
            const token = getToken();
            const res = await fetch(`/api/world-cup/matches/${matchId}/guesses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setGuesses(prev => ({ ...prev, [matchId]: data }));
            }
        } catch {}
        finally { setLoadingGuesses(prev => ({ ...prev, [matchId]: false })); }
    };

    const toggleGuesses = (matchId: number) => {
        const isExpanded = !expandedGuesses[matchId];
        setExpandedGuesses(prev => ({ ...prev, [matchId]: isExpanded }));
        if (isExpanded && !guesses[matchId]) {
            fetchGuesses(matchId);
        }
    };

    const inputStyle: React.CSSProperties = {
        padding: "0.6rem 0.9rem",
        borderRadius: "8px",
        border: "1.5px solid #e0e0e0",
        fontSize: "0.9rem",
        outline: "none",
        fontFamily: "inherit",
        width: "100%"
    };

    return (
        <div className={styles.dashboard} style={{ height: "100vh", overflow: "hidden", display: "flex" }}>
            <AdminSidebar activePath="/admin/bolao" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: "auto" }}>
                <header className={styles.header}>
                    <div>
                        <h1>⚽ Gerenciar Bolão Copa 2026</h1>
                        <p style={{ fontSize: "0.85rem", color: "#888", marginTop: "4px" }}>
                            Adicione jogos, defina placares e veja quem acertou. Desconto atual dos cupons: <strong style={{ color: "#107c41" }}>{discountPct}%</strong>
                            <a href="/admin/settings" style={{ marginLeft: "8px", fontSize: "0.8rem", color: "#107c41", textDecoration: "underline" }}>Alterar</a>
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={() => setIsAddingMatch(true)}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                background: "#107c41", color: "white",
                                border: "none", borderRadius: "10px",
                                padding: "0.65rem 1.2rem", fontWeight: 700,
                                fontSize: "0.88rem", cursor: "pointer"
                            }}
                        >
                            <Plus size={16} /> Adicionar Jogo
                        </button>
                        <button
                            onClick={fetchMatches}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                background: "white", color: "#444",
                                border: "1.5px solid #e0e0e0", borderRadius: "10px",
                                padding: "0.65rem 1rem", cursor: "pointer"
                            }}
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </header>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: "fixed", top: "24px", right: "24px",
                        background: toast.type === "success" ? "#1a7f3c" : "#c0392b",
                        color: "white", padding: "14px 22px", borderRadius: "12px",
                        fontWeight: 600, fontSize: "0.95rem", zIndex: 9999,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.18)"
                    }}>
                        {toast.msg}
                    </div>
                )}

                <div style={{ padding: "1.5rem 2rem" }}>
                    {/* Danger Zone */}
                    <div style={{ marginBottom: "1.5rem", padding: "0.9rem 1.25rem", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "#991b1b" }}>
                            <AlertTriangle size={16} />
                            <span><strong>Zona de perigo:</strong> Resetar irá apagar todos os palpites e resultados de todos os jogos.</span>
                        </div>
                        <button
                            onClick={handleResetSystem}
                            disabled={modalActionLoading === -1}
                            style={{
                                background: "#dc2626", color: "white", border: "none",
                                borderRadius: "8px", padding: "6px 14px", fontSize: "0.8rem",
                                fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
                            }}
                        >
                            {modalActionLoading === -1 ? "Resetando..." : "Resetar Tudo"}
                        </button>
                    </div>

                    {/* Add Match Form */}
                    {isAddingMatch && (
                        <div style={{ background: "white", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "2px solid #107c41", boxShadow: "0 4px 20px rgba(16,124,65,0.1)" }}>
                            <h3 style={{ fontWeight: 700, marginBottom: "1rem", color: "#107c41" }}>➕ Novo Jogo</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555" }}>Adversário *</label>
                                    <input
                                        type="text" placeholder="Ex: Alemanha"
                                        value={newMatch.team_b}
                                        onChange={e => setNewMatch(prev => ({ ...prev, team_b: e.target.value }))}
                                        style={{ ...inputStyle, marginTop: "4px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555" }}>Estádio</label>
                                    <input
                                        type="text" placeholder="Ex: Estádio Nacional"
                                        value={newMatch.stadium}
                                        onChange={e => setNewMatch(prev => ({ ...prev, stadium: e.target.value }))}
                                        style={{ ...inputStyle, marginTop: "4px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555" }}>Data e Hora *</label>
                                    <input
                                        type="datetime-local"
                                        value={newMatch.match_time}
                                        onChange={e => setNewMatch(prev => ({ ...prev, match_time: e.target.value }))}
                                        style={{ ...inputStyle, marginTop: "4px" }}
                                    />
                                </div>
                                <div style={{ display: "flex", alignItems: "flex-end" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", fontWeight: 600, color: "#555", cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={newMatch.is_unlocked}
                                            onChange={e => setNewMatch(prev => ({ ...prev, is_unlocked: e.target.checked }))}
                                        />
                                        Liberar palpites agora
                                    </label>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                                <button
                                    onClick={handleAddMatch}
                                    disabled={addingLoading}
                                    style={{ background: "#107c41", color: "white", border: "none", borderRadius: "8px", padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}
                                >
                                    {addingLoading ? "Salvando..." : "Salvar Jogo"}
                                </button>
                                <button
                                    onClick={() => setIsAddingMatch(false)}
                                    style={{ background: "none", color: "#666", border: "1.5px solid #e0e0e0", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {loadingMatches ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#888" }}>Carregando jogos...</div>
                    ) : matches.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#888" }}>
                            <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Nenhum jogo cadastrado.</p>
                            <button onClick={() => setIsAddingMatch(true)} style={{ background: "#107c41", color: "white", border: "none", borderRadius: "10px", padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>
                                + Adicionar Primeiro Jogo
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {matches.map((match) => {
                                const score = matchScores[match.id] || { score_a: "", score_b: "" };
                                const feedback = matchFeedback[match.id];
                                const isLoading = modalActionLoading === match.id;
                                const isExpanded = expandedGuesses[match.id];
                                const matchGuesses = guesses[match.id] || [];
                                const isLoadingGuesses = loadingGuesses[match.id];
                                const winners = matchGuesses.filter((g: any) => g.is_correct);

                                const matchDate = new Date(match.match_time);
                                const dateStr = matchDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                                const timeStr = matchDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

                                return (
                                    <div key={match.id} style={{
                                        background: "white",
                                        border: match.is_finalized ? "2px solid #bae6fd" : match.is_unlocked ? "2px solid rgba(16, 124, 65, 0.25)" : "2px solid #f0f0f0",
                                        borderRadius: "16px",
                                        overflow: "hidden",
                                        boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                                    }}>
                                        {/* Match Header */}
                                        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f5f5f5" }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                                                        <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a", margin: 0 }}>
                                                            🇧🇷 Brasil vs {getCountryFlagEmoji(match.team_b)} {match.team_b}
                                                        </h3>
                                                        <span style={{
                                                            fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px",
                                                            borderRadius: "20px", textTransform: "uppercase",
                                                            background: match.is_finalized ? "#bae6fd" : match.is_unlocked ? "#dcfce7" : "#f1f5f9",
                                                            color: match.is_finalized ? "#0369a1" : match.is_unlocked ? "#15803d" : "#6c757d"
                                                        }}>
                                                            {match.is_finalized ? "✓ Finalizado" : match.is_unlocked ? "Aberto" : "🔒 Bloqueado"}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: "0.8rem", color: "#888" }}>
                                                        📅 {dateStr} às {timeStr}h
                                                        {match.stadium && ` · 📍 ${match.stadium}`}
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                    {!match.is_finalized && (
                                                        <button
                                                            onClick={() => handleUnlockMatch(match.id, !match.is_unlocked)}
                                                            style={{
                                                                background: match.is_unlocked ? "#fef3c7" : "#dcfce7",
                                                                color: match.is_unlocked ? "#b45309" : "#15803d",
                                                                border: "none", borderRadius: "8px",
                                                                padding: "5px 12px", fontSize: "0.78rem",
                                                                fontWeight: 700, cursor: "pointer"
                                                            }}
                                                        >
                                                            {match.is_unlocked ? "🔒 Bloquear" : "🔓 Liberar"}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setEditingMatch({ ...match, match_time_local: new Date(match.match_time).toISOString().slice(0, 16) })}
                                                        style={{ background: "#f0f9ff", color: "#0369a1", border: "none", borderRadius: "8px", padding: "5px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMatch(match.id)}
                                                        style={{ background: "#fff5f5", color: "#dc2626", border: "none", borderRadius: "8px", padding: "5px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score Input & Finalize */}
                                        <div style={{ padding: "1.25rem 1.5rem", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#555" }}>Placar oficial:</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <input
                                                        type="number" min="0" placeholder="0"
                                                        disabled={match.is_finalized || isLoading}
                                                        value={score.score_a}
                                                        onChange={e => setMatchScores(prev => ({ ...prev, [match.id]: { ...score, score_a: e.target.value } }))}
                                                        style={{ width: "55px", padding: "6px 8px", borderRadius: "8px", border: "1.5px solid #ccc", textAlign: "center", fontWeight: 700, fontSize: "1rem" }}
                                                    />
                                                    <span style={{ fontWeight: 700, color: "#aaa" }}>x</span>
                                                    <input
                                                        type="number" min="0" placeholder="0"
                                                        disabled={match.is_finalized || isLoading}
                                                        value={score.score_b}
                                                        onChange={e => setMatchScores(prev => ({ ...prev, [match.id]: { ...score, score_b: e.target.value } }))}
                                                        style={{ width: "55px", padding: "6px 8px", borderRadius: "8px", border: "1.5px solid #ccc", textAlign: "center", fontWeight: 700, fontSize: "1rem" }}
                                                    />
                                                    {!match.is_finalized && (
                                                        <button
                                                            onClick={() => handleFinalizeMatch(match.id)}
                                                            disabled={isLoading}
                                                            style={{ background: "#107c41", color: "white", border: "none", borderRadius: "8px", padding: "7px 16px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                                                        >
                                                            {isLoading ? "Salvando..." : "✅ Salvar Placar"}
                                                        </button>
                                                    )}
                                                </div>
                                                {match.is_finalized && (
                                                    <span style={{ fontSize: "0.82rem", color: "#15803d", fontWeight: 600 }}>
                                                        ✓ Placar confirmado: {match.score_a} x {match.score_b}
                                                    </span>
                                                )}
                                            </div>
                                            {feedback && (
                                                <div style={{ fontSize: "0.8rem", marginTop: "6px", fontWeight: 600, color: feedback.startsWith("✓") ? "#107c41" : "#d32f2f" }}>
                                                    {feedback}
                                                </div>
                                            )}
                                        </div>

                                        {/* Guesses Section */}
                                        <div>
                                            <button
                                                onClick={() => toggleGuesses(match.id)}
                                                style={{ width: "100%", background: "none", border: "none", padding: "0.9rem 1.5rem", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", color: "#555", fontWeight: 600, fontSize: "0.88rem" }}
                                            >
                                                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <Users size={14} />
                                                    Lista de Palpites
                                                    {match.is_finalized && winners.length > 0 && (
                                                        <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                                                            🏆 {winners.length} vencedor{winners.length !== 1 ? "es" : ""}
                                                        </span>
                                                    )}
                                                </span>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>

                                            {isExpanded && (
                                                <div style={{ padding: "0 1.5rem 1.5rem" }}>
                                                    {isLoadingGuesses ? (
                                                        <p style={{ color: "#888", fontSize: "0.85rem" }}>Carregando palpites...</p>
                                                    ) : matchGuesses.length === 0 ? (
                                                        <p style={{ color: "#888", fontSize: "0.85rem" }}>Nenhum palpite enviado ainda.</p>
                                                    ) : (
                                                        <div style={{ overflowX: "auto" }}>
                                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                                                                <thead>
                                                                    <tr style={{ background: "#f8f9fa", borderRadius: "8px" }}>
                                                                        <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#555" }}>Cliente</th>
                                                                        <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#555" }}>Palpite</th>
                                                                        <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#555" }}>Resultado</th>
                                                                        <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#555" }}>Cupom</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {matchGuesses.map((g: any) => (
                                                                        <tr key={g.id} style={{ borderTop: "1px solid #f0f0f0", background: g.is_correct ? "rgba(16,124,65,0.03)" : "white" }}>
                                                                            <td style={{ padding: "8px 12px" }}>
                                                                                <div style={{ fontWeight: 600 }}>{g.user_name || "–"}</div>
                                                                                <div style={{ fontSize: "0.75rem", color: "#888" }}>{g.user_email}</div>
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                                                                                {g.guess_score_a} x {g.guess_score_b}
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                                                                {!g.is_processed ? (
                                                                                    <span style={{ color: "#888" }}>—</span>
                                                                                ) : g.is_correct ? (
                                                                                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: "10px", fontWeight: 700, fontSize: "0.75rem" }}>
                                                                                        🏆 Acertou!
                                                                                    </span>
                                                                                ) : (
                                                                                    <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: "10px", fontWeight: 700, fontSize: "0.75rem" }}>
                                                                                        Errou
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px" }}>
                                                                                {g.reward_coupon_code ? (
                                                                                    <code style={{ background: "#f0fdf4", color: "#107c41", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 700, border: "1px dashed #86efac" }}>
                                                                                        {g.reward_coupon_code}
                                                                                    </code>
                                                                                ) : "–"}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Edit Match Modal */}
            {editingMatch && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
                    <div style={{ background: "white", borderRadius: "20px", padding: "2rem", maxWidth: "500px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                        <h3 style={{ fontWeight: 700, marginBottom: "1.5rem", fontSize: "1.1rem" }}>✏️ Editar Jogo</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555" }}>Adversário</label>
                                <input
                                    type="text"
                                    value={editingMatch.team_b}
                                    onChange={e => setEditingMatch({ ...editingMatch, team_b: e.target.value })}
                                    style={{ ...inputStyle, marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555" }}>Estádio</label>
                                <input
                                    type="text"
                                    value={editingMatch.stadium || ""}
                                    onChange={e => setEditingMatch({ ...editingMatch, stadium: e.target.value })}
                                    style={{ ...inputStyle, marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555" }}>Data e Hora</label>
                                <input
                                    type="datetime-local"
                                    value={editingMatch.match_time_local}
                                    onChange={e => setEditingMatch({ ...editingMatch, match_time_local: e.target.value })}
                                    style={{ ...inputStyle, marginTop: "4px" }}
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginTop: "1.5rem" }}>
                            <button
                                onClick={handleUpdateMatch}
                                style={{ background: "#107c41", color: "white", border: "none", borderRadius: "10px", padding: "10px 24px", fontWeight: 700, cursor: "pointer", flex: 1 }}
                            >
                                Salvar Alterações
                            </button>
                            <button
                                onClick={() => setEditingMatch(null)}
                                style={{ background: "none", color: "#555", border: "1.5px solid #e0e0e0", borderRadius: "10px", padding: "10px 20px", cursor: "pointer" }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
