"use client";
import { useState, useEffect } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/admin/dashboard/dashboard.module.css";
import reviewStyles from "./reviews.module.css";
import { Search, Filter, CheckCircle2, Layers, Inbox, RefreshCw, Trash2 } from "lucide-react";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

interface ReviewItem {
    id: number;
    user_name: string;
    comment: string;
    rating: number;
    product_id?: number | null;
    product_name?: string | null;
}

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [productFilter, setProductFilter] = useState<string>("all");
    const [actionMsg, setActionMsg] = useState<string>("");
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
                    const data = await res.json() as ReviewItem[];
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

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/reviews/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json() as ReviewItem[];
                setReviews(data);
            }
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    const productOptions = useMemo(() => {
        const unique = new Map<string, string>();
        reviews.forEach((rev) => {
            const key = String(rev.product_id ?? 0);
            unique.set(key, rev.product_name?.trim() || "Geral");
        });
        return [...unique.entries()].map(([id, name]) => ({ id, name }));
    }, [reviews]);

    const filteredReviews = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return reviews.filter((rev) => {
            const matchesProduct = productFilter === "all" || String(rev.product_id ?? 0) === productFilter;
            const matchesSearch = !term || [
                rev.user_name,
                rev.comment,
                rev.product_name || "Geral"
            ].some((value) => value?.toLowerCase().includes(term));
            return matchesProduct && matchesSearch;
        });
    }, [reviews, productFilter, searchTerm]);

    const groupedReviews = useMemo(() => {
        const grouped = new Map<string, ReviewItem[]>();
        filteredReviews.forEach((rev) => {
            const key = `${rev.product_id ?? 0}::${rev.product_name?.trim() || "Geral"}`;
            const current = grouped.get(key) || [];
            current.push(rev);
            grouped.set(key, current);
        });
        return [...grouped.entries()]
            .map(([key, items]) => {
                const [productId, productName] = key.split("::");
                return { productId, productName, items };
            })
            .sort((a, b) => b.items.length - a.items.length || a.productName.localeCompare(b.productName));
    }, [filteredReviews]);

    const totalPending = reviews.length;
    const visiblePending = filteredReviews.length;
    const distinctProducts = productOptions.length;

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
                setReviews(prev => prev.filter(r => r.id !== id));
                setActionMsg("✅ Avaliação aprovada com sucesso!");
                setTimeout(() => setActionMsg(""), 3000);
            }
        } catch (err) {
            console.error("Error approving review", err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Excluir esta avaliação? Ela será removida permanentemente do sistema.")) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setReviews(prev => prev.filter(r => r.id !== id));
                setActionMsg("🗑️ Avaliação excluída com sucesso!");
                setTimeout(() => setActionMsg(""), 3000);
            }
        } catch (err) {
            console.error("Error deleting review", err);
        }
    };

    return (
        <div className={styles.dashboard} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <AdminSidebar activePath="/admin/dashboard/reviews" />

            <main className={styles.mainContent} style={{ flex: 1, padding: '32px', overflowY: 'auto', overflowX: 'hidden', height: '100%' }}>
                <header className={styles.header}>
                    <div>
                        <h1>Moderação de Avaliações</h1>
                        <p>Aprove ou remova avaliações enviadas por clientes com filtros por produto.</p>
                    </div>
                    <button onClick={fetchReviews} style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 18px", borderRadius: "8px", border: "1.5px solid #2d5a27",
                        background: "white", color: "#2d5a27", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem"
                    }}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </header>

                {actionMsg && (
                    <div style={{
                        padding: "10px 16px", borderRadius: "10px", marginBottom: "12px",
                        background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534",
                        fontWeight: 600, fontSize: "0.85rem", animation: "fadeIn 0.3s ease"
                    }}>
                        {actionMsg}
                    </div>
                )}

                <section className={reviewStyles.statsGrid}>
                    <article className={reviewStyles.statCard}>
                        <Inbox size={18} />
                        <div>
                            <p className={reviewStyles.statLabel}>Pendentes (Total)</p>
                            <strong className={reviewStyles.statValue}>{totalPending}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <Filter size={18} />
                        <div>
                            <p className={reviewStyles.statLabel}>Pendentes (Filtro Atual)</p>
                            <strong className={reviewStyles.statValue}>{visiblePending}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <Layers size={18} />
                        <div>
                            <p className={reviewStyles.statLabel}>Produtos com Pendências</p>
                            <strong className={reviewStyles.statValue}>{distinctProducts}</strong>
                        </div>
                    </article>
                </section>

                <section className={reviewStyles.filtersCard}>
                    <div className={reviewStyles.filterItem}>
                        <label>Filtrar por produto</label>
                        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                            <option value="all">Todos os produtos</option>
                            {productOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={reviewStyles.filterItem}>
                        <label>Buscar por nome/comentário</label>
                        <div className={reviewStyles.searchWrap}>
                            <Search size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Ex.: Joana, hidratante, cheiro..."
                            />
                        </div>
                    </div>
                </section>

                <div className={reviewStyles.groupList}>
                    {loading ? (
                        <div className={reviewStyles.emptyState}>Carregando...</div>
                    ) : groupedReviews.length === 0 ? (
                        <div className={reviewStyles.emptyState}>Nenhuma avaliação pendente para os filtros aplicados.</div>
                    ) : (
                        groupedReviews.map((group) => (
                            <section key={`${group.productId}-${group.productName}`} className={reviewStyles.groupCard}>
                                <header className={reviewStyles.groupHeader}>
                                    <h2>{group.productName}</h2>
                                    <span className={reviewStyles.groupBadge}>{group.items.length} pendente(s)</span>
                                </header>

                                <div className={styles.productTable}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Usuário</th>
                                                <th>Avaliação</th>
                                                <th>Comentário</th>
                                                <th>Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((rev) => (
                                                <tr key={rev.id}>
                                                    <td><strong>{rev.user_name}</strong></td>
                                                    <td>
                                                        <div className={reviewStyles.stars}>
                                                            {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                                        </div>
                                                    </td>
                                                    <td className={reviewStyles.commentCell}>{rev.comment}</td>
                                                    <td>
                                                        <div className={styles.actions}>
                                                            <button
                                                                className={reviewStyles.approveBtn}
                                                                onClick={() => handleApprove(rev.id)}
                                                            >
                                                                <CheckCircle2 size={14} />
                                                                Aprovar
                                                            </button>
                                                            <button
                                                                className={styles.deleteBtn}
                                                                onClick={() => handleDelete(rev.id)}
                                                                title="Excluir permanentemente"
                                                            >
                                                                <Trash2 size={13} />
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
