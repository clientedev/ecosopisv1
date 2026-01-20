"use client";
import { useEffect, useState } from "react";
import styles from "../dashboard/dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function AdminSettings() {
    const [settings, setSettings] = useState<any>({ PIX_KEY: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
                const res = await fetch(`${apiUrl}/api/settings/`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(prev => ({ ...prev, ...data }));
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const res = await fetch(`${apiUrl}/api/settings/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                alert("Configurações salvas com sucesso!");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/settings" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Configurações do Sistema</h1>
                </header>

                <div className={styles.detailSection} style={{ background: 'white', padding: '2rem', borderRadius: '1rem', marginTop: '2rem' }}>
                    <h3>Configurações de Pagamento</h3>
                    <div style={{ marginTop: '1.5rem', maxWidth: '500px' }}>
                        <div className={styles.formGroup}>
                            <label>Chave PIX (E-mail, CPF, Celular ou Chave Aleatória)</label>
                            <input
                                type="text"
                                value={settings.PIX_KEY}
                                onChange={(e) => setSettings({ ...settings, PIX_KEY: e.target.value })}
                                placeholder="Insira sua chave PIX"
                                className={styles.inputField}
                                style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
                        </div>
                        <button 
                            className="btn-primary" 
                            style={{ marginTop: '1.5rem' }} 
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Salvando..." : "Salvar Configurações"}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
