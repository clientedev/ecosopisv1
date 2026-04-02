"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useCart } from "@/context/CartContext";
import styles from "./page.module.css";
import { ShoppingBag, ChevronRight, CheckCircle2, TrendingDown, Info, ShoppingCart, Plus, Minus, X } from "lucide-react";
import { useToast } from "@/components/Toast/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WholesalePage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [bundle, setBundle] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const { addWholesaleBundleToCart } = useCart();
    const { showToast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch("/api/products");
                if (res.ok) {
                    const data = await res.json();
                    setProducts(data.filter((p: any) => p.is_active));
                }
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const toggleProduct = (product: any) => {
        setBundle(prev => {
            const exists = prev.find(p => p.id === product.id);
            if (exists) {
                return prev.filter(p => p.id !== product.id);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setBundle(prev => prev.map(p => {
            if (p.id === productId) {
                return { ...p, quantity: Math.max(1, p.quantity + delta) };
            }
            return p;
        }));
    };

    const handleConfirmBundle = () => {
        try {
            const totalItems = bundle.reduce((acc, p) => acc + p.quantity, 0);
            if (totalItems < 10) {
                showToast("Você precisa de pelo menos 10 itens para o Atacado!", "error");
                return;
            }
            
            addWholesaleBundleToCart(bundle);
            showToast("Kit adicionado ao carrinho com sucesso!", "success");
            
            // Redirect to the correct localized route
            router.push("/carrinho");
        } catch (err) {
            console.error("Error confirming bundle:", err);
            showToast("Houve um erro ao processar o kit. Tente novamente.", "error");
        }
    };

    const totalQuantity = bundle.reduce((acc, p) => acc + p.quantity, 0);
    const progress = Math.min((totalQuantity / 10) * 100, 100);
    const isUnlocked = totalQuantity >= 10;
    
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const rawTotal = bundle.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const discountedTotal = rawTotal * 0.7;
    const savings = rawTotal * 0.3;

    return (
        <main className={styles.wholesalePage}>
            <Header />
            
            {/* Hero Section */}
            <div className={styles.hero}>
                <div className="container">
                    <div className={styles.heroContent}>
                        <span className={styles.badge}>DIFERENCIAL ECOSOPIS</span>
                        <h1 style={{ color: '#ffffff' }}>Atacado Nature-Premium</h1>
                        <p>Monte seu estoque com <strong>30% de DESCONTO REAL</strong>. Preço de fábrica para revenda ou uso pessoal consciente.</p>
                    </div>
                </div>
            </div>

            {/* Sticky Progress Bar */}
            <div className={`${styles.progressSticky} ${isUnlocked ? styles.unlocked : ''}`}>
                <div className="container">
                    <div className={styles.progressFlex}>
                        <div className={styles.progressInfo}>
                            <span className={styles.progressLabel}>
                                {isUnlocked ? (
                                    <><CheckCircle2 size={20} color="#f59e0b" /> DESCONTO DESBLOQUEADO!</>
                                ) : (
                                    `Faltam ${10 - totalQuantity} itens para o Atacado`
                                )}
                            </span>
                            <span className={styles.itemCount}>{totalQuantity}/10 ITENS</span>
                        </div>
                        <div className={styles.barContainer}>
                            <div className={styles.barFill} style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: '40px', paddingBottom: '120px' }}>
                <div className={styles.searchBarWrapper}>
                    <div className={styles.searchInputContainer}>
                        <Link href="/produtos" className={styles.backLink}>← Voltar para Loja</Link>
                        <div className={styles.searchField}>
                            <ShoppingCart size={20} />
                            <input 
                                type="text" 
                                placeholder="Procurar produto no catálogo..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.layout}>
                    <div className={styles.grid}>
                        <div className={styles.gridHeaderFlex}>
                            <h2 className={styles.gridTitle}>Catálogo de Atacado</h2>
                            <span className={styles.resultsCount}>{filteredProducts.length} produtos encontrados</span>
                        </div>
                        {loading ? (
                            <div className={styles.loading}>Carregando catálogo...</div>
                        ) : (
                            <div className={styles.productGrid}>
                                {filteredProducts.map(p => {
                                    const inBundle = bundle.find(item => item.id === p.id);
                                    return (
                                        <div key={p.id} className={`${styles.productCard} ${inBundle ? styles.selected : ''}`}>
                                            <div className={styles.imgWrapper}>
                                                <img src={p.image_url || "/static/attached_assets/placeholder.png"} alt={p.name} />
                                                {inBundle && (
                                                    <div className={styles.selectedOverlay}>
                                                        <CheckCircle2 size={32} />
                                                        <span>{inBundle.quantity} no Kit</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={styles.cardInfo}>
                                                <div className={styles.nameAndOldPrice}>
                                                    <h3>{p.name}</h3>
                                                    <span className={styles.oldPrice}>R$ {p.price.toFixed(2)}</span>
                                                </div>
                                                <div className={styles.priceRow}>
                                                    <span className={styles.newPrice}>R$ {(p.price * 0.7).toFixed(2)}</span>
                                                    <span className={styles.unitLabel}>/ unidade</span>
                                                </div>
                                                
                                                <div className={styles.actionRow}>
                                                    <div className={styles.qtyControlMain}>
                                                        <button onClick={() => updateQuantity(p.id, -1)} disabled={!inBundle}>
                                                            <Minus size={18}/>
                                                        </button>
                                                        <span className={!inBundle ? styles.qtyDisabled : ''}>
                                                            {inBundle ? inBundle.quantity : 0}
                                                        </span>
                                                        <button onClick={() => {
                                                            if (!inBundle) toggleProduct(p);
                                                            else updateQuantity(p.id, 1);
                                                        }}>
                                                            <Plus size={18}/>
                                                        </button>
                                                    </div>
                                                    
                                                    {!inBundle ? (
                                                        <button className={styles.addBtnLarge} onClick={() => toggleProduct(p)}>
                                                            ADICIONAR
                                                        </button>
                                                    ) : (
                                                        <button className={styles.removeBtnLarge} onClick={() => toggleProduct(p)}>
                                                            REMOVER
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Summary Sidebar (Desktop Only) */}
                    <aside className={styles.summaryDesktop}>
                        <div className={styles.summaryCard}>
                            <h3>Resumo do Kit</h3>
                            <div className={styles.summaryRow}>
                                <span>Itens Selecionados</span>
                                <span>{totalQuantity}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>R$ {rawTotal.toFixed(2)}</span>
                            </div>
                            <div className={`${styles.summaryRow} ${styles.saving}`}>
                                <span>Economia (30%)</span>
                                <span>- R$ {savings.toFixed(2)}</span>
                            </div>
                            <div className={styles.divider}></div>
                            <div className={styles.totalRow}>
                                <span>TOTAL ATACADO</span>
                                <span>R$ {discountedTotal.toFixed(2)}</span>
                            </div>
                            
                            <button 
                                className={styles.finalizeBtn} 
                                disabled={!isUnlocked}
                                onClick={handleConfirmBundle}
                            >
                                {isUnlocked ? 'ADICIONAR AO CARRINHO' : `ADICIONE MAIS ${10 - totalQuantity} ITENS`}
                            </button>
                            
                            <p className={styles.hint}>
                                <Info size={14} /> Frete calculado no checkout
                            </p>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Mobile Bottom Bar */}
            <div className={styles.mobileBottom}>
                <div className={styles.mobileInfo}>
                    <div>
                        <span className={styles.mLabel}>TOTAL ATACADO</span>
                        <span className={styles.mValue}>R$ {discountedTotal.toFixed(2)}</span>
                    </div>
                    <span className={styles.mSavings}>Você economiza R$ {savings.toFixed(2)}</span>
                </div>
                <button 
                    className={styles.mBtn} 
                    disabled={!isUnlocked}
                    onClick={handleConfirmBundle}
                >
                    <ShoppingCart size={18} /> {isUnlocked ? 'CONCLUIR' : `${totalQuantity}/10`}
                </button>
            </div>

            <Footer />
        </main>
    );
}
