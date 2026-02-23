"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchReviews = async () => {
            try {
                const res = await fetch(`/api/reviews/pending`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setReviews(data);
                }
            } catch (error) {
                console.error("Error fetching reviews:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [router]);

    const handleApprove = async (id: number) => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/approve/${id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setReviews(reviews.filter(r => r.id !== id));
            }
        } catch (err) {
            console.error("Error approving review", err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Excluir esta avaliação?")) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setReviews(reviews.filter(r => r.id !== id));
            }
        } catch (err) {
            console.error("Error deleting review", err);
        }
    };

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/reviews" />

            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <div>
                        <h1>Moderação de Avaliações</h1>
                        <p>Aprove ou remova avaliações enviadas por clientes.</p>
                    </div>
                </header>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Origem/Produto</th>
                                <th>Usuário</th>
                                <th>Avaliação</th>
                                <th>Comentário</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                        {loading ? "Carregando..." : "Nenhuma avaliação pendente."}
                                    </td>
                                </tr>
                            ) : (
                                reviews.map((rev: any) => (
                                    <tr key={rev.id}>
                                        <td>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                {rev.product_name || "Geral"}
                                            </span>
                                        </td>
                                        <td><strong>{rev.user_name}</strong></td>
                                        <td>
                                            <div style={{ color: '#f1c40f', fontSize: '1.2rem' }}>
                                                {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                            </div>
                                        </td>
                                        <td style={{ maxWidth: '400px', fontSize: '0.9rem', lineHeight: '1.4' }}>{rev.comment}</td>
                                        <td>
                                            <div className={styles.actions}>
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => handleApprove(rev.id)}
                                                    style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: 'none' }}
                                                >
                                                    Aprovar
                                                </button>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDelete(rev.id)}
                                                >
                                                    Excluir
                                                </button>
                                            </div>
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
