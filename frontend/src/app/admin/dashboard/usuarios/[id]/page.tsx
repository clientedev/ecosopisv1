"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import styles from "../../dashboard.module.css";

export default function UserProfileAdmin() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const token = localStorage.getItem("token");
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
                const res = await fetch(`${apiUrl}/auth/users/${params.id}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                } else {
                    router.push("/admin/dashboard/usuarios");
                }
            } catch (error) {
                console.error("Error fetching user profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUserProfile();
    }, [params.id, router]);

    if (loading) return <div className={styles.mainContent}>Carregando...</div>;
    if (!user) return <div className={styles.mainContent}>Usuário não encontrado</div>;

    return (
        <div className={styles.dashboard}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>ECOSOPIS ADMIN</div>
                <nav>
                    <Link href="/admin/dashboard">Produtos</Link>
                    <Link href="/admin/dashboard/usuarios" className={styles.active}>Usuários</Link>
                    <Link href="/">Ver Site</Link>
                </nav>
            </aside>
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Perfil do Cliente: {user.full_name}</h1>
                    <Link href="/admin/dashboard/usuarios" className={styles.editBtn}>Voltar</Link>
                </header>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3>Email</h3>
                        <p style={{ fontSize: '1.2rem' }}>{user.email}</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Total de Pedidos</h3>
                        <p>{user.orders?.length || 0}</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Data de Cadastro</h3>
                        <p style={{ fontSize: '1.2rem' }}>{new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                <h2 style={{ margin: '2rem 0 1rem', color: '#1e293b' }}>Histórico de Compras</h2>
                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Pedido ID</th>
                                <th>Data</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Itens</th>
                            </tr>
                        </thead>
                        <tbody>
                            {user.orders?.map((order: any) => (
                                <tr key={order.id}>
                                    <td>#{order.id}</td>
                                    <td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <span className={`${styles.stockBadge} ${styles.stockOk}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td><span className={styles.priceTag}>R$ {order.total.toFixed(2)}</span></td>
                                    <td>
                                        {order.items.map((item: any, idx: number) => (
                                            <div key={idx} style={{ fontSize: '0.8rem' }}>
                                                {item.quantity}x {item.product_name}
                                            </div>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                            {(!user.orders || user.orders.length === 0) && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        Nenhum pedido encontrado para este cliente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
