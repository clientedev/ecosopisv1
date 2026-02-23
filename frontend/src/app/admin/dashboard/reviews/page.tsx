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
        <div className={styles.adminContainer}>
            <AdminSidebar active="reviews" />

            <main className={styles.mainContent}>
                <div className={styles.header}>
                    <div>
                        <h1>Moderação de Avaliações</h1>
                        <p>Aprove ou remova avaliações enviadas por clientes.</p>
                    </div>
                </div>

                <div className={styles.tableCard}>
                    <table className={styles.adminTable}>
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
                                    <td colSpan={5} className={styles.emptyRow}>
                                        {loading ? "Carregando..." : "Nenhuma avaliação pendente."}
                                    </td>
                                </tr>
                            ) : (
                                reviews.map((rev: any) => (
                                    <tr key={rev.id}>
                                        <td>
                                            <span className={styles.productBadge}>
                                                {rev.product_name || "Geral"}
                                            </span>
                                        </td>
                                        <td><strong>{rev.user_name}</strong></td>
                                        <td>
                                            <div className={styles.stars}>
                                                {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                            </div>
                                        </td>
                                        <td className={styles.commentCell}>{rev.comment}</td>
                                        <td>
                                            <div className={styles.actionButtons}>
                                                <button
                                                    className={styles.approveBtn}
                                                    onClick={() => handleApprove(rev.id)}
                                                    title="Aprovar"
                                                >
                                                    Aprovar
                                                </button>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDelete(rev.id)}
                                                    title="Excluir"
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
