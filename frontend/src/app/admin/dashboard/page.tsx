"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";
import EditProductModal from "./EditProductModal";
import NewProductModal from "./NewProductModal";
import { Download, ExternalLink, Search, X } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AdminLayout from "@/components/AdminLayout/AdminLayout";

export default function AdminDashboard() {
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
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

    const handleDelete = async (productId: number, productName: string, isActive: boolean) => {
        const action = isActive ? 'Desativar' : 'Reativar';
        const confirmation = isActive 
            ? `Desativar o produto "${productName}"? Ele ficará oculto no site mas pedidos antigos serão preservados.`
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

    const filteredProducts = products
        .filter((p: any) =>
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.slug && p.slug.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Produtos</h1>
                    <button
                        className="btn-primary"
                        onClick={() => setIsAddingProduct(true)}
                    >
                        + Novo Produto
                    </button>
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

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Imagem</th>
                                <th>Nome</th>
                                <th>Preço</th>
                                <th>Estoque</th>
                                <th>Ordem</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((p: any) => (
                                <tr key={p.id} style={{ opacity: p.is_active === false ? 0.5 : 1 }}>
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
                                        {p.is_active === false && (
                                            <span style={{
                                                display: 'inline-block', marginLeft: '8px',
                                                background: '#fef2f2', color: '#ef4444',
                                                fontSize: '0.65rem', padding: '2px 6px',
                                                borderRadius: '4px', fontWeight: 700
                                            }}>INATIVO</span>
                                        )}
                                    </td>
                                    <td data-label="Preço"><span className={styles.priceTag}>{p.price ? `R$ ${p.price.toFixed(2)}` : 'R$ 0,00'}</span></td>
                                    <td data-label="Estoque">
                                        <span className={`${styles.stockBadge} ${p.stock <= 5 ? styles.stockLow : styles.stockOk}`}>
                                            {p.stock ?? 0} unidades
                                        </span>
                                    </td>
                                    <td data-label="Ordem">
                                        <span style={{ fontWeight: 600, color: '#4b5563' }}>
                                            {p.order ?? 0}
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
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDelete(p.id, p.name, p.is_active)}
                                            >
                                                {p.is_active === false ? 'Reativar' : 'Desativar'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
