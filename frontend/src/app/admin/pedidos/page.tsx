"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import {
    Package, CheckCircle, Truck, Clock, Download, FileText,
    ChevronDown, ChevronUp, XCircle, RefreshCw, Search,
    AlertTriangle, ExternalLink, Tag, Loader2, Copy, MapPin
} from "lucide-react";
import pedidoStyles from "./pedidos.module.css";

interface Order {
    id: number;
    buyer_name: string;
    buyer_email: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    customer_cpf: string | null;
    status: string;
    total: number;
    items: any[];
    address: any;
    correios_label_url: string | null;
    etiqueta_url: string | null;
    shipment_id: string | null;
    codigo_rastreio: string | null;
    shipping_method: string | null;
    shipping_price: number;
    stripe_session_id: string | null;
    stripe_payment_id: string | null;
    payment_method: string | null;
    coupon_code: string | null;
    discount_amount: number;
    created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    pending:            { label: "Pendente",          color: "#d97706", icon: Clock },
    paid:               { label: "Pago",              color: "#059669", icon: CheckCircle },
    shipped:            { label: "Enviado",           color: "#2563eb", icon: Truck },
    delivered:          { label: "Entregue",          color: "#7c3aed", icon: Package },
    cancelled:          { label: "Cancelado",         color: "#dc2626", icon: XCircle },
    payment_error:      { label: "Erro Pgto.",        color: "#dc2626", icon: XCircle },
    processando_envio:  { label: "Proc. Envio",       color: "#0891b2", icon: Loader2 },
    erro_envio:         { label: "Erro Envio",        color: "#dc2626", icon: XCircle },
    PROCESSANDO_ENVIO:  { label: "Proc. Envio",       color: "#0891b2", icon: Loader2 },
    ERRO_ENVIO:         { label: "Erro Envio",        color: "#dc2626", icon: XCircle },
};

const NEXT_STATUS: Record<string, string[]> = {
    pending:   ["paid", "cancelled"],
    paid:      ["shipped", "cancelled"],
    shipped:   ["delivered"],
    delivered: [],
    cancelled: [],
};

const ME_BALANCE_URL = "https://melhorenvio.com.br/painel/carteira";

