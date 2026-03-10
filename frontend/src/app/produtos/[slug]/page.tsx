"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";
import { QrCode, Download } from "lucide-react";

export default function ProductDetailPage() {
    const params = useParams();
    const [product, setProduct] = useState<any>(null);

    const [activeImage, setActiveImage] = useState("");
    const [selectedFaq, setSelectedFaq] = useState<any>(null);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewData, setReviewData] = useState({ rating: 5, comment: "", user_name: "" });
    const [submittingReview, setSubmittingReview] = useState(false);

    const faqs = [
        { q: "Qual o prazo de entrega?", a: "O prazo médio de entrega é de 5 a 10 dias úteis, dependendo da sua região." },
        { q: "O produto é vegano?", a: "Sim! Todos os nossos produtos são 100% veganos e livres de crueldade animal." },
        { q: "Como usar o produto?", a: "Recomendamos o uso diário sobre a pele limpa e seca para melhores resultados." }
    ];

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/products/${params.slug}`);
                if (res.ok) {
                    const data = await res.json();
                    setProduct(data);
                    setActiveImage(data.image_url || (data.images && data.images[0]) || "");
                    logVisit(`/produtos/${params.slug}`);
                }
            } catch (error) {
                console.error("Error fetching product:", error);
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

    if (!product) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'var(--font-karla)' }}>
            <p>Carregando produto...</p>
        </div>
    );

    const allImages = product.images && product.images.length > 0 ? product.images : [product.image_url];

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
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = `/conta?redirect=/produtos/${params.slug}`;
            return;
        }
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const existingItem = cart.find((i: any) => i.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id: product.id, name: product.name, price: product.price, quantity: 1 });
        }
        localStorage.setItem("cart", JSON.stringify(cart));
        logClick("site");
        window.location.href = "/carrinho";
    };

    const [buyingNow, setBuyingNow] = useState(false);

    const handleBuyNow = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = `/conta?redirect=/produtos/${params.slug}`;
            return;
        }
        if (!product) return;
        setBuyingNow(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/payment/create-preference`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: [{
                        product_id: product.id,
                        product_name: product.name,
                        quantity: 1,
                        price: product.price
                    }],
                    total: product.price,
                    address: {},
                    shipping_method: "pac",
                    shipping_price: 0
                })
            });
            if (res.ok) {
                const data = await res.json();
                logClick("site");
                // Redirect to MercadoPago Checkout Pro
                const checkoutUrl = process.env.NODE_ENV === "production"
                    ? data.init_point
                    : data.sandbox_init_point;
                window.location.href = checkoutUrl || data.init_point;
            } else {
                const err = await res.json();
                alert(`Erro ao iniciar pagamento: ${err.detail || "Tente novamente"}`);
            }
        } catch (error) {
            console.error("Erro ao criar preference MP:", error);
            alert("Erro de conexão. Tente novamente.");
        } finally {
            setBuyingNow(false);
        }
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

    return (
        <main>
            <Header />
            <div className={`container ${styles.productContainer}`}>
                <div className={styles.productLayout}>
                    <div className={styles.imageSection}>
                        <div className={styles.mainImageContainer}>
                            {(activeImage || product.image_url) && (
                                <div className={styles.imageWrapper} style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <Image
                                        src={getImageUrl(activeImage || product.image_url)}
                                        alt={product.name}
                                        fill
                                        className={styles.productImage}
                                        unoptimized={true}
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
                                            unoptimized={true}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Seção de Dúvidas (Chat FAQ) - Restaurada aqui */}
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

                    <div className={styles.infoSection}>
                        <div className={styles.tags}>
                            {product.tags.map((tag: string) => (
                                <span key={tag} className="scientific-badge">{tag}</span>
                            ))}
                        </div>
                        <h1 className={styles.productName}>{product.name}</h1>
                        {product.price && (
                            <p className={styles.price}>R$ {product.price.toFixed(2).replace(".", ",")}</p>
                        )}
                        <p className={styles.description}>{product.description}</p>
                        <div className={styles.buyActions}>
                            {product.buy_on_site && (
                                <>
                                    <button
                                        className="btn-primary"
                                        onClick={handleBuyNow}
                                        disabled={buyingNow}
                                        style={{ position: 'relative' }}
                                    >
                                        {buyingNow ? '⏳ Redirecionando...' : 'COMPRAR AGORA'}
                                    </button>
                                    <button className="btn-outline" onClick={handleAddToCart}>ADICIONAR AO CARRINHO</button>
                                </>
                            )}
                            {product.mercadolivre_url && (
                                <a href={product.mercadolivre_url} target="_blank" className="btn-outline" onClick={() => logClick("mercadolivre")}>
                                    COMPRAR NO MERCADO LIVRE
                                </a>
                            )}
                            {product.shopee_url && (
                                <a href={product.shopee_url} target="_blank" className={styles.shopeeBtn} onClick={() => logClick("shopee")}>
                                    <svg viewBox="0 0 24 24" className={styles.shopeeLogo}>
                                        <path d="M19.349 7.153H17.43A5.433 5.433 0 0012 2.15a5.433 5.433 0 00-5.43 5.003h-1.92a2.153 2.153 0 00-2.15 2.155L2.5 19.308a2.153 2.153 0 002.15 2.155h14.7a2.153 2.153 0 002.15-2.155l-0.001-10a2.153 2.153 0 00-2.15-2.155zM12 4.15a3.433 3.433 0 013.43 3.003H8.57A3.433 3.433 0 0112 4.15zM15.42 15.655c-0.21 0.49-0.56 0.885-1.07 1.18s-1.13 0.44-1.87 0.44c-0.65 0-1.21-0.105-1.68-0.315s-0.845-0.515-1.135-0.915l1.01-0.9c0.2 0.28 0.44 0.49 0.72 0.63s0.59 0.21 0.93 0.21c0.39 0 0.69-0.085 0.89-0.255s0.3-0.38 0.3-0.63c0-0.23-0.08-0.415-0.24-0.55s-0.455-0.27-0.88-0.4c-0.67-0.205-1.165-0.435-1.485-0.69s-0.48-0.635-0.48-1.14c0-0.53 0.21-0.965 0.63-1.3s0.975-0.5 1.665-0.5c0.59 0 1.095 0.125 1.515 0.375s0.725 0.585 0.915 1.005l-0.94 0.8c-0.165-0.33-0.4-0.57-0.705-0.72s-0.65-0.225-1.035-0.225c-0.32 0-0.57 0.075-0.75 0.225s-0.27 0.355-0.27 0.615c0 0.2 0.075 0.365 0.225 0.5s0.41 0.245 0.78 0.335c0.665 0.19 1.155 0.4 1.47 0.63s0.56 0.54 0.735 0.935 0.265 0.84 0.265 1.335z" fill="white" />
                                    </svg>
                                    COMPRAR NA SHOPEE
                                </a>
                            )}
                        </div>
                        {/* Link para a Ficha Técnica Premium */}
                        <a
                            href={`/produto/${product.slug}/info`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginTop: '14px',
                                marginBottom: '14px',
                                padding: '12px 24px',
                                borderRadius: '10px',
                                border: '1.5px solid #2d5a27',
                                color: '#2d5a27',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                background: 'rgba(45, 90, 39, 0.04)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <QrCode size={20} /> Ver Ficha Técnica Completa
                        </a>
                        <div className={styles.detailSection}>
                            <h3>INGREDIENTES</h3>
                            <p>{product.ingredients}</p>
                        </div>
                        <div className={styles.detailSection}>
                            <h3>BENEFÍCIOS</h3>
                            <p>{product.benefits}</p>
                        </div>
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
                        {product.reviews && product.reviews.length > 0 ? (
                            product.reviews.map((rev: any) => (
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
                                </div>
                            ))
                        ) : (
                            <p className={styles.noReviews}>Ainda não há avaliações para este produto. Seja o primeiro a avaliar!</p>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
