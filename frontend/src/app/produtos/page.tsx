"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";
import { 
    Sparkles, Filter, LayoutGrid, DollarSign, Search, 
    SlidersHorizontal, X, ArrowRight, ShieldCheck, Check, 
    ChevronRight, Tag, Package, ArrowUpDown, RefreshCw, Eye 
} from "lucide-react";
import Link from "next/link";
import { fuzzySearch } from "@/utils/search";
import { useTheme } from "@/context/ThemeContext";

const categories = [
    { id: "all", name: "Todos os Produtos" },
    { id: "sabonete", name: "Sabonetes Naturais" },
    { id: "creme", name: "Cremes e Loções" },
    { id: "oleo", name: "Óleos de Tratamento" },
    { id: "oe", name: "Óleos Essenciais" },
    { id: "kit", name: "Kits e Presentes" }
];

const skinFilters = [
    { id: "all", name: "Todos os Tipos" },
    { id: "skin:oily", name: "Pele Oleosa / Acneica" },
    { id: "skin:dry", name: "Pele Seca / Ressecada" },
    { id: "skin:normal", name: "Pele Normal / Mista" },
    { id: "sensitivity", name: "Pele Sensível / Foliculite" }
];

const benefitFilters = [
    { id: "all", name: "Todos os Benefícios" },
    { id: "spots", name: "Clareamento de Manchas" },
    { id: "acne", name: "Controle de Oleosidade & Acne" },
    { id: "hidratante", name: "Hidratação & Maciez" },
    { id: "facial", name: "Tratamento Facial" },
    { id: "hair", name: "Cuidados Capilares" }
];

const sortOptions = [
    { id: "featured", name: "Mais Vendidos" },
    { id: "price_asc", name: "Menor Preço" },
    { id: "price_desc", name: "Maior Preço" },
    { id: "name_asc", name: "Nome (A-Z)" }
];

