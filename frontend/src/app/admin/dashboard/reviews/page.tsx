"use client";
import { useState, useEffect } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/admin/dashboard/dashboard.module.css";
import reviewStyles from "./reviews.module.css";
import { Search, Filter, CheckCircle2, Layers, Inbox, RefreshCw, Trash2, Clock } from "lucide-react";
import { fuzzySearch } from "@/utils/search";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

interface ReviewItem {
    id: number;
    user_name: string;
    comment: string;
    rating: number;
    is_approved: boolean;
    product_id?: number | null;
    product_name?: string | null;
    created_at?: string;
}

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [productFilter, setProductFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [actionMsg, setActionMsg] = useState<string>("");
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchInitialReviews = async () => {
            try {
                const res = await fetch(`/api/reviews/admin/all`, {
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
        fetchInitialReviews();
    }, [router]);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/reviews/admin/all`, {
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
        const baseFiltered = reviews.filter((rev) => {
            const matchesProduct = productFilter === "all" || String(rev.product_id ?? 0) === productFilter;
            const matchesStatus = statusFilter === "all" || (statusFilter === "approved" ? rev.is_approved : !rev.is_approved);
            return matchesProduct && matchesStatus;
        });

        if (!searchTerm.trim()) return baseFiltered;

        return fuzzySearch(baseFiltered, searchTerm.trim(), ["user_name", "comment", "product_name"]);
    }, [reviews, productFilter, statusFilter, searchTerm]);

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

    const totalReviews = reviews.length;
    const pendingCount = reviews.filter(r => !r.is_approved).length;
    const approvedCount = reviews.filter(r => r.is_approved).length;
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
                setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: true } : r));
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
                            <p className={reviewStyles.statLabel}>Total de Avaliações</p>
                            <strong className={reviewStyles.statValue}>{totalReviews}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <Clock size={18} />
                        <div>
                            <p className={reviewStyles.statLabel}>Pendentes</p>
                            <strong className={reviewStyles.statValue} style={{ color: "#d97706" }}>{pendingCount}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <CheckCircle2 size={18} />
                        <div>
                            <p className={reviewStyles.statLabel}>Aprovadas</p>
                            <strong className={reviewStyles.statValue} style={{ color: "#059669" }}>{approvedCount}</strong>
                        </div>
                    </article>
                </section>

                <section className={reviewStyles.filtersCard}>
                    <div className={reviewStyles.filterItem}>
                        <label>Status</label>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todas</option>
                            <option value="pending">Pendentes</option>
                            <option value="approved">Aprovadas</option>
                        </select>
                    </div>
                    <div className={reviewStyles.filterItem}>
                        <label>Produto</label>
                        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                            <option value="all">Todos os produtos</option>
                            {productOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={reviewStyles.filterItem} style={{ flex: 2 }}>
                        <label>Buscar por nome/comentário</label>
                        <div className={reviewStyles.searchWrap}>
                            <Search size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Busque por cliente ou conteúdo..."
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
                                                <th>Data</th>
                                                <th>Usuário</th>
                                                <th>Avaliação</th>
                                                <th>Comentário</th>
                                                <th>Status</th>
                                                <th>Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((rev) => (
                                                <tr key={rev.id} style={{ opacity: rev.is_approved ? 0.8 : 1 }}>
                                                    <td>
                                                        <span className={reviewStyles.dateText}>
                                                            {rev.created_at ? new Date(rev.created_at).toLocaleDateString("pt-BR") : "—"}
                                                        </span>
                                                    </td>
                                                    <td><strong>{rev.user_name}</strong></td>
                                                    <td>
                                                        <div className={reviewStyles.stars}>
                                                            {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                                        </div>
                                                    </td>
                                                    <td className={reviewStyles.commentCell}>{rev.comment}</td>
                                                    <td>
                                                        <span className={rev.is_approved ? reviewStyles.statusApproved : reviewStyles.statusPending}>
                                                            {rev.is_approved ? "Aprovada" : "Pendente"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.actions}>
                                                            {!rev.is_approved && (
                                                                <button
                                                                    className={reviewStyles.approveBtn}
                                                                    onClick={() => handleApprove(rev.id)}
                                                                >
                                                                    <CheckCircle2 size={14} />
                                                                    Aprovar
                                                                </button>
                                                            )}
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
