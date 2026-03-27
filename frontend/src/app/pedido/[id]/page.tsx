"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";

const STATUS_STEPS = [
    { key: "pending", label: "Pendente", icon: "⏳", color: "#f59e0b" },
    { key: "paid", label: "Pago", icon: "✅", color: "#10b981" },
    { key: "shipped", label: "Enviado", icon: "🚚", color: "#3b82f6" },
    { key: "delivered", label: "Entregue", icon: "📦", color: "#2d5a27" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: "Aguardando pagamento", color: "#f59e0b", icon: "⏳" },
    paid: { label: "Pagamento confirmado", color: "#10b981", icon: "✅" },
    shipped: { label: "Enviado", color: "#3b82f6", icon: "🚚" },
    delivered: { label: "Entregue", color: "#2d5a27", icon: "📦" },
    cancelled: { label: "Cancelado", color: "#ef4444", icon: "❌" },
    payment_error: { label: "Erro no pagamento", color: "#ef4444", icon: "⚠️" },
};

function OrderContent() {
    const params = useParams();
    const orderId = params?.id;
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrder = async () => {
        const token = localStorage.getItem("token");
        if (!token || !orderId) { setLoading(false); return; }
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setOrder(await res.json());
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchOrder();
        const interval = setInterval(() => {
            if (order?.status === "pending") fetchOrder();
        }, 6000);
        return () => clearInterval(interval);
    }, [orderId, order?.status]);

    const statusInfo = STATUS_MAP[order?.status] || STATUS_MAP["pending"];
    const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === order?.status);
    const isCancelled = order?.status === "cancelled" || order?.status === "payment_error";

    return (
        <main>
            <Header />
            <div className="container" style={{ maxWidth: 640, padding: "60px 20px" }}>
                {loading ? (
                    <p style={{ textAlign: "center", color: "#888" }}>Carregando pedido...</p>
                ) : !order ? (
                    <div style={{ textAlign: "center" }}>
                        <h2>Pedido não encontrado</h2>
                        <Link href="/produtos" style={{
                            display: "inline-block", marginTop: "16px", padding: "12px 24px",
                            background: "#2d5a27", color: "white", borderRadius: "8px",
                            textDecoration: "none", fontWeight: 700
                        }}>Ver produtos</Link>
                    </div>
                ) : (
                    <div style={{
                        background: "white", borderRadius: 20, padding: "36px 32px",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.10)"
                    }}>
                        {/* Header */}
                        <div style={{ textAlign: "center", marginBottom: 28 }}>
                            <div style={{ fontSize: "2.5rem" }}>{statusInfo.icon}</div>
                            <h1 style={{ fontSize: "1.4rem", color: "#1a3a16", margin: "8px 0 4px" }}>
                                Pedido #{order.id}
                            </h1>
                            <span style={{
                                display: "inline-block", padding: "5px 18px", borderRadius: 20,
                                fontSize: "0.88rem", fontWeight: 600,
                                background: statusInfo.color + "18", color: statusInfo.color,
                            }}>
                                {statusInfo.label}
                            </span>
                        </div>

                        {/* Status Tracker */}
                        {!isCancelled && (
                            <div style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                margin: "0 0 32px 0", position: "relative"
                            }}>
                                {/* Background Line */}
                                <div style={{
                                    position: "absolute", top: "18px", left: "12%", right: "12%",
                                    height: "3px", background: "#e5e7eb", zIndex: 0
                                }} />
                                {/* Active Line */}
                                <div style={{
                                    position: "absolute", top: "18px", left: "12%",
                                    width: `${Math.max(0, currentStepIdx) / (STATUS_STEPS.length - 1) * 76}%`,
                                    height: "3px", background: "#2d5a27", zIndex: 1,
                                    transition: "width 0.5s ease"
                                }} />

                                {STATUS_STEPS.map((step, idx) => {
                                    const isActive = idx <= currentStepIdx;
                                    return (
                                        <div key={step.key} style={{
                                            display: "flex", flexDirection: "column", alignItems: "center",
                                            zIndex: 2, flex: 1
                                        }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: "50%",
                                                background: isActive ? "#2d5a27" : "#e5e7eb",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "1rem",
                                                transition: "background 0.3s ease",
                                                border: isActive ? "3px solid #2d5a27" : "3px solid #e5e7eb",
                                            }}>
                                                {isActive ? "✓" : step.icon}
                                            </div>
                                            <span style={{
                                                fontSize: "0.7rem", marginTop: "6px",
                                                color: isActive ? "#2d5a27" : "#94a3b8",
                                                fontWeight: isActive ? 700 : 400, textAlign: "center"
                                            }}>
                                                {step.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Order Items */}
                        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20, marginBottom: 16 }}>
                            <h3 style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 12, fontWeight: 700 }}>
                                🛒 Itens do Pedido
                            </h3>
                            {(order.items || []).map((item: any, i: number) => (
                                <div key={i} style={{
                                    display: "flex", justifyContent: "space-between",
                                    padding: "8px 0", borderBottom: i < (order.items?.length - 1) ? "1px solid #f8fafc" : "none"
                                }}>
                                    <span style={{ color: "#374151", fontSize: "0.9rem" }}>
                                        {item.quantity}x {item.product_name}
                                    </span>
                                    <span style={{ fontWeight: 600, color: "#111" }}>
                                        R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Shipping & Total */}
                        <div style={{
                            background: "#f8fafc", borderRadius: 12, padding: "16px 20px",
                            marginBottom: 20
                        }}>
                            {order.shipping_method && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.88rem" }}>
                                    <span style={{ color: "#666" }}>🚚 Frete ({order.shipping_method?.toUpperCase()})</span>
                                    <span>R$ {Number(order.shipping_price || 0).toFixed(2).replace(".", ",")}</span>
                                </div>
                            )}
                            {order.discount_amount > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.88rem", color: "#15803d" }}>
                                    <span>🏷️ Desconto</span>
                                    <span>- R$ {Number(order.discount_amount).toFixed(2).replace(".", ",")}</span>
                                </div>
                            )}
                            <div style={{
                                display: "flex", justifyContent: "space-between",
                                paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: "1.05rem"
                            }}>
                                <span style={{ fontWeight: 700, color: "#111" }}>Total</span>
                                <span style={{ fontWeight: 700, color: "#2d5a27" }}>
                                    R$ {Number(order.total).toFixed(2).replace(".", ",")}
                                </span>
                            </div>
                        </div>

                        {/* Address */}
                        {order.address && order.address.street && (
                            <div style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 8, fontWeight: 700 }}>
                                    📍 Endereço de Entrega
                                </h3>
                                <div style={{ fontSize: "0.85rem", color: "#555", lineHeight: 1.6 }}>
                                    <p style={{ margin: 0 }}>{order.address.street}, {order.address.number}</p>
                                    {order.address.complement && <p style={{ margin: 0 }}>{order.address.complement}</p>}
                                    <p style={{ margin: 0 }}>{order.address.neighborhood} — {order.address.city}/{order.address.state}</p>
                                    {order.address.cep && <p style={{ margin: 0 }}>CEP: {order.address.cep}</p>}
                                </div>
                            </div>
                        )}

                        {/* Date */}
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", marginBottom: 20 }}>
                            Pedido criado em {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <Link href="/perfil?tab=orders" style={{
                                flex: 1, textAlign: "center", padding: "12px 20px",
                                background: "#2d5a27", color: "white", borderRadius: 10,
                                textDecoration: "none", fontWeight: 700, fontSize: "0.9rem"
                            }}>
                                Meus Pedidos
                            </Link>
                            <Link href="/produtos" style={{
                                flex: 1, textAlign: "center", padding: "12px 20px",
                                border: "2px solid #2d5a27", color: "#2d5a27", borderRadius: 10,
                                textDecoration: "none", fontWeight: 700, fontSize: "0.9rem"
                            }}>
                                Continuar Comprando
                            </Link>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
        </main>
    );
}

export default function OrderPage() {
    return (
        <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Carregando...</div>}>
            <OrderContent />
        </Suspense>
    );
}
