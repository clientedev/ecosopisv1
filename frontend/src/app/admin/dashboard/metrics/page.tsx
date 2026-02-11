"use client";
import { useState, useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard.module.css";
import { BarChart3, MousePointer2, Users, ShoppingBag } from "lucide-react";

export default function AdminMetricsPage() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();
    }, []);

    const fetchMetrics = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch('/api/metrics/admin/summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMetrics(data);
            }
        } catch (err) {
            console.error("Error fetching metrics", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="container">Carregando métricas...</div>;

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/metrics" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Métricas e Engajamento</h1>
                </header>

                <div className={styles.metricsGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px' }}>
                    <div className={styles.metricCard} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666', marginBottom: '10px' }}>
                            <Users size={20} />
                            <span>Total de Visitas</span>
                        </div>
                        <h2 style={{ fontSize: '2rem', margin: 0 }}>{metrics?.total_visits || 0}</h2>
                    </div>

                    <div className={styles.metricCard} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666', marginBottom: '10px' }}>
                            <MousePointer2 size={20} />
                            <span>Total de Cliques em Comprar</span>
                        </div>
                        <h2 style={{ fontSize: '2rem', margin: 0 }}>{metrics?.total_clicks || 0}</h2>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px' }}>
                    <section>
                        <h3>Cliques por Canal</h3>
                        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                            {Object.entries(metrics?.clicks_by_type || {}).map(([type, count]: [string, any]) => (
                                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                                    <span style={{ textTransform: 'capitalize' }}>{type === 'site' ? 'Loja Própria' : type}</span>
                                    <strong>{count}</strong>
                                </div>
                            ))}
                            {Object.keys(metrics?.clicks_by_type || {}).length === 0 && <p style={{ color: '#999' }}>Sem cliques registrados ainda.</p>}
                        </div>
                    </section>

                    <section>
                        <h3>Top 10 Produtos (Cliques)</h3>
                        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                            {metrics?.clicks_by_product?.map((item: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                                    <span>{item.name}</span>
                                    <strong>{item.count}</strong>
                                </div>
                            ))}
                            {(!metrics?.clicks_by_product || metrics.clicks_by_product.length === 0) && <p style={{ color: '#999' }}>Sem dados de produtos ainda.</p>}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
