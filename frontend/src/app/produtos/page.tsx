"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";
import { 
    Sparkles, Filter, LayoutGrid, DollarSign, Search, 
    SlidersHorizontal, X, ShieldCheck, Check, 
    Star, RefreshCw, ArrowUpDown, Tag, ShoppingBag 
} from "lucide-react";
import Link from "next/link";
import { fuzzySearch } from "@/utils/search";

const categories = [
    { id: "all", name: "Todos os Produtos" },
    { id: "sabonete", name: "Sabonetes Naturais" },
    { id: "creme", name: "Cremes e Loções" },
    { id: "oleo", name: "Óleos de Tratamento" },
    { id: "oe", name: "Óleos Essenciais" },
    { id: "kit", name: "Kits e Presentes" }
];

const skinFilters = [
    { id: "all", name: "Todos os Tipos de Pele" },
    { id: "skin:oily", name: "Pele Oleosa / Acneica" },
    { id: "skin:dry", name: "Pele Seca" },
    { id: "skin:normal", name: "Pele Normal / Mista" },
    { id: "sensitivity", name: "Pele Sensível / Foliculite" }
];

const priceRangeFilters = [
    { id: "all", name: "Todos os Preços", min: 0, max: 999 },
    { id: "under40", name: "Até R$ 40", min: 0, max: 40 },
    { id: "40to80", name: "R$ 40 - R$ 80", min: 40, max: 80 },
    { id: "above80", name: "Acima de R$ 80", min: 80, max: 999 }
];

const availabilityFilters = [
    { id: "all", name: "Todos os Produtos" },
    { id: "on_sale", name: "🔥 Em Promoção" },
    { id: "in_stock", name: "✓ Em Estoque" }
];

const sortOptions = [
    { id: "featured", name: "Destaques / Populares" },
    { id: "price_asc", name: "Menor Preço" },
    { id: "price_desc", name: "Maior Preço" },
    { id: "name_asc", name: "Nome (A-Z)" }
];

