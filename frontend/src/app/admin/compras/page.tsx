"use client";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard/dashboard.module.css";

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            const token = localStorage.getItem("token");
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            try {
                const res = await fetch(`${apiUrl}/orders/`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data);
                }
            } catch (error) {
                console.error("Erro ao carregar pedidos", error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/compras" />
            <main className={styles.mainContent} style={{ padding: '2rem' }}>
                <header className={styles.header}>
                    <h1>Gerenciamento de Pedidos</h1>
                </header>

                {loading ? (
                    <p>Carregando pedidos...</p>
                ) : (
                    <div className={styles.productTable}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px' }}>
                            <thead style={{ backgroundColor: '#f4f4f4' }}>
                                <tr>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>ID</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Data</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Itens</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Total</th>
                                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id}>
                                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>#{order.id}</td>
                                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                                            {order.items.map((item: any) => (
                                                <div key={item.product_id} style={{ fontSize: '0.9rem' }}>
                                                    {item.quantity}x {item.product_name}
                                                </div>
                                            ))}
                                        </td>
                                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>R$ {order.total.toFixed(2)}</td>
                                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                                            <span style={{ 
                                                padding: '5px 10px', 
                                                borderRadius: '20px', 
                                                fontSize: '0.8rem',
                                                backgroundColor: order.status === 'pending' ? '#fff3cd' : '#d4edda',
                                                color: order.status === 'pending' ? '#856404' : '#155724'
                                            }}>
                                                {order.status.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
