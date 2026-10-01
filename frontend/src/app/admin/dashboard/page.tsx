"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";
import EditProductModal from "./EditProductModal";
import NewProductModal from "./NewProductModal";
import {
    Download, ExternalLink, Search, X, GripVertical,
    Trash2, CheckCircle2, ArrowUpDown, Loader2
} from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AdminLayout from "@/components/AdminLayout/AdminLayout";

export default function AdminDashboard() {
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
    const [dragOverItemId, setDragOverItemId] = useState<number | null>(null);
    const [savingOrder, setSavingOrder] = useState(false);
    const [orderSavedToast, setOrderSavedToast] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/products/?include_inactive=true`);
                if (!res.ok) throw new Error("Falha ao carregar produtos");
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching products:", error);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [router]);

    const getImageUrl = (url: string) => {
        if (!url) return "/logo_final.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        if (url.startsWith("attached_assets/")) return `/static/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    // Toggle ativar / desativar (ao desativar, desce automaticamente para o final)
    const handleDelete = async (productId: number, productName: string, isActive: boolean) => {
        const action = isActive ? 'Desativar' : 'Reativar';
        const confirmation = isActive 
            ? `Desativar o produto "${productName}"? Ele ficará oculto no site e descerá para o final da lista.`
            : `Reativar o produto "${productName}"? Ele voltará a aparecer no site para os clientes.`;

        if (!confirm(confirmation)) return;
        
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(products.map((p: any) => p.id === productId ? { ...p, is_active: data.is_active } : p));
            } else {
                alert(`Erro ao ${action.toLowerCase()} produto`);
            }
        } catch (err) {
            alert('Erro de conexão');
        }
    };

    // Exclusão definitiva de produto inativo
    const handlePermanentDelete = async (productId: number, productName: string) => {
        const confirmation = `ATENÇÃO: Deseja realmente EXCLUIR DEFINITIVAMENTE o produto "${productName}"?\n\nEsta ação apagará o produto do sistema permanentemente e não poderá ser desfeita.`;
        if (!confirm(confirmation)) return;

        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/products/${productId}?permanent=true`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setProducts(prev => prev.filter((p: any) => p.id !== productId));
                alert(`Produto "${productName}" excluído definitivamente com sucesso.`);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`Erro ao excluir produto: ${errData.detail || "Falha na requisição"}`);
            }
        } catch (err) {
            alert('Erro de conexão ao excluir produto');
        }
    };

    const handleExportZpl = async (productId: number, slug: string) => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                router.push("/admin");
                return;
            }

            const res = await fetch(`/api/products/${productId}/label.zpl`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.status === 401) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.push("/admin");
                return;
            }

            if (!res.ok) {
                throw new Error("Falha ao exportar ZPL");
            }

            const zplText = await res.text();
            const blob = new Blob([zplText], { type: "application/zpl" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `label-${slug}.zpl`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Erro ao exportar ZPL", err);
            alert("Erro ao exportar ZPL");
        }
    };

    // ── DRAG & DROP REORDERING ───────────────────────────────────────────────
    const handleDragStart = (e: React.DragEvent, id: number) => {
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(id));
    };

    const handleDragOver = (e: React.DragEvent, id: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverItemId !== id) {
            setDragOverItemId(id);
        }
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setDragOverItemId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetId: number) => {
        e.preventDefault();
        const sourceId = draggedItemId;
        setDraggedItemId(null);
        setDragOverItemId(null);

        if (!sourceId || sourceId === targetId) return;

        // Produtos ativos podem ser reordenados entre si
        const activeProducts = products
            .filter((p: any) => p.is_active !== false)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        
        const inactiveProducts = products
            .filter((p: any) => p.is_active === false)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        const sourceIndex = activeProducts.findIndex((p: any) => p.id === sourceId);
        const targetIndex = activeProducts.findIndex((p: any) => p.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        const newActive = [...activeProducts];
        const [moved] = newActive.splice(sourceIndex, 1);
        newActive.splice(targetIndex, 0, moved);

        // Atribui nova ordem numérica consecutiva (1, 2, 3...) aos ativos
        const updatedOrders: { id: number; order: number }[] = [];
        const reorderedActive = newActive.map((p: any, idx: number) => {
            const newOrd = idx + 1;
            updatedOrders.push({ id: p.id, order: newOrd });
            return { ...p, order: newOrd };
        });

        // Atualização otimista no estado local
        setProducts([...reorderedActive, ...inactiveProducts]);

        // Salva ordem no servidor
        setSavingOrder(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/products/reorder", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(updatedOrders)
            });
            if (res.ok) {
                setOrderSavedToast(true);
                setTimeout(() => setOrderSavedToast(false), 2500);
            } else {
                console.error("Falha ao salvar reordenação de produtos no servidor");
            }
        } catch (err) {
            console.error("Erro ao salvar ordem dos produtos:", err);
        } finally {
            setSavingOrder(false);
        }
    };

    // ── AUTOMÁTICO: PRODUTOS INATIVOS DESCEM PARA O FINAL ────────────────────
    const filteredProducts = useMemo(() => {
        return [...products]
            .filter((p: any) =>
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.slug && p.slug.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .sort((a, b) => {
                // Inativos descem automaticamente para o final da lista
                const aActive = a.is_active !== false;
                const bActive = b.is_active !== false;
                if (aActive !== bActive) {
                    return aActive ? -1 : 1;
                }
                return (a.order ?? 0) - (b.order ?? 0);
            });
    }, [products, searchTerm]);

    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Produtos</h1>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <Link
                            href="/admin/dashboard/precos"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1.5px solid #86efac",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                fontWeight: 700,
                                fontSize: "0.9rem",
                                textDecoration: "none"
                            }}
                        >
                            ⚡ Ajuste Global de Preços
                        </Link>
                        <button
                            className="btn-primary"
                            onClick={() => setIsAddingProduct(true)}
                        >
                            + Novo Produto
                        </button>
                    </div>
                </header>

                <div className={styles.adminSearchContainer}>
                    <Search size={18} className={styles.adminSearchIcon} />
                    <input
                        type="text"
                        placeholder="Buscar produto por nome ou slug..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.adminSearchInput}
                    />
                    {searchTerm && (
                        <button className={styles.adminSearchClear} onClick={() => setSearchTerm("")}>
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3>Total de Produtos</h3>
                        <p>{products.length}</p>
                    </div>
                </div>

                {/* BARRA DE CLASSIFICAÇÃO / ARRASTAR E SOLTAR */}
                <div className={styles.reorderBar}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <ArrowUpDown size={16} color="#166534" />
                        <span>
                            <strong>Classificar exibição:</strong> Arraste as linhas com o mouse pelo ícone <GripVertical size={14} style={{ verticalAlign: 'middle', display: 'inline' }} /> para definir a ordem dos produtos no site. Produtos inativos descem automaticamente para o final.
                        </span>
                    </div>
                    {savingOrder && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#2563eb", fontSize: "0.82rem", fontWeight: 600 }}>
                            <Loader2 size={14} className="spin" /> Salvando ordem...
                        </span>
                    )}
                    {orderSavedToast && (
                        <span className={styles.reorderToast}>
                            <CheckCircle2 size={14} /> Ordem salva com sucesso!
                        </span>
                    )}
                </div>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: "70px", textAlign: "center" }}>Ordem</th>
                                <th>Imagem</th>
                                <th>Nome</th>
                                <th>Preço</th>
                                <th>Estoque</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((p: any) => {
                                const isInactive = p.is_active === false;
                                const isDraggable = !isInactive && !searchTerm;

                                return (
                                    <tr
                                        key={p.id}
                                        draggable={isDraggable}
                                        onDragStart={(e) => isDraggable && handleDragStart(e, p.id)}
                                        onDragOver={(e) => isDraggable && handleDragOver(e, p.id)}
                                        onDragEnd={handleDragEnd}
                                        onDrop={(e) => isDraggable && handleDrop(e, p.id)}
                                        className={`
                                            ${isDraggable ? styles.draggableRow : ''}
                                            ${draggedItemId === p.id ? styles.draggingRow : ''}
                                            ${dragOverItemId === p.id && draggedItemId !== p.id ? styles.dragOverRow : ''}
                                        `}
                                        style={{
                                            opacity: isInactive ? 0.6 : 1,
                                            backgroundColor: isInactive ? '#f8fafc' : undefined
                                        }}
                                    >
                                        <td data-label="Ordem" style={{ textAlign: "center" }}>
                                            {!isInactive ? (
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                                    <span
                                                        className={styles.dragGrip}
                                                        title={searchTerm ? "Limpe a busca para reordenar" : "Clique e arraste para mudar a posição"}
                                                    >
                                                        <GripVertical size={18} color="#64748b" />
                                                    </span>
                                                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                                                        {p.order ?? 0}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span
                                                    title="Produto inativo fica fixo no final da lista"
                                                    style={{
                                                        fontSize: "0.72rem",
                                                        fontWeight: 700,
                                                        color: "#94a3b8",
                                                        background: "#f1f5f9",
                                                        padding: "2px 6px",
                                                        borderRadius: "4px"
                                                    }}
                                                >
                                                    Inativo ↓
                                                </span>
                                            )}
                                        </td>
                                        <td data-label="Imagem">
                                            <img
                                                src={getImageUrl(p.image_url)}
                                                alt={p.name}
                                                className={styles.productThumb}
                                                onError={(e) => { (e.target as HTMLImageElement).src = '/logo_final.png'; }}
                                            />
                                        </td>
                                        <td data-label="Nome">
                                            <strong>{p.name}</strong>
                                            {isInactive && (
                                                <span style={{
                                                    display: 'inline-block', marginLeft: '8px',
                                                    background: '#fef2f2', color: '#ef4444',
                                                    fontSize: '0.65rem', padding: '2px 6px',
                                                    borderRadius: '4px', fontWeight: 700
                                                }}>INATIVO</span>
                                            )}
                                        </td>
                                        <td data-label="Preço">
                                            {p.is_on_sale && p.sale_price ? (
                                                <div>
                                                    <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '0.82rem', marginRight: '6px' }}>
                                                        R$ {(p.original_price ?? p.price).toFixed(2)}
                                                    </span>
                                                    <span className={styles.priceTag} style={{ color: '#16a34a', fontWeight: 700 }}>
                                                        R$ {p.sale_price.toFixed(2)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className={styles.priceTag}>{p.price ? `R$ ${p.price.toFixed(2)}` : 'R$ 0,00'}</span>
                                            )}
                                        </td>
                                        <td data-label="Estoque">
                                            <span className={`${styles.stockBadge} ${p.stock <= 5 ? styles.stockLow : styles.stockOk}`}>
                                                {p.stock ?? 0} unidades
                                            </span>
                                        </td>
                                        <td data-label="Ações">
                                            <div className={styles.actions}>
                                                <a
                                                    href={`/produto/${p.slug}/info`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.editBtn}
                                                    style={{ backgroundColor: '#2d5a27', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                                    title="Ver Página de Detalhes"
                                                >
                                                    <ExternalLink size={14} /> Página
                                                </a>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(`/static/qrcodes/${p.slug}.png`);
                                                            if (!response.ok) throw new Error(`Status ${response.status}`);
                                                            const rawBlob = await response.blob();
                                                            const blob = new Blob([rawBlob], { type: 'image/png' });
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;
                                                            link.download = `qrcode-${p.slug}.png`;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            window.URL.revokeObjectURL(url);
                                                        } catch (err) {
                                                            console.error("Erro ao baixar QR Code", err);
                                                            alert("Erro ao baixar QR Code. Verifique se o QR foi gerado.");
                                                        }
                                                    }}
                                                    className={styles.editBtn}
                                                    style={{ backgroundColor: '#b8860b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                                    title="Baixar QR Code da Ficha Técnica"
                                                >
                                                    <Download size={14} /> QR
                                                </button>
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => setEditingProduct(p)}
                                                >
                                                    Editar
                                                </button>
                                                {isInactive ? (
                                                    <>
                                                        <button
                                                            className={styles.reactivateBtn}
                                                            onClick={() => handleDelete(p.id, p.name, p.is_active)}
                                                            title="Reativar produto para voltar a exibir na loja"
                                                        >
                                                            <CheckCircle2 size={14} /> Reativar
                                                        </button>
                                                        <button
                                                            className={styles.permanentDeleteBtn}
                                                            onClick={() => handlePermanentDelete(p.id, p.name)}
                                                            title="Excluir este produto inativo definitivamente do banco"
                                                        >
                                                            <Trash2 size={14} /> Excluir
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleDelete(p.id, p.name, p.is_active)}
                                                        title="Desativar produto (ele descerá automaticamente para o final da lista)"
                                                    >
                                                        Desativar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {editingProduct && (
                    <EditProductModal
                        product={editingProduct}
                        onClose={() => setEditingProduct(null)}
                        onSave={(updated) => {
                            setProducts(products.map((p: any) => p.id === updated.id ? updated : p));
                        }}
                    />
                )}

                {isAddingProduct && (
                    <NewProductModal
                        onClose={() => setIsAddingProduct(false)}
                        onSave={(newProduct) => {
                            setProducts([newProduct, ...products]);
                        }}
                    />
                )}
            </main>
        </AdminLayout>
    );
}
