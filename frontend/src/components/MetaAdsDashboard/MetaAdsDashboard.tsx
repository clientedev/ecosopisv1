"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import {
    Megaphone, Users, ShoppingBag, DollarSign, Target, TrendingUp, RefreshCw, CheckCircle2,
    AlertTriangle, Settings, Send, Percent, Receipt,
} from "lucide-react";
import biStyles from "@/app/admin/dashboard/metrics/metrics.module.css";

// Paleta validada (CVD/contraste): Meta = azul, Total do site = âmbar
const C_META = "#2563eb";
const C_ALL = "#d97706";

const brl = (v: any) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (v: any) => Number(v || 0).toLocaleString("pt-BR");
const STEP_LABEL: Record<string, string> = {
    PageView: "Visitas (páginas)",
    ViewContent: "Viu produto",
    AddToCart: "Adicionou ao carrinho",
    InitiateCheckout: "Iniciou checkout",
    Purchase: "Comprou (pago)",
};

function authHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function Kpi({ title, value, hint, icon: Icon, tint }: { title: string; value: React.ReactNode; hint?: string; icon: any; tint: string }) {
    return (
        <div className={biStyles.kpiCard}>
            <div className={biStyles.kpiHeader}>
                <span className={biStyles.kpiTitle}>{title}</span>
                <div className={biStyles.kpiIcon} style={{ background: `${tint}14`, color: tint }}>
                    <Icon size={20} />
                </div>
            </div>
            <div className={biStyles.kpiValue}>{value}</div>
            {hint && <span className={biStyles.kpiTrend} style={{ color: "#64748b" }}>{hint}</span>}
        </div>
    );
}

function StatusPill({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999,
            fontSize: 12, fontWeight: 700, background: ok ? "#dcfce7" : "#fef3c7", color: ok ? "#166534" : "#92400e",
        }}>
            {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {ok ? okText : badText}
        </span>
    );
}

function ConfigPanel({ onSaved }: { onSaved: () => void }) {
    const [cfg, setCfg] = useState<any>(null);
    const [form, setForm] = useState({ pixel_id: "", ad_account_id: "", capi_token: "", ads_token: "", test_event_code: "" });
    const [msg, setMsg] = useState<string>("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const r = await fetch("/api/meta/admin/config", { headers: authHeaders() });
        if (r.ok) {
            const d = await r.json();
            setCfg(d);
            setForm((f) => ({ ...f, pixel_id: d.pixel_id || "", ad_account_id: d.ad_account_id || "", test_event_code: d.test_event_code || "" }));
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setBusy(true); setMsg("");
        const body: any = { pixel_id: form.pixel_id, ad_account_id: form.ad_account_id, test_event_code: form.test_event_code };
        if (form.capi_token.trim()) body.capi_token = form.capi_token.trim();
        if (form.ads_token.trim()) body.ads_token = form.ads_token.trim();
        const r = await fetch("/api/meta/admin/config", { method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
        setBusy(false);
        if (r.ok) { setMsg("Configuração salva."); setForm((f) => ({ ...f, capi_token: "", ads_token: "" })); load(); onSaved(); }
        else setMsg("Não foi possível salvar.");
    };

    const test = async () => {
        setBusy(true); setMsg("");
        const r = await fetch("/api/meta/admin/test", { method: "POST", headers: authHeaders() });
        const d = await r.json().catch(() => ({}));
        setBusy(false);
        setMsg(d.ok ? "✅ Evento de teste aceito pela Meta. A API de Conversões está funcionando." : `⚠️ ${d.error || "Falha no teste"}`);
    };

    const input = (label: string, key: keyof typeof form, placeholder: string, secret = false) => (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#334155" }}>
            {label}
            <input
                type={secret ? "password" : "text"} value={form[key]} placeholder={placeholder}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 14 }}
                autoComplete="off"
            />
        </label>
    );

    return (
        <div className={biStyles.chartCard}>
            <div className={biStyles.chartCardHeader}>
                <h3 className={biStyles.chartCardTitle}><Settings size={18} /> Configuração da integração Meta</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                {input("ID do Pixel / Conjunto de dados", "pixel_id", "951267150021255")}
                {input("ID da conta de anúncios", "ad_account_id", "1116883899402382")}
                {input(`Token da API de Conversões ${cfg?.capi_token_set ? `(atual: ${cfg.capi_token_masked})` : "(não configurado)"}`, "capi_token", "Cole o token gerado no Gerenciador de Eventos", true)}
                {input(`Token de leitura de anúncios ${cfg?.ads_token_set ? `(atual: ${cfg.ads_token_masked})` : "(opcional)"}`, "ads_token", "Token com permissão ads_read", true)}
                {input("Código de teste (opcional)", "test_event_code", "TEST12345")}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "12px 0 0" }}>
                O token da API de Conversões é gerado em Gerenciador de Eventos → conjunto de dados → Configurações → API de Conversões → “Gerar token de acesso”.
                O mesmo token pode ler gasto/ROAS se tiver a permissão <code>ads_read</code>. Tokens ficam salvos só no servidor e nunca aparecem completos aqui.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={save} disabled={busy} className={biStyles.pdfExportBtn}>Salvar</button>
                <button onClick={test} disabled={busy} className={biStyles.periodBtn} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <Send size={14} /> Enviar evento de teste
                </button>
                {msg && <span style={{ fontSize: 13, color: "#334155" }}>{msg}</span>}
            </div>
        </div>
    );
}

