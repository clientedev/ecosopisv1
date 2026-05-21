"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Sparkles, ShoppingCart, User, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import styles from "./MobileBottomNav.module.css";

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { cartCount } = useCart();
    const { user } = useAuth();

    // All hooks must be declared before any conditional returns (Rules of Hooks)
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch all products when search is opened
    useEffect(() => {
        if (isSearchOpen) {
            const fetchProducts = async () => {
                setLoading(true);
                try {
                    const res = await fetch("/api/products");
                    if (res.ok) {
                        const data = await res.json();
                        setAllProducts(Array.isArray(data) ? data : []);
                    }
                } catch (error) {
                    console.error("Error fetching products:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchProducts();
            
            // Auto focus input
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 300);

            // Prevent body scroll when search is open
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        
        return () => {
            document.body.style.overflow = "";
        };
    }, [isSearchOpen]);

    // Local fuzzy/text-inclusion search filter
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        
        const query = searchQuery.toLowerCase();
        const filtered = allProducts.filter((p: any) => {
            const nameMatch = p.name?.toLowerCase().includes(query);
            const descMatch = p.description?.toLowerCase().includes(query);
            const categoryMatch = p.category?.toLowerCase().includes(query);
            const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags || "[]");
            const tagsMatch = tags.some((tag: string) => tag.toLowerCase().includes(query));
            
            return nameMatch || descMatch || categoryMatch || tagsMatch;
        });
        
        setSearchResults(filtered);
    }, [searchQuery, allProducts]);

    const handleSuggestionClick = (tag: string) => {
        setSearchQuery(tag);
        searchInputRef.current?.focus();
    };

    const getImageUrl = (url?: string) => {
        if (!url) return "/logo_nova_transparent.png";
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

    // Hide bottom navigation in the cart/checkout flow to avoid overlapping checkout buttons
    if (pathname.startsWith("/carrinho")) {
        return null;
    }

    return (
        <>
            <div className={styles.bottomNav}>
                <Link 
                    href="/" 
                    className={`${styles.navItem} ${pathname === "/" ? styles.active : ""}`}
                >
                    <Home size={22} />
                    <span>Início</span>
                </Link>

                <button 
                    onClick={() => setIsSearchOpen(true)}
                    className={`${styles.navItem} ${isSearchOpen ? styles.active : ""}`}
                >
                    <Search size={22} />
                    <span>Buscar</span>
                </button>

                <Link 
                    href="/lia" 
                    className={`${styles.navItem} ${styles.liaItem} ${pathname === "/lia" ? styles.active : ""}`}
                >
                    <div className={styles.liaIconWrapper}>
                        <Sparkles size={22} />
                    </div>
                    <span>Lia AI</span>
                </Link>

                <Link 
                    href="/carrinho" 
                    className={`${styles.navItem} ${pathname === "/carrinho" ? styles.active : ""}`}
                >
                    <div className={styles.cartIconWrapper}>
                        <ShoppingCart size={22} />
                        {cartCount > 0 && (
                            <span className={styles.cartBadge}>{cartCount}</span>
                        )}
                    </div>
                    <span>Carrinho</span>
                </Link>

                <Link 
                    href={user ? "/perfil" : "/conta"} 
                    className={`${styles.navItem} ${pathname === "/perfil" || pathname === "/conta" ? styles.active : ""}`}
                >
                    <User size={22} />
                    <span>{user ? "Conta" : "Entrar"}</span>
                </Link>
            </div>

            {/* Premium Fullscreen Search Overlay */}
            {isSearchOpen && (
                <div className={styles.searchOverlay}>
                    <div className={styles.searchHeader}>
                        <div className={styles.searchInputWrapper}>
                            <Search size={20} className={styles.searchModalIcon} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="O que você está procurando?"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchField}
                            />
                            {searchQuery && (
                                <button 
                                    className={styles.clearBtn} 
                                    onClick={() => setSearchQuery("")}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button 
                            className={styles.closeBtn} 
                            onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery("");
                            }}
                        >
                            Fechar
                        </button>
                    </div>

                    <div className={styles.searchBody}>
                        {!searchQuery && (
                            <div className={styles.suggestionsContainer}>
                                <h3>Sugestões de Busca</h3>
                                <div className={styles.suggestionsGrid}>
                                    {["Açafrão", "Clareamento", "Foliculite", "Rosa Mosqueta", "Kit", "Sabonete", "Argila Verde"].map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => handleSuggestionClick(tag)}
                                            className={styles.suggestionTag}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className={styles.searchLoading}>
                                <div className={styles.spinner}></div>
                                <p>Carregando produtos...</p>
                            </div>
                        )}

                        {searchQuery && !loading && (
                            <div className={styles.resultsContainer}>
                                <div className={styles.resultsHeader}>
                                    <span>{searchResults.length} {searchResults.length === 1 ? "produto encontrado" : "produtos encontrados"}</span>
                                </div>

                                {searchResults.length === 0 ? (
                                    <div className={styles.noResults}>
                                        <p>Nenhum produto encontrado para &quot;<strong>{searchQuery}</strong>&quot;.</p>
                                        <p className={styles.noResultsTip}>Tente buscar por termos mais genéricos como &quot;sabonete&quot; ou &quot;óleo&quot;.</p>
                                    </div>
                                ) : (
                                    <div className={styles.resultsList}>
                                        {searchResults.map((p) => (
                                            <Link
                                                key={p.id}
                                                href={`/produtos/${p.slug}`}
                                                className={styles.productResultCard}
                                                onClick={() => {
                                                    setIsSearchOpen(false);
                                                    setSearchQuery("");
                                                }}
                                            >
                                                <div className={styles.resultImageWrapper}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img 
                                                        src={getImageUrl(p.image_url)} 
                                                        alt={p.name}
                                                        className={styles.resultImage}
                                                    />
                                                </div>
                                                <div className={styles.resultInfo}>
                                                    <h4>{p.name}</h4>
                                                    <p className={styles.resultCategory}>{p.category}</p>
                                                    {p.price && (
                                                        <span className={styles.resultPrice}>
                                                            R$ {p.price.toFixed(2).replace(".", ",")}
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
