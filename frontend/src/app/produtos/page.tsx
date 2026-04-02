"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";
import { Sparkles, Filter, LayoutGrid, DollarSign } from "lucide-react";
import Link from "next/link";

const categories = [
    { id: "all", name: "Todos os Produtos" },
    { id: "sabonete", name: "Sabonetes Naturais" },
    { id: "creme", name: "Cremes e Loções" },
    { id: "oleo", name: "Óleos de Tratamento" },
    { id: "oe", name: "Óleos Essenciais" },
    { id: "kit", name: "Kits e Presentes" }
];

const skinFilters = [
    { id: "skin:oily", name: "Pele Oleosa" },
    { id: "skin:dry", name: "Pele Seca" },
    { id: "skin:normal", name: "Pele Normal" }
];

const treatmentFilters = [
    { id: "facial", name: "Tratamento Facial" },
    { id: "hair", name: "Cuidado Capilar" },
    { id: "spots", name: "Xô Manchas" }
];

export default function ProductsPage() {
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeFilter, setActiveFilter] = useState("all");
    const [maxPrice, setMaxPrice] = useState(500);

    const getImageUrl = (url: string) => {
        if (!url) return "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
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

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch("/api/products");
                if (!res.ok) throw new Error("Falha ao carregar produtos");
                const data = await res.json();
                const products = (Array.isArray(data) ? data : []).map((p: any) => ({
                    ...p,
                    image_url: p.image_url // Pass raw URL to ProductCard which has its own getImageUrl
                }));
                setAllProducts(products);
            } catch (error) {
                console.error("Error fetching products:", error);
                setAllProducts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        return allProducts.filter(p => {
            const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags || "[]");

            // Category check
            const categoryMatch = activeCategory === "all" || tags.includes(activeCategory);

            // Sub-filter check
            const filterMatch = activeFilter === "all" || tags.includes(activeFilter);

            // Price check
            const priceMatch = p.price <= maxPrice;

            return categoryMatch && filterMatch && priceMatch;
        });
    }, [allProducts, activeCategory, activeFilter, maxPrice]);

    return (
        <>
            <Header />
            <main className="container">
                <div className={styles.productsContainer}>
                    <aside className={styles.sidebar}>
                        <div className={styles.wholesaleSidebarCard}>
                            <div className={styles.wholesaleBadge}>ECONOMIA REAL</div>
                            <h4>Atacado ECOSOPIS</h4>
                            <p>Desbloqueie <strong>30% de desconto</strong> direto de fábrica ao montar seu kit com 10+ produtos.</p>
                            <Link href="/atacado" className={styles.wholesaleBtnSidebar}>
                                COMPRAR NO ATACADO
                            </Link>
                        </div>

                        <div className={styles.quizSidebarCard}>
                            <Sparkles size={24} color="var(--primary-green)" style={{ marginBottom: '12px' }} />
                            <h4>Dúvida na escolha?</h4>
                            <p>Responda nosso quiz e encontre o produto ideal para sua pele em 1 minuto.</p>
                            <Link href="/quizz" className={styles.quizBtnSidebar} style={{ display: 'block', textDecoration: 'none' }}>
                                INICIAR QUIZ
                            </Link>
                        </div>

                        <div className={styles.filterGroup}>
                            <h3><LayoutGrid size={14} /> Categorias</h3>
                            <div className={styles.filterList}>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        className={activeCategory === cat.id ? styles.filterItemActive : styles.filterItem}
                                        onClick={() => setActiveCategory(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.filterGroup}>
                            <h3><DollarSign size={14} /> Preço Máximo</h3>
                            <div className={styles.priceRangeContainer}>
                                <div className={styles.priceDisplay}>
                                    <span>R$ 0</span>
                                    <span>R$ {maxPrice}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="500"
                                    step="10"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                                    className={styles.priceSlider}
                                />
                            </div>
                        </div>

                        <div className={styles.filterGroup}>
                            <h3><Filter size={14} /> Tipo de Pele</h3>
                            <div className={styles.filterList}>
                                <button
                                    className={activeFilter === "all" ? styles.filterItemActive : styles.filterItem}
                                    onClick={() => setActiveFilter("all")}
                                >
                                    Todos os tipos
                                </button>
                                {skinFilters.map(f => (
                                    <button
                                        key={f.id}
                                        className={activeFilter === f.id ? styles.filterItemActive : styles.filterItem}
                                        onClick={() => setActiveFilter(f.id)}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.filterGroup}>
                            <h3><Sparkles size={14} /> Tratamentos</h3>
                            <div className={styles.filterList}>
                                {treatmentFilters.map(f => (
                                    <button
                                        key={f.id}
                                        className={activeFilter === f.id ? styles.filterItemActive : styles.filterItem}
                                        onClick={() => setActiveFilter(f.id)}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <div className={styles.mainContent}>
                        <div className={styles.gridHeader}>
                            <h2>{activeCategory === 'all' ? 'Todos os Produtos' : categories.find(c => c.id === activeCategory)?.name}</h2>
                            <span className={styles.resultsCount}>{filteredProducts.length} itens encontrados</span>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                                <div className="loader"></div>
                                <p style={{ marginTop: '20px', color: '#999', fontSize: '0.9rem' }}>Carregando produtos...</p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                                <p style={{ color: '#666' }}>Nenhum produto atende aos filtros selecionados.</p>
                                <button
                                    onClick={() => { setActiveCategory('all'); setActiveFilter('all'); setMaxPrice(500); }}
                                    style={{ marginTop: '20px', color: 'var(--primary-green)', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                                >
                                    Limpar todos os filtros
                                </button>
                            </div>
                        ) : (
                            <div className={styles.productGrid}>
                                {filteredProducts.map((product: any) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
