"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { Coins, Settings, TrendingUp, History, Save, CheckCircle, XCircle, Clock } from "lucide-react";

export default function CashbackManagement() {
    const [config, setConfig] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { "Authorization": `Bearer ${token}` };

            const [configRes, statsRes, txRes] = await Promise.all([
                fetch("/api/cashback/admin/config", { headers }),
                fetch("/api/cashback/admin/stats", { headers }),
                fetch("/api/cashback/admin/transactions?limit=50", { headers })
            ]);

            if (configRes.ok) setConfig(await configRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
            if (txRes.ok) {
                const txData = await txRes.json();
                setTransactions(txData.transactions || []);
            }
        } catch (error) {
            console.error("Error fetching cashback data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }
        fetchData();
    }, [router]);

    const handleUpdateConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/cashback/admin/config", {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                alert("Configurações salvas com sucesso!");
                fetchData();
            }
        } catch (error) {
            console.error("Error updating config:", error);
            alert("Erro ao salvar configurações.");
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'approved': return { color: '#059669', bg: '#ecfdf5', label: 'Aprovado' };
            case 'used': return { color: '#2563eb', bg: '#eff6ff', label: 'Utilizado' };
            case 'expired': return { color: '#dc2626', bg: '#fef2f2', label: 'Expirado' };
            case 'pending': return { color: '#d97706', bg: '#fffbeb', label: 'Pendente' };
            default: return { color: '#64748b', bg: '#f1f5f9', label: status };
        }
    };

    if (loading && !config) {
        return <div className={styles.loading}>Carregando sistema de cashback...</div>;
    }

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/cashback" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                <header className={styles.header} style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '1rem', color: '#059669' }}>
                            <Coins size={32} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0 }}>Gestão de Cashback</h1>
                            <p style={{ color: '#64748b', margin: 0 }}>Configure e monitore o sistema de fidelidade</p>
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {[
                            { label: "Total Emitido", value: stats.total_emitido, icon: <Coins size={20} />, color: "#10b981" },
                            { label: "Total Usado", value: stats.total_usado, icon: <TrendingUp size={20} />, color: "#3b82f6" },
                            { label: "Em Circulação", value: stats.em_circulacao, icon: <Clock size={20} />, color: "#f59e0b" },
                            { label: "Total Expirado", value: stats.total_expirado, icon: <XCircle size={20} />, color: "#ef4444" }
                        ].map((stat, i) => (
                            <div key={i} style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                                    {stat.icon} {stat.label}
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>
                                    R$ {stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                    {/* Config Section */}
                    <section style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <Settings size={24} color="#059669" />
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Configurações</h2>
                        </div>

                        <form onSubmit={handleUpdateConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '1rem' }}>
                                <div>
                                    <div style={{ fontWeight: '600' }}>Sistema Ativado</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Habilita/desabilita o cashback no checkout</div>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={config?.is_active} 
                                    onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Cashback 1ª Compra (%)</label>
                                <input 
                                    type="number" 
                                    value={config?.first_purchase_percentage || ""} 
                                    onChange={(e) => setConfig({ ...config, first_purchase_percentage: parseFloat(e.target.value) })}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Cashback Recompras (%)</label>
                                <input 
                                    type="number" 
                                    value={config?.repurchase_percentage || ""} 
                                    onChange={(e) => setConfig({ ...config, repurchase_percentage: parseFloat(e.target.value) })}
                                    required
                                />
                            </div>

                            <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>Validade (Dias)</label>
                                    <input 
                                        type="number" 
                                        value={config?.repurchase_validity_days || ""} 
                                        onChange={(e) => setConfig({ ...config, repurchase_validity_days: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Min. Uso (R$)</label>
                                    <input 
                                        type="number" 
                                        value={config?.min_purchase_to_use || ""} 
                                        onChange={(e) => setConfig({ ...config, min_purchase_to_use: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                                <input 
                                    type="checkbox" 
                                    id="allow_coupons"
                                    checked={config?.allow_with_coupons} 
                                    onChange={(e) => setConfig({ ...config, allow_with_coupons: e.target.checked })}
                                />
                                <label htmlFor="allow_coupons" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Permitir usar com cupons de desconto</label>
                            </div>

                            <button type="submit" className="btn-primary" disabled={isSaving} style={{ marginTop: '1rem', width: '100%', padding: '1rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Save size={20} /> {isSaving ? "Salvando..." : "Salvar Alterações"}
                            </button>
                        </form>
                    </section>

                    {/* Transactions Section */}
                    <section style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <History size={24} color="#2563eb" />
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Últimas Transações</h2>
                        </div>

                        <div className={styles.productTable} style={{ margin: 0 }}>
                            <table style={{ minWidth: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Valor</th>
                                        <th>Tipo</th>
                                        <th>Data</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx: any) => {
                                        const status = getStatusStyle(tx.status);
                                        return (
                                            <tr key={tx.id}>
                                                <td>
                                                    <div style={{ fontWeight: '600' }}>{tx.user_name || 'Cliente'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{tx.user_email}</div>
                                                </td>
                                                <td>
                                                    <strong style={{ color: tx.type === 'earned' ? '#059669' : '#dc2626' }}>
                                                        {tx.type === 'earned' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: '#64748b' }}>
                                                        {tx.type === 'earned' ? 'Ganho' : 'Uso'}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>{tx.created_at.split(' ')[0]}</td>
                                                <td>
                                                    <span style={{ 
                                                        padding: '0.25rem 0.625rem', 
                                                        borderRadius: '2rem', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: '600',
                                                        background: status.bg,
                                                        color: status.color
                                                    }}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {transactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                Nenhuma transação encontrada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
