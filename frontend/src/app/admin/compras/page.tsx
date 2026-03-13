"use client";
import { useState, useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard/dashboard.module.css";
import { FileText, Truck, CheckCircle, Clock, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "Pendente", color: "#856404", bg: "#fff3cd" },
    paid: { label: "Pago", color: "#155724", bg: "#d4edda" },
    shipped: { label: "Enviado", color: "#004085", bg: "#cce5ff" },
    delivered: { label: "Entregue", color: "#155724", bg: "#d4edda" },
    cancelled: { label: "Cancelado", color: "#721c24", bg: "#f8d7da" },
    mp_error: { label: "Erro MP", color: "#721c24", bg: "#f8d7da" },
};

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/orders/admin/all`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (error) {
            console.error("Erro ao carregar pedidos", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(() => fetchOrders(), 30000); // 30s auto-refresh
        return () => clearInterval(interval);
    }, []);

    const updateStatus = async (orderId: number, newStatus: string) => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchOrders();
            }
        } catch (err) {
            alert("Erro ao atualizar status");
        }
    };

    const printLabel = (orderId: number) => {
        const token = localStorage.getItem("token");
        window.open(`${API_URL}/orders/${orderId}/label?token=${token}`, "_blank");
    };

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/compras" />
            <main className={styles.mainContent} style={{ padding: '2rem' }}>
                <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h1 style={{ margin: 0 }}>Gerenciamento de Pedidos</h1>
                    <button
                        onClick={() => fetchOrders(true)}
                        className="btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
                        disabled={refreshing}
                    >
                        <RefreshCw size={16} className={refreshing ? "spin" : ""} /> ATUALIZAR
                    </button>
                </header>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <p style={{ color: '#888' }}>Carregando pedidos...</p>
                    </div>
                ) : (
                    <div className={styles.productTable}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <thead style={{ backgroundColor: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>ID / DATA</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>CLIENTE</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>ITENS / TOTAL</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>PAGAMENTO</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>STATUS</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nenhum pedido encontrado.</td></tr>
                                ) : orders.map((order) => {
                                    const status = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
                                    return (
                                        <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>#{order.id}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ fontWeight: 600 }}>{order.customer_name || order.user_name || "Cliente"}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{order.customer_email || order.user_email}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{order.customer_phone}</div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ fontSize: '0.85rem' }}>
                                                    {order.items.map((item: any, i: number) => (
                                                        <div key={i}>{item.quantity}x {item.product_name}</div>
                                                    ))}
                                                </div>
                                                <div style={{ fontWeight: 700, color: '#2d5a27', marginTop: '5px' }}>R$ {Number(order.total).toFixed(2)}</div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{order.payment_method?.toUpperCase() || "PIX"}</div>
                                                {order.mp_payment_id && (
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID MP: {order.mp_payment_id}</div>
                                                )}
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Frete: {order.shipping_method?.toUpperCase()}</div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    backgroundColor: status.bg,
                                                    color: status.color
                                                }}>
                                                    {status.label.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {order.status === 'paid' && (
                                                        <button
                                                            onClick={() => printLabel(order.id)}
                                                            className="btn-primary"
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: '#4a7c59' }}
                                                            title="Imprimir Etiqueta"
                                                        >
                                                            <FileText size={14} /> ETIQUETA
                                                        </button>
                                                    )}
                                                    {order.status === 'paid' && (
                                                        <button
                                                            onClick={() => updateStatus(order.id, 'shipped')}
                                                            className="btn-outline"
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            <Truck size={14} /> ENVIAR
                                                        </button>
                                                    )}
                                                    {order.status === 'shipped' && (
                                                        <button
                                                            onClick={() => updateStatus(order.id, 'delivered')}
                                                            className="btn-outline"
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            <CheckCircle size={14} /> ENTREGAR
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
            <style jsx>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
