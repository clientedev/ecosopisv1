"use client";
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout/AdminLayout";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard/dashboard.module.css";

export default function AdminSubscriptionsPage() {
    const [subs, setSubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubs = async () => {
            const token = localStorage.getItem("token");
            const apiUrl = "/api";
            try {
                const res = await fetch(`${apiUrl}/orders/admin/subscriptions`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) setSubs(await res.json());
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubs();
    }, []);

    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/subscriptions" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
                <header className={styles.header}>
                    <h1>Gerenciamento de Assinaturas</h1>
                </header>
                {loading ? <p style={{ padding: '2rem', color: '#64748b' }}>Carregando...</p> : (
                    <div className={styles.productTable}>
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Plano</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subs.map((s) => (
                                    <tr key={s.id}>
                                        <td data-label="Cliente">{s.user_email}</td>
                                        <td data-label="Plano">{s.plan_name}</td>
                                        <td data-label="Valor">R$ {s.price?.toFixed(2)}</td>
                                        <td data-label="Status">
                                            <span style={{ padding: '4px 10px', borderRadius: '20px', backgroundColor: '#d4edda', color: '#155724', fontWeight: 600, fontSize: '0.8rem' }}>
                                                {s.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td data-label="Data">{new Date(s.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {subs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            Nenhuma assinatura encontrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </AdminLayout>
    );
}
