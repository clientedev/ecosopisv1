"use client";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useCart } from "@/context/CartContext";
import styles from "./page.module.css";
import { ShoppingBag, ChevronRight, CheckCircle2, TrendingDown, Info, ShoppingCart, Plus, Minus, X, Sparkles, QrCode } from "lucide-react";
import { useToast } from "@/components/Toast/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStaticProductData } from "@/lib/productData";
import { fuzzySearch } from "@/utils/search";

interface LiaMessage {
    role: 'user' | 'lia';
    text: string;
}

export default function WholesalePage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [bundle, setBundle] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProductForModal, setSelectedProductForModal] = useState<any>(null);
    const { addWholesaleBundleToCart } = useCart();
    const { showToast } = useToast();
    const [isLiaOpen, setIsLiaOpen] = useState(false);
    const [liaMessages, setLiaMessages] = useState<LiaMessage[]>([
        { role: 'lia', text: 'Oi! Sou a Lia. Como posso ajudar com sua compra no atacado?' }
    ]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        if (isLiaOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [liaMessages, isLiaOpen]);

    const handleLiaQuestion = (questionCode: number) => {
        let userText = "";
        let liaResponse = "";
        
        switch(questionCode) {
            case 1:
                userText = "Como funciona o desconto de 30%?";
                liaResponse = "É simples! Basta adicionar 10 ou mais itens no carrinho a partir desta página, e o desconto de 30% (+ preço de fábrica) será aplicado automaticamente em todos os itens. 🌱";
                break;
            case 2:
                userText = "Qual é o pedido mínimo?";
                liaResponse = "Para obter o desconto de atacadista, você precisa selecionar pelo menos 10 itens no total. Eles podem ser todos do mesmo produto ou variados!";
                break;
            case 3:
                userText = "O frete é grátis?";
                liaResponse = "Como oferecemos o preço de fábrica no atacado, o frete é calculado de acordo com o peso da caixa no momento do checkout, mas não temos frete grátis garantido. No entanto, sua economia de 30% geralmente compensa muito mais!";
                break;
        }

        setLiaMessages(prev => [...prev, { role: 'user', text: userText }]);
        setTimeout(() => {
            setLiaMessages(prev => [...prev, { role: 'lia', text: liaResponse }]);
        }, 600);
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch("/api/products", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    const wholesale = data.filter((p: any) => p.is_active && p.is_wholesale).map((p: any) => {
                        const staticData = getStaticProductData(p.slug);
                        if (staticData) {
                            return {
                                ...p,
                                ingredients: staticData.ativos,
                                benefits: staticData.beneficios,
                                details: {
                                    ...(p.details || {}),
                                    ingredientes: staticData.ativos,
                                    beneficios: staticData.beneficios,
                                    modo_de_uso: staticData.modo_de_uso,
                                }
                            };
                        }
                        return p;
                    });
                    setProducts(wholesale);
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
    
    const filteredProducts = searchTerm 
        ? fuzzySearch(products, searchTerm, ["name", "description"])
        : products;
    
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
                {/* GLOBAL OVERRIDE FOR STICKY */}
                <style dangerouslySetInnerHTML={{ __html: `
                    html, body {
                        overflow-x: visible !important;
                        overflow: visible !important;
                    }
                    main {
                        overflow: visible !important;
                    }
                ` }} />
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
                                                <button 
                                                    className={styles.detailsTrigger} 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedProductForModal(p);
                                                    }}
                                                    title="Ver Ficha Técnica"
                                                >
                                                    <Info size={20} />
                                                </button>
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
                    <aside className={styles.summaryDesktop} style={{ position: 'sticky', top: '160px', alignSelf: 'flex-start', height: 'fit-content' }}>
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

            {/* Floating Lia Help - Premium UX Edition */}
            <div className={styles.floatingLiaContainer}>
                <button 
                    className={styles.floatingLia}
                    onClick={() => setIsLiaOpen(!isLiaOpen)}
                    aria-label="Ajuda da Lia"
                >
                    <div className={styles.liaTooltip}>
                        Alguma dúvida?
                    </div>
                    <div className={styles.liaIconWrapper}>
                        <img src="/lia.jpg" alt="Lia AI" className={styles.liaFace} />
                        <Sparkles size={14} className={styles.liaSparkle} />
                    </div>
                </button>

                {isLiaOpen && (
                    <div className={styles.liaPopover}>
                        <div className={styles.popoverHeader}>
                            <div className={styles.popoverTitleIcon}>
                                <Sparkles size={18} color="#f59e0b" />
                                <h3>Dicas da Lia</h3>
                            </div>
                            <button onClick={() => setIsLiaOpen(false)} className={styles.closePopover}>
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className={styles.popoverBody} style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '350px' }}>
                            <div className={styles.chatArea} style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#f8fafc' }}>
                                {liaMessages.map((msg, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{
                                            background: msg.role === 'user' ? '#10b981' : '#ffffff',
                                            color: msg.role === 'user' ? 'white' : '#1e293b',
                                            padding: '10px 14px',
                                            borderRadius: '15px',
                                            borderBottomRightRadius: msg.role === 'user' ? '2px' : '15px',
                                            borderBottomLeftRadius: msg.role === 'lia' ? '2px' : '15px',
                                            maxWidth: '85%',
                                            fontSize: '0.85rem',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                            border: msg.role === 'lia' ? '1px solid #e2e8f0' : 'none'
                                        }}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            
                            <div className={styles.presetQuestions} style={{ padding: '10px', background: 'white', borderTop: '1px solid #e2e8f0' }}>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>Perguntas frequentes:</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <button onClick={() => handleLiaQuestion(1)} className={styles.presetQBtn}>
                                        Como funciona o desconto de 30%?
                                    </button>
                                    <button onClick={() => handleLiaQuestion(2)} className={styles.presetQBtn}>
                                        Qual é o pedido mínimo?
                                    </button>
                                    <button onClick={() => handleLiaQuestion(3)} className={styles.presetQBtn}>
                                        O frete é grátis no atacado?
                                    </button>
                                </div>
                            </div>
                            </div>
                            
                            <hr className={styles.popoverDivider} />
                            
                            <div className={styles.popoverFooter}>
                                <p>Dúvidas técnicas? <Link href="/lia">Conversar com a IA completa</Link></p>
                            </div>
                        </div>
                )}
            </div>

            {/* Product Details Modal */}
            {selectedProductForModal && (
                <div className={styles.modalOverlay} onClick={() => setSelectedProductForModal(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeModal} onClick={() => setSelectedProductForModal(null)}>
                            <X size={24} />
                        </button>
                        
                        <div className={styles.modalLayout}>
                            <div className={styles.modalImageSection}>
                                <img 
                                    src={selectedProductForModal.image_url || "/static/attached_assets/placeholder.png"} 
                                    alt={selectedProductForModal.name} 
                                />
                                <div className={styles.modalPriceBadge}>
                                    R$ {selectedProductForModal.price.toFixed(2)}
                                </div>
                            </div>
                            
                            <div className={styles.modalInfoSection}>
                                <h2>{selectedProductForModal.name}</h2>
                                <p className={styles.modalDescription}>{selectedProductForModal.description}</p>
                                
                                <div className={styles.technicalSpecs}>
                                    {/* Combine base product fields and detail-specific fields */}
                                    {(selectedProductForModal.details?.modo_de_uso || selectedProductForModal.details?.modo_uso) && (
                                        <div className={styles.specItem}>
                                            <h3>🌿 Modo de Uso</h3>
                                            <p>{selectedProductForModal.details.modo_de_uso || selectedProductForModal.details.modo_uso}</p>
                                        </div>
                                    )}

                                    {(selectedProductForModal.details?.ingredientes || selectedProductForModal.ingredients) && (
                                        <div className={styles.specItem}>
                                            <h3>🔬 Ativos / Ingredientes</h3>
                                            <p>{selectedProductForModal.details?.ingredientes || selectedProductForModal.ingredients}</p>
                                        </div>
                                    )}

                                    {selectedProductForModal.benefits && (
                                        <div className={styles.specItem}>
                                            <h3>✨ Benefícios</h3>
                                            <p>{selectedProductForModal.benefits}</p>
                                        </div>
                                    )}

                                    {selectedProductForModal.details?.curiosidades && (
                                        <div className={styles.specItem}>
                                            <h3>💎 Curiosidades</h3>
                                            <p>{selectedProductForModal.details.curiosidades}</p>
                                        </div>
                                    )}

                                    {selectedProductForModal.details?.contraindicacoes && (
                                        <div className={styles.specItem}>
                                            <h3>⚠️ Contraindicações</h3>
                                            <p>{selectedProductForModal.details.contraindicacoes}</p>
                                        </div>
                                    )}

                                    {selectedProductForModal.details?.cuidados && (
                                        <div className={styles.specItem}>
                                            <h3>🛡️ Cuidados</h3>
                                            <p>{selectedProductForModal.details.cuidados}</p>
                                        </div>
                                    )}

                                    {/* Fallback if absolutely no tech specs are found */}
                                    {!selectedProductForModal.benefits && 
                                     !selectedProductForModal.ingredients && 
                                     !selectedProductForModal.details && (
                                        <div className={styles.noSpecs}>
                                            <p>Informações técnicas detalhadas em breve para este produto.</p>
                                        </div>
                                    )}
                                </div>

                                <Link 
                                    href={`/produto/${selectedProductForModal.slug}/info`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.fullSpecsBtn}
                                >
                                    <QrCode size={20} /> Ver Ficha Técnica Completa
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </main>
    );
}
