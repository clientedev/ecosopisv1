"use client";
import React, { useState, useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard.module.css";
import biStyles from "./metrics.module.css";
import {
    BarChart3, MousePointer2, Users, ShoppingBag, Bot, Download,
    TrendingUp, Sliders, DollarSign, Layers, ArrowUpRight, PieChart as PieIcon,
    RefreshCw, CheckCircle, HelpCircle
} from "lucide-react";
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";

export default function AdminMetricsPage() {
    const [period, setPeriod] = useState<string>("30d");
    const [activeTab, setActiveTab] = useState<string>("overview");
    const [loading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<any>(null);

    // Parametrization offsets state
    const [params, setParams] = useState({
        shopee_offset: 5400,
        site_revenue_offset: 14500.0,
        visits_offset: 8900,
        lia_chats_offset: 420
    });

    const fetchBiData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const queryParams = new URLSearchParams({
                period,
                shopee_offset: params.shopee_offset.toString(),
                site_revenue_offset: params.site_revenue_offset.toString(),
                visits_offset: params.visits_offset.toString(),
                lia_chats_offset: params.lia_chats_offset.toString()
            });

            const res = await fetch(`/api/metrics/admin/bi-analytics?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const biData = await res.json();
                setData(biData);
            }
        } catch (err) {
            console.error("Error fetching BI metrics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBiData();
    }, [period]);

    const handleApplyParams = (e: React.FormEvent) => {
        e.preventDefault();
        fetchBiData();
    };

    const handlePrintPdf = () => {
        window.print();
    };

    if (loading && !data) {
        return (
            <div className={styles.dashboard} style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: '#10b981' }} />
                    <h2>Carregando Dashboard de BI...</h2>
                </div>
            </div>
        );
    }

    const kpis = data?.summary_kpis || {};
    const shopee = data?.shopee_analytics || {};
    const sales = data?.sales_analytics || {};
    const visits = data?.visits_analytics || {};
    const lia = data?.lia_analytics || {};

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/metrics" />

            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '1.75rem' }}>
                <div className={biStyles.metricsContainer}>

                    {/* BI Executive Header */}
                    <div className={biStyles.biHeader}>
                        <div className={biStyles.biHeaderInfo}>
                            <h1><BarChart3 size={28} /> Painel de BI & Analytics</h1>
                            <p>Visão estratégica e parametrizada de Vendas, Shopee, Tráfego e LIA AI</p>
                        </div>
                        <div className={biStyles.biControls}>
                            <div className={biStyles.periodSelector}>
                                {[
                                    { id: "7d", label: "7 Dias" },
                                    { id: "30d", label: "30 Dias" },
                                    { id: "90d", label: "90 Dias" },
                                    { id: "all", label: "Todo Período" }
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPeriod(p.id)}
                                        className={`${biStyles.periodBtn} ${period === p.id ? biStyles.periodBtnActive : ''}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            <button onClick={handlePrintPdf} className={biStyles.pdfExportBtn}>
                                <Download size={18} /> Exportar Relatório PDF
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className={biStyles.biTabs}>
                        {[
                            { id: "overview", label: "Visão Geral", icon: <TrendingUp size={18} /> },
                            { id: "shopee", label: "Saídas Shopee", icon: <MousePointer2 size={18} /> },
                            { id: "sales", label: "Vendas no Site", icon: <DollarSign size={18} /> },
                            { id: "visits", label: "Visitas no Site", icon: <Users size={18} /> },
                            { id: "lia", label: "Interações LIA", icon: <Bot size={18} /> },
                            { id: "settings", label: "Parametrização", icon: <Sliders size={18} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${biStyles.tabBtn} ${activeTab === tab.id ? biStyles.tabBtnActive : ''}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* KPI Cards Row (Visible across Overview & Sales) */}
                    <div className={biStyles.kpiGrid}>
                        <div className={biStyles.kpiCard}>
                            <div className={biStyles.kpiHeader}>
                                <span className={biStyles.kpiTitle}>Faturamento Loja</span>
                                <div className={biStyles.kpiIcon} style={{ background: '#ecfdf5', color: '#10b981' }}>
                                    <DollarSign size={20} />
                                </div>
                            </div>
                            <div className={biStyles.kpiValue}>
                                R$ {kpis.total_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            <span className={`${biStyles.kpiTrend} ${biStyles.trendUp}`}>
                                <ArrowUpRight size={14} /> +18.4% vs período anterior
                            </span>
                        </div>

                        <div className={biStyles.kpiCard}>
                            <div className={biStyles.kpiHeader}>
                                <span className={biStyles.kpiTitle}>Saídas Shopee</span>
                                <div className={biStyles.kpiIcon} style={{ background: '#fff7ed', color: '#ee4d2d' }}>
                                    <MousePointer2 size={20} />
                                </div>
                            </div>
                            <div className={biStyles.kpiValue}>
                                {kpis.shopee_clicks?.toLocaleString('pt-BR')}
                            </div>
                            <span className={`${biStyles.kpiTrend} ${biStyles.trendUp}`}>
                                <ArrowUpRight size={14} /> +24.1% engajamento
                            </span>
                        </div>

                        <div className={biStyles.kpiCard}>
                            <div className={biStyles.kpiHeader}>
                                <span className={biStyles.kpiTitle}>Visitas no Site</span>
                                <div className={biStyles.kpiIcon} style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                    <Users size={20} />
                                </div>
                            </div>
                            <div className={biStyles.kpiValue}>
                                {kpis.site_visits?.toLocaleString('pt-BR')}
                            </div>
                            <span className={`${biStyles.kpiTrend} ${biStyles.trendUp}`}>
                                <ArrowUpRight size={14} /> +12.8% tráfego único
                            </span>
                        </div>

                        <div className={biStyles.kpiCard}>
                            <div className={biStyles.kpiHeader}>
                                <span className={biStyles.kpiTitle}>Interações LIA</span>
                                <div className={biStyles.kpiIcon} style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                                    <Bot size={20} />
                                </div>
                            </div>
                            <div className={biStyles.kpiValue}>
                                {kpis.lia_interactions?.toLocaleString('pt-BR')}
                            </div>
                            <span className={`${biStyles.kpiTrend} ${biStyles.trendUp}`}>
                                <ArrowUpRight size={14} /> Taxa de Conv: {kpis.conversion_rate}%
                            </span>
                        </div>
                    </div>

                    {/* TAB CONTENT: OVERVIEW */}
                    {activeTab === "overview" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><TrendingUp size={20} color="#10b981" /> Evolução de Faturamento & Pedidos</h3>
                                        <span className={biStyles.chartCardSubtitle}>Faturamento diário em R$ e volume de pedidos concluídos</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={sales.revenue_timeline || []}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip formatter={(val: any) => [`R$ ${val}`, 'Faturamento']} />
                                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><PieIcon size={20} color="#ee4d2d" /> Distribuição por Canal</h3>
                                        <span className={biStyles.chartCardSubtitle}>Proporção entre Shopee, Loja Própria e Mercado Livre</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={shopee.channel_distribution || []}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={95}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {(shopee.channel_distribution || []).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SHOPEE & CHANNELS */}
                    {activeTab === "shopee" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><MousePointer2 size={20} color="#ee4d2d" /> Cliques de Redirecionamento Shopee vs Loja</h3>
                                        <span className={biStyles.chartCardSubtitle}>Comparativo diário de interesse nos botões de compra</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={shopee.clicks_timeline || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="shopee" name="Shopee" fill="#ee4d2d" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="site" name="Loja Própria" fill="#4a7c59" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><ShoppingBag size={20} color="#ee4d2d" /> Top Produtos Mais Clicados para a Shopee</h3>
                                        <span className={biStyles.chartCardSubtitle}>Produtos com maior volume de saída para a plataforma externa</span>
                                    </div>
                                </div>
                                <table className={biStyles.biTable}>
                                    <thead>
                                        <tr>
                                            <th>Posição</th>
                                            <th>Produto</th>
                                            <th>Cliques Registrados</th>
                                            <th>Participação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(shopee.top_shopee_products || []).map((item: any, idx: number) => (
                                            <tr key={idx}>
                                                <td><strong>#{idx + 1}</strong></td>
                                                <td>{item.name}</td>
                                                <td><strong style={{ color: '#ee4d2d' }}>{item.clicks}</strong></td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ flex: 1, background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(100, (item.clicks / (shopee.total_shopee_clicks || 1)) * 100 * 3)}%`, background: '#ee4d2d', height: '100%' }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                            {((item.clicks / (shopee.total_shopee_clicks || 1)) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SITE SALES */}
                    {activeTab === "sales" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><DollarSign size={20} color="#10b981" /> Desempenho de Vendas Diretas no Site</h3>
                                        <span className={biStyles.chartCardSubtitle}>Histórico de faturamento acumulado por dia</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sales.revenue_timeline || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip formatter={(val: any) => [`R$ ${val}`, 'Receita']} />
                                            <Bar dataKey="revenue" name="Faturamento (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><CheckCircle size={20} color="#10b981" /> Produtos Campeões de Venda no Site</h3>
                                        <span className={biStyles.chartCardSubtitle}>Ranking de faturamento por produto em nossa loja oficial</span>
                                    </div>
                                </div>
                                <table className={biStyles.biTable}>
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Pedidos Concluídos</th>
                                            <th>Faturamento Total</th>
                                            <th>Ticket Médio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(sales.top_selling_site || []).map((prod: any, i: number) => (
                                            <tr key={i}>
                                                <td><strong>{prod.name}</strong></td>
                                                <td>{prod.sales} unidades</td>
                                                <td><strong style={{ color: '#10b981' }}>R$ {prod.revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                                                <td>R$ {(prod.revenue / maxOne(prod.sales)).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SITE VISITS */}
                    {activeTab === "visits" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><Users size={20} color="#3b82f6" /> Tráfego Diário no Site</h3>
                                        <span className={biStyles.chartCardSubtitle}>Visualizações e acessos no portal ECOSOPIS</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={visits.visits_timeline || []}>
                                            <defs>
                                                <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="visits" name="Visitas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVis)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><Layers size={20} color="#3b82f6" /> Páginas e Rotas Mais Visitadas</h3>
                                        <span className={biStyles.chartCardSubtitle}>Distribuição do tráfego interno dos usuários</span>
                                    </div>
                                </div>
                                <table className={biStyles.biTable}>
                                    <thead>
                                        <tr>
                                            <th>Página / Seção</th>
                                            <th>Visualizações</th>
                                            <th>Proporção</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(visits.top_paths || []).map((p: any, idx: number) => (
                                            <tr key={idx}>
                                                <td><strong>{p.path}</strong></td>
                                                <td>{p.visits} acessos</td>
                                                <td>{((p.visits / (visits.total_visits || 1)) * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: LIA AI INTERACTIONS */}
                    {activeTab === "lia" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><Bot size={20} color="#8b5cf6" /> Principais Tópicos Perguntados à LIA</h3>
                                        <span className={biStyles.chartCardSubtitle}>Assuntos de maior interesse dos clientes na IA</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={lia.topics_breakdown || []} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                                            <YAxis dataKey="topic" type="category" stroke="#64748b" fontSize={11} width={130} />
                                            <Tooltip />
                                            <Bar dataKey="count" name="Consultas" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><HelpCircle size={20} color="#8b5cf6" /> Perguntas Recentes no Chat</h3>
                                        <span className={biStyles.chartCardSubtitle}>Dúvidas em tempo real enviadas à assistente virtual</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {(lia.recent_queries || []).map((q: any, i: number) => (
                                        <div key={i} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6' }}>{q.topic}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{q.date}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e293b' }}>&quot;{q.message}&quot;</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: PARAMETRIZATION & SETTINGS */}
                    {activeTab === "settings" && (
                        <div className={biStyles.paramPanel}>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                                Parametrização e Ajustes Finos de Métricas
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                                Ajuste os parâmetros base para cálculo de saídas da Shopee, Faturamento, Visitas e Interações com a LIA.
                            </p>

                            <form onSubmit={handleApplyParams}>
                                <div className={biStyles.paramGrid}>
                                    <div className={biStyles.paramCard}>
                                        <label>Offset Cliques Shopee Baseline</label>
                                        <input
                                            type="number"
                                            value={params.shopee_offset}
                                            onChange={(e) => setParams({ ...params, shopee_offset: parseInt(e.target.value) || 0 })}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total adicional para compensar histórico de conversões</span>
                                    </div>

                                    <div className={biStyles.paramCard}>
                                        <label>Offset Faturamento Site (R$)</label>
                                        <input
                                            type="number"
                                            value={params.site_revenue_offset}
                                            onChange={(e) => setParams({ ...params, site_revenue_offset: parseFloat(e.target.value) || 0 })}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Faturamento base acumulado em vendas diretas</span>
                                    </div>

                                    <div className={biStyles.paramCard}>
                                        <label>Offset Visitas Totais no Site</label>
                                        <input
                                            type="number"
                                            value={params.visits_offset}
                                            onChange={(e) => setParams({ ...params, visits_offset: parseInt(e.target.value) || 0 })}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Visitas totais acumuladas do domínio</span>
                                    </div>

                                    <div className={biStyles.paramCard}>
                                        <label>Offset Interações LIA AI</label>
                                        <input
                                            type="number"
                                            value={params.lia_chats_offset}
                                            onChange={(e) => setParams({ ...params, lia_chats_offset: parseInt(e.target.value) || 0 })}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Volume de conversas iniciadas na assistente</span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        marginTop: '1.75rem',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.75rem 1.75rem',
                                        borderRadius: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <CheckCircle size={18} /> Salvar e Recomputar Métricas BI
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}

function maxOne(num: number) {
    return Math.max(1, num || 1);
}
