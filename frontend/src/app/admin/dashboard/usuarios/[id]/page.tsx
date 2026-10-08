"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import styles from "../../dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AdminLayout from "@/components/AdminLayout/AdminLayout";
import { ArrowLeft, User, Mail, ShoppingBag, Calendar } from "lucide-react";

export default function UserProfileAdmin() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`/api/auth/users/${params.id}`, {
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

    if (loading) return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard/usuarios" />
            <main className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Carregando dados do usuário...</p>
            </main>
        </AdminLayout>
    );

    if (!user) return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard/usuarios" />
            <main className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#ef4444' }}>Usuário não encontrado.</p>
            </main>
        </AdminLayout>
    );

    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard/usuarios" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={24} color="#2d5a27" /> Perfil: {user.full_name}
                        </h1>
                        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.9rem' }}>
                            Visualização detalhada e histórico de compras do cliente.
                        </p>
                    </div>
                    <Link 
                        href="/admin/dashboard/usuarios" 
                        className={styles.editBtn}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                        <ArrowLeft size={16} /> Voltar para Usuários
                    </Link>
                </header>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={16} /> Email</h3>
                        <p style={{ fontSize: '1.05rem', wordBreak: 'break-all', marginTop: '6px' }}>{user.email}</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={16} /> Total de Pedidos</h3>
                        <p style={{ fontSize: '1.8rem', marginTop: '6px' }}>{user.orders?.length || 0}</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} /> Data de Cadastro</h3>
                        <p style={{ fontSize: '1.05rem', marginTop: '6px' }}>{new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                <h2 style={{ margin: '2rem 0 1rem', color: '#1e293b', fontSize: '1.3rem' }}>Histórico de Compras</h2>
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
                                    <td data-label="Pedido ID"><strong>#{order.id}</strong></td>
                                    <td data-label="Data">{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td data-label="Status">
                                        <span className={`${styles.stockBadge} ${styles.stockOk}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td data-label="Total"><span className={styles.priceTag}>R$ {order.total.toFixed(2)}</span></td>
                                    <td data-label="Itens">
                                        {order.items?.map((item: any, idx: number) => (
                                            <div key={idx} style={{ fontSize: '0.85rem' }}>
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
        </AdminLayout>
    );
}
