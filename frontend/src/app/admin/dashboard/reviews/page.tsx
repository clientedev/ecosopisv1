"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/admin/dashboard/dashboard.module.css";
import reviewStyles from "./reviews.module.css";
import { 
    Search, 
    CheckCircle2, 
    Inbox, 
    RefreshCw, 
    Trash2, 
    Clock, 
    Star, 
    Package, 
    CheckCheck,
    AlertCircle
} from "lucide-react";
import { fuzzySearch } from "@/utils/search";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

interface ReviewItem {
    id: number;
    user_name: string;
    comment: string;
    rating: number;
    images: string[];
    is_approved: boolean;
    product_id?: number | null;
    product_name?: string | null;
    created_at?: string;
}

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProductTab, setSelectedProductTab] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [actionMsg, setActionMsg] = useState<string>("");
    const router = useRouter();

    const normalizeReviews = (data: any[]): ReviewItem[] => {
        if (!Array.isArray(data)) return [];
        return data.map((r) => {
            let imgs: string[] = [];
            if (Array.isArray(r.images)) {
                imgs = r.images;
            } else if (typeof r.images === "string") {
                try {
                    const parsed = JSON.parse(r.images);
                    imgs = Array.isArray(parsed) ? parsed : (parsed ? [String(parsed)] : []);
                } catch {
                    imgs = r.images.trim() ? [r.images.trim()] : [];
                }
            }
            return {
                id: r.id,
                user_name: r.user_name || "Cliente Verificado",
                comment: r.comment || "",
                rating: typeof r.rating === "number" ? r.rating : 5,
                images: imgs.filter((url: any) => typeof url === "string" && url.trim().length > 0),
                is_approved: Boolean(r.is_approved),
                product_id: r.product_id != null ? Number(r.product_id) : null,
                product_name: r.product_name?.trim() || (r.product ? r.product.name : "Geral (Sem Produto)"),
                created_at: r.created_at || undefined,
            };
        });
    };

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                router.push("/admin");
                return;
            }
            const res = await fetch(`/api/reviews/admin/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReviews(normalizeReviews(data));
            }
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    // Estatísticas por produto
    const productStats = useMemo(() => {
        const map = new Map<string, {
            id: string;
            numericId: number;
            name: string;
            total: number;
            pending: number;
            approved: number;
            avgRating: number;
            totalRatingSum: number;
        }>();

        reviews.forEach((rev) => {
            const key = String(rev.product_id ?? 0);
            const name = rev.product_name?.trim() || "Geral (Sem Produto)";
            const current = map.get(key) || {
                id: key,
                numericId: rev.product_id ?? 0,
                name,
                total: 0,
                pending: 0,
                approved: 0,
                avgRating: 0,
                totalRatingSum: 0,
            };

            current.total += 1;
            if (rev.is_approved) {
                current.approved += 1;
            } else {
                current.pending += 1;
            }
            current.totalRatingSum += rev.rating;
            current.avgRating = Number((current.totalRatingSum / current.total).toFixed(1));

            map.set(key, current);
        });

        return [...map.values()].sort((a, b) => b.pending - a.pending || b.total - a.total || a.name.localeCompare(b.name));
    }, [reviews]);

    // Filtros aplicados
    const filteredReviews = useMemo(() => {
        const baseFiltered = reviews.filter((rev) => {
            const matchesProduct = selectedProductTab === "all" || String(rev.product_id ?? 0) === selectedProductTab;
            const matchesStatus = statusFilter === "all" || (statusFilter === "approved" ? rev.is_approved : !rev.is_approved);
            return matchesProduct && matchesStatus;
        });

        if (!searchTerm.trim()) return baseFiltered;

        return fuzzySearch(baseFiltered, searchTerm.trim(), ["user_name", "comment", "product_name"]);
    }, [reviews, selectedProductTab, statusFilter, searchTerm]);

    // Agrupamento por produto para renderização em caixas separadas
    const groupedReviews = useMemo(() => {
        const grouped = new Map<string, {
            productId: number;
            productKey: string;
            productName: string;
            items: ReviewItem[];
            totalProductReviews: number;
            pendingInProduct: number;
            avgRating: number;
        }>();

        // Inicializa com as estatísticas dos produtos filtrados
        productStats.forEach(p => {
            if (selectedProductTab === "all" || selectedProductTab === p.id) {
                grouped.set(p.id, {
                    productId: p.numericId,
                    productKey: p.id,
                    productName: p.name,
                    items: [],
                    totalProductReviews: p.total,
                    pendingInProduct: p.pending,
                    avgRating: p.avgRating,
                });
            }
        });

        // Distribui os itens filtrados
        filteredReviews.forEach((rev) => {
            const key = String(rev.product_id ?? 0);
            const group = grouped.get(key);
            if (group) {
                group.items.push(rev);
            }
        });

        // Retorna apenas os grupos que têm itens ou cujo produto foi filtrado
        return [...grouped.values()]
            .filter(g => g.items.length > 0 || (selectedProductTab !== "all" && selectedProductTab === g.productKey))
            .sort((a, b) => b.pendingInProduct - a.pendingInProduct || b.items.length - a.items.length || a.productName.localeCompare(b.productName));
    }, [filteredReviews, productStats, selectedProductTab]);

    const totalReviews = reviews.length;
    const pendingCount = reviews.filter(r => !r.is_approved).length;
    const approvedCount = reviews.filter(r => r.is_approved).length;

    const handleApprove = async (id: number) => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/approve/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
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

    const handleApproveAllProduct = async (productId: number, productName: string) => {
        if (!confirm(`Aprovar todas as avaliações pendentes do produto "${productName}"?`)) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/admin/approve-all/${productId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                setReviews(prev => prev.map(r => {
                    const matches = productId === 0 ? (!r.product_id || r.product_id === 0) : (r.product_id === productId);
                    return matches ? { ...r, is_approved: true } : r;
                }));
                setActionMsg(`✅ ${data.message || `Avaliações de "${productName}" aprovadas!`}`);
                setTimeout(() => setActionMsg(""), 3500);
            }
        } catch (err) {
            console.error("Error approving all", err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Excluir esta avaliação permanentemente?")) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
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

    const handleDeleteAllProduct = async (productId: number, productName: string) => {
        if (!confirm(`Atenção: Deseja excluir TODAS as avaliações do produto "${productName}"? Esta ação removerá os registros do banco.`)) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/admin/product/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                setReviews(prev => prev.filter(r => {
                    const matches = productId === 0 ? (!r.product_id || r.product_id === 0) : (r.product_id === productId);
                    return !matches;
                }));
                setActionMsg(`🗑️ ${data.message || `Avaliações de "${productName}" excluídas com sucesso!`}`);
                setTimeout(() => setActionMsg(""), 3500);
            }
        } catch (err) {
            console.error("Error deleting product reviews", err);
        }
    };

    return (
        <div className={styles.dashboard} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <AdminSidebar activePath="/admin/dashboard/reviews" />

            <main className={styles.mainContent} style={{ flex: 1, padding: '32px', overflowY: 'auto', overflowX: 'hidden', height: '100%' }}>
                <header className={styles.header}>
                    <div>
                        <h1>Moderação de Avaliações</h1>
                        <p>Avaliações divididas e organizadas por produto para facilitar a aprovação.</p>
                    </div>
                    <button 
                        onClick={fetchReviews} 
                        style={{
                            display: "flex", 
                            alignItems: "center", 
                            gap: "6px",
                            padding: "8px 18px", 
                            borderRadius: "8px", 
                            border: "1.5px solid #2d5a27",
                            background: "white", 
                            color: "#2d5a27", 
                            cursor: "pointer", 
                            fontWeight: 600, 
                            fontSize: "0.85rem"
                        }}
                    >
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </header>

                {actionMsg && (
                    <div style={{
                        padding: "10px 16px", 
                        borderRadius: "10px", 
                        marginBottom: "16px",
                        background: "#f0fdf4", 
                        border: "1px solid #bbf7d0", 
                        color: "#166534",
                        fontWeight: 600, 
                        fontSize: "0.85rem"
                    }}>
                        {actionMsg}
                    </div>
                )}

                {/* Cards de Resumo */}
                <section className={reviewStyles.statsGrid}>
                    <article className={reviewStyles.statCard}>
                        <Inbox size={20} color="#2d5a27" />
                        <div>
                            <p className={reviewStyles.statLabel}>Total de Avaliações</p>
                            <strong className={reviewStyles.statValue}>{totalReviews}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <Clock size={20} color="#d97706" />
                        <div>
                            <p className={reviewStyles.statLabel}>Pendentes</p>
                            <strong className={reviewStyles.statValue} style={{ color: "#d97706" }}>{pendingCount}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <CheckCircle2 size={20} color="#059669" />
                        <div>
                            <p className={reviewStyles.statLabel}>Aprovadas</p>
                            <strong className={reviewStyles.statValue} style={{ color: "#059669" }}>{approvedCount}</strong>
                        </div>
                    </article>
                    <article className={reviewStyles.statCard}>
                        <Package size={20} color="#475569" />
                        <div>
                            <p className={reviewStyles.statLabel}>Produtos com Avaliações</p>
                            <strong className={reviewStyles.statValue}>{productStats.length}</strong>
                        </div>
                    </article>
                </section>

                {/* Barra de Navegação por Abas de Produto */}
                <section className={reviewStyles.tabsContainer}>
                    <div className={reviewStyles.tabsHeader}>
                        <span className={reviewStyles.tabsTitle}>Filtrar por Produto:</span>
                        {productStats.length > 0 && (
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                Mostrando {selectedProductTab === "all" ? "todos os produtos" : productStats.find(p => p.id === selectedProductTab)?.name}
                            </span>
                        )}
                    </div>
                    <div className={reviewStyles.productTabsScroll}>
                        <button
                            type="button"
                            className={`${reviewStyles.productTab} ${selectedProductTab === "all" ? reviewStyles.productTabActive : ""}`}
                            onClick={() => setSelectedProductTab("all")}
                        >
                            Todos os Produtos
                            <span className={reviewStyles.tabCountBadge}>{totalReviews}</span>
                            {pendingCount > 0 && <span className={reviewStyles.tabPendingAlert} title={`${pendingCount} pendente(s)`} />}
                        </button>

                        {productStats.map((prod) => (
                            <button
                                key={prod.id}
                                type="button"
                                className={`${reviewStyles.productTab} ${selectedProductTab === prod.id ? reviewStyles.productTabActive : ""}`}
                                onClick={() => setSelectedProductTab(prod.id)}
                            >
                                <Package size={13} />
                                {prod.name}
                                <span className={reviewStyles.tabCountBadge}>{prod.total}</span>
                                {prod.pending > 0 && (
                                    <span 
                                        className={reviewStyles.tabPendingAlert} 
                                        title={`${prod.pending} pendente(s)`} 
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Filtros secundários: Status e Busca */}
                <section className={reviewStyles.filtersCard}>
                    <div className={reviewStyles.filterItem}>
                        <label>Status das Avaliações</label>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todas ({reviews.length})</option>
                            <option value="pending">Apenas Pendentes ({pendingCount})</option>
                            <option value="approved">Apenas Aprovadas ({approvedCount})</option>
                        </select>
                    </div>

                    <div className={reviewStyles.filterItem} style={{ flex: 1, minWidth: "260px" }}>
                        <label>Buscar por Cliente ou Comentário</label>
                        <div className={reviewStyles.searchWrap}>
                            <Search size={15} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Digite nome de cliente ou trecho da avaliação..."
                            />
                        </div>
                    </div>
                </section>

                {/* Lista de Avaliações Dividida por Produtos */}
                <div className={reviewStyles.groupList}>
                    {loading ? (
                        <div className={reviewStyles.emptyState}>Carregando avaliações...</div>
                    ) : groupedReviews.length === 0 ? (
                        <div className={reviewStyles.emptyState}>
                            Nenhuma avaliação encontrada com os filtros selecionados.
                        </div>
                    ) : (
                        groupedReviews.map((group) => (
                            <section key={group.productKey} className={reviewStyles.groupCard}>
                                <header className={reviewStyles.groupHeader}>
                                    <div className={reviewStyles.groupHeaderLeft}>
                                        <h2 className={reviewStyles.groupTitle}>
                                            <Package size={17} color="#2d5a27" />
                                            {group.productName}
                                        </h2>
                                        <span className={reviewStyles.avgRatingBadge}>
                                            <Star size={12} fill="#f59e0b" color="#f59e0b" />
                                            {group.avgRating}
                                        </span>
                                        <span className={reviewStyles.groupBadgeTotal}>
                                            {group.totalProductReviews} avaliação(ões)
                                        </span>
                                        {group.pendingInProduct > 0 ? (
                                            <span className={reviewStyles.groupBadgePending}>
                                                <AlertCircle size={12} />
                                                {group.pendingInProduct} pendente(s)
                                            </span>
                                        ) : (
                                            <span className={reviewStyles.groupBadgeClean}>
                                                <CheckCircle2 size={12} />
                                                Todas aprovadas
                                            </span>
                                        )}
                                    </div>

                                    <div className={reviewStyles.groupHeaderActions}>
                                        {group.pendingInProduct > 0 && (
                                            <button
                                                type="button"
                                                className={reviewStyles.approveAllBtn}
                                                onClick={() => handleApproveAllProduct(group.productId, group.productName)}
                                                title="Aprova todas as avaliações pendentes deste produto em lote"
                                            >
                                                <CheckCheck size={14} />
                                                Aprovar Todas Pendentes ({group.pendingInProduct})
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className={reviewStyles.deleteGroupBtn}
                                            onClick={() => handleDeleteAllProduct(group.productId, group.productName)}
                                            title="Excluir todas as avaliações deste produto"
                                        >
                                            <Trash2 size={12} />
                                            Excluir Todas
                                        </button>
                                    </div>
                                </header>

                                {group.items.length === 0 ? (
                                    <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                                        Nenhuma avaliação pendente para este produto no momento.
                                    </div>
                                ) : (
                                    <div className={styles.productTable}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th style={{ width: "95px" }}>Data</th>
                                                    <th style={{ width: "160px" }}>Cliente</th>
                                                    <th style={{ width: "110px" }}>Nota</th>
                                                    <th>Comentário</th>
                                                    <th style={{ width: "130px" }}>Fotos</th>
                                                    <th style={{ width: "95px" }}>Status</th>
                                                    <th style={{ width: "130px" }}>Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.items.map((rev) => (
                                                    <tr key={rev.id} style={{ opacity: rev.is_approved ? 0.9 : 1 }}>
                                                        <td>
                                                            <span className={reviewStyles.dateText}>
                                                                {rev.created_at ? new Date(rev.created_at).toLocaleDateString("pt-BR") : "—"}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <strong>{rev.user_name}</strong>
                                                        </td>
                                                        <td>
                                                            <div className={reviewStyles.stars}>
                                                                {"★".repeat(rev.rating)}{"☆".repeat(Math.max(0, 5 - rev.rating))}
                                                            </div>
                                                        </td>
                                                        <td className={reviewStyles.commentCell}>
                                                            {rev.comment}
                                                        </td>
                                                        <td>
                                                            {Array.isArray(rev.images) && rev.images.length > 0 ? (
                                                                <div className={reviewStyles.photoThumbsGrid}>
                                                                    {rev.images.map((imgUrl, i) => (
                                                                        <a
                                                                            key={i}
                                                                            href={imgUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className={reviewStyles.photoThumbLink}
                                                                            title="Abrir foto ampliada"
                                                                        >
                                                                            <img
                                                                                src={imgUrl}
                                                                                alt="Foto"
                                                                                className={reviewStyles.photoThumbImg}
                                                                            />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className={reviewStyles.noPhotosText}>Sem fotos</span>
                                                            )}
                                                        </td>
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
                                                                        title="Aprovar esta avaliação"
                                                                    >
                                                                        <CheckCircle2 size={13} />
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
                                )}
                            </section>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
