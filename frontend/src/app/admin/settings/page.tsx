"use client";
import { useEffect, useState } from "react";
import styles from "../dashboard/dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function AdminSettings() {
    const [settings, setSettings] = useState<any>({ PIX_KEY: "", bolao_discount_percentage: "10" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const apiUrl = "/api";
                const res = await fetch(`${apiUrl}/settings`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings((prev: any) => ({ ...prev, ...data }));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const apiUrl = "/api";
            const res = await fetch(`${apiUrl}/settings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                showToast("✅ Configurações salvas com sucesso!", "success");
            } else {
                showToast("❌ Erro ao salvar configurações.", "error");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast("❌ Erro de conexão.", "error");
        } finally {
            setSaving(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "0.75rem",
        marginTop: "0.5rem",
        border: "1.5px solid #e0e0e0",
        borderRadius: "10px",
        fontSize: "0.95rem",
        outline: "none",
        transition: "border-color 0.2s",
        fontFamily: "inherit"
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        fontWeight: 600,
        fontSize: "0.9rem",
        color: "#444",
        marginBottom: "0.25rem"
    };

    return (
        <div className={styles.dashboard} style={{ height: "100vh", overflow: "hidden", display: "flex" }}>
            <AdminSidebar activePath="/admin/settings" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: "auto" }}>
                <header className={styles.header}>
                    <h1>⚙️ Configurações do Sistema</h1>
                </header>

                {/* Toast */}
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
                    }}>
                        {toast.msg}
                    </div>
                )}

                {loading ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#888" }}>Carregando configurações...</div>
                ) : (
                    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "680px" }}>

                        {/* Payment Settings */}
                        <div style={{ background: "white", padding: "1.75rem", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" }}>
                            <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1a1a1a", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                💳 Configurações de Pagamento
                            </h3>
                            <div>
                                <label style={labelStyle}>Chave PIX (E-mail, CPF, Celular ou Chave Aleatória)</label>
                                <input
                                    type="text"
                                    value={settings.PIX_KEY || ""}
                                    onChange={(e) => setSettings({ ...settings, PIX_KEY: e.target.value })}
                                    placeholder="Insira sua chave PIX"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Bolão Settings */}
                        <div style={{ background: "white", padding: "1.75rem", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" }}>
                            <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1a1a1a", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                ⚽ Configurações do Bolão Copa
                            </h3>
                            <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                                Defina o percentual de desconto que os clientes ganharão ao acertar o placar de um jogo do Brasil no Bolão Copa 2026.
                            </p>
                            <div>
                                <label style={labelStyle}>Desconto para quem acertar o placar (%)</label>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "0.5rem" }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={settings.bolao_discount_percentage || "10"}
                                        onChange={(e) => setSettings({ ...settings, bolao_discount_percentage: e.target.value })}
                                        style={{ ...inputStyle, maxWidth: "120px", marginTop: 0 }}
                                    />
                                    <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#107c41" }}>%</span>
                                    <span style={{ fontSize: "0.82rem", color: "#888" }}>
                                        Ex: 10 = cupom de 10% de desconto para quem acertar
                                    </span>
                                </div>
                                <div style={{
                                    marginTop: "1rem",
                                    padding: "0.75rem 1rem",
                                    background: "rgba(16, 124, 65, 0.07)",
                                    borderRadius: "10px",
                                    fontSize: "0.83rem",
                                    color: "#0a522b",
                                    border: "1px solid rgba(16, 124, 65, 0.15)"
                                }}>
                                    ℹ️ O cupom gerado terá validade de <strong>30 dias</strong> e será aplicado automaticamente na conta do cliente que acertar.
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            className="btn-primary"
                            style={{ alignSelf: "flex-start", padding: "0.85rem 2.5rem", fontSize: "1rem", fontWeight: 700 }}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Salvando..." : "💾 Salvar Configurações"}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
