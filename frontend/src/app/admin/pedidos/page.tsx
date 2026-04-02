"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { Package, CheckCircle, Truck, Clock, Download, FileText, ChevronDown, ChevronUp, XCircle, Eye, RefreshCw } from "lucide-react";
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
        // Opens the order label/ticket PDF in a new tab using the Bearer auth via a trick:
        // We fetch and create an object URL
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

    const downloadExistingLabel = (url: string) => {
        window.open(url, "_blank");
    };

    const filteredOrders = filter === "all" ? orders : orders.filter(o => o.status === filter);

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        paid: orders.filter(o => o.status === "paid").length,
        shipped: orders.filter(o => o.status === "shipped").length,
        delivered: orders.filter(o => o.status === "delivered").length,
        revenue: orders.filter(o => ["paid", "shipped", "delivered"].includes(o.status)).reduce((sum, o) => sum + (o.total || 0), 0),
    };

    return (
        <div style={{ display: "flex", height: "100vh", background: "#f9fafb", overflow: "hidden" }}>
            <AdminSidebar activePath="/admin/pedidos" />

            <main style={{ flex: 1, padding: "32px", overflowY: "auto", overflowX: "hidden", height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "1.8rem", color: "#1a1a1a" }}>
                        📦 Gestão de Pedidos
                    </h1>
                    <button onClick={fetchOrders} style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 18px", borderRadius: "8px", border: "1.5px solid #2d5a27",
                        background: "white", color: "#2d5a27", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem"
                    }}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
                <p style={{ color: "#888", marginBottom: "28px", fontSize: "0.9rem" }}>
                    Gerencie pedidos, altere status e gere etiquetas de envio
                </p>

                {/* Stats */}
                <div className={pedidoStyles.statsGrid}>
                    {[
                        { label: "Total", value: stats.total, color: "#6b7280", icon: "📊" },
                        { label: "Pendentes", value: stats.pending, color: "#d97706", icon: "⏳" },
                        { label: "Pagos", value: stats.paid, color: "#059669", icon: "✅" },
                        { label: "Enviados", value: stats.shipped, color: "#2563eb", icon: "🚚" },
                        { label: "Entregues", value: stats.delivered, color: "#7c3aed", icon: "📦" },
                        { label: "Receita", value: `R$ ${stats.revenue.toFixed(2).replace(".", ",")}`, color: "#059669", icon: "💰" },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            background: "white", borderRadius: "12px", padding: "18px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textAlign: "center"
                        }}>
                            <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{stat.icon}</div>
                            <div style={{ fontSize: typeof stat.value === "string" ? "1.1rem" : "1.8rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: "0.72rem", color: "#888", marginTop: "2px" }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filter */}
                <div className={pedidoStyles.filtersRow}>
                    {["all", "pending", "paid", "shipped", "delivered", "cancelled"].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: "7px 16px", borderRadius: "20px", border: "none", cursor: "pointer",
                            background: filter === f ? "#2d5a27" : "#e5e7eb",
                            color: filter === f ? "white" : "#374151",
                            fontWeight: filter === f ? 700 : 400, fontSize: "0.82rem",
                            transition: "all 0.2s"
                        }}>
                            {f === "all" ? `Todos (${stats.total})` : `${STATUS_LABELS[f]?.label || f} (${orders.filter(o => o.status === f).length})`}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>Carregando pedidos...</div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>Nenhum pedido encontrado.</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {filteredOrders.map(order => {
                            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280", icon: Clock };
                            const StatusIcon = statusInfo.icon;
                            const isExpanded = expandedId === order.id;
                            const transitions = NEXT_STATUS[order.status] || [];
                            const hasLabel = !!order.correios_label_url;
                            const name = order.buyer_name || order.customer_name || "Cliente";
                            const email = order.buyer_email || order.customer_email || "";

                            return (
                                <div key={order.id} style={{
                                    background: "white", borderRadius: "14px",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                                    border: isExpanded ? "2px solid #2d5a27" : "1px solid #f1f5f9",
                                    overflow: "hidden"
                                }}>
                                    {/* Row Header */}
                                    <div
                                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                        className={pedidoStyles.orderRowHeader}
                                    >
                                        <div className={pedidoStyles.orderInfo}>
                                            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111" }}>
                                                Pedido #{order.id}
                                            </div>
                                            <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "3px" }}>{name}</div>
                                            <div style={{ fontSize: "0.75rem", color: "#aaa", marginTop: "2px" }}>
                                                {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                            </div>
                                        </div>

                                        <div className={pedidoStyles.orderItems} style={{ fontSize: "0.82rem", color: "#555" }}>
                                            {(order.items || []).length} item(s)
                                            <div style={{ fontWeight: 600, color: "#059669", marginTop: "4px" }}>
                                                R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}
                                            </div>
                                        </div>

                                        <div className={pedidoStyles.orderStatus}>
                                            <span style={{
                                                display: "inline-flex", alignItems: "center", gap: "5px",
                                                background: `${statusInfo.color}12`, color: statusInfo.color,
                                                padding: "5px 12px", borderRadius: "20px",
                                                fontWeight: 600, fontSize: "0.8rem"
                                            }}>
                                                <StatusIcon size={13} /> {statusInfo.label}
                                            </span>
                                        </div>

                                        {/* Quick Actions */}
                                        <div className={pedidoStyles.orderQuickActions} onClick={(e) => e.stopPropagation()}>
                                            {transitions.map(ns => (
                                                <button key={ns}
                                                    onClick={() => updateStatus(order.id, ns)}
                                                    disabled={updatingStatus === order.id}
                                                    style={{
                                                        padding: "5px 10px", borderRadius: "6px", border: "none",
                                                        cursor: "pointer", fontWeight: 600, fontSize: "0.72rem",
                                                        background: ns === "cancelled" ? "#fef2f2" : STATUS_LABELS[ns]?.color + "15",
                                                        color: ns === "cancelled" ? "#dc2626" : STATUS_LABELS[ns]?.color,
                                                        opacity: updatingStatus === order.id ? 0.5 : 1
                                                    }}
                                                >
                                                    {STATUS_LABELS[ns]?.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className={pedidoStyles.orderChevron}>{isExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}</div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className={pedidoStyles.expandedDetails}>
                                            {/* Items */}
                                            <div>
                                                <h4 style={{ fontSize: "0.85rem", color: "#374151", marginBottom: "10px", fontWeight: 700 }}>
                                                    🛒 Itens do Pedido
                                                </h4>
                                                {(order.items || []).map((item: any, i: number) => (
                                                    <div key={i} style={{
                                                        display: "flex", justifyContent: "space-between",
                                                        padding: "6px 0", fontSize: "0.85rem",
                                                        borderBottom: i < (order.items || []).length - 1 ? "1px solid #f1f5f9" : "none"
                                                    }}>
                                                        <span style={{ color: "#374151" }}>{item.quantity}x {item.product_name}</span>
                                                        <span style={{ fontWeight: 600 }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#666" }}>
                                                        <span>Frete ({order.shipping_method?.toUpperCase() || "FIXO"})</span>
                                                        <span>R$ {Number(order.shipping_price || 0).toFixed(2)}</span>
                                                    </div>
                                                    {(order.discount_amount || 0) > 0 && (
                                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#15803d" }}>
                                                            <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                                                            <span>- R$ {Number(order.discount_amount).toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", fontWeight: 700, marginTop: "6px", color: "#2d5a27" }}>
                                                        <span>Total</span>
                                                        <span>R$ {Number(order.total || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Customer & Address */}
                                            <div>
                                                <h4 style={{ fontSize: "0.85rem", color: "#374151", marginBottom: "10px", fontWeight: 700 }}>
                                                    👤 Cliente
                                                </h4>
                                                <div style={{ fontSize: "0.85rem", color: "#555", lineHeight: 1.8 }}>
                                                    <p style={{ margin: 0 }}><strong>Nome:</strong> {name}</p>
                                                    <p style={{ margin: 0 }}><strong>Email:</strong> {email}</p>
                                                    {order.customer_phone && <p style={{ margin: 0 }}><strong>Tel:</strong> {order.customer_phone}</p>}
                                                    <p style={{ margin: 0 }}><strong>Pagamento:</strong> {order.payment_method?.toUpperCase() || "STRIPE"}</p>
                                                </div>

                                                {order.address && order.address.street && (
                                                    <>
                                                        <h4 style={{ fontSize: "0.85rem", color: "#374151", marginTop: "16px", marginBottom: "8px", fontWeight: 700 }}>
                                                            📍 Endereço
                                                        </h4>
                                                        <div style={{ fontSize: "0.82rem", color: "#555", lineHeight: 1.6 }}>
                                                            <p style={{ margin: 0 }}>{order.address.street}{order.address.number ? `, ${order.address.number}` : ""}</p>
                                                            {order.address.complement && <p style={{ margin: 0 }}>{order.address.complement}</p>}
                                                            <p style={{ margin: 0 }}>{order.address.neighborhood || ""} — {order.address.city || ""}/{order.address.state || ""}</p>
                                                            {(order.address.cep || order.address.zip) && <p style={{ margin: 0 }}>CEP: {order.address.cep || order.address.zip}</p>}
                                                        </div>
                                                    </>
                                                )}

                                                {order.stripe_payment_id && (
                                                    <div style={{ marginTop: "16px" }}>
                                                        <h4 style={{ fontSize: "0.85rem", color: "#374151", marginBottom: "6px", fontWeight: 700 }}>
                                                            💳 Stripe
                                                        </h4>
                                                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", wordBreak: "break-all" }}>
                                                            <p style={{ margin: "0 0 2px" }}>Payment: {order.stripe_payment_id}</p>
                                                            {order.stripe_session_id && <p style={{ margin: 0 }}>Session: {order.stripe_session_id}</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions Bar */}
                                            <div className={pedidoStyles.expandedActions}>
                                                {/* Ticket PDF */}
                                                <button onClick={() => printTicket(order.id)} style={{
                                                    display: "flex", alignItems: "center", gap: "6px",
                                                    background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0",
                                                    padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                                                    fontWeight: 600, fontSize: "0.8rem"
                                                }}>
                                                    <FileText size={14} /> Ticket do Pedido (PDF)
                                                </button>

                                                {/* Correios Label */}
                                                {hasLabel ? (
                                                    <button onClick={() => downloadExistingLabel(order.correios_label_url!)} style={{
                                                        display: "flex", alignItems: "center", gap: "6px",
                                                        background: "#2563eb", color: "white", border: "none",
                                                        padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                                                        fontWeight: 600, fontSize: "0.8rem"
                                                    }}>
                                                        <Download size={14} /> Baixar Etiqueta Correios
                                                    </button>
                                                ) : (order.status === "paid" || order.status === "shipped") && (
                                                    <button
                                                        onClick={() => generateLabel(order.id)}
                                                        disabled={generatingLabel === order.id}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "6px",
                                                            background: generatingLabel === order.id ? "#94a3b8" : "#2d5a27",
                                                            color: "white", border: "none",
                                                            padding: "8px 16px", borderRadius: "8px",
                                                            cursor: generatingLabel === order.id ? "not-allowed" : "pointer",
                                                            fontWeight: 600, fontSize: "0.8rem"
                                                        }}
                                                    >
                                                        <Truck size={14} />
                                                        {generatingLabel === order.id ? "Gerando..." : "Gerar Etiqueta Correios"}
                                                    </button>
                                                )}

                                                {/* Status Changes */}
                                                {transitions.map(ns => (
                                                    <button key={ns}
                                                        onClick={() => updateStatus(order.id, ns)}
                                                        disabled={updatingStatus === order.id}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "6px",
                                                            padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                                                            fontWeight: 600, fontSize: "0.8rem", border: "none",
                                                            background: ns === "cancelled" ? "#fef2f2" : STATUS_LABELS[ns]?.color + "20",
                                                            color: ns === "cancelled" ? "#dc2626" : STATUS_LABELS[ns]?.color,
                                                            opacity: updatingStatus === order.id ? 0.5 : 1
                                                        }}
                                                    >
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
            </main>
        </div>
    );
}
