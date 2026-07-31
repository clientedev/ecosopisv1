"use client";

import { useState, useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "./raspadinha.module.css";
import dashboardStyles from "../dashboard.module.css";
import { Save, Ticket, Sparkles, History, CheckCircle2, AlertCircle } from "lucide-react";

interface ScratchSettings {
  id?: number;
  enabled: boolean;
  reward_type: string;
  reward_value: number;
  coupon_prefix: string;
  coupon_valid_days: number;
  message: string;
}

interface ScratchRewardHistory {
  id: number;
  user_id: number;
  reward_type: string;
  reward_value: number;
  coupon_code: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  user?: {
    full_name?: string;
    email: string;
  };
}

export default function AdminRaspadinhaPage() {
  const [settings, setSettings] = useState<ScratchSettings>({
    enabled: true,
    reward_type: "percentage",
    reward_value: 10,
    coupon_prefix: "BEMVINDO",
    coupon_valid_days: 30,
    message: "Parabéns! Você ganhou 10% de desconto."
  });

  const [history, setHistory] = useState<ScratchRewardHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const [configRes, historyRes] = await Promise.all([
        fetch("/api/admin/raspadinha/config", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/admin/raspadinha/history", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setSettings(configData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
    } catch (err) {
      console.error("Error fetching scratchcard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: "", text: "" });
    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/admin/raspadinha/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setFeedback({ type: "success", text: "Configurações da Raspadinha salvas com sucesso!" });
      } else {
        const errorData = await res.json().catch(() => ({}));
        setFeedback({ type: "error", text: errorData.detail || "Erro ao salvar configurações." });
      }
    } catch (err) {
      setFeedback({ type: "error", text: "Erro de conexão com o servidor." });
    } finally {
      setSaving(false);
    }
  };

  const formatRewardTypeLabel = (type: string) => {
    switch (type) {
      case "percentage": return "Desconto %";
      case "fixed": return "Valor Fixo (R$)";
      case "free_shipping": return "Frete Grátis";
      default: return type;
    }
  };

  const formatRewardValueDisplay = (type: string, value: number) => {
    if (type === "percentage") return `${value}%`;
    if (type === "fixed") return `R$ ${value.toFixed(2)}`;
    if (type === "free_shipping") return "Frete Grátis";
    return value;
  };

  return (
    <div className={dashboardStyles.dashboard} style={{ height: "100vh", overflow: "hidden", display: "flex" }}>
      <AdminSidebar activePath="/admin/dashboard/raspadinha" />
      
      <main className={dashboardStyles.mainContent} style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
        <div className={styles.header}>
          <h1>
            <Sparkles size={28} color="#4a7c59" /> Raspadinha de Boas-vindas
          </h1>
          <p>Configure o benefício concedido no primeiro cadastro de novos usuários.</p>
        </div>

        {feedback.text && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "10px",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              backgroundColor: feedback.type === "success" ? "#dcfce7" : "#fee2e2",
              color: feedback.type === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`
            }}
          >
            {feedback.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {feedback.text}
          </div>
        )}

        <div className={styles.grid}>
          {/* Form Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <Ticket size={22} color="#4a7c59" /> Configurações do Prêmio
            </h2>

            <form onSubmit={handleSave}>
              <div className={styles.switchGroup}>
                <div className={styles.switchInfo}>
                  <strong>Raspadinha Ativada</strong>
                  <small>Exibe o modal automaticamente no primeiro acesso de novos usuários</small>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Tipo do Prêmio</label>
                <select
                  className={styles.select}
                  value={settings.reward_type}
                  onChange={(e) => setSettings({ ...settings, reward_type: e.target.value })}
                >
                  <option value="percentage">Desconto em %</option>
                  <option value="fixed">Valor Fixo (R$)</option>
                  <option value="free_shipping">Frete Grátis</option>
                </select>
              </div>

              {settings.reward_type !== "free_shipping" && (
                <div className={styles.formGroup}>
                  <label>
                    Valor do Prêmio {settings.reward_type === "percentage" ? "(%)" : "(R$)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={styles.input}
                    value={settings.reward_value}
                    onChange={(e) => setSettings({ ...settings, reward_value: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Prefixo do Cupom</label>
                <input
                  type="text"
                  className={styles.input}
                  value={settings.coupon_prefix}
                  onChange={(e) => setSettings({ ...settings, coupon_prefix: e.target.value.toUpperCase() })}
                  placeholder="Ex: BEMVINDO"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Validade em Dias</label>
                <input
                  type="number"
                  min="1"
                  className={styles.input}
                  value={settings.coupon_valid_days}
                  onChange={(e) => setSettings({ ...settings, coupon_valid_days: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Mensagem Exibida ao Revelar</label>
                <textarea
                  rows={3}
                  className={styles.textarea}
                  value={settings.message}
                  onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                  placeholder='Ex: "Parabéns! Você ganhou 10% de desconto."'
                  required
                />
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Save size={18} />
                {saving ? "Salvando..." : "Salvar Configurações"}
              </button>
            </form>
          </div>

          {/* History Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <History size={22} color="#4a7c59" /> Histórico de Resgates ({history.length})
            </h2>

            {loading ? (
              <p style={{ color: "#64748b" }}>Carregando histórico...</p>
            ) : history.length === 0 ? (
              <p style={{ color: "#64748b" }}>Nenhum cupom de raspadinha resgatado ainda.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Cupom</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.user?.full_name || "Usuário"}</strong>
                          <br />
                          <small style={{ color: "#64748b" }}>{item.user?.email}</small>
                        </td>
                        <td>
                          <span className={styles.typeBadge}>
                            {formatRewardTypeLabel(item.reward_type)}
                          </span>
                        </td>
                        <td>{formatRewardValueDisplay(item.reward_type, item.reward_value)}</td>
                        <td>
                          <span className={styles.codeBadge}>{item.coupon_code}</span>
                        </td>
                        <td>
                          {new Date(item.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric"
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
