"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";

const categories = [
    { id: "all", name: "Todos" },
    { id: "sabonete", name: "Sabonetes" },
    { id: "creme", name: "Cremes" },
    { id: "oleo", name: "Óleos" },
    { id: "oe", name: "Essenciais" },
    { id: "kit", name: "Kits" }
];

const filters = [
    { id: "skin:oily", name: "Pele Oleosa" },
    { id: "skin:dry", name: "Pele Seca" },
    { id: "skin:normal", name: "Pele Normal" },
    { id: "hair", name: "Cabelos" },
    { id: "facial", name: "Rosto" },
    { id: "spots", name: "Manchas" }
];

export default function ProductsPage() {
    const [allProducts, setAllProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeFilter, setActiveFilter] = useState("all");

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch("/api/products");
                const data = await res.json();
                setAllProducts(data);
                setFilteredProducts(data);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        let result = allProducts;

        if (activeCategory !== "all") {
            result = result.filter(p => {
                const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags || "[]");
                return tags.includes(activeCategory);
            });
        }

        if (activeFilter !== "all") {
            result = result.filter(p => {
                const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags || "[]");
                return tags.includes(activeFilter);
            });
        }

        setFilteredProducts(result);
    }, [activeCategory, activeFilter, allProducts]);

    return (
        <main>
            <Header />
            <div className="container" style={{ padding: '50px 0' }}>
                <h1 className={styles.pageTitle}>NOSSOS PRODUTOS</h1>
                
                <div className={styles.filterSection} style={{ marginBottom: '40px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold' }}>CATEGORIAS:</p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        border: '1px solid #2d5a27',
                                        backgroundColor: activeCategory === cat.id ? '#2d5a27' : 'transparent',
                                        color: activeCategory === cat.id ? 'white' : '#2d5a27',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p style={{ fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold' }}>FILTRAR POR:</p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setActiveFilter("all")}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid #666',
                                    backgroundColor: activeFilter === "all" ? '#666' : 'transparent',
                                    color: activeFilter === "all" ? 'white' : '#666',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Limpar Filtros
                            </button>
                            {filters.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFilter(f.id)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        border: '1px solid #2d5a27',
                                        backgroundColor: activeFilter === f.id ? '#2d5a27' : 'transparent',
                                        color: activeFilter === f.id ? 'white' : '#2d5a27',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center' }}>Carregando produtos...</p>
                ) : filteredProducts.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px' }}>Nenhum produto encontrado com estes filtros.</p>
                ) : (
                    <div className={styles.productGrid}>
                        {filteredProducts.map((product: any) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </div>
            <Footer />
        </main>
    );
}
