"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";
import EditProductModal from "./EditProductModal";
import NewProductModal from "./NewProductModal";
import { Download, ExternalLink } from "lucide-react";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function AdminDashboard() {
    const [products, setProducts] = useState<any[]>([]);
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
        return url;
    };

    const handleDelete = async (productId: number, productName: string) => {
        if (!confirm(`Desativar o produto "${productName}"? Ele ficará oculto no site mas pedidos antigos serão preservados.`)) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setProducts(products.map((p: any) => p.id === productId ? { ...p, is_active: false } : p));
            } else {
                alert('Erro ao desativar produto');
            }
        } catch (err) {
            alert('Erro de conexão');
        }
    };

    return (
        <div className={styles.dashboard}>
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
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p: any) => (
                                <tr key={p.id} style={{ opacity: p.is_active === false ? 0.5 : 1 }}>
                                    <td>
                                        <img
                                            src={getImageUrl(p.image_url)}
                                            alt={p.name}
                                            className={styles.productThumb}
                                            onError={(e) => { (e.target as HTMLImageElement).src = '/logo_final.png'; }}
                                        />
                                    </td>
                                    <td>
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
                                    <td><span className={styles.priceTag}>{p.price ? `R$ ${p.price.toFixed(2)}` : 'R$ 0,00'}</span></td>
                                    <td>
                                        <span className={`${styles.stockBadge} ${p.stock <= 5 ? styles.stockLow : styles.stockOk}`}>
                                            {p.stock ?? 0} unidades
                                        </span>
                                    </td>
                                    <td>
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
                                                        const response = await fetch(`/api/static/qrcodes/${p.slug}.png`);
                                                        const blob = await response.blob();
                                                        const url = window.URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.download = `qrcode-${p.slug}.png`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                    } catch (err) {
                                                        console.error("Erro ao baixar QR Code", err);
                                                        alert("Erro ao baixar QR Code");
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
                                                onClick={() => handleDelete(p.id, p.name)}
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
        </div>
    );
}
