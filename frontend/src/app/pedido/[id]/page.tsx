"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";

const STATUS_STEPS = [
    { key: "pending",   label: "Pedido Criado",       icon: "🛍️" },
    { key: "paid",      label: "Pagamento Confirmado", icon: "💳" },
    { key: "shipped",   label: "Em Trânsito",          icon: "🚚" },
    { key: "delivered", label: "Entregue",             icon: "✅" },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending:            { label: "Aguardando pagamento",   color: "#b45309", bg: "#fef3c7", icon: "⏳" },
    paid:               { label: "Pagamento confirmado",   color: "#065f46", bg: "#d1fae5", icon: "💳" },
    processando_envio:  { label: "Preparando envio...",    color: "#1d4ed8", bg: "#dbeafe", icon: "📦" },
    shipped:            { label: "Em trânsito",            color: "#1d4ed8", bg: "#dbeafe", icon: "🚚" },
    delivered:          { label: "Entregue",               color: "#065f46", bg: "#d1fae5", icon: "✅" },
    cancelled:          { label: "Cancelado",              color: "#991b1b", bg: "#fee2e2", icon: "❌" },
    payment_error:      { label: "Erro no pagamento",      color: "#991b1b", bg: "#fee2e2", icon: "⚠️" },
    erro_envio:         { label: "Problema no envio",      color: "#991b1b", bg: "#fee2e2", icon: "⚠️" },
};

function getStepIndex(status: string) {
    if (["paid", "processando_envio"].includes(status)) return 1;
    if (["shipped"].includes(status)) return 2;
    if (["delivered"].includes(status)) return 3;
    if (status === "pending") return 0;
    return -1;
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const el = document.createElement("textarea");
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    return (
        <button onClick={handleCopy} style={{
            background: copied ? "#d1fae5" : "#f1f5f9",
            color: copied ? "#065f46" : "#475569",
            border: "none", borderRadius: 6, padding: "4px 10px",
            fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s", whiteSpace: "nowrap"
        }}>
            {copied ? "✓ Copiado!" : "Copiar"}
        </button>
    );
}

