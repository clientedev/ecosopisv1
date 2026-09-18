"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";
import styles from "./page.module.css";
import Image from "next/image";
import { QrCode, Plus, Minus, ShoppingBag, Leaf, ChevronDown, Sparkles } from "lucide-react";
import { useToast } from "@/components/Toast/Toast";
import { useCart } from "@/context/CartContext";
import { getStaticProductData } from "@/lib/productData";

import ProductStoryCircles from "@/components/ProductStory/ProductStoryCircles";
import ProductStoryModal from "@/components/ProductStory/ProductStoryModal";

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [product, setProduct] = useState<any>(null);
    const [activeImage, setActiveImage] = useState("");
    const [selectedFaq, setSelectedFaq] = useState<any>(null);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewData, setReviewData] = useState({ rating: 5, comment: "", user_name: "" });
    const [submittingReview, setSubmittingReview] = useState(false);
    const [approvedReviews, setApprovedReviews] = useState<any[]>([]);
    const [reviewPage, setReviewPage] = useState(1);
    const reviewsPerPage = 4;
    const [buyingNow, setBuyingNow] = useState(false);
    const [paymentError, setPaymentError] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
    const [openAccordion, setOpenAccordion] = useState<number | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
    const [showStickyBar, setShowStickyBar] = useState(false);

    // Ref for the main buy button to trigger sticky bar
    const buyNowBtnRef = useRef<HTMLButtonElement>(null);

    const handleDecrement = () => {
        setQuantity(prev => Math.max(1, prev - 1));
    };

    const handleIncrement = () => {
        setQuantity(prev => Math.min(99, prev + 1));
    };

    const faqs = [
        { q: "Qual o prazo de entrega?", a: "O prazo médio de entrega é de 5 a 10 dias úteis, dependendo da sua região." },
        { q: "O produto é vegano?", a: "Sim! Todos os nossos produtos são 100% veganos e livres de crueldade animal." },
        { 
            q: "Como usar o produto?", 
            a: product?.details?.modo_de_uso || "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente." 
        }
    ];

    // IntersectionObserver for sticky bar (desktop only - mobile disabled per user request)
    useEffect(() => {
        const btn = buyNowBtnRef.current;
        if (!btn) return;

        const checkResize = () => {
            if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                setShowStickyBar(false);
            }
        };

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                    setShowStickyBar(false);
                } else {
                    setShowStickyBar(!entry.isIntersecting);
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(btn);
        window.addEventListener("resize", checkResize);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", checkResize);
        };
    }, [product]);

    // Oculta o balão flutuante da Lia quando a barra de compra fixa está ativa
    useEffect(() => {
        if (showStickyBar) {
            document.body.classList.add('has-sticky-buy-bar');
        } else {
            document.body.classList.remove('has-sticky-buy-bar');
        }
        return () => {
            document.body.classList.remove('has-sticky-buy-bar');
        };
    }, [showStickyBar]);

    useEffect(() => {
        // Normaliza campos que podem vir como string JSON do PostgreSQL/Railway
        const normalizeProduct = (p: any) => {
            const toArray = (v: any): any[] => {
                if (Array.isArray(v)) return v;
                if (typeof v === 'string') { try { const r = JSON.parse(v); return Array.isArray(r) ? r : []; } catch { return []; } }
                return [];
            };
            return { ...p, images: toArray(p.images), tags: toArray(p.tags), story_videos: toArray(p.story_videos) };
        };

        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/products/${params.slug}`, { cache: "no-store" });
                if (res.ok) {
                    const raw = await res.json();
                    const data = normalizeProduct(raw);
                    const staticData = getStaticProductData(data.slug);
                    if (staticData) {
                        data.ingredients = staticData.ativos;
                        data.benefits = staticData.beneficios;
                        data.frase_decisao = staticData.frase_decisao;
                        if (data.details) {
                            data.details.modo_de_uso = staticData.modo_de_uso;
                            data.details.ingredientes = staticData.ativos;
                            data.details.beneficios = staticData.beneficios;
                        } else {
                            data.details = { modo_de_uso: staticData.modo_de_uso, ingredientes: staticData.ativos, beneficios: staticData.beneficios };
                        }
                    }
                    setProduct(data);
                    setActiveImage(data.image_url || (data.images && data.images[0]) || "");
                    logVisit(`/produtos/${params.slug}`);
                    fetchApprovedReviews(data.id);
                }
            } catch (error) {
                console.error("Error fetching product:", error);
            }
        };

        const fetchApprovedReviews = async (productId: number) => {
            try {
                const res = await fetch(`/api/reviews/approved?product_id=${productId}`, { cache: "no-store" });
                if (!res.ok) return;
                const filtered = await res.json();
                const normalized = (Array.isArray(filtered) ? filtered : []).map((rev: any) => {
                    let imgs: string[] = [];
                    if (Array.isArray(rev.images)) {
                        imgs = rev.images;
                    } else if (typeof rev.images === "string") {
                        try {
                            const parsed = JSON.parse(rev.images);
                            imgs = Array.isArray(parsed) ? parsed : (parsed ? [String(parsed)] : []);
                        } catch {
                            imgs = rev.images.trim() ? [rev.images.trim()] : [];
                        }
                    }
                    return {
                        ...rev,
                        images: imgs.filter((img: any) => typeof img === "string" && img.trim().length > 0)
                    };
                });
                setApprovedReviews(normalized);
            } catch (error) {
                console.error("Error fetching approved reviews:", error);
            }
        };

        const logVisit = async (path: string) => {
            try {
                await fetch('/api/metrics/log/visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
            } catch (err) {
                console.error("Error logging visit", err);
            }
        };

        fetchProduct();
    }, [params.slug]);

    // Fetch related products
    useEffect(() => {
        const fetchRelated = async () => {
            const toArray = (v: any): any[] => { if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const r = JSON.parse(v); return Array.isArray(r) ? r : []; } catch { return []; } } return []; };
            try {
                const res = await fetch('/api/products', { cache: "no-store" });
                if (res.ok) {
                    const raw = await res.json();
                    const all = Array.isArray(raw) ? raw.map((p: any) => ({ ...p, images: toArray(p.images), tags: toArray(p.tags), story_videos: toArray(p.story_videos) })) : [];
                    const filtered = all.filter((p: any) => p.slug !== params.slug && p.is_active !== false).slice(0, 8);
                    setRelatedProducts(filtered);
                }
            } catch (e) {
                console.error("Error fetching related products:", e);
            }
        };
        if (params.slug) fetchRelated();
    }, [params.slug]);

    const logClick = async (type: string) => {
        if (!product) return;
        try {
            await fetch('/api/metrics/log/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: product.id,
                    click_type: type
                })
            });
        } catch (err) {
            console.error("Error logging click", err);
        }
    };

    const { showToast } = useToast();
    const { addToCart } = useCart();

    if (!product) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'var(--font-karla)' }}>
            <p>Carregando produto...</p>
        </div>
    );

    const allImages = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image_url].filter(Boolean);

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

    const handleAddToCart = () => {
        if (!product) {
            showToast("Erro ao carregar produto", 'error');
            return;
        }
        
        const isOnSale = !!(product.is_on_sale && product.sale_price && product.sale_price > 0);
        const cartItem = {
            id: product.id,
            name: product.name,
            price: isOnSale ? product.sale_price : product.price,
            image_url: product.image_url
        };
        
        addToCart(cartItem, quantity);
        logClick("site");
    };

    const handleBuyNow = () => {
        if (!product) {
            showToast("Erro ao carregar produto", "error");
            return;
        }

        setBuyingNow(true);
        setPaymentError("");

        const isOnSale = !!(product.is_on_sale && product.sale_price && product.sale_price > 0);
        const cartItem = {
            id: product.id,
            name: product.name,
            price: isOnSale ? product.sale_price : product.price,
            image_url: product.image_url
        };

        addToCart(cartItem, quantity);
        logClick("site");
        router.push("/carrinho");
    };

    const submitReview = async () => {
        if (!reviewData.comment) {
            alert("Por favor, escreva um comentário");
            return;
        }
        setSubmittingReview(true);
        try {
            const res = await fetch(`/api/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_name: reviewData.user_name || "Cliente",
                    comment: reviewData.comment,
                    rating: reviewData.rating,
                    product_id: product.id
                })
            });
            if (res.ok) {
                alert("Avaliação enviada! Ela será exibida após aprovação.");
                setShowReviewForm(false);
                setReviewData({ rating: 5, comment: "", user_name: "" });
            }
        } catch (error) {
            console.error("Erro ao enviar avaliação:", error);
        } finally {
            setSubmittingReview(false);
        }
    };

    // Resolve detailed botanical info for each ingredient in drawer
    const resolveIngredientDetails = (name: string, productName: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('açafrão') || lower.includes('acafrao') || lower.includes('curcuma')) {
            return {
                name,
                tag: 'Ativo Antioxidante & Anti-inflamatório',
                benefit: 'Ação termogênica e antioxidante que combate a foliculite, acalma a inflamação dos poros e auxilia na uniformização do tom da pele.',
                origin: 'Extrato botânico puro de Curcuma Longa (Açafrão da Terra Orgânico).'
            };
        }
        if (lower.includes('dolomita')) {
            return {
                name,
                tag: 'Mineral Calmante & Efeito Porcelana',
                benefit: 'Rica em cálcio e magnésio biodisponíveis, acalma irritações cutâneas, purifica profundamente e promove toque aveludado.',
                origin: 'Mineral natural purificado e micronizado de pureza farmacêutica.'
            };
        }
        if (lower.includes('argila branca') || lower.includes('caulim')) {
            return {
                name,
                tag: 'Clareador Natural & pH Fisiológico',
                benefit: 'A mais delicada das argilas. Promove clareamento gradual de manchas escuras, revitaliza a textura e devolve o viço natural.',
                origin: 'Argila caulinita nobre brasileira 100% pura e esterilizada.'
            };
        }
        if (lower.includes('argila verde')) {
            return {
                name,
                tag: 'Detox & Controle de Oleosidade',
                benefit: 'Ação secativa e adstringente, absorve excesso de sebo e combate bactérias causadoras de cravos e espinhas.',
                origin: 'Sedimentos minerais naturais ricos em silício, zinco e oligoelementos.'
            };
        }
        if (lower.includes('rosa mosqueta')) {
            return {
                name,
                tag: 'Regenerador Celular & Pró-Colágeno',
                benefit: 'Concentrado em ácidos graxos essenciais e vitaminas A e C, auxilia na cicatrização, reduz estrias e melhora a firmeza cutânea.',
                origin: 'Prensagem a frio de sementes botânicas nobres de Rosa Canina.'
            };
        }
        if (lower.includes('barbatimão') || lower.includes('barbatimao')) {
            return {
                name,
                tag: 'Adstringente & Cicatrizante Íntimo',
                benefit: 'Ação cicatrizante, tonificante e antisséptica natural consagrada pela flora medicinal brasileira para cuidados suaves.',
                origin: 'Extrato concentrado da casca de Stryphnodendron adstringens sustentável.'
            };
        }
        if (lower.includes('calêndula') || lower.includes('calendula')) {
            return {
                name,
                tag: 'Emoliente & Suavizante Cutâneo',
                benefit: 'Acalma peles sensibilizadas, reduz a vermelhidão pós-depilação e promove sensação imediata de alívio e hidratação.',
                origin: 'Extrato botânico de flores de Calendula officinalis.'
            };
        }
        if (lower.includes('rícino') || lower.includes('ricino') || lower.includes('castor')) {
            return {
                name,
                tag: 'Fortalecedor & Hidratação Profunda',
                benefit: 'Rico em ácido ricinoleico e vitamina E, estimula a hidratação profunda dos folículos e reforça a barreira lipídica da pele.',
                origin: 'Óleo vegetal puro prensado a frio de Ricinus communis.'
            };
        }
        if (lower.includes('coco') || lower.includes('palmiste')) {
            return {
                name,
                tag: 'Base Vegetal Nutritiva',
                benefit: 'Gera espuma cremosa, suave e biodegradável, higienizando profundamente enquanto preserva a hidratação natural da pele.',
                origin: 'Óleo vegetal puro extraído de cocos sustentáveis.'
            };
        }
        if (lower.includes('glicerina')) {
            return {
                name,
                tag: 'Umectante Hidratante Biocompatível',
                benefit: 'Retém a umidade na epiderme, evitando o ressecamento pós-banho e garantindo maciez e proteção contínuas.',
                origin: 'Glicerina 100% vegetal bidestilada de grau cosmético.'
            };
        }
        if (lower.includes('melaleuca') || lower.includes('tea tree')) {
            return {
                name,
                tag: 'Antisséptico & Purificante Botânico',
                benefit: 'Combate bactérias causadoras de foliculite e odores com ação purificante natural que equilibra a microbiota da pele.',
                origin: 'Óleo essencial puro destilado a vapor de Melaleuca alternifolia.'
            };
        }
        return {
            name,
            tag: 'Ativo Botânico Natural',
            benefit: `Componente ativo puro selecionado para agir em sinergia na fórmula de ${productName}, garantindo alta eficácia e respeito à barreira cutânea.`,
            origin: 'Matéria-prima 100% de origem vegetal pura, sustentável e rastreada.'
        };
    };

    // Parse ingredient list from comma or newline separated string
    const parseIngredients = (raw: string): string[] => {
        if (!raw) return [];
        const byNewline = raw.split('\n').map(s => s.trim()).filter(Boolean);
        if (byNewline.length > 1) return byNewline;
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    };

    const rawIngredientsText = product.details?.ingredientes || product.details?.composicao || product.ingredientes || product.composicao || product.ingredients || "";
    let parsedIngredients = parseIngredients(rawIngredientsText);

    // Fallback curated ingredients by product category if not yet configured
    if (parsedIngredients.length === 0) {
        const pName = (product.name || "").toLowerCase();
        if (pName.includes("açafrão") || pName.includes("acafrao")) {
            parsedIngredients = [
                "Açafrão da Terra (Cúrcuma Orgânica)",
                "Dolomita Branca Micronizada",
                "Óleo de Coco Palmiste",
                "Glicerina Vegetal Bidestilada",
                "Óleo Essencial Puro de Melaleuca"
            ];
        } else if (pName.includes("clareador") || pName.includes("argila branca")) {
            parsedIngredients = [
                "Argila Branca Caulinita Nobre",
                "Óleo Vegetal de Rosa Mosqueta",
                "Manteiga de Karité Pura",
                "Óleo de Coco Vegetal",
                "Vitamina E Antioxidante Natural"
            ];
        } else if (pName.includes("barbatimão") || pName.includes("barbatimao") || pName.includes("intimo")) {
            parsedIngredients = [
                "Extrato Concentrado de Barbatimão",
                "Extrato Botânico de Calêndula",
                "Óleo de Coco Palmiste",
                "Glicerina Vegetal Pura",
                "Óleo Essencial Suave"
            ];
        } else if (pName.includes("verde") || pName.includes("acne")) {
            parsedIngredients = [
                "Argila Verde Purificante",
                "Óleo Essencial de Melaleuca (Tea Tree)",
                "Extrato Botânico de Alecrim",
                "Óleo de Coco Palmiste",
                "Glicerina Vegetal Pura"
            ];
        } else {
            parsedIngredients = [
                "Óleos Vegetais Nobres Prensados a Frio",
                "Glicerina 100% Vegetal Biocompatível",
                "Extratos Botânicos Ativos Selecionados",
                "Vitamina E Antioxidante Natural"
            ];
        }
    }

    const ingredientsWithDetails = parsedIngredients.map(item =>
        resolveIngredientDetails(item, product.name)
    );

    const displayPrice = product.is_on_sale && product.sale_price && product.sale_price > 0
        ? product.sale_price
        : product.price;

    return (
        <main style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', margin: 0, padding: 0, boxSizing: 'border-box' }}>
            <Header />
            <div className={styles.productContainer}>
                <div className={styles.productLayout}>
                    <div className={styles.imageSection}>
                        <div className={styles.mainImageContainer}>
                            {(activeImage || product.image_url) && (
                                <div className={styles.imageWrapper}>
                                    <Image
                                        src={getImageUrl(activeImage || product.image_url)}
                                        alt={product.name}
                                        fill
                                        className={styles.productImage}
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        priority
                                    />
                                </div>
                            )}
                        </div>
                        {allImages.length > 1 && (
                            <div className={styles.thumbnailGrid}>
                                {allImages.map((img: string, idx: number) => (
                                    <div
                                        key={idx}
                                        className={`${styles.thumbnailItem} ${activeImage === img ? styles.activeThumbnail : ''}`}
                                        onClick={() => setActiveImage(img)}
                                    >
                                        <Image
                                            src={getImageUrl(img)}
                                            alt={`Thumb ${idx}`}
                                            width={80}
                                            height={80}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={styles.infoSection}>
                        <div className={styles.tags}>
                            {product.tags.map((tag: string) => (
                                <span key={tag} className="scientific-badge">{tag}</span>
                            ))}
                        </div>
                        <h1 className={styles.productName}>{product.name}</h1>
                        {product.frase_decisao && (
                            <p className={styles.decisionPhrase}>{product.frase_decisao}</p>
                        )}
                        {product.price && (
                            <div className={styles.priceContainer}>
                                {product.is_on_sale && product.sale_price && product.sale_price > 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '1.1rem', color: '#9ca3af', textDecoration: 'line-through', fontWeight: 500 }}>
                                            R$ {product.price.toFixed(2).replace(".", ",")}
                                        </span>
                                        <span className={styles.price} style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 800 }}>
                                            R$ {product.sale_price.toFixed(2).replace(".", ",")}
                                        </span>
                                        <span style={{
                                            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            boxShadow: '0 4px 10px rgba(245,158,11,0.3)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            🔥 {Math.round((1 - product.sale_price / product.price) * 100)}% OFF
                                        </span>
                                    </div>
                                ) : (
                                    <p className={styles.price}>R$ {product.price.toFixed(2).replace(".", ",")}</p>
                                )}
                                <span className={styles.socialProofBadge}>⭐ Mais de 20.000 clientes satisfeitos</span>
                            </div>
                        )}
                        <div className={styles.buyActions}>
                            {product.buy_on_site && (
                                <div className={styles.purchaseControlsGroup}>
                                    <div className={styles.quantityWrapper}>
                                        <button 
                                            type="button"
                                            className={styles.quantityBtn} 
                                            onClick={handleDecrement}
                                            disabled={quantity <= 1}
                                            aria-label="Diminuir quantidade"
                                        >
                                            <Minus size={15} />
                                        </button>
                                        <span className={styles.quantityValue}>{quantity}</span>
                                        <button 
                                            type="button"
                                            className={styles.quantityBtn} 
                                            onClick={handleIncrement}
                                            aria-label="Aumentar quantidade"
                                        >
                                            <Plus size={15} />
                                        </button>
                                    </div>

                                    <div className={styles.actionButtonsRow}>
                                        <button 
                                            type="button"
                                            className={styles.addToCartBtn} 
                                            onClick={handleAddToCart}
                                            title="Adicionar ao Carrinho"
                                        >
                                            <ShoppingBag size={18} />
                                            <span className={styles.btnTextFull}>ADICIONAR AO CARRINHO</span>
                                            <span className={styles.btnTextShort}>ADICIONAR</span>
                                        </button>
                                    </div>

                                    <button
                                        ref={buyNowBtnRef}
                                        className={styles.buyNowBtn}
                                        onClick={handleBuyNow}
                                        disabled={buyingNow}
                                        id="main-buy-btn"
                                        type="button"
                                    >
                                        <ShoppingBag size={18} />
                                        <span>{buyingNow ? 'Processando...' : 'COMPRAR AGORA'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Vídeos em Formato Story */}
                            <ProductStoryCircles
                                storyVideos={product.story_videos}
                                onSelectStory={(index) => setSelectedStoryIndex(index)}
                                productImage={product.image_url}
                            />

                            {selectedStoryIndex !== null && product.story_videos && product.story_videos.length > 0 && (
                                <ProductStoryModal
                                    storyVideos={product.story_videos}
                                    initialIndex={selectedStoryIndex}
                                    productName={product.name}
                                    productImage={product.image_url}
                                    productPrice={product.is_on_sale && product.sale_price ? product.sale_price : product.price}
                                    onClose={() => setSelectedStoryIndex(null)}
                                    onBuyNow={handleBuyNow}
                                />
                            )}

                            {paymentError && (
                                <div style={{ marginTop: '15px', padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '0.82rem', width: '100%' }}>
                                    ⚠️ {paymentError}
                                </div>
                            )}

                            {(product.mercadolivre_url || product.shopee_url) && (
                                <div className={styles.marketplaceSection}>
                                    <p className={styles.marketplaceText}>Prefere comprar por marketplace? Escolha abaixo:</p>
                                    <div className={styles.marketplaceButtons}>
                                        {product.mercadolivre_url && (
                                            <a href={product.mercadolivre_url} target="_blank" className={styles.mlBtnProduct} onClick={() => logClick("mercadolivre")}>
                                                COMPRAR NO MERCADO LIVRE
                                            </a>
                                        )}
                                        {product.shopee_url && (
                                            <a href={product.shopee_url} target="_blank" className={styles.shopeeBtnProduct} onClick={() => logClick("shopee")}>
                                                COMPRAR NA SHOPEE
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className={styles.description}>{product.description}</p>

                        {/* Link para a Ficha Técnica Premium */}
                        <Link
                            href={`/produto/${product.slug}/info`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.techInfoLink}
                        >
                            <QrCode size={20} /> Ver Ficha Técnica Completa
                        </Link>
                        <div className={styles.detailSection}>
                            <h3>ATIVOS / INGREDIENTES</h3>
                            <p>{product.ingredients}</p>
                        </div>
                        <div className={styles.detailSection}>
                            <h3>BENEFÍCIOS</h3>
                            <p>{product.benefits}</p>
                        </div>
                    </div>
                </div>

                {/* ── SEÇÃO INFERIOR DE DETALHES: COMPOSIÇÃO BOTÂNICA & FAQ ── */}
                <div className={styles.productDetailsBottomGrid}>
                    {/* ── GAVETA DE ITENS UTILIZADOS (COMPOSIÇÃO BOTÂNICA) ── */}
                    {ingredientsWithDetails.length > 0 && (
                        <div className={styles.drawerSection}>
                            <div className={styles.drawerHeaderCard}>
                                <div className={styles.drawerBadge}>
                                    <Leaf size={13} />
                                    <span>Composição Declarada & Ativa</span>
                                </div>
                                <h3 className={styles.drawerTitle}>
                                    <span>Itens Utilizados no Produto</span>
                                    <span className={styles.drawerCountBadge}>
                                        {ingredientsWithDetails.length} ativos botânicos
                                    </span>
                                </h3>
                                <p className={styles.drawerSubtitle}>
                                    Transparência absoluta: abra cada gaveta para conhecer em detalhes a função terapêutica e a origem de cada elemento desta fórmula.
                                </p>
                                <div className={styles.drawerChips}>
                                    <span className={styles.drawerChip}>🌱 100% Vegano</span>
                                    <span className={styles.drawerChip}>🐰 Cruelty-Free</span>
                                    <span className={styles.drawerChip}>🚫 Sem Parabenos</span>
                                    <span className={styles.drawerChip}>✨ Grau Nobre</span>
                                </div>
                            </div>

                            <div className={styles.drawerList}>
                                {ingredientsWithDetails.map((item, idx) => {
                                    const isOpen = openAccordion === idx;
                                    const numStr = String(idx + 1).padStart(2, '0');
                                    return (
                                        <div
                                            key={idx}
                                            className={`${styles.drawerItem} ${isOpen ? styles.drawerItemOpen : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className={styles.drawerTrigger}
                                                onClick={() => setOpenAccordion(isOpen ? null : idx)}
                                                aria-expanded={isOpen}
                                            >
                                                <div className={styles.drawerTriggerLeft}>
                                                    <div className={styles.drawerNumBadge}>
                                                        {numStr}
                                                    </div>
                                                    <div className={styles.drawerItemMeta}>
                                                        <div className={styles.drawerItemName}>{item.name}</div>
                                                        <div className={styles.drawerItemTag}>{item.tag}</div>
                                                    </div>
                                                </div>
                                                <div className={styles.drawerTriggerRight}>
                                                    <ChevronDown
                                                        size={18}
                                                        className={`${styles.drawerChevron} ${isOpen ? styles.drawerChevronOpen : ''}`}
                                                    />
                                                </div>
                                            </button>

                                            <div className={`${styles.drawerBody} ${isOpen ? styles.drawerBodyOpen : ''}`}>
                                                <div className={styles.drawerBodyInner}>
                                                    <div className={styles.drawerCardsGrid}>
                                                        <div className={styles.drawerCard}>
                                                            <div className={styles.drawerCardHeader}>
                                                                <Sparkles size={14} />
                                                                <span>Ação na sua pele</span>
                                                            </div>
                                                            <p className={styles.drawerCardText}>{item.benefit}</p>
                                                        </div>
                                                        <div className={styles.drawerCard}>
                                                            <div className={styles.drawerCardHeader}>
                                                                <Leaf size={14} />
                                                                <span>Origem & Pureza</span>
                                                            </div>
                                                            <p className={styles.drawerCardText}>{item.origin}</p>
                                                        </div>
                                                    </div>
                                                    <div className={styles.drawerFooterNotice}>
                                                        ✓ Ingrediente biocompatível e seguro para uso diário
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Seção de Dúvidas (Chat FAQ) */}
                    <div className={styles.chatSection}>
                        <div className={styles.chatHeaderInline}>
                            <span>💬 Dúvidas sobre o produto?</span>
                        </div>
                        <div className={styles.chatContentInline}>
                            <div className={styles.chatMessageInline}>
                                Olá! 👋 Como posso te ajudar com o <strong>{product.name}</strong> hoje?
                            </div>
                            <div className={styles.faqListInline}>
                                {faqs.map((faq, i) => (
                                    <button key={i} className={styles.faqButtonInline} onClick={() => setSelectedFaq(faq)}>
                                        {faq.q}
                                    </button>
                                ))}
                            </div>
                            {selectedFaq && (
                                <div className={styles.answerInline}>
                                    {selectedFaq.a}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className={styles.wholesalePromoCard}>
                    <div className={styles.wholesaleBadge}>ECONOMIA REAL</div>
                    <div className={styles.wholesaleContent}>
                        <h3>Atacado ECOSOPIS</h3>
                        <p>Desbloqueie <strong>30% de desconto</strong> direto de fábrica ao montar seu kit com 10+ produtos.</p>
                        <Link href="/atacado" className={styles.wholesaleBtn}>
                            COMPRAR NO ATACADO
                        </Link>
                    </div>
                </div>
                
                <div className={styles.reviewsSection}>
                    <div className={styles.reviewsHeader}>
                        <h2>Avaliações dos Clientes</h2>
                        <button className="btn-primary" onClick={() => setShowReviewForm(!showReviewForm)}>
                            {showReviewForm ? 'Cancelar' : 'Deixar uma Avaliação'}
                        </button>
                    </div>

                    {showReviewForm && (
                        <div className={styles.reviewForm}>
                            <h3>Sua Avaliação</h3>
                            <div className={styles.starRating}>
                                <input
                                    type="text"
                                    placeholder="Seu nome"
                                    value={reviewData.user_name}
                                    onChange={(e) => setReviewData({ ...reviewData, user_name: e.target.value })}
                                    className={styles.reviewInput}
                                    style={{ marginBottom: '1rem' }}
                                    required
                                />
                                <div style={{ display: 'flex', gap: '5px', marginBottom: '1rem' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className={star <= reviewData.rating ? styles.starActive : styles.star}
                                            onClick={() => setReviewData({ ...reviewData, rating: star })}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                placeholder="Conte sua experiência com este produto..."
                                value={reviewData.comment}
                                onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                                className={styles.reviewInput}
                            />
                            <button className="btn-primary" onClick={submitReview} disabled={submittingReview}>
                                {submittingReview ? 'Enviando...' : 'Enviar Avaliação'}
                            </button>
                        </div>
                    )}

                    <div className={styles.reviewsList}>
                        {approvedReviews.length > 0 ? (
                            approvedReviews
                                .slice((reviewPage - 1) * reviewsPerPage, reviewPage * reviewsPerPage)
                                .map((rev: any) => (
                                <div key={rev.id} className={styles.reviewCard}>
                                    <div className={styles.reviewMeta}>
                                        <span className={styles.reviewerName}>{rev.user_name}</span>
                                        <div className={styles.reviewStars}>
                                            {Array(5).fill(0).map((_, i) => (
                                                <span key={i} className={i < rev.rating ? styles.starActiveSmall : styles.starSmall}>★</span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className={styles.reviewComment}>{rev.comment}</p>
                                    {Array.isArray(rev.images) && rev.images.length > 0 && (
                                        <div className={styles.reviewPhotosGrid}>
                                            {rev.images.map((imgUrl: string, idx: number) => (
                                                <a 
                                                    key={idx} 
                                                    href={imgUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className={styles.reviewPhotoItem}
                                                >
                                                    <img src={imgUrl} alt={`Foto do cliente ${rev.user_name}`} />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className={styles.noReviews}>Ainda não há avaliações para este produto. Seja o primeiro a avaliar!</p>
                        )}
                    </div>

                    {/* Paginação de avaliações do produto */}
                    {approvedReviews.length > reviewsPerPage && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '24px'
                        }}>
                            <button
                                type="button"
                                disabled={reviewPage === 1}
                                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: 'white',
                                    color: '#2d5a27',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    cursor: reviewPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: reviewPage === 1 ? 0.4 : 1
                                }}
                            >
                                ← Anterior
                            </button>

                            {Array.from({ length: Math.ceil(approvedReviews.length / reviewsPerPage) }, (_, idx) => idx + 1).map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setReviewPage(num)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        border: reviewPage === num ? 'none' : '1px solid #cbd5e1',
                                        background: reviewPage === num ? '#2d5a27' : 'white',
                                        color: reviewPage === num ? 'white' : '#334155',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {num}
                                </button>
                            ))}

                            <button
                                type="button"
                                disabled={reviewPage === Math.ceil(approvedReviews.length / reviewsPerPage)}
                                onClick={() => setReviewPage(p => Math.min(Math.ceil(approvedReviews.length / reviewsPerPage), p + 1))}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: 'white',
                                    color: '#2d5a27',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    cursor: reviewPage === Math.ceil(approvedReviews.length / reviewsPerPage) ? 'not-allowed' : 'pointer',
                                    opacity: reviewPage === Math.ceil(approvedReviews.length / reviewsPerPage) ? 0.4 : 1
                                }}
                            >
                                Próxima →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── VOCÊ TAMBÉM PODE GOSTAR DE ── */}
            {relatedProducts.length > 0 && (
                <section className={styles.relatedSection}>
                    <div className={styles.relatedSectionInner}>
                        <div className={styles.relatedHeader}>
                            <span className={styles.relatedLabel}>Descubra mais</span>
                            <h2 className={styles.relatedTitle}>Você também pode gostar de:</h2>
                        </div>
                        <div className={styles.relatedGrid}>
                            {relatedProducts.map((p: any) => (
                                <Link
                                    key={p.id}
                                    href={`/produtos/${p.slug}`}
                                    className={styles.relatedCard}
                                >
                                    <div className={styles.relatedCardImage}>
                                        <Image
                                            src={getImageUrl(p.image_url || '')}
                                            alt={p.name}
                                            fill
                                            sizes="(max-width: 768px) 200px, 25vw"
                                            style={{ objectFit: 'contain', padding: '12px' }}
                                        />
                                    </div>
                                    <div className={styles.relatedCardBody}>
                                        <span className={styles.relatedCardName}>{p.name}</span>
                                        <span className={styles.relatedCardPrice}>
                                            {p.is_on_sale && p.sale_price && p.sale_price > 0
                                                ? `R$ ${p.sale_price.toFixed(2).replace('.', ',')}`
                                                : p.price
                                                    ? `R$ ${p.price.toFixed(2).replace('.', ',')}`
                                                    : 'Consulte'}
                                        </span>
                                        <div className={styles.relatedCardBtn}>Ver Produto</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <Footer />

            {/* ── STICKY BUY BAR ── */}
            {product.buy_on_site && (
                <div className={`${styles.stickyBar} ${showStickyBar ? styles.stickyBarVisible : ''}`} role="complementary" aria-label="Compra rápida">
                    <div className={styles.stickyBarInfo}>
                        <div className={styles.stickyBarName}>{product.name}</div>
                        <div className={styles.stickyBarPrice}>
                            {displayPrice ? `R$ ${displayPrice.toFixed(2).replace('.', ',')}` : ''}
                        </div>
                    </div>

                    <div className={styles.stickyBarQty}>
                        <button
                            className={styles.stickyBarQtyBtn}
                            onClick={handleDecrement}
                            disabled={quantity <= 1}
                            aria-label="Diminuir"
                        >
                            <Minus size={14} />
                        </button>
                        <span className={styles.stickyBarQtyValue}>{quantity}</span>
                        <button
                            className={styles.stickyBarQtyBtn}
                            onClick={handleIncrement}
                            aria-label="Aumentar"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    <button
                        className={styles.stickyBarBuyBtn}
                        onClick={handleBuyNow}
                        disabled={buyingNow}
                        id="sticky-buy-btn"
                    >
                        <ShoppingBag size={18} />
                        <span>COMPRAR</span>
                    </button>
                </div>
            )}
        </main>
    );
}
