"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { Package, CheckCircle, Truck, Clock, Download, FileText, ChevronDown, ChevronUp, XCircle, Eye, RefreshCw, Search, User } from "lucide-react";
import pedidoStyles from "./pedidos.module.css";

interface Order {
    id: number;
    buyer_name: string;
    buyer_email: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    status: string;
    total: number;
    items: any[];
    address: any;
    correios_label_url: string | null;
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
    pending: { label: "Pendente", color: "#d97706", icon: Clock },
    paid: { label: "Pago", color: "#059669", icon: CheckCircle },
    shipped: { label: "Enviado", color: "#2563eb", icon: Truck },
    delivered: { label: "Entregue", color: "#7c3aed", icon: Package },
    cancelled: { label: "Cancelado", color: "#dc2626", icon: XCircle },
    payment_error: { label: "Erro", color: "#dc2626", icon: XCircle },
};

const NEXT_STATUS: Record<string, string[]> = {
    pending: ["paid", "cancelled"],
    paid: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
};

export default function AdminPedidosPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [generatingLabel, setGeneratingLabel] = useState<number | null>(null);

    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const authHeaders = () => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    });

    useEffect(() => { fetchOrders(); }, []);

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
        if (!confirm("⚠️ ATENÇÃO: Esta ação irá EXCLUIR PERMANENTEMENTE todos os pedidos do sistema. Tem certeza que deseja continuar?")) return;
        if (!confirm("Confirmação final: Deseja realmente zerar todo o histórico de testes?")) return;

        try {
            const res = await fetch("/api/orders/admin/clear-all", {
                method: "DELETE",
                headers: authHeaders()
            });
            if (res.ok) {
                alert("Histórico zerado com sucesso!");
                await fetchOrders();
            } else {
                const err = await res.json();
                alert(`Erro ao zerar: ${err.detail || "Falha desconhecida"}`);
            }
        } catch { alert("Erro de conexão"); }
    };

    const updateStatus = async (orderId: number, newStatus: string) => {
        setUpdatingStatus(orderId);
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) await fetchOrders();
            else {
                const err = await res.json();
                alert(`Erro: ${err.detail || "Falha ao atualizar"}`);
            }
        } catch { alert("Erro de conexão"); }
        finally { setUpdatingStatus(null); }
    };

    const generateLabel = async (orderId: number) => {
        setGeneratingLabel(orderId);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
            const res = await fetch(`/api/shipping/generate-label/${orderId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                await fetchOrders();
                if (data.label_url) window.open(data.label_url, "_blank");
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail || "Falha ao gerar etiqueta"}`);
            }
        } catch { alert("Erro de conexão"); }
        finally { setGeneratingLabel(null); }
    };

    const printTicket = (orderId: number) => {
        fetch(`/api/orders/${orderId}/label`, { headers: authHeaders() })
            .then(res => {
                if (!res.ok) throw new Error("Falha ao gerar ticket");
                return res.blob();
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
            })
            .catch(err => alert(err.message));
    };

    const filteredOrders = orders.filter(o => {
        const matchesStatus = filter === "all" || o.status === filter;
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term || 
            String(o.id).includes(term) ||
            (o.buyer_name || o.customer_name || "").toLowerCase().includes(term) ||
            (o.buyer_email || o.customer_email || "").toLowerCase().includes(term);
        return matchesStatus && matchesSearch;
    });

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        paid: orders.filter(o => o.status === "paid").length,
        shipped: orders.filter(o => o.status === "shipped").length,
        delivered: orders.filter(o => o.status === "delivered").length,
        revenue: orders.filter(o => ["paid", "shipped", "delivered"].includes(o.status)).reduce((sum, o) => sum + (o.total || 0), 0),
    };

    return (
        <div style={{ display: "flex", height: "100vh", background: "#fdfdfd", overflow: "hidden" }}>
            <AdminSidebar activePath="/admin/pedidos" />

            <main style={{ flex: 1, padding: "2rem", overflowY: "auto", height: "100%" }}>
                <header className={pedidoStyles.headerRow}>
                    <div className={pedidoStyles.titleSection}>
                        <h1>Gestão de Pedidos</h1>
                        <p>Acompanhe e gerencie as vendas do sistema de forma profissional.</p>
                    </div>
                    <button onClick={fetchOrders} className={pedidoStyles.btnAction + " " + pedidoStyles.btnSecondary}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </header>

                <section className={pedidoStyles.statsGrid}>
                    {[
                        { label: "Total", value: stats.total, icon: "📊", color: "#1a1a1a" },
                        { label: "Pendentes", value: stats.pending, icon: "⏳", color: "#d97706" },
                        { label: "Pagos", value: stats.paid, icon: "✅", color: "#059669" },
                        { label: "Enviados", value: stats.shipped, icon: "🚚", color: "#2563eb" },
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
                            placeholder="Buscar por ID, nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={pedidoStyles.filterTabs}>
                        {["all", "pending", "paid", "shipped", "delivered", "cancelled"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`${pedidoStyles.filterBtn} ${filter === f ? pedidoStyles.filterBtnActive : pedidoStyles.filterBtnInactive}`}
                            >
                                {f === "all" ? `Todos` : (STATUS_LABELS[f]?.label || f)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>Carregando...</div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>Nenhum pedido encontrado.</div>
                ) : (
                    <div className={pedidoStyles.ordersList}>
                        {filteredOrders.map(order => {
                            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280", icon: Clock };
                            const StatusIcon = statusInfo.icon;
                            const isExpanded = expandedId === order.id;
                            const transitions = NEXT_STATUS[order.status] || [];
                            const hasLabel = !!order.correios_label_url;
                            const name = order.buyer_name || order.customer_name || "Cliente";
                            const email = order.buyer_email || order.customer_email || "";

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
                                            
                                            <div className={pedidoStyles.badge} style={{ background: `${statusInfo.color}10`, color: statusInfo.color, border: `1px solid ${statusInfo.color}30` }}>
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
                                                <div className={pedidoStyles.orderTimelineSection}>
                                                    <h4 className={pedidoStyles.sectionTitle}>📍 Status do Pedido</h4>
                                                    <div className={pedidoStyles.timeline}>
                                                        {["pending", "paid", "shipped", "delivered"].map((s, i, arr) => {
                                                            const currentIdx = ["pending", "paid", "shipped", "delivered"].indexOf(order.status);
                                                            const isActive = i <= currentIdx && order.status !== 'cancelled';
                                                            const isLast = i === arr.length - 1;
                                                            const SIcon = STATUS_LABELS[s].icon;
                                                            
                                                            return (
                                                                <div key={s} className={`${pedidoStyles.timelineItem} ${isActive ? pedidoStyles.timelineActive : ""}`}>
                                                                    <div className={pedidoStyles.timelineNode}>
                                                                        <SIcon size={14} />
                                                                    </div>
                                                                    <div className={pedidoStyles.timelineLabel}>{STATUS_LABELS[s].label}</div>
                                                                    {!isLast && <div className={pedidoStyles.timelineConnector}></div>}
                                                                </div>
                                                            );
                                                        })}
                                                        {order.status === 'cancelled' && (
                                                            <div className={`${pedidoStyles.timelineItem} ${pedidoStyles.timelineCancelled}`}>
                                                                <div className={pedidoStyles.timelineNode}><XCircle size={14} /></div>
                                                                <div className={pedidoStyles.timelineLabel}>Cancelado</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

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
                                                            <span>R$ {(order.total - order.shipping_price + order.discount_amount).toFixed(2)}</span>
                                                        </div>
                                                        <div className={pedidoStyles.summaryRow}>
                                                            <span>Frete ({order.shipping_method || "Fixo"})</span>
                                                            <span>R$ {Number(order.shipping_price || 0).toFixed(2)}</span>
                                                        </div>
                                                        {(order.discount_amount || 0) > 0 && (
                                                            <div className={pedidoStyles.summaryRow} style={{ color: "#059669" }}>
                                                                <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                                                                <span>- R$ {Number(order.discount_amount).toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        <div className={pedidoStyles.summaryTotal}>
                                                            <span>Total Final</span>
                                                            <span>R$ {Number(order.total || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={pedidoStyles.customerInfo}>
                                                <h4 className={pedidoStyles.sectionTitle}>👤 Informações de Entrega</h4>
                                                <p><strong>Nome completo:</strong> {name}</p>
                                                <p><strong>E-mail:</strong> {email}</p>
                                                {order.customer_phone && <p><strong>Telefone:</strong> {order.customer_phone}</p>}

                                                {order.address && (
                                                    <div style={{ marginTop: "1rem", color: "#6b7280" }}>
                                                        <p style={{ margin: 0 }}>{order.address.street}, {order.address.number}</p>
                                                        <p style={{ margin: 0 }}>{order.address.neighborhood} - {order.address.city}/{order.address.state}</p>
                                                        <p style={{ margin: 0 }}>CEP: {order.address.cep || order.address.zip}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={pedidoStyles.actionFooter}>
                                                <button onClick={() => printTicket(order.id)} className={pedidoStyles.btnAction + " " + pedidoStyles.btnSecondary}>
                                                    <FileText size={14} /> Ticket PDF
                                                </button>

                                                {hasLabel ? (
                                                    <button onClick={() => window.open(order.correios_label_url!, "_blank")} className={pedidoStyles.btnAction + " " + pedidoStyles.btnPrimary}>
                                                        <Download size={14} /> Etiqueta Correios
                                                    </button>
                                                ) : (order.status === "paid" || order.status === "shipped") && (
                                                    <button onClick={() => generateLabel(order.id)} disabled={generatingLabel === order.id} className={pedidoStyles.btnAction + " " + pedidoStyles.btnPrimary}>
                                                        <Truck size={14} /> {generatingLabel === order.id ? "Gerando..." : "Gerar Etiqueta"}
                                                    </button>
                                                )}

                                                {transitions.map(ns => (
                                                    <button key={ns} onClick={() => updateStatus(order.id, ns)} className={pedidoStyles.btnAction + " " + pedidoStyles.btnSecondary} style={{ color: STATUS_LABELS[ns]?.color }}>
                                                        Marcar como {STATUS_LABELS[ns]?.label}
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
            </main>
        </div>
    );
}
