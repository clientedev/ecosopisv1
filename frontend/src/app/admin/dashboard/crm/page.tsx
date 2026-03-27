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
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/crm" />
            <main className={styles.mainContent} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Carregando Inteligência de Vendas...</div>
            </main>
        </div>
    );

    const stats = [
        { label: 'Receita Total (Pagos)', value: `R$ ${data?.total_revenue?.toFixed(2).replace('.', ',') || '0,00'}`, icon: <DollarSign size={24} />, color: '#10b981' },
        { label: 'Total de Pedidos', value: data?.total_orders || 0, icon: <ShoppingBag size={24} />, color: '#3b82f6' },
        { label: 'Ticket Médio (Pagos)', value: `R$ ${data?.avg_ticket?.toFixed(2).replace('.', ',') || '0,00'}`, icon: <TrendingUp size={24} />, color: '#f59e0b' },
        { label: 'Novos Clientes (30d)', value: data?.user_growth?.reduce((acc: number, cur: any) => acc + cur.count, 0) || 0, icon: <Users size={24} />, color: '#8b5cf6' },
    ];

    // Format data for charts
    const dailyVolumeData = data?.revenue_series?.map((item: any) => {
        const d = new Date(item.date);
        d.setUTCHours(12);
        const growth = data.user_growth.find((u: any) => u.date === item.date);
        return {
            date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            receita: item.revenue,
            pedidos: item.orders,
            clientes: growth ? growth.count : 0
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
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/crm" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
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

                {/* Dashboard Charts Row 1: Core Sales Performance */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
                    
                    {/* Revenue and Orders Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <TrendingUp size={22} color="#10b981" /> Volume de Vendas e Pedidos (30 dias)
                        </h3>
                        {dailyVolumeData.length > 0 ? (
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={dailyVolumeData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} dy={10} />
                                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} tickFormatter={(val) => `R$ ${val}`} />
                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#3b82f6', fontSize: 13}} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                            formatter={(value: any, name: any) => [
                                                name === 'receita' ? `R$ ${Number(value).toFixed(2).replace('.', ',')}` : value,
                                                typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : name
                                            ]}
                                        />
                                        <Legend verticalAlign="top" height={36}/>
                                        <Area yAxisId="left" type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        <Bar yAxisId="right" dataKey="pedidos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                Sem dados históricos suficientes.
                            </div>
                        )}
                    </div>

                    {/* Status Pie Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <Clock size={22} color="#f59e0b" /> Status de Pedidos
                        </h3>
                        {statusData.length > 0 ? (
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
                                            {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                                        <Legend verticalAlign="bottom" align="center" iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Nenhum pedido registrado.</div>
                        )}
                    </div>
                </div>

                {/* Dashboard Charts Row 2: Customer Growth and Payments */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                    
                    {/* User Growth Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <Users size={22} color="#8b5cf6" /> Novos Clientes Diários
                        </h3>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <AreaChart data={dailyVolumeData}>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                                    <Area type="step" dataKey="clientes" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Payment Method Distribution */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <DollarSign size={22} color="#10b981" /> Métodos de Pagamento (Pedidos Pagos)
                        </h3>
                        {(() => {
                            const paymentData = Object.entries(data?.payment_distribution || {}).map(([key, value], idx) => ({
                                name: key.toUpperCase(),
                                value: value,
                                color: PIE_COLORS[idx % PIE_COLORS.length]
                            }));
                            return paymentData.length > 0 ? (
                                <div style={{ width: '100%', height: 300 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                {paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Sem dados de pagamento.</div>
                            );
                        })()}
                    </div>
                </div>

                {/* Dashboard Charts Row 3: Product Channels and Top Sellers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    
                    {/* Channel Clicks Bar Chart */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <ShoppingBag size={22} color="#3b82f6" /> Performance por Canal de Venda (Cliques)
                        </h3>
                        {(() => {
                            const clickData = [
                                { name: 'Site', value: data?.click_stats?.site || 0, color: '#10b981' },
                                { name: 'Shopee', value: data?.click_stats?.shopee || 0, color: '#ee4d2d' },
                                { name: 'MercadoLivre', value: data?.click_stats?.mercadolivre || 0, color: '#ffe600' }
                            ];
                            return (
                                <div style={{ width: '100%', height: 320 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={clickData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 13, fontWeight: 600}} />
                                            <YAxis axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                                                {clickData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Top Products Rank */}
                    <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                            <CheckCircle size={22} color="#10b981" /> Top 10 Produtos Mais Vendidos
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '320px', overflowY: 'auto' }}>
                            {data?.top_products?.map((p: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', background: i < 3 ? '#2d5a27' : '#e2e8f0', color: i < 3 ? '#fff' : '#64748b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: i < 3 ? 800 : 600, fontSize: '0.9rem' }}>
                                            {i + 1}
                                        </div>
                                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{p.name}</span>
                                    </div>
                                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#2d5a27', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {p.count} und.
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
