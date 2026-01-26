"use client";
import { useState, useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard.module.css";
import { Save } from "lucide-react";

export default function AdminAnnouncementPage() {
    const [text, setText] = useState("");
    const [bgColor, setBgColor] = useState("#2d5a27");
    const [textColor, setTextColor] = useState("#ffffff");
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        fetchAnnouncement();
    }, []);

    const fetchAnnouncement = async () => {
        try {
            const res = await fetch('/api/products/announcement');
            if (res.ok) {
                const data = await res.json();
                setText(data.text);
                setBgColor(data.bg_color);
                setTextColor(data.text_color);
                setIsActive(data.is_active);
            }
        } catch (err) {
            console.error("Error fetching announcement", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: "", text: "" });

        const token = localStorage.getItem("token");
        try {
            const res = await fetch('/api/products/announcement', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    text,
                    bg_color: bgColor,
                    text_color: textColor,
                    is_active: isActive
                })
            });

            if (res.ok) {
                setMessage({ type: "success", text: "Configurações salvas com sucesso!" });
            } else {
                setMessage({ type: "error", text: "Erro ao salvar configurações." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Erro de conexão." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="container">Carregando...</div>;

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/announcement" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Configurar Faixa de Aviso</h1>
                </header>
                
                <form onSubmit={handleSave} className={styles.form} style={{ maxWidth: '600px', marginTop: '20px' }}>
                    <div className={styles.formGroup}>
                        <label>Texto do Aviso</label>
                        <input 
                            type="text" 
                            value={text} 
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Ex: Frete grátis em todo o site!"
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className={styles.formGroup}>
                            <label>Cor de Fundo</label>
                            <input 
                                type="color" 
                                value={bgColor} 
                                onChange={(e) => setBgColor(e.target.value)}
                                style={{ height: '45px', padding: '2px' }}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Cor do Texto</label>
                            <input 
                                type="color" 
                                value={textColor} 
                                onChange={(e) => setTextColor(e.target.value)}
                                style={{ height: '45px', padding: '2px' }}
                            />
                        </div>
                    </div>

                    <div className={styles.checkboxGroup} style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            id="isActive"
                            checked={isActive} 
                            onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <label htmlFor="isActive">Exibir faixa no topo do site</label>
                    </div>

                    <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: bgColor, color: textColor, textAlign: 'center' }}>
                        <strong>Pré-visualização:</strong><br/>
                        {text || "Seu aviso aparecerá aqui"}
                    </div>

                    {message.text && (
                        <div style={{ 
                            marginTop: '20px', 
                            padding: '10px', 
                            borderRadius: '5px', 
                            backgroundColor: message.type === 'success' ? '#e8f5e9' : '#ffebee',
                            color: message.type === 'success' ? '#2e7d32' : '#c62828',
                            textAlign: 'center'
                        }}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <Save size={18} /> {saving ? "Salvando..." : "Salvar Configurações"}
                    </button>
                </form>
            </main>
        </div>
    );
}