export default function AdminPedidosPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [generatingLabel, setGeneratingLabel] = useState<number | null>(null);
    const [labelResults, setLabelResults] = useState<Record<number, { url: string; tracking: string; shipment: string }>>({});
    const [bannerDismissed, setBannerDismissed] = useState(false);

    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const authHeaders = () => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    });

    useEffect(() => {
        fetchOrders();
        const dismissed = localStorage.getItem("me_banner_dismissed");
        if (dismissed) setBannerDismissed(true);
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/orders/admin/all", { headers: authHeaders() });
            if (res.status === 401 || res.status === 403) { router.push("/admin"); return; }
            if (res.ok) setOrders(await res.json());
        } catch (e) {
            console.error("Erro ao carregar pedidos:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm("⚠️ Esta ação irá EXCLUIR PERMANENTEMENTE todos os pedidos. Confirmar?")) return;
        if (!confirm("Confirmação final: excluir histórico de testes?")) return;
        try {
            const res = await fetch("/api/orders/admin/clear-all", { method: "DELETE", headers: authHeaders() });
            if (res.ok) { alert("Histórico zerado!"); await fetchOrders(); }
            else { const err = await res.json(); alert(`Erro: ${err.detail}`); }
        } catch { alert("Erro de conexão"); }
    };

    const updateStatus = async (orderId: number, newStatus: string) => {
        setUpdatingStatus(orderId);
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) await fetchOrders();
            else { const err = await res.json(); alert(`Erro: ${err.detail}`); }
        } catch { alert("Erro de conexão"); }
        finally { setUpdatingStatus(null); }
    };

    const gerarEtiquetaME = async (orderId: number) => {
        setGeneratingLabel(orderId);
        try {
            const res = await fetch(`/api/shipping/generate-label/${orderId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` }
            });
            const data = await res.json();
            if (res.ok) {
                await fetchOrders();
                if (data.label_url) {
                    setLabelResults(prev => ({
                        ...prev,
                        [orderId]: {
                            url: data.label_url,
                            tracking: data.tracking_code || "",
                            shipment: data.shipment_id || ""
                        }
                    }));
                    window.open(data.label_url, "_blank");
                }
            } else {
                alert(`❌ ${data.detail || "Falha ao gerar etiqueta"}`);
            }
        } catch { alert("Erro de conexão"); }
        finally { setGeneratingLabel(null); }
    };

    const printTicketPDF = async (orderId: number) => {
        const token = getToken();
        try {
            const res = await fetch(`/api/orders/${orderId}/label`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) { alert("Falha ao gerar ticket PDF"); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch { alert("Erro ao gerar ticket PDF"); }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => alert(`Copiado: ${text}`));
    };

    const dismissBanner = () => {
        setBannerDismissed(true);
        localStorage.setItem("me_banner_dismissed", "1");
    };

    const filteredOrders = orders.filter(o => {
        const matchesStatus = filter === "all" || o.status === filter;
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
            String(o.id).includes(term) ||
            (o.buyer_name || o.customer_name || "").toLowerCase().includes(term) ||
            (o.buyer_email || o.customer_email || "").toLowerCase().includes(term) ||
            (o.codigo_rastreio || "").toLowerCase().includes(term) ||
            (o.shipment_id || "").toLowerCase().includes(term);
        return matchesStatus && matchesSearch;
    });

    const stats = {
        total:    orders.length,
        pending:  orders.filter(o => o.status === "pending").length,
        paid:     orders.filter(o => o.status === "paid").length,
        shipped:  orders.filter(o => o.status === "shipped").length,
        delivered:orders.filter(o => o.status === "delivered").length,
        revenue:  orders.filter(o => ["paid","shipped","delivered"].includes(o.status))
                        .reduce((s, o) => s + (o.total || 0), 0),
    };

    return (
        <div style={{ display: "flex", height: "100vh", background: "#fdfdfd", overflow: "hidden" }}>
            <AdminSidebar activePath="/admin/pedidos" />

            <main style={{ flex: 1, padding: "2rem", overflowY: "auto", height: "100%" }}>

                {/* ── Banner Melhor Envio ── */}
                {!bannerDismissed && (
                    <div style={{
                        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                        border: "1.5px solid #fb923c",
                        borderRadius: "16px",
                        padding: "1rem 1.5rem",
                        marginBottom: "1.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap"
                    }}>
                        <AlertTriangle size={22} color="#ea580c" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <strong style={{ color: "#9a3412", fontSize: "0.95rem" }}>
                                ⚠️ Lembre-se de abastecer o saldo da Melhor Envio
                            </strong>
                            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#7c2d12" }}>
                                Sem saldo na carteira, a etiqueta não será gerada. Mantenha saldo suficiente antes de gerar etiquetas.
                            </p>
                        </div>
                        <a
                            href={ME_BALANCE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                                background: "#ea580c", color: "white", padding: "8px 16px",
                                borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700,
                                textDecoration: "none", whiteSpace: "nowrap"
                            }}
                        >
                            Abastecer Saldo <ExternalLink size={14} />
                        </a>
                        <button
                            onClick={dismissBanner}
                            style={{ background: "none", border: "none", color: "#9a3412", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <header className={pedidoStyles.headerRow}>
                    <div className={pedidoStyles.titleSection}>
                        <h1>Gestão de Pedidos</h1>
                        <p>Gerencie vendas e gere etiquetas via Melhor Envio.</p>
                    </div>
                    <button onClick={fetchOrders} className={pedidoStyles.btnAction + " " + pedidoStyles.btnSecondary}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </header>

                <section className={pedidoStyles.statsGrid}>
                    {[
                        { label: "Total",       value: stats.total,     icon: "📊", color: "#1a1a1a" },
                        { label: "Pendentes",   value: stats.pending,   icon: "⏳", color: "#d97706" },
                        { label: "Pagos",       value: stats.paid,      icon: "✅", color: "#059669" },
                        { label: "Enviados",    value: stats.shipped,   icon: "🚚", color: "#2563eb" },
                        { label: "Entregues",   value: stats.delivered, icon: "📦", color: "#7c3aed" },
                        { label: "Faturamento", value: `R$ ${stats.revenue.toFixed(2).replace(".", ",")}`, icon: "💰", color: "#2d5a27" },
                    ].map(stat => (
                        <div key={stat.label} className={pedidoStyles.statCard}>
                            <div className={pedidoStyles.statIcon}>{stat.icon}</div>
                            <div className={pedidoStyles.statValue} style={{ color: stat.color }}>{stat.value}</div>
                            <div className={pedidoStyles.statLabel}>{stat.label}</div>
                        </div>
                    ))}
                </section>

                <div className={pedidoStyles.filtersRow}>
                    <div className={pedidoStyles.searchSection}>
                        <Search className={pedidoStyles.searchIcon} size={18} />
                        <input
                            className={pedidoStyles.searchInput}
                            placeholder="Buscar por ID, nome, e-mail, rastreio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={pedidoStyles.filterTabs}>
                        {["all","pending","paid","shipped","delivered","cancelled"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`${pedidoStyles.filterBtn} ${filter === f ? pedidoStyles.filterBtnActive : pedidoStyles.filterBtnInactive}`}
                            >
                                {f === "all" ? "Todos" : (STATUS_LABELS[f]?.label || f)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>
                        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
                        <p>Carregando pedidos...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>Nenhum pedido encontrado.</div>
                ) : (
                    <div className={pedidoStyles.ordersList}>
                        {filteredOrders.map(order => {
                            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280", icon: Clock };
                            const StatusIcon = statusInfo.icon;
                            const isExpanded = expandedId === order.id;
                            const transitions = NEXT_STATUS[order.status] || [];
                            const name = order.buyer_name || order.customer_name || "Cliente";
                            const email = order.buyer_email || order.customer_email || "";
                            const labelResult = labelResults[order.id];
                            const etiquetaUrl = order.etiqueta_url || labelResult?.url;
                            const trackingCode = order.codigo_rastreio || labelResult?.tracking;
                            const shipmentId = order.shipment_id || labelResult?.shipment;
                            const canGenerateLabel = ["paid","shipped","erro_envio","ERRO_ENVIO"].includes(order.status);

                            return (
                                <div key={order.id} className={`${pedidoStyles.orderCard} ${isExpanded ? pedidoStyles.orderCardExpanded : ""}`}>
                                    <div className={pedidoStyles.orderRowHeader} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                                        <div className={pedidoStyles.orderMainInfo}>
                                            <div className={pedidoStyles.orderIdBox}>
                                                <span>Pedido</span>
                                                <strong>#{order.id}</strong>
                                            </div>
                                            <div className={pedidoStyles.customerBrief}>
                                                <h3 title={name}>{name}</h3>
                                                <p>{email}</p>
                                                {trackingCode && (
                                                    <p style={{ color: "#2563eb", fontSize: "0.75rem", marginTop: "2px" }}>
                                                        🔍 Rastreio: <strong>{trackingCode}</strong>
                                                    </p>
                                                )}
                                                <div className={pedidoStyles.orderDate}>
                                                    {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={pedidoStyles.orderRightSide}>
                                            <div className={pedidoStyles.orderValueTotal}>
                                                <span>Total</span>
                                                <strong>R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}</strong>
                                            </div>
                                            <div className={pedidoStyles.badge} style={{ background: `${statusInfo.color}15`, color: statusInfo.color, border: `1px solid ${statusInfo.color}30` }}>
                                                <StatusIcon size={14} /> {statusInfo.label}
                                            </div>
                                            <div style={{ color: "#cbd5e1" }}>
                                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className={pedidoStyles.expandedContent}>
                                            <div className={pedidoStyles.orderDetailGrid}>

                                                {/* Timeline */}
                                                <div className={pedidoStyles.orderTimelineSection}>
                                                    <h4 className={pedidoStyles.sectionTitle}>📍 Status do Pedido</h4>
                                                    <div className={pedidoStyles.timeline}>
                                                        {["pending","paid","shipped","delivered"].map((s, i, arr) => {
                                                            const currentIdx = ["pending","paid","shipped","delivered"].indexOf(order.status);
                                                            const isActive = i <= currentIdx && !["cancelled","payment_error"].includes(order.status);
                                                            const SIcon = STATUS_LABELS[s].icon;
                                                            return (
                                                                <div key={s} className={`${pedidoStyles.timelineItem} ${isActive ? pedidoStyles.timelineActive : ""}`}>
                                                                    <div className={pedidoStyles.timelineNode}><SIcon size={14} /></div>
                                                                    <div className={pedidoStyles.timelineLabel}>{STATUS_LABELS[s].label}</div>
                                                                    {i < arr.length - 1 && <div className={pedidoStyles.timelineConnector}></div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Melhor Envio Info */}
                                                    {(shipmentId || trackingCode) && (
                                                        <div style={{ marginTop: "1.5rem", background: "#eff6ff", borderRadius: "10px", padding: "1rem", fontSize: "0.8rem" }}>
                                                            <p style={{ fontWeight: 700, color: "#1e40af", marginBottom: "0.5rem" }}>📦 Melhor Envio</p>
                                                            {shipmentId && (
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                                                    <span style={{ color: "#64748b" }}>ID do Envio:</span>
                                                                    <span style={{ fontFamily: "monospace", color: "#1e293b", display: "flex", alignItems: "center", gap: "4px" }}>
                                                                        {shipmentId.slice(0, 18)}...
                                                                        <Copy size={12} style={{ cursor: "pointer", color: "#64748b" }} onClick={(e) => { e.stopPropagation(); copyToClipboard(shipmentId); }} />
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {trackingCode && (
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                    <span style={{ color: "#64748b" }}>Rastreio:</span>
                                                                    <span style={{ fontFamily: "monospace", color: "#1e40af", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                                                                        {trackingCode}
                                                                        <Copy size={12} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); copyToClipboard(trackingCode); }} />
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Itens + Resumo */}
                                                <div className={pedidoStyles.itemsSection}>
                                                    <h4 className={pedidoStyles.sectionTitle}>🛒 Itens do Pedido</h4>
                                                    <div className={pedidoStyles.itemList}>
                                                        {(order.items || []).map((item: any, i: number) => (
                                                            <div key={i} className={pedidoStyles.itemRow}>
                                                                <span>{item.quantity}x {item.product_name}</span>
                                                                <span style={{ fontWeight: 600 }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className={pedidoStyles.summarySection}>
                                                        <h5 className={pedidoStyles.miniSectionTitle}>Resumo Financeiro</h5>
                                                        <div className={pedidoStyles.summaryRow}>
                                                            <span>Subtotal</span>
                                                            <span>R$ {(order.total - order.shipping_price + (order.discount_amount || 0)).toFixed(2)}</span>
                                                        </div>
                                                        <div className={pedidoStyles.summaryRow}>
                                                            <span>Frete ({order.shipping_method || "—"})</span>
                                                            <span>R$ {Number(order.shipping_price || 0).toFixed(2)}</span>
                                                        </div>
                                                        {(order.discount_amount || 0) > 0 && (
                                                            <div className={pedidoStyles.summaryRow} style={{ color: "#059669" }}>
                                                                <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                                                                <span>-R$ {Number(order.discount_amount).toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        <div className={pedidoStyles.summaryTotal}>
                                                            <span>Total Final</span>
                                                            <span>R$ {Number(order.total || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dados do Destinatário */}
                                            <div className={pedidoStyles.customerInfo}>
                                                <h4 className={pedidoStyles.sectionTitle}>👤 Dados de Entrega</h4>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                                                    <div>
                                                        <strong>Nome:</strong> {name}<br />
                                                        <strong>E-mail:</strong> {email}<br />
                                                        {order.customer_phone && <><strong>Tel:</strong> {order.customer_phone}<br /></>}
                                                        {order.customer_cpf && <><strong>CPF:</strong> {order.customer_cpf}<br /></>}
                                                    </div>
                                                    {order.address && (
                                                        <div style={{ color: "#4b5563" }}>
                                                            <strong style={{ color: "#111" }}>Endereço:</strong><br />
                                                            {order.address.street}, {order.address.number}
                                                            {order.address.complement ? ` - ${order.address.complement}` : ""}<br />
                                                            {order.address.neighborhood} — {order.address.city}/{order.address.state}<br />
                                                            CEP: {order.address.postal_code || order.address.cep || order.address.zip}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Ações */}
                                            <div className={pedidoStyles.actionFooter}>
                                                {/* Ticket PDF interno */}
                                                <button
                                                    onClick={() => printTicketPDF(order.id)}
                                                    className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                    title="Gera um PDF interno com os dados do pedido"
                                                >
                                                    <FileText size={14} /> Ticket PDF
                                                </button>

                                                {/* Etiqueta Melhor Envio */}
                                                {etiquetaUrl ? (
                                                    <>
                                                        <button
                                                            onClick={() => window.open(etiquetaUrl, "_blank")}
                                                            className={`${pedidoStyles.btnAction} ${pedidoStyles.btnPrimary}`}
                                                        >
                                                            <Download size={14} /> Etiqueta Melhor Envio
                                                        </button>
                                                        <button
                                                            onClick={() => gerarEtiquetaME(order.id)}
                                                            disabled={generatingLabel === order.id}
                                                            className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                            title="Re-gerar etiqueta no Melhor Envio"
                                                        >
                                                            <RefreshCw size={14} />
                                                            {generatingLabel === order.id ? "Gerando..." : "Re-gerar"}
                                                        </button>
                                                    </>
                                                ) : canGenerateLabel && (
                                                    <button
                                                        onClick={() => gerarEtiquetaME(order.id)}
                                                        disabled={generatingLabel === order.id}
                                                        className={`${pedidoStyles.btnAction} ${pedidoStyles.btnPrimary}`}
                                                        style={{ position: "relative" }}
                                                    >
                                                        {generatingLabel === order.id ? (
                                                            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Gerando Etiqueta ME...</>
                                                        ) : (
                                                            <><Tag size={14} /> Gerar Etiqueta Melhor Envio</>
                                                        )}
                                                    </button>
                                                )}

                                                {/* Rastrear no ME */}
                                                {trackingCode && (
                                                    <a
                                                        href={`https://melhorrastreio.com.br/rastreio/${trackingCode}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                        style={{ textDecoration: "none" }}
                                                    >
                                                        <MapPin size={14} /> Rastrear Envio
                                                    </a>
                                                )}

                                                {/* Transições de Status */}
                                                {transitions.map(ns => (
                                                    <button
                                                        key={ns}
                                                        onClick={() => updateStatus(order.id, ns)}
                                                        disabled={updatingStatus === order.id}
                                                        className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                        style={{ color: STATUS_LABELS[ns]?.color }}
                                                    >
                                                        {updatingStatus === order.id ? "..." : `Marcar como ${STATUS_LABELS[ns]?.label}`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <footer className={pedidoStyles.clearSection}>
                    <p style={{ fontSize: "0.875rem", color: "#ef4444" }}>Zona de Perigo</p>
                    <button onClick={handleClearAll} className={pedidoStyles.btnClear}>
                        <XCircle size={16} /> Zerar Histórico de Pedidos
                    </button>
                    <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
                        Esta ação removerá todos os pedidos permanentemente. Use apenas para limpeza de testes.
                    </p>
                </footer>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </main>
        </div>
    );
}