export default function MetaAdsDashboard({ showHeader = true }: { showHeader?: boolean }) {
    const [period, setPeriod] = useState("30d");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showConfig, setShowConfig] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const r = await fetch(`/api/meta/admin/dashboard?period=${period}`, { headers: authHeaders() });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setData(await r.json());
        } catch (e: any) {
            setError("Não foi possível carregar as métricas da Meta.");
        } finally {
            setLoading(false);
        }
    }, [period]);
    useEffect(() => { load(); }, [load]);

    const k = data?.kpis || {};
    const setup = data?.setup || {};
    const ads = data?.ads || {};
    const daily = (data?.daily || []).map((d: any) => ({ ...d, label: d.date?.slice(8, 10) + "/" + d.date?.slice(5, 7) }));
    const funnel = (data?.funnel || []).map((f: any) => ({ ...f, label: STEP_LABEL[f.step] || f.step }));
    const pixelLast = setup.pixel_status?.last_fired_time;
    const pixelActive = (setup.events_received || 0) > 0 || !!pixelLast;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {showHeader && (
                <div className={biStyles.biHeader}>
                    <div className={biStyles.biHeaderInfo}>
                        <h1><Megaphone size={28} /> Meta Ads — Facebook &amp; Instagram</h1>
                        <p>Visitas, funil e vendas que vieram da Meta, medidos pelo próprio site (Pixel + API de Conversões)</p>
                    </div>
                    <div className={biStyles.biControls}>
                        <div className={biStyles.periodSelector}>
                            {[{ id: "7d", l: "7 dias" }, { id: "14d", l: "14 dias" }, { id: "30d", l: "30 dias" }, { id: "90d", l: "90 dias" }].map((p) => (
                                <button key={p.id} onClick={() => setPeriod(p.id)} className={`${biStyles.periodBtn} ${period === p.id ? biStyles.periodBtnActive : ""}`}>{p.l}</button>
                            ))}
                        </div>
                        <button onClick={load} className={biStyles.periodBtn} title="Atualizar" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <RefreshCw size={14} /> Atualizar
                        </button>
                        <button onClick={() => setShowConfig((s) => !s)} className={biStyles.pdfExportBtn}>
                            <Settings size={16} /> Configurar
                        </button>
                    </div>
                </div>
            )}

            {/* Status da integração */}
            <div className={biStyles.chartCard} style={{ gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: "#1e293b", marginRight: 6 }}>Status:</strong>
                    <StatusPill ok={pixelActive} okText={`Pixel ativo (${setup.pixel_id || "-"})`} badText="Pixel aguardando primeiros eventos" />
                    <StatusPill ok={!!setup.capi_configured} okText="API de Conversões ligada" badText="API de Conversões sem token" />
                    <StatusPill ok={!!setup.ads_configured} okText="Gasto/ROAS conectado" badText="Gasto/ROAS sem token" />
                    {setup.capi_events && (
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                            Eventos enviados à Meta pelo servidor: {int(setup.capi_events.sent)} · erros: {int(setup.capi_events.error)}
                        </span>
                    )}
                    {!showHeader && (
                        <button onClick={() => setShowConfig((s) => !s)} className={biStyles.periodBtn} style={{ marginLeft: "auto" }}>
                            <Settings size={14} /> Configurar
                        </button>
                    )}
                </div>
                {setup.last_capi_error && (
                    <span style={{ fontSize: 12, color: "#92400e" }}>Último erro da API de Conversões: {setup.last_capi_error}</span>
                )}
                {!setup.ads_configured && setup.ads_reason && (
                    <span style={{ fontSize: 12, color: "#64748b" }}>Investimento e ROAS: {setup.ads_reason}. Clique em “Configurar” para conectar.</span>
                )}
            </div>

            {showConfig && <ConfigPanel onSaved={load} />}

            {error && <div className={biStyles.chartCard} style={{ color: "#991b1b" }}>{error}</div>}
            {loading && !data && <div className={biStyles.chartCard} style={{ color: "#64748b" }}>Carregando métricas da Meta…</div>}

            {data && (
                <>
                    <div className={biStyles.kpiGrid}>
                        <Kpi title="Visitantes vindos da Meta" value={int(k.meta_visitors)} hint={`de ${int(k.visitors)} visitantes no site`} icon={Users} tint={C_META} />
                        <Kpi title="Vendas pagas (Meta)" value={int(k.meta_orders)} hint={`${int(k.meta_orders_started)} pedidos iniciados`} icon={ShoppingBag} tint={C_META} />
                        <Kpi title="Receita (Meta)" value={brl(k.meta_revenue)} hint={`${k.meta_share_revenue || 0}% da receita do site (${brl(k.revenue)})`} icon={DollarSign} tint="#10b981" />
                        <Kpi title="Ticket médio (Meta)" value={brl(k.meta_aov)} icon={Receipt} tint="#0f766e" />
                        <Kpi title="Conversão (Meta)" value={`${k.meta_conversion_rate || 0}%`} hint={`Site todo: ${k.site_conversion_rate || 0}%`} icon={Percent} tint="#7c3aed" />
                        <Kpi title="Investimento em anúncios" value={k.spend != null ? brl(k.spend) : "—"} hint={k.spend != null ? "Gasto informado pela Meta" : "Conecte o token de anúncios"} icon={Megaphone} tint={C_ALL} />
                        <Kpi title="ROAS (receita ÷ gasto)" value={k.roas_site != null ? `${k.roas_site}x` : "—"} hint={k.roas_site != null ? "Vendas medidas no site" : "Precisa do gasto"} icon={TrendingUp} tint="#16a34a" />
                        <Kpi title="Custo por venda (CPA)" value={k.cpa_site != null ? brl(k.cpa_site) : "—"} icon={Target} tint="#dc2626" />
                    </div>

                    <div className={biStyles.chartGrid}>
                        <div className={biStyles.chartCard}>
                            <div className={biStyles.chartCardHeader}>
                                <h3 className={biStyles.chartCardTitle}><Users size={18} /> Visitantes por dia</h3>
                                <span className={biStyles.chartCardSubtitle}>Meta × site todo</span>
                            </div>
                            <div className={biStyles.chartBody}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={daily} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                                        <Tooltip formatter={(v: any) => int(v)} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Line type="monotone" dataKey="visitors" name="Site todo" stroke={C_ALL} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                        <Line type="monotone" dataKey="meta_visitors" name="Vindos da Meta" stroke={C_META} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className={biStyles.chartCard}>
                            <div className={biStyles.chartCardHeader}>
                                <h3 className={biStyles.chartCardTitle}><DollarSign size={18} /> Receita por dia</h3>
                                <span className={biStyles.chartCardSubtitle}>Pedidos pagos</span>
                            </div>
                            <div className={biStyles.chartBody}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
                                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
                                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                                        <Tooltip formatter={(v: any) => brl(v)} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="revenue" name="Site todo" fill={C_ALL} radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="meta_revenue" name="Vindos da Meta" fill={C_META} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {ads.available && (
                            <div className={biStyles.chartCard}>
                                <div className={biStyles.chartCardHeader}>
                                    <h3 className={biStyles.chartCardTitle}><Megaphone size={18} /> Investimento por dia</h3>
                                    <span className={biStyles.chartCardSubtitle}>Gasto na conta de anúncios</span>
                                </div>
                                <div className={biStyles.chartBody}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
                                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                                            <Tooltip formatter={(v: any) => brl(v)} />
                                            <Bar dataKey="spend" name="Investimento" fill={C_META} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className={biStyles.chartCard}>
                            <div className={biStyles.chartCardHeader}>
                                <h3 className={biStyles.chartCardTitle}><Target size={18} /> Funil de compra</h3>
                                <span className={biStyles.chartCardSubtitle}>Eventos no período</span>
                            </div>
                            <table className={biStyles.biTable}>
                                <thead><tr><th>Etapa</th><th style={{ textAlign: "right" }}>Site todo</th><th style={{ textAlign: "right" }}>Meta</th><th style={{ textAlign: "right" }}>% Meta</th></tr></thead>
                                <tbody>
                                    {funnel.map((f: any) => (
                                        <tr key={f.step}>
                                            <td>{f.label}</td>
                                            <td style={{ textAlign: "right" }}>{int(f.all)}</td>
                                            <td style={{ textAlign: "right", fontWeight: 700, color: "#1e293b" }}>{int(f.meta)}</td>
                                            <td style={{ textAlign: "right", color: "#64748b" }}>{f.all ? Math.round((100 * f.meta) / f.all) : 0}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {ads.available && (ads.campaigns || []).length > 0 && (
                        <div className={biStyles.chartCard}>
                            <div className={biStyles.chartCardHeader}>
                                <h3 className={biStyles.chartCardTitle}><Megaphone size={18} /> Campanhas na Meta (dados do Gerenciador de Anúncios)</h3>
                            </div>
                            <div style={{ overflowX: "auto" }}>
                                <table className={biStyles.biTable}>
                                    <thead><tr>
                                        <th>Campanha</th><th style={{ textAlign: "right" }}>Gasto</th><th style={{ textAlign: "right" }}>Alcance</th>
                                        <th style={{ textAlign: "right" }}>Cliques</th><th style={{ textAlign: "right" }}>CPC</th><th style={{ textAlign: "right" }}>CTR</th>
                                        <th style={{ textAlign: "right" }}>Carrinhos</th><th style={{ textAlign: "right" }}>Compras</th><th style={{ textAlign: "right" }}>ROAS</th>
                                    </tr></thead>
                                    <tbody>
                                        {ads.campaigns.map((c: any) => (
                                            <tr key={c.campaign_id}>
                                                <td>{c.campaign_name}</td>
                                                <td style={{ textAlign: "right" }}>{brl(c.spend)}</td>
                                                <td style={{ textAlign: "right" }}>{int(c.reach)}</td>
                                                <td style={{ textAlign: "right" }}>{int(c.clicks)}</td>
                                                <td style={{ textAlign: "right" }}>{brl(c.cpc)}</td>
                                                <td style={{ textAlign: "right" }}>{Number(c.ctr || 0).toFixed(2)}%</td>
                                                <td style={{ textAlign: "right" }}>{int(c.add_to_cart)}</td>
                                                <td style={{ textAlign: "right" }}>{int(c.purchases)}</td>
                                                <td style={{ textAlign: "right" }}>{c.roas != null ? `${c.roas}x` : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className={biStyles.chartGrid}>
                        <div className={biStyles.chartCard}>
                            <div className={biStyles.chartCardHeader}>
                                <h3 className={biStyles.chartCardTitle}><TrendingUp size={18} /> Vendas por campanha (medido no site)</h3>
                                <span className={biStyles.chartCardSubtitle}>pelo parâmetro utm_campaign</span>
                            </div>
                            {(data.campaigns || []).length === 0 ? (
                                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma visita ou pedido com origem Meta no período ainda.</p>
                            ) : (
                                <table className={biStyles.biTable}>
                                    <thead><tr><th>Campanha</th><th style={{ textAlign: "right" }}>Visitantes</th><th style={{ textAlign: "right" }}>Pedidos</th><th style={{ textAlign: "right" }}>Pagos</th><th style={{ textAlign: "right" }}>Receita</th></tr></thead>
                                    <tbody>
                                        {data.campaigns.map((c: any) => (
                                            <tr key={c.campaign}>
                                                <td>{c.campaign}</td>
                                                <td style={{ textAlign: "right" }}>{int(c.visitors)}</td>
                                                <td style={{ textAlign: "right" }}>{int(c.orders)}</td>
                                                <td style={{ textAlign: "right" }}>{int(c.paid_orders)}</td>
                                                <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(c.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className={biStyles.chartCard}>
                            <div className={biStyles.chartCardHeader}>
                                <h3 className={biStyles.chartCardTitle}><ShoppingBag size={18} /> Receita por origem</h3>
                                <span className={biStyles.chartCardSubtitle}>Todos os pedidos pagos</span>
                            </div>
                            {(data.sources || []).length === 0 ? (
                                <p style={{ color: "#94a3b8", fontSize: 14 }}>Sem pedidos pagos no período.</p>
                            ) : (
                                <table className={biStyles.biTable}>
                                    <thead><tr><th>Origem</th><th style={{ textAlign: "right" }}>Pedidos</th><th style={{ textAlign: "right" }}>Receita</th></tr></thead>
                                    <tbody>
                                        {data.sources.map((s: any) => (
                                            <tr key={s.source}><td>{s.source}</td><td style={{ textAlign: "right" }}>{int(s.orders)}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{brl(s.revenue)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className={biStyles.chartCard}>
                        <div className={biStyles.chartCardHeader}>
                            <h3 className={biStyles.chartCardTitle}><Receipt size={18} /> Últimos pedidos vindos da Meta</h3>
                        </div>
                        {(data.recent_orders || []).length === 0 ? (
                            <p style={{ color: "#94a3b8", fontSize: 14 }}>Os pedidos com origem Facebook/Instagram aparecerão aqui.</p>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className={biStyles.biTable}>
                                    <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Campanha</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th>Enviado à Meta</th></tr></thead>
                                    <tbody>
                                        {data.recent_orders.map((o: any) => (
                                            <tr key={o.id}>
                                                <td><a href={`/admin/pedidos?id=${o.id}`} style={{ color: C_META, fontWeight: 700 }}>#{o.id}</a></td>
                                                <td>{o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "-"}</td>
                                                <td>{o.customer}</td>
                                                <td>{o.utm_campaign || o.utm_source || "-"}</td>
                                                <td>{o.status}</td>
                                                <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(o.total)}</td>
                                                <td>{o.capi_sent ? "✅" : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
