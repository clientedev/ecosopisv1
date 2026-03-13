"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: "Aguardando pagamento", color: "#f59e0b", icon: "⏳" },
    paid: { label: "Pagamento confirmado", color: "#10b981", icon: "✅" },
    shipped: { label: "Enviado", color: "#3b82f6", icon: "🚚" },
    delivered: { label: "Entregue", color: "#2d5a27", icon: "📦" },
    cancelled: { label: "Cancelado", color: "#ef4444", icon: "❌" },
    mp_error: { label: "Erro no pagamento", color: "#ef4444", icon: "⚠️" },
};

export default function OrderPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const orderId = params?.id;
    const returnStatus = searchParams?.get("status"); // from MP redirect

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const fetchOrder = async () => {
        const token = localStorage.getItem("token");
        if (!token || !orderId) return;
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
        // Poll while pending
        const interval = setInterval(() => {
            if (order?.status === "pending") fetchOrder();
        }, 6000);
        return () => clearInterval(interval);
    }, [orderId, order?.status]);

    const copyPix = () => {
        if (order?.pix_qr_code) {
            navigator.clipboard.writeText(order.pix_qr_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const statusInfo = STATUS_LABELS[order?.status] || STATUS_LABELS["pending"];

    return (
        <main>
            <Header />
            <div className="container" style={{ maxWidth: 560, padding: "60px 20px" }}>
                {loading ? (
                    <p style={{ textAlign: "center", color: "#888" }}>Carregando pedido...</p>
                ) : !order ? (
                    <div style={{ textAlign: "center" }}>
                        <h2>Pedido não encontrado</h2>
                        <Link href="/produtos" className="btn-primary">Ver produtos</Link>
                    </div>
                ) : (
                    <div style={{ background: "white", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 40px rgba(0,0,0,0.10)" }}>
                        {/* Header */}
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                            <div style={{ fontSize: "2.5rem" }}>{statusInfo.icon}</div>
                            <h1 style={{ fontSize: "1.3rem", color: "#1a3a16", margin: "8px 0 4px" }}>Pedido #{order.id}</h1>
                            <span style={{
                                display: "inline-block", padding: "4px 16px",
                                borderRadius: 20, fontSize: "0.85rem", fontWeight: 600,
                                background: statusInfo.color + "20", color: statusInfo.color,
                            }}>
                                {statusInfo.label}
                            </span>
                        </div>

                        {/* MP return banner */}
                        {returnStatus === "success" && (
                            <div style={{ background: "#e8f5e9", borderRadius: 10, padding: "12px 16px", marginBottom: 20, textAlign: "center" }}>
                                <p style={{ margin: 0, color: "#2d5a27", fontWeight: 600 }}>✅ Pagamento aprovado com sucesso!</p>
                            </div>
                        )}
                        {returnStatus === "failure" && (
                            <div style={{ background: "#ffe4e4", borderRadius: 10, padding: "12px 16px", marginBottom: 20, textAlign: "center" }}>
                                <p style={{ margin: 0, color: "#b00020", fontWeight: 600 }}>❌ Pagamento recusado. Tente novamente.</p>
                            </div>
                        )}

                        {/* PIX section */}
                        {order.status === "pending" && order.pix_qr_code && (
                            <div style={{ textAlign: "center", marginBottom: 24 }}>
                                <p style={{ fontWeight: 600, color: "#333", marginBottom: 12 }}>💠 Pague com PIX:</p>
                                {order.pix_qr_code_base64 && (
                                    <div style={{ display: "inline-block", border: "3px solid #2d5a27", borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
                                        <img
                                            src={`data:image/png;base64,${order.pix_qr_code_base64}`}
                                            alt="QR Code PIX" style={{ width: 180, height: 180, display: "block" }}
                                        />
                                    </div>
                                )}
                                <div style={{ background: "#f5f5f5", borderRadius: 10, padding: "10px 14px", wordBreak: "break-all", fontSize: "0.7rem", color: "#555", marginBottom: 12, maxHeight: 72, overflow: "auto" }}>
                                    {order.pix_qr_code}
                                </div>
                                <button className="btn-primary" style={{ width: "100%" }} onClick={copyPix}>
                                    {copied ? "✅ Copiado!" : "📋 COPIAR CÓDIGO PIX"}
                                </button>
                            </div>
                        )}

                        {/* Order details */}
                        <div style={{ borderTop: "1px solid #eee", paddingTop: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ color: "#666" }}>Total</span>
                                <span style={{ fontWeight: 700, color: "#2d5a27" }}>R$ {Number(order.total).toFixed(2)}</span>
                            </div>
                            {order.ship_method && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ color: "#666" }}>Frete</span>
                                    <span>{order.shipping_method?.toUpperCase()} — R$ {Number(order.shipping_price || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ marginTop: 12 }}>
                                <p style={{ color: "#666", fontSize: "0.85rem", margin: "0 0 6px" }}>Itens:</p>
                                {(order.items || []).map((item: any, i: number) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: 4 }}>
                                        <span>{item.quantity}x {item.product_name}</span>
                                        <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                            <Link href="/produtos" className="btn-outline" style={{ flex: 1, textAlign: "center" }}>
                                Continuar comprando
                            </Link>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
        </main>
    );
}
