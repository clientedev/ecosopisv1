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
                const res = await fetch('/api/products/reviews/all', {
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

    const toggleApprove = async (id: number, currentStatus: boolean) => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/products/reviews/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ is_approved: !currentStatus })
            });
            if (res.ok) {
                setReviews(reviews.map(r => r.id === id ? { ...r, is_approved: !currentStatus } : r));
            }
        } catch (err) {
            console.error("Error updating review status", err);
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
                                <th>ID</th>
                                <th>Usuário</th>
                                <th>Estrelas</th>
                                <th>Comentário</th>
                                <th>Status</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Nenhuma avaliação encontrada.</td></tr>
                            ) : (
                                reviews.map((rev: any) => (
                                    <tr key={rev.id}>
                                        <td>#{rev.id}</td>
                                        <td><strong>{rev.user_name}</strong></td>
                                        <td><span style={{ color: '#f1c40f' }}>{"★".repeat(rev.rating)}{"☆".repeat(5-rev.rating)}</span></td>
                                        <td style={{ maxWidth: '300px', fontSize: '0.9rem' }}>{rev.comment}</td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '4px', 
                                                fontSize: '0.8rem',
                                                backgroundColor: rev.is_approved ? '#e8f5e9' : '#fff3e0',
                                                color: rev.is_approved ? '#2e7d32' : '#ef6c00'
                                            }}>
                                                {rev.is_approved ? 'APROVADO' : 'PENDENTE'}
                                            </span>
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => toggleApprove(rev.id, rev.is_approved)}
                                                style={{ 
                                                    padding: '5px 10px', 
                                                    borderRadius: '5px', 
                                                    border: '1px solid #2d5a27',
                                                    backgroundColor: rev.is_approved ? 'white' : '#2d5a27',
                                                    color: rev.is_approved ? '#2d5a27' : 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {rev.is_approved ? 'Desaprovar' : 'Aprovar'}
                                            </button>
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
