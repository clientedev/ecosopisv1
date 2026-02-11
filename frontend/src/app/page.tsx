"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import NewsSection from "@/components/NewsSection/NewsSection";
import styles from "./page.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function Home() {
    const [recentProducts, setRecentProducts] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewForm, setReviewForm] = useState({ user_name: "", comment: "", rating: 5 });
    const [formStatus, setFormStatus] = useState({ type: "", text: "" });

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const res = await fetch('/api/products/reviews/approved');
                if (res.ok) {
                    const data = await res.json();
                    setReviews(data);
                }
            } catch (err) {
                console.error("Error fetching reviews", err);
            }
        };

        const logVisit = async () => {
            try {
                await fetch('/api/metrics/log/visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: '/' })
                });
            } catch (err) {
                console.error("Error logging visit", err);
            }
        };

        fetchReviews();
        logVisit();
    }, []);

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus({ type: "info", text: "Enviando..." });
        try {
            const res = await fetch('/api/products/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reviewForm)
            });
            if (res.ok) {
                setFormStatus({ type: "success", text: "Sua avaliação foi enviada e será exibida após aprovação! ✨" });
                setReviewForm({ user_name: "", comment: "", rating: 5 });
            } else {
                setFormStatus({ type: "error", text: "Erro ao enviar avaliação." });
            }
        } catch (err) {
            setFormStatus({ type: "error", text: "Erro de conexão." });
        }
    };
    const [slides, setSlides] = useState<any[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    const getImageUrl = (url: string) => {
        if (!url) return "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        return url;
    };

    useEffect(() => {
        const fetchCarousel = async () => {
            try {
                const res = await fetch('/api/carousel');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const dbSlides = data.map((item: any) => ({
                            badge: item.badge && item.badge !== "-" ? item.badge : null,
                            title: item.title && item.title !== "-" ? item.title : null,
                            description: item.description && item.description !== "-" ? item.description : null,
                            image_url: getImageUrl(item.image_url),
                            alignment: item.alignment || "center",
                            elements_config: typeof item.elements_config === 'string' ? JSON.parse(item.elements_config) : item.elements_config,
                            ctaPrimary: item.cta_primary_text && item.cta_primary_text !== "-" ? { text: item.cta_primary_text, link: item.cta_primary_link || "/produtos" } : null,
                            ctaSecondary: item.cta_secondary_text && item.cta_secondary_text !== "-" ? { text: item.cta_secondary_text, link: item.cta_secondary_link || "/quizz" } : null
                        }));
                        setSlides(dbSlides);
                    }
                }
            } catch (error) {
                console.error("Error fetching carousel:", error);
            }
        };
        fetchCarousel();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (slides.length > 0) {
                setCurrentSlide((prev) => (prev + 1) % slides.length);
            }
        }, 8000);
        return () => clearInterval(timer);
    }, [slides.length]);

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                const res = await fetch('/api/products');
                if (!res.ok) throw new Error("Falha ao carregar produtos");
                const data = await res.json();
                setRecentProducts(Array.isArray(data) ? data.slice(0, 4) : []);
            } catch (error) {
                console.error("Error fetching recent products:", error);
                setRecentProducts([]);
            }
        };
        fetchRecent();
    }, []);

    return (
        <main>
            <Header />

            {/* Hero Carousel */}
            <section className={styles.heroCarousel}>
                {slides.map((slide, index) => {
                    // Helper to convert hex to rgba for overlay
                    const hexToRgba = (hex: string, opacity: number) => {
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    };

                    const overlay = slide.overlay_color && slide.overlay_opacity !== undefined
                        ? hexToRgba(slide.overlay_color, slide.overlay_opacity)
                        : 'rgba(0,0,0,0.3)';

                    return (
                        <div
                            key={index}
                            className={`${styles.carouselSlide} ${index === currentSlide ? styles.activeSlide : ''}`}
                            style={{
                                backgroundImage: slide.image_url ? `linear-gradient(${overlay}, ${overlay}), url(${slide.image_url})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                minHeight: '500px',
                                display: index === currentSlide ? 'flex' : 'none',
                                alignItems: 'center',
                                width: '100%',
                                height: '500px',
                                position: 'relative'
                            }}
                        >
                            <div className={`container ${styles.heroContent}`} style={{
                                textAlign: slide.alignment as any,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: slide.alignment === 'center' ? 'center' : slide.alignment === 'right' ? 'flex-end' : 'flex-start',
                            }}>
                                {slide.badge && (
                                    <span
                                        className="scientific-badge"
                                        style={{
                                            backgroundColor: slide.badge_bg_color || '#4a7c59',
                                            color: slide.badge_color || '#ffffff'
                                        }}
                                    >
                                        {slide.badge}
                                    </span>
                                )}
                                {slide.title && (
                                    <h1 style={{ color: slide.title_color || '#ffffff' }}>
                                        {slide.title}
                                    </h1>
                                )}
                                {slide.description && (
                                    <p style={{ color: slide.description_color || '#ffffff' }}>
                                        {slide.description}
                                    </p>
                                )}
                                <div className={styles.heroActions}>
                                    {slide.ctaPrimary && <Link href={slide.ctaPrimary.link} className="btn-primary">{slide.ctaPrimary.text}</Link>}
                                    {slide.ctaSecondary && (
                                        <Link
                                            href={slide.ctaSecondary.link}
                                            className="btn-outline"
                                            style={{ color: 'white', borderColor: 'white' }}
                                        >
                                            {slide.ctaSecondary.text}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className={styles.carouselDots}>
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
                            onClick={() => setCurrentSlide(index)}
                        />
                    ))}
                </div>
            </section>

            {/* Advantages Section */}
            <section className={styles.advantages}>
                <div className="container">
                    <div className={styles.advantagesGrid}>
                        <div className={styles.advantageItem}>
                            <h3>🌱 100% Vegano</h3>
                            <p>Livre de qualquer ingrediente de origem animal e testes em bichos.</p>
                        </div>
                        <div className={styles.advantageItem}>
                            <h3>🔬 Ciência Natural</h3>
                            <p>Ativos extraídos com tecnologia para manter a potência máxima da planta.</p>
                        </div>
                        <div className={styles.advantageItem}>
                            <h3>♻️ Sustentável</h3>
                            <p>Embalagens e processos que respeitam o ciclo da natureza.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recent Products */}
            <section className={styles.section}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>LANÇAMENTOS RECENTES</h2>
                        <Link href="/produtos" className={styles.viewAll}>Ver todos →</Link>
                    </div>
                    <div className={styles.productGrid}>
                        {recentProducts.map((product: any) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Quiz Promo */}
            <section className={styles.quizPromo}>
                <div className={`container ${styles.quizPromoContent}`}>
                    <h2>Dúvida sobre qual produto escolher?</h2>
                    <p>Nossa inteligência artificial analisa seu perfil e recomenda a rotina ideal em menos de 1 minuto.</p>
                    <Link href="/quizz" className="btn-primary">INICIAR CONSULTORIA GRATUITA</Link>
                </div>
            </section>

            {/* News Section */}
            <NewsSection />

            {/* Reviews Section */}
            <section className={styles.reviewsSection}>
                <div className="container">
                    <h2 className={styles.sectionTitle} style={{ textAlign: 'center', marginBottom: '40px' }}>EXPERIÊNCIAS ECOSOPIS</h2>

                    <div className={styles.reviewsGrid}>
                        {reviews.length > 0 ? (
                            reviews.map((rev: any) => (
                                <div key={rev.id} className={styles.reviewCard}>
                                    <div className={styles.reviewStars}>
                                        {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                    </div>
                                    <p className={styles.reviewComment}>"{rev.comment}"</p>
                                    <span className={styles.reviewAuthor}>— {rev.user_name}</span>
                                </div>
                            ))
                        ) : (
                            <p style={{ textAlign: 'center', gridColumn: '1/-1', opacity: 0.7 }}>
                                Seja a primeira a compartilhar sua jornada de autocuidado!
                            </p>
                        )}
                    </div>

                    <div className={styles.reviewFormContainer}>
                        <h3>Deixe sua Avaliação</h3>
                        <form onSubmit={handleReviewSubmit} className={styles.reviewForm}>
                            <div className={styles.formRow}>
                                <input
                                    type="text"
                                    placeholder="Seu Nome"
                                    value={reviewForm.user_name}
                                    onChange={(e) => setReviewForm({ ...reviewForm, user_name: e.target.value })}
                                    required
                                />
                                <select
                                    value={reviewForm.rating}
                                    onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value) })}
                                >
                                    <option value="5">5 Estrelas ★★★★★</option>
                                    <option value="4">4 Estrelas ★★★★☆</option>
                                    <option value="3">3 Estrelas ★★★☆☆</option>
                                    <option value="2">2 Estrelas ★★☆☆☆</option>
                                    <option value="1">1 Estrela ★☆☆☆☆</option>
                                </select>
                            </div>
                            <textarea
                                placeholder="Conte sua experiência com nossos produtos botânicos..."
                                value={reviewForm.comment}
                                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                required
                            />
                            <button type="submit" className="btn-primary">ENVIAR AVALIAÇÃO</button>
                            {formStatus.text && (
                                <p className={`${styles.formMessage} ${styles[formStatus.type as keyof typeof styles]}`}>
                                    {formStatus.text}
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
