"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./perfil.module.css";

export default function UserProfile() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    router.push("/conta");
                    return;
                }
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
                const res = await fetch(`${apiUrl}/auth/me`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                } else {
                    localStorage.removeItem("token");
                    router.push("/conta");
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [router]);

    if (loading) return <div className={styles.loading}>Carregando seu perfil...</div>;
    if (!profile) return null;

    return (
        <main>
            <Header />
            <div className={`container ${styles.profileContainer}`}>
                <div className={styles.profileHeader}>
                    <h1>Olá, {profile.full_name}!</h1>
                    <p>Bem-vindo à sua área exclusiva ECOSOPIS.</p>
                </div>

                <div className={styles.profileGrid}>
                    <section className={styles.infoSection}>
                        <h2>Meus Dados</h2>
                        <div className={styles.infoCard}>
                            <p><strong>Nome:</strong> {profile.full_name}</p>
                            <p><strong>Email:</strong> {profile.email}</p>
                            <p><strong>Membro desde:</strong> {new Date(profile.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </section>

                    <section className={styles.historySection}>
                        <h2>Histórico de Compras</h2>
                        <div className={styles.ordersList}>
                            {profile.orders && profile.orders.length > 0 ? (
                                profile.orders.map((order: any) => (
                                    <div key={order.id} className={styles.orderCard}>
                                        <div className={styles.orderHeader}>
                                            <span>Pedido #{order.id}</span>
                                            <span className={styles.orderDate}>{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className={styles.orderStatus}>
                                            Status: <strong>{order.status}</strong>
                                        </div>
                                        <div className={styles.orderItems}>
                                            {order.items.map((item: any, idx: number) => (
                                                <div key={idx} className={styles.orderItem}>
                                                    {item.quantity}x {item.product_name} - R$ {item.price.toFixed(2)}
                                                </div>
                                            ))}
                                        </div>
                                        <div className={styles.orderTotal}>
                                            Total: <strong>R$ {order.total.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className={styles.noOrders}>Você ainda não realizou nenhuma compra.</p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
            <Footer />
        </main>
    );
}
