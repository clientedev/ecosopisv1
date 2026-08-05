"use client";
import React, { useState, useEffect, useCallback } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard.module.css";
import biStyles from "./metrics.module.css";
import {
    BarChart3, MousePointer2, Users, ShoppingBag, Bot, Download,
    TrendingUp, Layers, ArrowUpRight, PieChart as PieIcon,
    RefreshCw, CheckCircle, HelpCircle, InboxIcon
} from "lucide-react";
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '3rem 2rem', gap: '0.75rem', color: '#94a3b8', textAlign: 'center'
        }}>
            <Icon size={40} strokeWidth={1.2} />
            <strong style={{ color: '#475569', fontSize: '1rem' }}>{title}</strong>
            <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '340px' }}>{desc}</p>
        </div>
    );
}

export default function AdminMetricsPage() {
    const [period, setPeriod] = useState<string>("30d");
    const [activeTab, setActiveTab] = useState<string>("overview");
    const [loading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<any>(null);

    const fetchBiData = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/metrics/admin/bi-analytics?period=${period}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setData(await res.json());
            }
        } catch (err) {
            console.error("Error fetching BI metrics:", err);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchBiData();
    }, [fetchBiData]);

    const handlePrintPdf = () => window.print();

    if (loading && !data) {
        return (
            <div className={styles.dashboard} style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={36} style={{ margin: '0 auto 1rem auto', color: '#10b981', animation: 'spin 1s linear infinite' }} />
                    <h2>Carregando Dashboard de BI...</h2>
                </div>
            </div>
        );
    }

    const kpis = data?.summary_kpis || {};
    const shopee = data?.shopee_analytics || {};
    const siteClicks = data?.site_clicks_analytics || {};
    const visits = data?.visits_analytics || {};
    const lia = data?.lia_analytics || {};

    const hasClicksData = (shopee.clicks_timeline || []).some((d: any) => d.shopee > 0 || d.site > 0);
    const hasShopeeProducts = (shopee.top_shopee_products || []).length > 0;
    const hasSiteProducts = (siteClicks.top_site_clicked || []).length > 0;
    const hasVisits = (visits.visits_timeline || []).some((d: any) => d.visits > 0);
    const hasPaths = (visits.top_paths || []).length > 0;
    const hasLiaTopics = (lia.topics_breakdown || []).length > 0;
    const hasLiaRecent = (lia.recent_queries || []).length > 0;

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/metrics" />

            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '1.75rem' }}>
                <div className={biStyles.metricsContainer}>

                    {/* BI Executive Header */}
                    <div className={biStyles.biHeader}>
                        <div className={biStyles.biHeaderInfo}>
                            <h1><BarChart3 size={28} /> Painel de BI & Analytics</h1>
                            <p>Dados reais de cliques, tráfego e interações com a LIA captados diretamente do site</p>
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
                            { id: "site_clicks", label: "Cliques Comprar (Site)", icon: <ShoppingBag size={18} /> },
                            { id: "visits", label: "Visitas no Site", icon: <Users size={18} /> },
                            { id: "lia", label: "Interações LIA", icon: <Bot size={18} /> }
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

                    {/* KPI Cards Row */}
                    <div className={biStyles.kpiGrid}>
                        <div className={biStyles.kpiCard}>
                            <div className={biStyles.kpiHeader}>
                                <span className={biStyles.kpiTitle}>Cliques Comprar (Site)</span>
                                <div className={biStyles.kpiIcon} style={{ background: '#ecfdf5', color: '#10b981' }}>
                                    <ShoppingBag size={20} />
                                </div>
                            </div>
                            <div className={biStyles.kpiValue}>
                                {(kpis.total_site_clicks ?? 0).toLocaleString('pt-BR')}
                            </div>
                            <span className={`${biStyles.kpiTrend} ${biStyles.trendUp}`}>
                                <ArrowUpRight size={14} /> CTR: {kpis.click_through_rate ?? 0}%
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
                                {(kpis.shopee_clicks ?? 0).toLocaleString('pt-BR')}
                            </div>
                            <span className={biStyles.kpiTrend} style={{ color: '#64748b' }}>
                                Redirecionamentos registrados
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
                                {(kpis.site_visits ?? 0).toLocaleString('pt-BR')}
                            </div>
                            <span className={biStyles.kpiTrend} style={{ color: '#64748b' }}>
                                Acessos no período
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
                                {(kpis.lia_interactions ?? 0).toLocaleString('pt-BR')}
                            </div>
                            <span className={biStyles.kpiTrend} style={{ color: '#64748b' }}>
                                Mensagens enviadas à LIA
                            </span>
                        </div>
                    </div>

                    {/* TAB CONTENT: OVERVIEW */}
                    {activeTab === "overview" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><TrendingUp size={20} color="#10b981" /> Evolução de Cliques em Comprar (Site vs Shopee)</h3>
                                        <span className={biStyles.chartCardSubtitle}>Cliques diários registrados no botão Comprar da loja e redirecionamentos para a Shopee</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    {hasClicksData ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={shopee.clicks_timeline || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="site" name="Cliques Comprar (Site)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="shopee" name="Cliques Shopee" fill="#ee4d2d" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState icon={InboxIcon} title="Nenhum clique registrado ainda" desc="Os cliques serão capturados automaticamente quando visitantes interagirem com os botões de compra no site." />
                                    )}
                                </div>
                            </div>

                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><PieIcon size={20} color="#ee4d2d" /> Distribuição de Cliques por Canal</h3>
                                        <span className={biStyles.chartCardSubtitle}>Proporção de cliques entre Shopee, Loja Própria e Mercado Livre</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    {hasClicksData ? (
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
                                    ) : (
                                        <EmptyState icon={PieIcon} title="Sem dados de canais ainda" desc="O gráfico de distribuição será preenchido conforme os cliques forem registrados." />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SHOPEE */}
                    {activeTab === "shopee" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><MousePointer2 size={20} color="#ee4d2d" /> Cliques Shopee vs Loja Própria por Dia</h3>
                                        <span className={biStyles.chartCardSubtitle}>Comparativo diário de redirecionamentos</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    {hasClicksData ? (
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
                                    ) : (
                                        <EmptyState icon={MousePointer2} title="Nenhum clique Shopee registrado" desc="Os redirecionamentos para a Shopee serão contabilizados quando clientes clicarem no botão correspondente." />
                                    )}
                                </div>
                            </div>

                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><ShoppingBag size={20} color="#ee4d2d" /> Top Produtos Mais Clicados para a Shopee</h3>
                                        <span className={biStyles.chartCardSubtitle}>Produtos com maior volume de saída para a Shopee</span>
                                    </div>
                                </div>
                                {hasShopeeProducts ? (
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
                                            {shopee.top_shopee_products.map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td><strong>#{idx + 1}</strong></td>
                                                    <td>{item.name}</td>
                                                    <td><strong style={{ color: '#ee4d2d' }}>{item.clicks}</strong></td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ flex: 1, background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${Math.min(100, (item.clicks / Math.max(1, shopee.top_shopee_products[0]?.clicks)) * 100)}%`, background: '#ee4d2d', height: '100%' }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                {((item.clicks / Math.max(1, shopee.total_shopee_clicks)) * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <EmptyState icon={InboxIcon} title="Sem dados de produtos ainda" desc="O ranking será exibido quando houver cliques nos botões de redirecionamento para a Shopee." />
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SITE BUY CLICKS */}
                    {activeTab === "site_clicks" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><ShoppingBag size={20} color="#10b981" /> Evolução de Cliques no Botão Comprar (Loja Própria)</h3>
                                        <span className={biStyles.chartCardSubtitle}>Cliques diários captados no site ECOSOPIS</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    {(siteClicks.buy_clicks_timeline || []).some((d: any) => d.clicks > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={siteClicks.buy_clicks_timeline || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip formatter={(val: any) => [`${val} cliques`, 'Cliques em Comprar']} />
                                                <Bar dataKey="clicks" name="Cliques no Botão Comprar" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState icon={ShoppingBag} title="Nenhum clique na loja registrado ainda" desc="Os cliques no botão Comprar da loja própria serão exibidos aqui conforme acontecerem." />
                                    )}
                                </div>
                            </div>

                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><CheckCircle size={20} color="#10b981" /> Top Produtos com Maior Intenção de Compra no Site</h3>
                                        <span className={biStyles.chartCardSubtitle}>Ranking por número de cliques no botão Comprar</span>
                                    </div>
                                </div>
                                {hasSiteProducts ? (
                                    <table className={biStyles.biTable}>
                                        <thead>
                                            <tr>
                                                <th>Posição</th>
                                                <th>Produto</th>
                                                <th>Cliques no Botão Comprar</th>
                                                <th>Proporção de Cliques</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {siteClicks.top_site_clicked.map((prod: any, i: number) => (
                                                <tr key={i}>
                                                    <td><strong>#{i + 1}</strong></td>
                                                    <td><strong>{prod.name}</strong></td>
                                                    <td><strong style={{ color: '#10b981' }}>{prod.clicks} cliques</strong></td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ flex: 1, background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${Math.min(100, (prod.clicks / Math.max(1, siteClicks.top_site_clicked[0]?.clicks)) * 100)}%`, background: '#10b981', height: '100%' }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                {((prod.clicks / Math.max(1, siteClicks.total_site_clicks)) * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <EmptyState icon={InboxIcon} title="Sem dados de produtos ainda" desc="O ranking será exibido quando houver cliques nos botões de compra da loja própria." />
                                )}
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
                                        <span className={biStyles.chartCardSubtitle}>Acessos registrados no portal ECOSOPIS</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    {hasVisits ? (
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
                                    ) : (
                                        <EmptyState icon={Users} title="Nenhuma visita registrada ainda" desc="As visitas ao site são registradas automaticamente. Certifique-se de que o componente de rastreamento está ativo nas páginas." />
                                    )}
                                </div>
                            </div>

                            <div className={biStyles.chartCard} style={{ gridColumn: 'span 2' }}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><Layers size={20} color="#3b82f6" /> Páginas e Rotas Mais Visitadas</h3>
                                        <span className={biStyles.chartCardSubtitle}>Distribuição do tráfego interno dos usuários</span>
                                    </div>
                                </div>
                                {hasPaths ? (
                                    <table className={biStyles.biTable}>
                                        <thead>
                                            <tr>
                                                <th>Página / Seção</th>
                                                <th>Visualizações</th>
                                                <th>Proporção</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visits.top_paths.map((p: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td><strong>{p.path}</strong></td>
                                                    <td>{p.visits} acessos</td>
                                                    <td>{((p.visits / Math.max(1, visits.total_visits)) * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <EmptyState icon={InboxIcon} title="Sem páginas visitadas ainda" desc="O detalhamento por página será exibido conforme as visitas forem registradas." />
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: LIA AI */}
                    {activeTab === "lia" && (
                        <div className={biStyles.chartGrid}>
                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><Bot size={20} color="#8b5cf6" /> Tópicos Perguntados à LIA</h3>
                                        <span className={biStyles.chartCardSubtitle}>Categorias reais de dúvidas dos clientes</span>
                                    </div>
                                </div>
                                <div className={biStyles.chartBody}>
                                    {hasLiaTopics ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={lia.topics_breakdown || []} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis type="number" stroke="#64748b" fontSize={12} />
                                                <YAxis dataKey="topic" type="category" stroke="#64748b" fontSize={11} width={140} />
                                                <Tooltip />
                                                <Bar dataKey="count" name="Consultas" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState icon={Bot} title="Nenhum tópico registrado ainda" desc="Quando clientes conversarem com a LIA, os tópicos detectados aparecerão aqui." />
                                    )}
                                </div>
                            </div>

                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <div>
                                        <h3 className={biStyles.chartCardTitle}><HelpCircle size={20} color="#8b5cf6" /> Perguntas Reais Recentes</h3>
                                        <span className={biStyles.chartCardSubtitle}>Últimas mensagens enviadas à assistente virtual LIA</span>
                                    </div>
                                </div>
                                {hasLiaRecent ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {lia.recent_queries.map((q: any, i: number) => (
                                            <div key={i} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6' }}>{q.topic}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{q.date}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e293b' }}>&quot;{q.message}&quot;</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState icon={InboxIcon} title="Nenhuma pergunta registrada ainda" desc="As mensagens enviadas pelos clientes à LIA aparecerão aqui em tempo real." />
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