export default function ProductsPage() {
    const { activeTheme } = useTheme();
    const isV2Theme = activeTheme === 'pg_produtos_v2';

    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters state
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeSkin, setActiveSkin] = useState("all");
    const [activeBenefit, setActiveBenefit] = useState("all");
    const [maxPrice, setMaxPrice] = useState(500);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("featured");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch("/api/products");
                if (!res.ok) throw new Error("Falha ao carregar produtos");
                const data = await res.json();
                const products = (Array.isArray(data) ? data : []).map((p: any) => ({
                    ...p,
                    image_url: p.image_url
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
        let result = allProducts.filter(p => {
            const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags || "[]");

            // Category check
            let categoryMatch = activeCategory === "all";
            if (!categoryMatch) {
                if (activeCategory === "sabonete") {
                    categoryMatch = tags.includes("sabonete") || tags.includes("sabonete-liquido");
                } else if (activeCategory === "creme") {
                    categoryMatch = tags.includes("creme") || tags.includes("manteiga");
                } else {
                    categoryMatch = tags.includes(activeCategory);
                }
            }

            // Skin Type check
            const skinMatch = activeSkin === "all" || tags.includes(activeSkin);

            // Benefit check
            let benefitMatch = activeBenefit === "all";
            if (!benefitMatch) {
                if (activeBenefit === "spots") {
                    benefitMatch = tags.includes("spots") || tags.includes("clareador");
                } else if (activeBenefit === "acne") {
                    benefitMatch = tags.includes("acne") || tags.includes("foliculite");
                } else {
                    benefitMatch = tags.includes(activeBenefit);
                }
            }

            // Price check
            const currentPrice = p.is_on_sale && p.sale_price ? p.sale_price : p.price || 0;
            const priceMatch = currentPrice <= maxPrice;

            return categoryMatch && skinMatch && benefitMatch && priceMatch;
        });

        // Search filter
        if (searchTerm) {
            result = fuzzySearch(result, searchTerm, ["name", "description", "ingredients"]);
        }

        // Sorting
        if (sortBy === "price_asc") {
            result.sort((a, b) => ((a.is_on_sale && a.sale_price ? a.sale_price : a.price) || 0) - ((b.is_on_sale && b.sale_price ? b.sale_price : b.price) || 0));
        } else if (sortBy === "price_desc") {
            result.sort((a, b) => ((b.is_on_sale && b.sale_price ? b.sale_price : b.price) || 0) - ((a.is_on_sale && a.sale_price ? a.sale_price : a.price) || 0));
        } else if (sortBy === "name_asc") {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }

        return result;
    }, [allProducts, activeCategory, activeSkin, activeBenefit, maxPrice, searchTerm, sortBy]);

    const hasActiveFilters = activeCategory !== "all" || activeSkin !== "all" || activeBenefit !== "all" || maxPrice < 500 || searchTerm !== "";

    const resetFilters = () => {
        setActiveCategory("all");
        setActiveSkin("all");
        setActiveBenefit("all");
        setMaxPrice(500);
        setSearchTerm("");
        setSortBy("featured");
    };

    return (
        <>
            <Header />

            {/* CeraVe-inspired Clean Hero Banner */}
            <section className={styles.v2CatalogHero}>
                <div className={styles.v2HeroContainer}>
                    <div className={styles.v2HeroBadgeRow}>
                        <span className={styles.v2HeroBadge}>
                            <ShieldCheck size={13} style={{ marginRight: 4 }} /> CATÁLOGO DERMOCOSMÉTICO ECOSOPIS
                        </span>
                        <span className={styles.v2HeroGuarantee}>
                            100% Vegano • Botânico • Sem Parabenos
                        </span>
                    </div>

                    <h1 className={styles.v2HeroTitle}>
                        {activeCategory === "all" ? "Todos os Produtos" : categories.find(c => c.id === activeCategory)?.name}
                    </h1>
                    <p className={styles.v2HeroSubtitle}>
                        Fórmulas botânicas com ingredientes ativos desenvolvidos para tratar, cuidar e manter a saúde da sua pele.
                    </p>

                    {/* Quick Category Bar */}
                    <div className={styles.v2CategoryBar}>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={activeCategory === cat.id ? styles.v2CategoryPillActive : styles.v2CategoryPill}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <main className="container">
                {/* PROMINENT WHOLESALE HIGHLIGHT BANNER */}
                <div className={styles.v2WholesaleBanner}>
                    <div className={styles.v2WholesaleBannerContent}>
                        <div className={styles.v2WholesaleHeaderBadge}>
                            <Package size={13} style={{ marginRight: 5 }} /> ÁREA DE ATACADO & REVENDA
                        </div>
                        <h3>Desconto de até 35% direto de fábrica</h3>
                        <p>
                            Monte seu pedido com 10 ou mais produtos e receba condições exclusivas com faturamento rápido e entrega prioritária.
                        </p>
                    </div>
                    <Link href="/atacado" className={styles.v2WholesaleBannerBtn}>
                        <span>CONHECER ÁREA DE ATACADO</span>
                        <ArrowRight size={16} />
                    </Link>
                </div>

                <div className={styles.productsContainer}>
                    {/* FILTER SIDEBAR */}
                    <aside className={styles.sidebar}>
                        <div className={styles.v2SidebarSectionTitle}>
                            <SlidersHorizontal size={14} /> FILTROS DE PRECISÃO
                        </div>

                        {/* Category Filter */}
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

                        {/* Skin Type Filter */}
                        <div className={styles.filterGroup}>
                            <h3><Filter size={14} /> Tipo de Pele</h3>
                            <div className={styles.filterList}>
                                {skinFilters.map(f => (
                                    <button
                                        key={f.id}
                                        className={activeSkin === f.id ? styles.filterItemActive : styles.filterItem}
                                        onClick={() => setActiveSkin(f.id)}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Benefit Filter */}
                        <div className={styles.filterGroup}>
                            <h3><Sparkles size={14} /> Benefício & Tratamento</h3>
                            <div className={styles.filterList}>
                                {benefitFilters.map(f => (
                                    <button
                                        key={f.id}
                                        className={activeBenefit === f.id ? styles.filterItemActive : styles.filterItem}
                                        onClick={() => setActiveBenefit(f.id)}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Price Filter */}
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

                        {/* Quiz Sidebar Banner */}
                        <div className={styles.quizSidebarCard}>
                            <Sparkles size={22} color="#00529B" style={{ marginBottom: '10px' }} />
                            <h4>Dúvida na escolha?</h4>
                            <p>Descubra em 1 minuto o produto idela para as necessidades da sua pele.</p>
                            <Link href="/quizz" className={styles.quizBtnSidebar}>
                                FAZER QUIZ DE PELE
                            </Link>
                        </div>
                    </aside>

                    {/* MAIN CONTENT GRID */}
                    <div className={styles.mainContent}>
                        {/* Search and Sort Toolbar */}
                        <div className={styles.v2Toolbar}>
                            <div className={styles.searchBarContainer}>
                                <Search size={18} className={styles.searchIcon} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome ou ativo (ex: Açafrão, Argila...)"
                                    className={styles.searchBar}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button className={styles.clearSearch} onClick={() => setSearchTerm("")}>
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Sort Selector */}
                            <div className={styles.v2SortContainer}>
                                <ArrowUpDown size={15} className={styles.sortIcon} />
                                <select 
                                    className={styles.v2SortSelect}
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    {sortOptions.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Mobile Drawer Trigger */}
                            <button className={styles.drawerTrigger} onClick={() => setIsDrawerOpen(true)}>
                                <SlidersHorizontal size={18} />
                                <span>FILTROS</span>
                            </button>
                        </div>

                        {/* Active Filter Chips Bar */}
                        {hasActiveFilters && (
                            <div className={styles.v2ActiveFiltersBar}>
                                <span className={styles.v2ActiveFiltersLabel}>Filtros ativos:</span>
                                
                                {activeCategory !== "all" && (
                                    <span className={styles.v2FilterChip}>
                                        {categories.find(c => c.id === activeCategory)?.name}
                                        <X size={12} onClick={() => setActiveCategory("all")} />
                                    </span>
                                )}
                                {activeSkin !== "all" && (
                                    <span className={styles.v2FilterChip}>
                                        {skinFilters.find(f => f.id === activeSkin)?.name}
                                        <X size={12} onClick={() => setActiveSkin("all")} />
                                    </span>
                                )}
                                {activeBenefit !== "all" && (
                                    <span className={styles.v2FilterChip}>
                                        {benefitFilters.find(f => f.id === activeBenefit)?.name}
                                        <X size={12} onClick={() => setActiveBenefit("all")} />
                                    </span>
                                )}
                                {maxPrice < 500 && (
                                    <span className={styles.v2FilterChip}>
                                        Até R$ {maxPrice}
                                        <X size={12} onClick={() => setMaxPrice(500)} />
                                    </span>
                                )}
                                {searchTerm && (
                                    <span className={styles.v2FilterChip}>
                                        "{searchTerm}"
                                        <X size={12} onClick={() => setSearchTerm("")} />
                                    </span>
                                )}

                                <button className={styles.v2ClearAllBtn} onClick={resetFilters}>
                                    <RefreshCw size={12} /> Limpar Filtros
                                </button>
                            </div>
                        )}

                        {/* Results Count Header */}
                        <div className={styles.gridHeader}>
                            <h2 className={styles.v2GridTitle}>
                                Catalogação Clean ({filteredProducts.length})
                            </h2>
                            <span className={styles.resultsCount}>
                                Mostrando {filteredProducts.length} de {allProducts.length} produtos
                            </span>
                        </div>

                        {/* Products Loading / Empty / Grid State */}
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                                <div className="loader"></div>
                                <p style={{ marginTop: '20px', color: '#64748B', fontSize: '0.9rem' }}>
                                    Carregando catálogo de produtos...
                                </p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className={styles.v2EmptyState}>
                                <h3>Nenhum produto encontrado</h3>
                                <p>Tente ajustar os filtros de tipo de pele ou faixa de preço para ver mais produtos.</p>
                                <button className="btn-primary" onClick={resetFilters} style={{ marginTop: '16px' }}>
                                    LIMPAR TODOS OS FILTROS
                                </button>
                            </div>
                        ) : (
                            <div className={styles.productGrid}>
                                {filteredProducts.map((product: any) => (
                                    <ProductCard key={product.id} product={product} showMarketplace={false} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Filter Drawer Overlay for Mobile */}
            {isDrawerOpen && (
                <div className={styles.drawerOverlay} onClick={() => setIsDrawerOpen(false)}>
                    <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.drawerHeader}>
                            <h3>FILTRAR POR PRECISÃO</h3>
                            <button className={styles.closeDrawer} onClick={() => setIsDrawerOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className={styles.drawerBody}>
                            <div className={styles.filterGroup}>
                                <h3><LayoutGrid size={14} /> Categorias</h3>
                                <div className={styles.filterList}>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            className={activeCategory === cat.id ? styles.filterItemActive : styles.filterItem}
                                            onClick={() => { setActiveCategory(cat.id); setIsDrawerOpen(false); }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.filterGroup}>
                                <h3><Filter size={14} /> Tipo de Pele</h3>
                                <div className={styles.filterList}>
                                    {skinFilters.map(f => (
                                        <button
                                            key={f.id}
                                            className={activeSkin === f.id ? styles.filterItemActive : styles.filterItem}
                                            onClick={() => { setActiveSkin(f.id); setIsDrawerOpen(false); }}
                                        >
                                            {f.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.filterGroup}>
                                <h3><Sparkles size={14} /> Benefício & Tratamento</h3>
                                <div className={styles.filterList}>
                                    {benefitFilters.map(f => (
                                        <button
                                            key={f.id}
                                            className={activeBenefit === f.id ? styles.filterItemActive : styles.filterItem}
                                            onClick={() => { setActiveBenefit(f.id); setIsDrawerOpen(false); }}
                                        >
                                            {f.name}
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
                        </div>

                        <div className={styles.drawerFooter}>
                            <button className={styles.applyBtn} onClick={() => setIsDrawerOpen(false)}>
                                APLICAR FILTROS ({filteredProducts.length})
                            </button>
                            <button 
                                className={styles.resetBtn} 
                                onClick={() => { 
                                    resetFilters();
                                    setIsDrawerOpen(false); 
                                }}
                            >
                                LIMPAR TUDO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

