"use client";
import React, { useEffect, useState } from 'react';
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard.module.css";
import { 
    TrendingUp, 
    Users, 
    ShoppingBag, 
    DollarSign, 
    ArrowUpRight, 
    Clock, 
    Package,
    CheckCircle
} from 'lucide-react';

export default function AdminCRMPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch('/api/crm/admin/crm-summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error("Error fetching CRM data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className={styles.loading}>Carregando análise comercial...</div>;

    const stats = [
        { label: 'Receita Total', value: `R$ ${data?.total_revenue?.toFixed(2) || '0.00'}`, icon: <DollarSign />, color: '#10b981' },
        { label: 'Total de Pedidos', value: data?.total_orders || 0, icon: <ShoppingBag />, color: '#3b82f6' },
        { label: 'Ticket Médio', value: `R$ ${data?.avg_ticket?.toFixed(2) || '0.00'}`, icon: <TrendingUp />, color: '#f59e0b' },
        { label: 'Conversão', value: '4.2%', icon: <ArrowUpRight />, color: '#8b5cf6' },
    ];

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/crm" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>CRM e Inteligência de Vendas</h1>
                </header>

                <div className={styles.statsGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    {stats.map((stat, i) => (
                        <div key={i} className={styles.statCard} style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ background: `${stat.color}15`, color: stat.color, padding: '10px', borderRadius: '12px' }}>
                                    {stat.icon}
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', background: '#ecfdf5', padding: '4px 8px', borderRadius: '100px' }}>+12%</span>
                            </div>
                            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>{stat.label}</span>
                            <h2 style={{ fontSize: '1.75rem', margin: '8px 0 0 0', fontWeight: 700, color: '#1e293b' }}>{stat.value}</h2>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Package size={20} /> Produtos Mais Vendidos
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {data?.top_products?.map((p: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#64748b' }}>
                                            {i + 1}
                                        </div>
                                        <span style={{ fontWeight: 600, color: '#334155' }}>{p.name}</span>
                                    </div>
                                    <span style={{ fontWeight: 700, color: '#3b82f6' }}>{p.count} vendas</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock size={20} /> Status dos Pedidos
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {Object.entries(data?.orders_by_status || {}).map(([status, count]: [string, any]) => (
                                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === 'paid' ? '#10b981' : '#f59e0b' }} />
                                        <span style={{ fontSize: '0.875rem', textTransform: 'capitalize', color: '#475569' }}>{status}</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
