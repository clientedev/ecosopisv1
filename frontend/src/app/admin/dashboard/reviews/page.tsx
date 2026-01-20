"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css";

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
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
                const res = await fetch(`${apiUrl}/api/reviews/pending`, {
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const res = await fetch(`${apiUrl}/api/reviews/approve/${id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setReviews(reviews.filter(r => r.id !== id));
                alert("Avaliação aprovada!");
            }
        } catch (err) {
            console.error("Error approving review", err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Excluir esta avaliação?")) return;
        const token = localStorage.getItem("token");
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const res = await fetch(`${apiUrl}/api/reviews/${id}`, {
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
                    <Link href="/admin/dashboard/box">Assinaturas Box</Link>
                    <Link href="/admin/dashboard/reviews" className={styles.active}>Avaliações</Link>
                    <Link href="/admin/dashboard/usuarios">Usuários</Link>
                    <Link href="/admin/dashboard/cupons">Cupons</Link>
                    <Link href="/">Ver Site</Link>
                    <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
                </nav>
            </aside>
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Moderação de Avaliações</h1>
                </header>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Usuário</th>
                                <th>Estrelas</th>
                                <th>Comentário</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Nenhuma avaliação pendente.</td></tr>
                            ) : (
                                reviews.map((rev: any) => (
                                    <tr key={rev.id}>
                                        <td><strong>{rev.product_name}</strong></td>
                                        <td>{rev.user_name}</td>
                                        <td><span style={{ color: '#f1c40f' }}>{"★".repeat(rev.rating)}{"☆".repeat(5-rev.rating)}</span></td>
                                        <td style={{ maxWidth: '300px', fontSize: '0.9rem' }}>{rev.comment}</td>
                                        <td>
                                            <div className={styles.actions}>
                                                <button 
                                                    className="btn-primary"
                                                    onClick={() => handleApprove(rev.id)}
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