function OrderContent() {
    const params = useParams();
    const orderId = params?.id;
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrder = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token || !orderId) { setLoading(false); return; }
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setOrder(await res.json());
        } catch { }
        finally { setLoading(false); }
    }, [orderId]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    useEffect(() => {
        if (!order) return;
        if (["pending", "paid", "processando_envio"].includes(order.status)) {
            const interval = setInterval(fetchOrder, 8000);
            return () => clearInterval(interval);
        }
    }, [order?.status, fetchOrder]);

    const status = order?.status || "pending";
    const statusInfo = STATUS_MAP[status] || { label: status, color: "#475569", bg: "#f1f5f9", icon: "📋" };
    const currentStep = getStepIndex(status);
    const isCancelled = ["cancelled", "payment_error", "erro_envio"].includes(status);
    const hasTracking = !!order?.codigo_rastreio;
    const isCorreios = !order?.shipping_method || ["PAC", "SEDEX"].some(s => (order.shipping_method || "").toUpperCase().includes(s));

    const items = order?.items || [];
    const subtotal = items.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 1), 0);

    return (
        <main>
            <Header />
            <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 20px" }}>
                <div style={{ maxWidth: 660, margin: "0 auto" }}>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: "80px 20px" }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: "50%",
                                border: "4px solid #e2e8f0", borderTopColor: "#2d5a27",
                                animation: "spin 0.8s linear infinite", margin: "0 auto 16px"
                            }} />
                            <p style={{ color: "#94a3b8", margin: 0 }}>Carregando pedido...</p>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : !order ? (
                        <div style={{ textAlign: "center", background: "white", borderRadius: 20, padding: "60px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
                            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
                            <h2 style={{ color: "#1e293b", marginBottom: 8 }}>Pedido não encontrado</h2>
                            <p style={{ color: "#64748b", marginBottom: 24 }}>Verifique se você está logado na conta correta.</p>
                            <Link href="/perfil?tab=orders" style={{
                                display: "inline-block", padding: "12px 28px",
                                background: "#2d5a27", color: "white", borderRadius: 10,
                                textDecoration: "none", fontWeight: 700
                            }}>Meus Pedidos</Link>
                        </div>
                    ) : (
                        <>
                            {/* Header Card */}
                            <div style={{
                                background: "white", borderRadius: 20, padding: "28px 32px",
                                boxShadow: "0 4px 24px rgba(0,0,0,0.08)", marginBottom: 16
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                    <div>
                                        <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                            Pedido
                                        </p>
                                        <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#1e293b", fontWeight: 800 }}>
                                            #{order.id}
                                        </h1>
                                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                                            {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR", {
                                                day: "2-digit", month: "long", year: "numeric",
                                                hour: "2-digit", minute: "2-digit"
                                            }) : "—"}
                                        </p>
                                    </div>
                                    <div style={{
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        padding: "8px 18px", borderRadius: 50,
                                        background: statusInfo.bg, color: statusInfo.color,
                                        fontWeight: 700, fontSize: "0.88rem"
                                    }}>
                                        {statusInfo.icon} {statusInfo.label}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {!isCancelled && (
                                    <div style={{ marginTop: 28, position: "relative" }}>
                                        {/* Track line */}
                                        <div style={{
                                            position: "absolute", top: 16, left: "6.25%", right: "6.25%",
                                            height: 3, background: "#e2e8f0", borderRadius: 99, zIndex: 0
                                        }} />
                                        <div style={{
                                            position: "absolute", top: 16, left: "6.25%",
                                            width: `${(currentStep / (STATUS_STEPS.length - 1)) * 87.5}%`,
                                            height: 3, background: "linear-gradient(90deg, #2d5a27, #4ade80)",
                                            borderRadius: 99, zIndex: 1, transition: "width 0.6s ease"
                                        }} />
                                        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                                            {STATUS_STEPS.map((step, idx) => {
                                                const done = idx < currentStep;
                                                const active = idx === currentStep;
                                                return (
                                                    <div key={step.key} style={{
                                                        display: "flex", flexDirection: "column",
                                                        alignItems: "center", flex: 1
                                                    }}>
                                                        <div style={{
                                                            width: 34, height: 34, borderRadius: "50%",
                                                            background: done || active ? "#2d5a27" : "#f1f5f9",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: done ? "1rem" : "0.9rem",
                                                            border: active ? "3px solid #4ade80" : done ? "3px solid #2d5a27" : "3px solid #e2e8f0",
                                                            boxShadow: active ? "0 0 0 4px rgba(74,222,128,0.2)" : "none",
                                                            transition: "all 0.3s"
                                                        }}>
                                                            {done ? <span style={{ color: "white", fontWeight: 900, fontSize: "0.9rem" }}>✓</span>
                                                                : active ? <span style={{ color: "white", fontSize: "0.85rem" }}>{step.icon}</span>
                                                                    : <span style={{ fontSize: "0.85rem", opacity: 0.4 }}>{step.icon}</span>}
                                                        </div>
                                                        <span style={{
                                                            fontSize: "0.68rem", marginTop: 6, textAlign: "center",
                                                            color: done || active ? "#2d5a27" : "#94a3b8",
                                                            fontWeight: done || active ? 700 : 400,
                                                            lineHeight: 1.3, maxWidth: 70
                                                        }}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tracking Card — appears when shipped */}
                            {hasTracking && (
                                <div style={{
                                    background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                                    borderRadius: 20, padding: "24px 28px",
                                    boxShadow: "0 8px 32px rgba(37,99,235,0.25)", marginBottom: 16
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                        <span style={{ fontSize: "1.5rem" }}>🚚</span>
                                        <div>
                                            <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                                Rastreamento
                                            </p>
                                            <p style={{ margin: 0, color: "white", fontWeight: 700, fontSize: "0.95rem" }}>
                                                Seu pedido está a caminho!
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tracking Code */}
                                    <div style={{
                                        background: "rgba(255,255,255,0.12)", borderRadius: 12,
                                        padding: "14px 18px", marginBottom: 14
                                    }}>
                                        <p style={{ margin: "0 0 6px", color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 600 }}>
                                            CÓDIGO DE RASTREIO
                                        </p>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                            <span style={{
                                                fontFamily: "monospace", fontSize: "1.15rem",
                                                fontWeight: 800, color: "white", letterSpacing: 2
                                            }}>
                                                {order.codigo_rastreio}
                                            </span>
                                            <CopyButton text={order.codigo_rastreio} />
                                        </div>
                                    </div>

                                    {/* Rastrear Links */}
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                        <a
                                            href={`https://melhorrastreio.com.br/rastreio/${order.codigo_rastreio}`}
                                            target="_blank" rel="noopener noreferrer"
                                            style={{
                                                flex: 1, textAlign: "center", padding: "11px 16px",
                                                background: "white", color: "#1d4ed8",
                                                borderRadius: 10, textDecoration: "none",
                                                fontWeight: 700, fontSize: "0.85rem", minWidth: 150,
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                                            }}>
                                            📍 Rastrear Agora
                                        </a>
                                        {isCorreios && (
                                            <a
                                                href={`https://rastreamento.correios.com.br/app/index.php`}
                                                target="_blank" rel="noopener noreferrer"
                                                style={{
                                                    flex: 1, textAlign: "center", padding: "11px 16px",
                                                    background: "rgba(255,255,255,0.15)", color: "white",
                                                    borderRadius: 10, textDecoration: "none",
                                                    fontWeight: 700, fontSize: "0.85rem", minWidth: 150,
                                                    border: "1px solid rgba(255,255,255,0.3)"
                                                }}>
                                                📮 Site dos Correios
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Waiting for tracking */}
                            {status === "shipped" && !hasTracking && (
                                <div style={{
                                    background: "#fff7ed", borderRadius: 20, padding: "20px 24px",
                                    border: "1px solid #fed7aa", marginBottom: 16,
                                    display: "flex", alignItems: "center", gap: 14
                                }}>
                                    <span style={{ fontSize: "1.5rem" }}>📦</span>
                                    <div>
                                        <p style={{ margin: "0 0 2px", fontWeight: 700, color: "#9a3412" }}>Pedido enviado!</p>
                                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#c2410c" }}>
                                            O código de rastreio será disponibilizado em breve.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Waiting for payment */}
                            {status === "processando_envio" && (
                                <div style={{
                                    background: "#eff6ff", borderRadius: 20, padding: "20px 24px",
                                    border: "1px solid #bfdbfe", marginBottom: 16,
                                    display: "flex", alignItems: "center", gap: 14
                                }}>
                                    <span style={{ fontSize: "1.5rem" }}>📦</span>
                                    <div>
                                        <p style={{ margin: "0 0 2px", fontWeight: 700, color: "#1d4ed8" }}>Processando o envio</p>
                                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#2563eb" }}>
                                            Estamos preparando sua etiqueta e logo seu pedido será despachado.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div style={{
                                background: "white", borderRadius: 20, padding: "24px 28px",
                                boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: 16
                            }}>
                                <h3 style={{ margin: "0 0 16px", color: "#1e293b", fontSize: "1rem", fontWeight: 700 }}>
                                    🛒 Itens do Pedido
                                </h3>
                                {items.length > 0 ? (
                                    <div>
                                        {items.map((item: any, i: number) => (
                                            <div key={i} style={{
                                                display: "flex", justifyContent: "space-between",
                                                alignItems: "center", padding: "10px 0",
                                                borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : "none"
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{
                                                        width: 40, height: 40, borderRadius: 8,
                                                        background: "#f8fafc", display: "flex",
                                                        alignItems: "center", justifyContent: "center",
                                                        fontSize: "1.2rem", flexShrink: 0
                                                    }}>
                                                        🌿
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 600, color: "#1e293b", fontSize: "0.9rem" }}>
                                                            {item.product_name || "Produto"}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                                                            Qtd: {item.quantity}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>
                                                    {((item.price || 0) * (item.quantity || 1)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: "#94a3b8", textAlign: "center", margin: 0 }}>Itens do pedido indisponíveis</p>
                                )}

                                {/* Summary */}
                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                        <span style={{ color: "#64748b", fontSize: "0.88rem" }}>Subtotal</span>
                                        <span style={{ color: "#64748b", fontSize: "0.88rem" }}>
                                            {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    </div>
                                    {order.shipping_price !== undefined && order.shipping_price !== null && (
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ color: "#64748b", fontSize: "0.88rem" }}>
                                                🚚 Frete {order.shipping_method ? `(${order.shipping_method.toUpperCase()})` : ""}
                                            </span>
                                            <span style={{ color: "#64748b", fontSize: "0.88rem" }}>
                                                {Number(order.shipping_price) === 0
                                                    ? "Grátis"
                                                    : Number(order.shipping_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                                }
                                            </span>
                                        </div>
                                    )}
                                    {order.discount_amount > 0 && (
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ color: "#15803d", fontSize: "0.88rem" }}>🏷️ Desconto</span>
                                            <span style={{ color: "#15803d", fontSize: "0.88rem", fontWeight: 600 }}>
                                                - {Number(order.discount_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                            </span>
                                        </div>
                                    )}
                                    <div style={{
                                        display: "flex", justifyContent: "space-between",
                                        paddingTop: 10, borderTop: "1px solid #e2e8f0", marginTop: 8
                                    }}>
                                        <span style={{ fontWeight: 800, color: "#1e293b", fontSize: "1rem" }}>Total</span>
                                        <span style={{ fontWeight: 800, color: "#2d5a27", fontSize: "1.1rem" }}>
                                            {Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            {order.address && order.address.street && (
                                <div style={{
                                    background: "white", borderRadius: 20, padding: "20px 28px",
                                    boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: 16
                                }}>
                                    <h3 style={{ margin: "0 0 12px", color: "#1e293b", fontSize: "1rem", fontWeight: 700 }}>
                                        📍 Endereço de Entrega
                                    </h3>
                                    <div style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.7 }}>
                                        <p style={{ margin: 0, fontWeight: 600 }}>
                                            {order.address.street}, {order.address.number}
                                            {order.address.complement ? ` — ${order.address.complement}` : ""}
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            {order.address.neighborhood} · {order.address.city}/{order.address.state}
                                        </p>
                                        {order.address.cep && (
                                            <p style={{ margin: 0, color: "#94a3b8" }}>
                                                CEP {order.address.cep}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <Link href="/perfil?tab=orders" style={{
                                    flex: 1, textAlign: "center", padding: "13px 20px",
                                    background: "#2d5a27", color: "white", borderRadius: 12,
                                    textDecoration: "none", fontWeight: 700, fontSize: "0.9rem",
                                    boxShadow: "0 4px 16px rgba(45,90,39,0.3)", minWidth: 180
                                }}>
                                    ← Meus Pedidos
                                </Link>
                                <Link href="/produtos" style={{
                                    flex: 1, textAlign: "center", padding: "13px 20px",
                                    border: "2px solid #e2e8f0", color: "#475569", borderRadius: 12,
                                    textDecoration: "none", fontWeight: 700, fontSize: "0.9rem",
                                    background: "white", minWidth: 180
                                }}>
                                    Continuar Comprando
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}

export default function OrderPage() {
    return (
        <Suspense fallback={
            <div style={{ padding: "100px", textAlign: "center", color: "#94a3b8" }}>
                Carregando...
            </div>
        }>
            <OrderContent />
        </Suspense>
    );
}
