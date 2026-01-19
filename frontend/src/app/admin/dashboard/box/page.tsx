"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css"; // Reuse dashboard styles

export default function AdminBoxPage() {
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchSubscriptions = async () => {
            try {
                const res = await fetch('/api/products/subscriptions/all', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSubscriptions(data);
                }
            } catch (error) {
                console.error("Error fetching subscriptions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubscriptions();
    }, [router]);

    const updateShipping = async (id: number, status: string) => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/products/subscriptions/${id}/shipping`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ shipping_status: status })
            });
            if (res.ok) {
                setSubscriptions(subscriptions.map(s => s.id === id ? { ...s, shipping_status: status } : s));
            }
        } catch (err) {
            console.error("Error updating shipping", err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/admin");
    };

    return (
        <div className={styles.dashboard}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>ECOSOPIS ADMIN</div>
                <nav>
                    <Link href="/admin/dashboard">Produtos</Link>
                    <Link href="/admin/dashboard/carousel">Carrossel Hero</Link>
                    <Link href="/admin/dashboard/announcement">Faixa de Aviso</Link>
                    <Link href="/admin/dashboard/box" className={styles.active}>Assinaturas Box</Link>
                    <Link href="/admin/dashboard/usuarios">Usuários</Link>
                    <Link href="/admin/dashboard/cupons">Cupons</Link>
                    <Link href="/">Ver Site</Link>
                    <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
                </nav>
            </aside>
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Box Surpresa</h1>
                </header>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Usuário ID</th>
                                <th>Plano</th>
                                <th>Status Assinatura</th>
                                <th>Status Envio</th>
                                <th>Ações de Envio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptions.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Nenhuma assinatura encontrada.</td></tr>
                            ) : (
                                subscriptions.map((sub: any) => (
                                    <tr key={sub.id}>
                                        <td>#{sub.id}</td>
                                        <td>{sub.user_id}</td>
                                        <td><strong>{sub.plan_name}</strong></td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '4px', 
                                                fontSize: '0.8rem',
                                                backgroundColor: sub.status === 'active' ? '#e8f5e9' : '#ffebee',
                                                color: sub.status === 'active' ? '#2e7d32' : '#c62828'
                                            }}>
                                                {sub.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: '500' }}>{sub.shipping_status.toUpperCase()}</span>
                                        </td>
                                        <td>
                                            <select 
                                                value={sub.shipping_status}
                                                onChange={(e) => updateShipping(sub.id, e.target.value)}
                                                style={{ padding: '5px', borderRadius: '5px', border: '1px solid #ddd' }}
                                            >
                                                <option value="pending">Pendente</option>
                                                <option value="preparing">Preparando</option>
                                                <option value="shipped">Enviado</option>
                                                <option value="delivered">Entregue</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
