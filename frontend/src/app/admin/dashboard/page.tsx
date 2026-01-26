"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";
import EditProductModal from "./EditProductModal";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function AdminDashboard() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/products/`);
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
        if (!url) return "/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/attached_assets")) return url;
        return `/api${url}`;
    };

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Produtos</h1>
                    <button className="btn-primary">+ Novo Produto</button>
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
                                <tr key={p.id}>
                                    <td>
                                        <img 
                                            src={getImageUrl(p.image_url)} 
                                            alt={p.name} 
                                            className={styles.productThumb}
                                        />
                                    </td>
                                    <td><strong>{p.name}</strong></td>
                                    <td><span className={styles.priceTag}>{p.price ? `R$ ${p.price.toFixed(2)}` : 'R$ 0,00'}</span></td>
                                    <td>
                                        <span className={`${styles.stockBadge} ${p.stock <= 5 ? styles.stockLow : styles.stockOk}`}>
                                            {p.stock ?? 0} unidades
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button 
                                                className={styles.editBtn}
                                                onClick={() => setEditingProduct(p)}
                                            >
                                                Editar
                                            </button>
                                            <button className={styles.deleteBtn}>Excluir</button>
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
            </main>
        </div>
    );
}
