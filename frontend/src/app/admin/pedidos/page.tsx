"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { Package, CheckCircle, Truck, Clock, Download, FileText } from "lucide-react";

interface Order {
    id: number;
    buyer_name: string;
    buyer_email: string;
    status: string;
    total: number;
    items: any[];
    address: any;
    correios_label_url: string | null;
    shipping_method: string | null;
    created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pendente", color: "#d97706", icon: Clock },
    paid: { label: "Pago", color: "#059669", icon: CheckCircle },
    shipped: { label: "Enviado", color: "#2563eb", icon: Truck },
    delivered: { label: "Entregue", color: "#7c3aed", icon: Package },
    cancelled: { label: "Cancelado", color: "#dc2626", icon: Clock },
};

export default function AdminPedidosPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingLabel, setGeneratingLabel] = useState<number | null>(null);
    const [filter, setFilter] = useState("all");

    const apiUrl = typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`)
        : "";

    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/payment/admin/orders`, {
                headers: { "Authorization": `Bearer ${getToken()}` }
            });
            if (res.status === 401 || res.status === 403) {
                router.push("/admin");
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (e) {
            console.error("Erro ao carregar pedidos:", e);
        } finally {
            setLoading(false);
        }
    };

    const generateLabel = async (orderId: number) => {
        setGeneratingLabel(orderId);
        try {
            const res = await fetch(`${apiUrl}/shipping/generate-label/${orderId}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Refresh orders list
                await fetchOrders();
                // Open label in new tab
                if (data.label_url) {
                    window.open(`${apiUrl}${data.label_url}`, "_blank");
                }
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail || "Falha ao gerar etiqueta"}`);
            }
        } catch (e) {
            console.error("Erro ao gerar etiqueta:", e);
            alert("Erro de conexão ao gerar etiqueta");
        } finally {
            setGeneratingLabel(null);
        }
    };

    const downloadLabel = (orderId: number) => {
        window.open(`${apiUrl}/shipping/label/${orderId}`, "_blank");
    };

    const filteredOrders = filter === "all"
        ? orders
        : orders.filter(o => o.status === filter);

    const stats = {
        total: orders.length,
        paid: orders.filter(o => o.status === "paid").length,
        shipped: orders.filter(o => o.status === "shipped").length,
        pending: orders.filter(o => o.status === "pending").length,
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
            <AdminSidebar activePath="/admin/pedidos" />

            <main style={{ flex: 1, padding: "32px", overflowX: "auto" }}>
                <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "1.8rem", marginBottom: "8px", color: "#1a1a1a" }}>
                    📦 Pedidos Mercado Pago
                </h1>
                <p style={{ color: "#888", marginBottom: "28px", fontSize: "0.9rem" }}>
                    Gerencie pedidos pagos e gere etiquetas dos Correios
                </p>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "28px" }}>
                    {[
                        { label: "Total", value: stats.total, color: "#6b7280" },
                        { label: "Aguardando Pagto", value: stats.pending, color: "#d97706" },
                        { label: "Pagos", value: stats.paid, color: "#059669" },
                        { label: "Enviados", value: stats.shipped, color: "#2563eb" },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            background: "white", borderRadius: "12px", padding: "20px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textAlign: "center"
                        }}>
                            <div style={{ fontSize: "2rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "4px" }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filter */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                    {["all", "pending", "paid", "shipped", "delivered"].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: "8px 18px", borderRadius: "20px", border: "none", cursor: "pointer",
                            background: filter === f ? "#2d5a27" : "#e5e7eb",
                            color: filter === f ? "white" : "#374151",
                            fontWeight: filter === f ? 700 : 400, fontSize: "0.85rem"
                        }}>
                            {f === "all" ? "Todos" : STATUS_LABELS[f]?.label || f}
                        </button>
                    ))}
                    <button onClick={fetchOrders} style={{
                        padding: "8px 18px", borderRadius: "20px", border: "1.5px solid #2d5a27",
                        background: "transparent", color: "#2d5a27", cursor: "pointer", fontSize: "0.85rem"
                    }}>
                        🔄 Atualizar
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
                        Carregando pedidos...
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
                        Nenhum pedido encontrado.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {filteredOrders.map(order => {
                            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280", icon: Clock };
                            const StatusIcon = statusInfo.icon;
                            const canGenerate = order.status === "paid";
                            const hasLabel = !!order.correios_label_url;

                            return (
                                <div key={order.id} style={{
                                    background: "white", borderRadius: "14px", padding: "20px 24px",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto",
                                    gap: "16px", alignItems: "center"
                                }}>
                                    {/* Order Info */}
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "#111" }}>
                                            Pedido #{order.id}
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "#555", marginTop: "4px" }}>
                                            {order.buyer_name || "Cliente"}
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "#888" }}>
                                            {order.buyer_email}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "#aaa", marginTop: "4px" }}>
                                            {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR") : "-"}
                                        </div>
                                    </div>

                                    {/* Address & Items */}
                                    <div>
                                        <div style={{ fontSize: "0.82rem", color: "#555" }}>
                                            {order.address?.street && (
                                                <>{order.address.street}, {order.address.city} – {order.address.zip}</>
                                            )}
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "4px" }}>
                                            {(order.items || []).length} produto(s) · {order.shipping_method?.toUpperCase() || "PAC"}
                                        </div>
                                        <div style={{ fontWeight: 600, color: "#059669", marginTop: "4px" }}>
                                            R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <span style={{
                                            display: "inline-flex", alignItems: "center", gap: "6px",
                                            background: `${statusInfo.color}15`, color: statusInfo.color,
                                            padding: "6px 14px", borderRadius: "20px",
                                            fontWeight: 600, fontSize: "0.82rem"
                                        }}>
                                            <StatusIcon size={14} />
                                            {statusInfo.label}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                                        {hasLabel ? (
                                            <button
                                                onClick={() => downloadLabel(order.id)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "6px",
                                                    background: "#2563eb", color: "white", border: "none",
                                                    padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                                                    fontWeight: 600, fontSize: "0.8rem"
                                                }}
                                            >
                                                <Download size={14} /> Baixar Etiqueta
                                            </button>
                                        ) : canGenerate ? (
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
                                                <FileText size={14} />
                                                {generatingLabel === order.id ? "Gerando..." : "Gerar Etiqueta"}
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: "0.75rem", color: "#aaa" }}>
                                                {order.status === "pending" ? "Aguardando pagto" : "Já enviado"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