export default function ProductsPage() {
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filter & search state
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeSkin, setActiveSkin] = useState("all");
    const [activePriceRange, setActivePriceRange] = useState("all");
    const [activeAvailability, setActiveAvailability] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("featured");
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

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

            // Price range check
            const currentPrice = p.is_on_sale && p.sale_price ? p.sale_price : p.price || 0;
            const priceFilterObj = priceRangeFilters.find(f => f.id === activePriceRange);
            const priceMatch = priceFilterObj 
                ? (currentPrice >= priceFilterObj.min && currentPrice <= priceFilterObj.max)
                : true;

            // Availability check
            let availMatch = true;
            if (activeAvailability === "on_sale") {
                availMatch = !!(p.is_on_sale && p.sale_price);
            } else if (activeAvailability === "in_stock") {
                availMatch = (p.stock === undefined || p.stock > 0);
            }

            return categoryMatch && skinMatch && priceMatch && availMatch;
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
    }, [allProducts, activeCategory, activeSkin, activePriceRange, activeAvailability, searchTerm, sortBy]);

    const hasActiveFilters = activeCategory !== "all" || activeSkin !== "all" || activePriceRange !== "all" || activeAvailability !== "all" || searchTerm !== "";

    const resetFilters = () => {
        setActiveCategory("all");
        setActiveSkin("all");
        setActivePriceRange("all");
        setActiveAvailability("all");
        setSearchTerm("");
        setSortBy("featured");
    };

    return (
        <>
            <Header />

            {/* Clean Hero Section */}
            <section className={styles.cleanCatalogHero}>
                <div className={styles.heroInnerContainer}>
                    <h1 className={styles.heroTitle}>
                        {activeCategory === "all" ? "Nossos Produtos" : categories.find(c => c.id === activeCategory)?.name}
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Fórmulas botânicas puras elaboradas com extratos vegetais e óleos essenciais para o seu ritual diário de cuidados.
                    </p>

                    {/* Category Buttons Bar */}
                    <div className={styles.categoryPillsRow}>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={activeCategory === cat.id ? styles.catPillActive : styles.catPill}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <main className="container">
                <div className={styles.catalogMainWrapper}>
                    {/* Modern Interactive Filter Bar / Toolbar */}
                    <div className={styles.toolbarContainer}>
                        {/* Search Bar */}
                        <div className={styles.searchBox}>
                            <Search size={18} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Buscar por produto ou ativo..."
                                className={styles.searchInput}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button className={styles.clearSearchBtn} onClick={() => setSearchTerm("")}>
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Sort Selector */}
                        <div className={styles.sortWrapper}>
                            <ArrowUpDown size={15} className={styles.sortIcon} />
                            <select 
                                className={styles.sortSelect}
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Toggle Advanced Filters */}
                        <button 
                            className={`${styles.filterToggleBtn} ${isFilterPanelOpen ? styles.filterToggleActive : ''}`}
                            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                        >
                            <SlidersHorizontal size={18} />
                            <span>FILTROS</span>
                        </button>
                    </div>

                    {/* Expandable Modern Interactive Chips Filters */}
                    {isFilterPanelOpen && (
                        <div className={styles.interactiveFilterPanel}>
                            {/* Skin Types Chips */}
                            <div className={styles.filterChipGroup}>
                                <span className={styles.filterChipGroupTitle}>Tipo de Pele:</span>
                                <div className={styles.chipsContainer}>
                                    {skinFilters.map(skin => (
                                        <button
                                            key={skin.id}
                                            className={activeSkin === skin.id ? styles.chipActive : styles.chip}
                                            onClick={() => setActiveSkin(skin.id)}
                                        >
                                            {skin.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Price Ranges Chips */}
                            <div className={styles.filterChipGroup}>
                                <span className={styles.filterChipGroupTitle}>Faixa de Preço:</span>
                                <div className={styles.chipsContainer}>
                                    {priceRangeFilters.map(price => (
                                        <button
                                            key={price.id}
                                            className={activePriceRange === price.id ? styles.chipActive : styles.chip}
                                            onClick={() => setActivePriceRange(price.id)}
                                        >
                                            {price.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Availability Chips */}
                            <div className={styles.filterChipGroup}>
                                <span className={styles.filterChipGroupTitle}>Disponibilidade:</span>
                                <div className={styles.chipsContainer}>
                                    {availabilityFilters.map(avail => (
                                        <button
                                            key={avail.id}
                                            className={activeAvailability === avail.id ? styles.chipActive : styles.chip}
                                            onClick={() => setActiveAvailability(avail.id)}
                                        >
                                            {avail.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active Filter Badges Bar */}
                    {hasActiveFilters && (
                        <div className={styles.activeFilterChipsRow}>
                            <span className={styles.activeFiltersText}>Filtros aplicados:</span>
                            {activeCategory !== "all" && (
                                <span className={styles.activeChip}>
                                    {categories.find(c => c.id === activeCategory)?.name}
                                    <X size={12} onClick={() => setActiveCategory("all")} />
                                </span>
                            )}
                            {activeSkin !== "all" && (
                                <span className={styles.activeChip}>
                                    {skinFilters.find(f => f.id === activeSkin)?.name}
                                    <X size={12} onClick={() => setActiveSkin("all")} />
                                </span>
                            )}
                            {activePriceRange !== "all" && (
                                <span className={styles.activeChip}>
                                    {priceRangeFilters.find(f => f.id === activePriceRange)?.name}
                                    <X size={12} onClick={() => setActivePriceRange("all")} />
                                </span>
                            )}
                            {activeAvailability !== "all" && (
                                <span className={styles.activeChip}>
                                    {availabilityFilters.find(f => f.id === activeAvailability)?.name}
                                    <X size={12} onClick={() => setActiveAvailability("all")} />
                                </span>
                            )}
                            {searchTerm && (
                                <span className={styles.activeChip}>
                                    "{searchTerm}"
                                    <X size={12} onClick={() => setSearchTerm("")} />
                                </span>
                            )}

                            <button className={styles.resetAllBtn} onClick={resetFilters}>
                                <RefreshCw size={12} /> Limpar tudo
                            </button>
                        </div>
                    )}

                    {/* Grid Counter Header */}
                    <div className={styles.catalogHeaderRow}>
                        <h2 className={styles.catalogTitle}>Catálogo ({filteredProducts.length})</h2>
                        <span className={styles.countText}>
                            Exibindo {filteredProducts.length} de {allProducts.length} itens
                        </span>
                    </div>

                    {/* Products Grid */}
                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className="loader"></div>
                            <p>Carregando produtos botânicos...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className={styles.emptyResultsState}>
                            <ShoppingBag size={48} className={styles.emptyIcon} />
                            <h3>Nenhum produto encontrado</h3>
                            <p>Tente selecionar outros filtros para encontrar o que procura.</p>
                            <button className="btn-primary" onClick={resetFilters} style={{ marginTop: '16px' }}>
                                RESTAURAR TODOS OS FILTROS
                            </button>
                        </div>
                    ) : (
                        <div className={styles.spaciousProductGrid}>
                            {filteredProducts.map((product: any) => (
                                <ProductCard key={product.id} product={product} showMarketplace={false} />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </>
    );
}


