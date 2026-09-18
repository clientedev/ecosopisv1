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
    AlertCircle,
    Edit2,
    Plus,
    Upload,
    X
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

    // Estado para edição de avaliação
    const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
    const [editFormData, setEditFormData] = useState<{
        user_name: string;
        comment: string;
        rating: number;
        is_approved: boolean;
        product_id: number | null;
        images: string[];
    }>({
        user_name: "",
        comment: "",
        rating: 5,
        is_approved: true,
        product_id: null,
        images: [],
    });
    const [newImageUrl, setNewImageUrl] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

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

    // Funções de Edição
    const openEditModal = (review: ReviewItem) => {
        setEditingReview(review);
        setEditFormData({
            user_name: review.user_name || "",
            comment: review.comment || "",
            rating: review.rating || 5,
            is_approved: review.is_approved,
            product_id: review.product_id != null ? Number(review.product_id) : null,
            images: Array.isArray(review.images) ? [...review.images] : [],
        });
        setNewImageUrl("");
    };

    const closeEditModal = () => {
        setEditingReview(null);
        setNewImageUrl("");
    };

    const handleAddImageLink = () => {
        const trimmed = newImageUrl.trim();
        if (!trimmed) return;
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
            alert("Por favor, insira uma URL válida (ex: https://...)");
            return;
        }
        setEditFormData(prev => ({
            ...prev,
            images: [...prev.images, trimmed]
        }));
        setNewImageUrl("");
    };

    const handleUploadImageFile = async (file: File) => {
        setUploadingImage(true);
        try {
            const token = localStorage.getItem("token");
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/images/upload", {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` },
                body: fd
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    setEditFormData(prev => ({
                        ...prev,
                        images: [...prev.images, data.url]
                    }));
                }
            } else {
                alert("Falha ao enviar imagem. Verifique o arquivo.");
            }
        } catch (err) {
            console.error("Erro no upload", err);
            alert("Erro de conexão ao enviar imagem.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemoveImage = (index: number) => {
        setEditFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleSaveEdit = async () => {
        if (!editingReview) return;
        if (!editFormData.user_name.trim()) {
            alert("O nome do cliente é obrigatório.");
            return;
        }
        if (!editFormData.comment.trim()) {
            alert("O comentário da avaliação é obrigatório.");
            return;
        }

        setSavingEdit(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/reviews/${editingReview.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_name: editFormData.user_name,
                    comment: editFormData.comment,
                    rating: editFormData.rating,
                    is_approved: editFormData.is_approved,
                    product_id: editFormData.product_id,
                    images: editFormData.images
                })
            });

            if (res.ok) {
                const data = await res.json();
                const updated = data.review;
                setReviews(prev => prev.map(r => r.id === editingReview.id ? {
                    ...r,
                    user_name: updated.user_name,
                    comment: updated.comment,
                    rating: updated.rating,
                    is_approved: updated.is_approved,
                    product_id: updated.product_id,
                    images: Array.isArray(updated.images) ? updated.images : [],
                    product_name: productStats.find(p => p.numericId === updated.product_id)?.name || r.product_name
                } : r));
                setActionMsg("✅ Avaliação atualizada com sucesso!");
                setTimeout(() => setActionMsg(""), 3500);
                closeEditModal();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.detail || "Erro ao salvar avaliação.");
            }
        } catch (err) {
            console.error("Error updating review", err);
            alert("Erro de conexão ao salvar avaliação.");
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <div className={styles.dashboard} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <AdminSidebar activePath="/admin/dashboard/reviews" />

            <main className={styles.mainContent} style={{ flex: 1, padding: '32px', overflowY: 'auto', overflowX: 'hidden', height: '100%' }}>
                <header className={styles.header}>
                    <div>
                        <h1>Moderação de Avaliações</h1>
                        <p>Avaliações divididas por produto, com edição completa e gerenciamento de fotos.</p>
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
                                                    <th style={{ width: "150px" }}>Cliente</th>
                                                    <th style={{ width: "105px" }}>Nota</th>
                                                    <th>Comentário</th>
                                                    <th style={{ width: "120px" }}>Fotos</th>
                                                    <th style={{ width: "95px" }}>Status</th>
                                                    <th style={{ width: "180px" }}>Ações</th>
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
                                                                    className={reviewStyles.editBtn}
                                                                    onClick={() => openEditModal(rev)}
                                                                    title="Editar texto, nota e fotos desta avaliação"
                                                                >
                                                                    <Edit2 size={13} />
                                                                    Editar
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
                                )}
                            </section>
                        ))
                    )}
                </div>
            </main>

            {/* Modal de Edição de Avaliação */}
            {editingReview && (
                <div className={reviewStyles.modalOverlay} onClick={closeEditModal}>
                    <div className={reviewStyles.modalContainer} onClick={(e) => e.stopPropagation()}>
                        <header className={reviewStyles.modalHeader}>
                            <h3>
                                <Edit2 size={17} color="#2d5a27" />
                                Editar Avaliação #{editingReview.id}
                            </h3>
                            <button
                                type="button"
                                className={reviewStyles.modalCloseBtn}
                                onClick={closeEditModal}
                                title="Fechar"
                            >
                                <X size={18} />
                            </button>
                        </header>

                        <div className={reviewStyles.modalBody}>
                            <div className={reviewStyles.formGroup}>
                                <label>Nome do Cliente / Avaliador</label>
                                <input
                                    type="text"
                                    value={editFormData.user_name}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, user_name: e.target.value }))}
                                    placeholder="Ex: Maria Silva"
                                />
                            </div>

                            <div className={reviewStyles.formGroup}>
                                <label>Nota (Estrelas)</label>
                                <div className={reviewStyles.starPicker}>
                                    {[1, 2, 3, 4, 5].map((starVal) => (
                                        <button
                                            key={starVal}
                                            type="button"
                                            className={`${reviewStyles.starPickerBtn} ${starVal <= editFormData.rating ? reviewStyles.starPickerActive : ""}`}
                                            onClick={() => setEditFormData(prev => ({ ...prev, rating: starVal }))}
                                            title={`${starVal} estrelas`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f59e0b", marginLeft: "6px" }}>
                                        {editFormData.rating} de 5 estrelas
                                    </span>
                                </div>
                            </div>

                            <div className={reviewStyles.formGroup}>
                                <label>Comentário da Avaliação</label>
                                <textarea
                                    rows={4}
                                    value={editFormData.comment}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, comment: e.target.value }))}
                                    placeholder="Digite o texto da avaliação..."
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div className={reviewStyles.formGroup}>
                                    <label>Status de Publicação</label>
                                    <select
                                        value={editFormData.is_approved ? "true" : "false"}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, is_approved: e.target.value === "true" }))}
                                    >
                                        <option value="true">✅ Aprovada (Visível no site)</option>
                                        <option value="false">⏳ Pendente de moderação</option>
                                    </select>
                                </div>

                                <div className={reviewStyles.formGroup}>
                                    <label>Produto Vinculado</label>
                                    <select
                                        value={editFormData.product_id != null ? String(editFormData.product_id) : "0"}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setEditFormData(prev => ({ ...prev, product_id: val === 0 ? null : val }));
                                        }}
                                    >
                                        <option value="0">Geral (Sem Produto Específico)</option>
                                        {productStats.filter(p => p.numericId !== 0).map(p => (
                                            <option key={p.id} value={p.numericId}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Gerenciador de Fotos da Avaliação */}
                            <div className={reviewStyles.imagesSectionBox}>
                                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                                    Fotos da Avaliação ({editFormData.images.length})
                                </label>

                                {/* Inserir link da imagem */}
                                <div className={reviewStyles.imageInputRow}>
                                    <input
                                        type="text"
                                        value={newImageUrl}
                                        onChange={(e) => setNewImageUrl(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddImageLink();
                                            }
                                        }}
                                        placeholder="Cole o link da foto (https://...)"
                                    />
                                    <button
                                        type="button"
                                        className={reviewStyles.addImageBtn}
                                        onClick={handleAddImageLink}
                                    >
                                        <Plus size={14} /> Inserir Link
                                    </button>
                                </div>

                                {/* Ou upload de imagem */}
                                <div className={reviewStyles.uploadRow}>
                                    <label className={reviewStyles.uploadFileLabel}>
                                        <Upload size={14} />
                                        {uploadingImage ? "Enviando imagem..." : "Upload do Computador"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            disabled={uploadingImage}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleUploadImageFile(e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                        JPG, PNG ou WebP
                                    </span>
                                </div>

                                {/* Miniaturas das fotos atuais */}
                                {editFormData.images.length > 0 ? (
                                    <div className={reviewStyles.imagesThumbsGrid}>
                                        {editFormData.images.map((imgUrl, i) => (
                                            <div key={i} className={reviewStyles.thumbCard} title={imgUrl}>
                                                <img src={imgUrl} alt={`Foto ${i + 1}`} />
                                                <button
                                                    type="button"
                                                    className={reviewStyles.removeThumbBtn}
                                                    onClick={() => handleRemoveImage(i)}
                                                    title="Remover foto"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", fontStyle: "italic" }}>
                                        Nenhuma foto anexada a esta avaliação no momento.
                                    </p>
                                )}
                            </div>
                        </div>

                        <footer className={reviewStyles.modalFooter}>
                            <button
                                type="button"
                                className={reviewStyles.cancelModalBtn}
                                onClick={closeEditModal}
                                disabled={savingEdit}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={reviewStyles.saveModalBtn}
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                            >
                                <CheckCircle2 size={15} />
                                {savingEdit ? "Salvando..." : "Salvar Alterações"}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
