"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "./branding.module.css";
import { Palette, Save, RefreshCw, Eye, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/Toast/Toast";

export default function BrandingPage() {
    const [settings, setSettings] = useState<Record<string, string>>({
        primary_color: "#4B8411",
        primary_color_dark: "#3a660d",
        secondary_color: "#ffffff",
        text_primary: "#1a1a1a",
        text_secondary: "#4a4a4a",
        bg_color: "#fdfcf9",
        admin_order_notification_email: "contato@ecosopis.com.br"
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    setSettings(prev => ({
                        ...prev,
                        ...data
                    }));
                }
            } catch (err) {
                console.error("Error fetching settings:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [router]);

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                showToast("Identidade visual atualizada com sucesso!", "success");
                // Refresh to apply changes via DynamicBranding if needed, 
                // but DynamicBranding should pick it up on next load.
                // For immediate effect we could also update :root here but a reload is cleaner for consistency.
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast("Erro ao salvar configurações", "error");
            }
        } catch (err) {
            showToast("Erro de conexão", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleTestEmail = async () => {
        setTestingEmail(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch("/api/settings/test-email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                showToast("E-mail de teste enviado com sucesso!", "success");
            } else {
                const data = await res.json();
                showToast(data.detail || "Erro ao testar e-mail", "error");
            }
        } catch (err) {
            showToast("Erro de conexão", "error");
        } finally {
            setTestingEmail(false);
        }
    };

    if (loading) return <div className={styles.loading}>Carregando configurações...</div>;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
            <AdminSidebar activePath="/admin/dashboard/branding" />
            
            <main style={{ flex: 1, overflowY: 'auto' }}>
                <div className={styles.brandingContainer}>
                    <header className={styles.header}>
                        <h1>Identidade e Configurações</h1>
                        <p>Personalize a identidade visual e as configurações de notificação da sua loja.</p>
                    </header>

                    <div className={styles.section}>
                        <h2><Palette size={20} color="#4B8411" /> Paleta de Cores</h2>
                        
                        <div className={styles.colorGrid}>
                            <div className={styles.colorItem}>
                                <label>Cor Primária (Marca)</label>
                                <div className={styles.inputGroup}>
                                    <input 
                                        type="color" 
                                        value={settings.primary_color} 
                                        onChange={(e) => handleChange("primary_color", e.target.value)}
                                        className={styles.colorPicker}
                                    />
                                    <input 
                                        type="text" 
                                        value={settings.primary_color} 
                                        onChange={(e) => handleChange("primary_color", e.target.value)}
                                        className={styles.hexInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.colorItem}>
                                <label>Cor Primária Escura (Hover)</label>
                                <div className={styles.inputGroup}>
                                    <input 
                                        type="color" 
                                        value={settings.primary_color_dark} 
                                        onChange={(e) => handleChange("primary_color_dark", e.target.value)}
                                        className={styles.colorPicker}
                                    />
                                    <input 
                                        type="text" 
                                        value={settings.primary_color_dark} 
                                        onChange={(e) => handleChange("primary_color_dark", e.target.value)}
                                        className={styles.hexInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.colorItem}>
                                <label>Fundo das Seções (Secundária)</label>
                                <div className={styles.inputGroup}>
                                    <input 
                                        type="color" 
                                        value={settings.secondary_color} 
                                        onChange={(e) => handleChange("secondary_color", e.target.value)}
                                        className={styles.colorPicker}
                                    />
                                    <input 
                                        type="text" 
                                        value={settings.secondary_color} 
                                        onChange={(e) => handleChange("secondary_color", e.target.value)}
                                        className={styles.hexInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.colorItem}>
                                <label>Fundo Geral do Site</label>
                                <div className={styles.inputGroup}>
                                    <input 
                                        type="color" 
                                        value={settings.bg_color} 
                                        onChange={(e) => handleChange("bg_color", e.target.value)}
                                        className={styles.colorPicker}
                                    />
                                    <input 
                                        type="text" 
                                        value={settings.bg_color} 
                                        onChange={(e) => handleChange("bg_color", e.target.value)}
                                        className={styles.hexInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.colorItem}>
                                <label>Cor do Texto Principal</label>
                                <div className={styles.inputGroup}>
                                    <input 
                                        type="color" 
                                        value={settings.text_primary} 
                                        onChange={(e) => handleChange("text_primary", e.target.value)}
                                        className={styles.colorPicker}
                                    />
                                    <input 
                                        type="text" 
                                        value={settings.text_primary} 
                                        onChange={(e) => handleChange("text_primary", e.target.value)}
                                        className={styles.hexInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.colorItem}>
                                <label>Cor do Texto Secundário</label>
                                <div className={styles.inputGroup}>
                                    <input 
                                        type="color" 
                                        value={settings.text_secondary} 
                                        onChange={(e) => handleChange("text_secondary", e.target.value)}
                                        className={styles.colorPicker}
                                    />
                                    <input 
                                        type="text" 
                                        value={settings.text_secondary} 
                                        onChange={(e) => handleChange("text_secondary", e.target.value)}
                                        className={styles.hexInput}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.previewArea} style={{ backgroundColor: settings.bg_color }}>
                            <span className={styles.previewTitle} style={{ color: settings.text_secondary }}><Eye size={16} /> PRÉ-VISUALIZAÇÃO RÁPIDA</span>
                            <h3 style={{ color: settings.text_primary, fontFamily: 'var(--font-header)', fontSize: '1.5rem' }}>Exemplo de Título da Loja</h3>
                            <p style={{ color: settings.text_secondary, maxWidth: '400px', textAlign: 'center' }}>
                                Este é um texto de exemplo para você ver como as cores de texto e fundo interagem entre si.
                            </p>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button 
                                    className={styles.demoButton}
                                    style={{ backgroundColor: settings.primary_color, color: settings.secondary_color }}
                                >
                                    BOTÃO PRINCIPAL
                                </button>
                                <button 
                                    className={styles.demoButton}
                                    style={{ border: `2px solid ${settings.primary_color}`, color: settings.primary_color, backgroundColor: 'transparent' }}
                                >
                                    BOTÃO OUTLINE
                                </button>
                            </div>
                        </div>

                        <div className={styles.saveActions}>
                            <button 
                                className={styles.saveBtn}
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? <RefreshCw className={styles.spin} /> : <Save size={20} />}
                                {saving ? "Salvando..." : "Salvar Configurações"}
                            </button>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h2><Palette size={20} color="#4B8411" /> Notificações de E-mail</h2>
                        <div className={styles.colorItem} style={{ maxWidth: '100%' }}>
                            <label>E-mail para receber avisos de novas vendas</label>
                            <input 
                                type="email" 
                                value={settings.admin_order_notification_email} 
                                onChange={(e) => handleChange("admin_order_notification_email", e.target.value)}
                                className={styles.hexInput}
                                style={{ width: '100%', marginTop: '10px' }}
                                placeholder="exemplo@gmail.com"
                            />
                            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                                Este e-mail receberá os detalhes de cada nova compra realizada no site.
                            </p>
                            <button 
                                onClick={handleTestEmail}
                                disabled={testingEmail}
                                style={{
                                    marginTop: '15px',
                                    padding: '8px 16px',
                                    backgroundColor: '#4B8411',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    opacity: testingEmail ? 0.7 : 1
                                }}
                            >
                                {testingEmail ? <RefreshCw size={16} className={styles.spin} /> : <Eye size={16} />}
                                TESTAR ENVIO AGORA
                            </button>
                        </div>
                    </div>
                    
                    <div className={styles.section} style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#e0f2fe', border: '1px solid #bae6fd' }}>
                        <CheckCircle2 size={24} color="#0369a1" />
                        <p style={{ margin: 0, color: '#0369a1', fontSize: '0.9rem' }}>
                            <strong>Dica:</strong> Após salvar, o site será recarregado para aplicar as novas cores globalmente. Use cores com bom contraste para garantir a leitura.
                        </p>
                    </div>
                </div>
            </main>
            
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .${styles.spin} {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
}
