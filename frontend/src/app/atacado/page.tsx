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
        const totalItems = bundle.reduce((acc, p) => acc + p.quantity, 0);
        if (totalItems < 10) {
            showToast("Você precisa de pelo menos 10 itens para o Atacado!", "error");
            return;
        }
        addWholesaleBundleToCart(bundle);
        router.push("/cart");
    };

    const totalQuantity = bundle.reduce((acc, p) => acc + p.quantity, 0);
    const progress = Math.min((totalQuantity / 10) * 100, 100);
    const isUnlocked = totalQuantity >= 10;
    
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
                        <h1>Atacado Nature-Premium</h1>
                        <p>Monte seu estoque com <strong>30% de DESCONTO REAL</strong>. Ideal para revenda ou para quem não abre mão do cuidado diário consciente.</p>
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
                <div className={styles.layout}>
                    {/* Product Grid */}
                    <div className={styles.grid}>
                        <h2 className={styles.gridTitle}>Escolha seus Produtos</h2>
                        {loading ? (
                            <div className={styles.loading}>Carregando catálogo...</div>
                        ) : (
                            <div className={styles.productGrid}>
                                {products.map(p => {
                                    const inBundle = bundle.find(item => item.id === p.id);
                                    return (
                                        <div key={p.id} className={`${styles.productCard} ${inBundle ? styles.selected : ''}`}>
                                            <div className={styles.imgWrapper}>
                                                <img src={p.image_url || "/static/attached_assets/placeholder.png"} alt={p.name} />
                                                {inBundle && <div className={styles.selectedBadge}><CheckCircle2 /></div>}
                                            </div>
                                            <div className={styles.cardInfo}>
                                                <h3>{p.name}</h3>
                                                <div className={styles.priceRow}>
                                                    <span className={styles.oldPrice}>R$ {p.price.toFixed(2)}</span>
                                                    <span className={styles.newPrice}>R$ {(p.price * 0.7).toFixed(2)}</span>
                                                </div>
                                                
                                                {inBundle ? (
                                                    <div className={styles.qtyControl}>
                                                        <button onClick={() => updateQuantity(p.id, -1)}><Minus size={16}/></button>
                                                        <span>{inBundle.quantity}</span>
                                                        <button onClick={() => updateQuantity(p.id, 1)}><Plus size={16}/></button>
                                                        <button className={styles.removeBtn} onClick={() => toggleProduct(p)}><X size={14}/></button>
                                                    </div>
                                                ) : (
                                                    <button className={styles.addBtn} onClick={() => toggleProduct(p)}>
                                                        ADICIONAR AO KIT
                                                    </button>
                                                )}
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
