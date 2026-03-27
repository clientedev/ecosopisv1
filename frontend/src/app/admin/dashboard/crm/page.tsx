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
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar
} from 'recharts';

const STATUS_MAP: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    shipped: 'Enviado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
    payment_error: 'Falha no Pagto'
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#2d5a27', '#ef4444', '#8b5cf6'];

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

    if (loading) return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/crm" />
            <main className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Carregando Inteligência de Vendas...</div>
            </main>
        </div>
    );

    const stats = [
        { label: 'Receita Total (Pagos)', value: `R$ ${data?.total_revenue?.toFixed(2).replace('.', ',') || '0,00'}`, icon: <DollarSign size={24} />, color: '#10b981' },
        { label: 'Total de Pedidos', value: data?.total_orders || 0, icon: <ShoppingBag size={24} />, color: '#3b82f6' },
        { label: 'Ticket Médio (Pagos)', value: `R$ ${data?.avg_ticket?.toFixed(2).replace('.', ',') || '0,00'}`, icon: <TrendingUp size={24} />, color: '#f59e0b' },
        { label: 'Variedades Vendidas', value: data?.top_products?.length || 0, icon: <Package size={24} />, color: '#8b5cf6' },
    ];

    // Format data for charts
    const revenueData = data?.revenue_series?.map((item: any) => {
        const d = new Date(item.date);
        d.setUTCHours(12); // Fix timezone offset visually
        return {
            date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            revenue: item.revenue
        };
    }) || [];

    const statusData = Object.entries(data?.orders_by_status || {}).map(([key, value], idx) => ({
        name: STATUS_MAP[key] || key,
        value: value,
        color: PIE_COLORS[idx % PIE_COLORS.length]
    }));

    const topProductsData = data?.top_products?.map((p: any) => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        vendas: p.count
    })) || [];

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/crm" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Inteligência de Vendas - CRM</h1>
                </header>

                <div className={styles.statsGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                    {stats.map((stat, i) => (
                        <div key={i} className={styles.statCard} style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ background: `${stat.color}15`, color: stat.color, padding: '12px', borderRadius: '14px', display: 'flex' }}>
                                    {stat.icon}
                                </div>
                            </div>
                            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</span>
                            <h2 style={{ fontSize: '2.1rem', margin: '8px 0 0 0', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>{stat.value}</h2>
                        </div>
                    ))}
                </div>

                {/* Dashboard Charts Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '24px', marginBottom: '32px' }}>
                    
                    {/* Revenue Area Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <TrendingUp size={22} color="#10b981" /> Receita dos Últimos 30 Dias (Pedidos Pagos)
                        </h3>
                        {revenueData.length > 0 ? (
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} tickFormatter={(val) => `R$ ${val}`} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                            formatter={(value: any) => [`R$ ${Number(value).toFixed(2).replace('.', ',')}`, 'Receita']}
                                            labelStyle={{ color: '#1e293b', fontWeight: 700, marginBottom: '4px' }}
                                        />
                                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                Nenhum volume de receita registrado nos últimos 30 dias.
                            </div>
                        )}
                    </div>

                    {/* Order Status Pie Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <Clock size={22} color="#f59e0b" /> Demografia de Status
                        </h3>
                        {statusData.length > 0 ? (
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 600 }}
                                            formatter={(value: any) => [value, 'Pedidos']}
                                        />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.9rem', color: '#475569' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                Nenhum pedido registrado.
                            </div>
                        )}
                    </div>

                </div>

                {/* Dashboard Charts Row 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    
                    {/* Top Products Bar Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <Package size={22} color="#3b82f6" /> Top 5 Produtos Mais Vendidos
                        </h3>
                        {topProductsData.length > 0 ? (
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer>
                                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 500}} width={140} />
                                        <Tooltip 
                                            cursor={{fill: '#f1f5f9'}}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                            formatter={(value: any) => [value, 'Unidades Vendidas']}
                                        />
                                        <Bar dataKey="vendas" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={28} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                Dados insuficientes de venda.
                            </div>
                        )}
                    </div>

                    {/* Detailed List of Top Products */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <CheckCircle size={22} color="#8b5cf6" /> Relação e Classificação
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '320px', overflowY: 'auto', paddingRight: '8px' }}>
                            {data?.top_products?.length > 0 ? (
                                data.top_products.map((p: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ 
                                                width: '40px', height: '40px', 
                                                background: i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : i === 2 ? '#ffedd5' : '#f1f5f9', 
                                                color: i === 0 ? '#d97706' : i === 1 ? '#64748b' : i === 2 ? '#c2410c' : '#94a3b8', 
                                                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem',
                                                boxShadow: i < 3 ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
                                            }}>
                                                {i + 1}º
                                            </div>
                                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '1rem' }}>{p.name}</span>
                                        </div>
                                        <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800 }}>
                                            {p.count} und.
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '60px' }}>Nenhuma venda confirmada listada.</p>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
