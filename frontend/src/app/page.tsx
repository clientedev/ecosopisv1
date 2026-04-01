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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const res = await fetch('/api/reviews/approved');
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
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: reviewForm.user_name,
                    comment: reviewForm.comment,
                    rating: reviewForm.rating
                })
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
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        return url;
    };

    useEffect(() => {
        const fetchCarousel = async () => {
            try {
                const res = await fetch('/api/carousel');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const dbSlides = data
                          .filter((item: any) => item.is_active !== false)
                          .map((item: any) => {
                            const desktopUrl = item.image_url ? getImageUrl(item.image_url) : "";
                            const mobileUrl = item.mobile_image_url ? getImageUrl(item.mobile_image_url) : "";
                            return {
                            badge: item.badge && item.badge !== "-" ? item.badge : null,
                            title: item.title && item.title !== "-" ? item.title : null,
                            description: item.description && item.description !== "-" ? item.description : null,
                            image_url: desktopUrl,
                            mobile_image_url: mobileUrl,
                            alignment: item.alignment || "center",
                            vertical_alignment: item.vertical_alignment || "center",
                            content_max_width: item.content_max_width || "500px",
                            glassmorphism: item.glassmorphism || false,
                            title_color: item.title_color,
                            description_color: item.description_color,
                            badge_color: item.badge_color,
                            badge_bg_color: item.badge_bg_color,
                            overlay_color: item.overlay_color,
                            overlay_opacity: item.overlay_opacity,
                            offset_x: item.offset_x || "0%",
                            offset_y: item.offset_y || "0%",
                            carousel_height: item.carousel_height || "700px",
                            mobile_carousel_height: item.mobile_carousel_height || "400px",
                            image_fit: item.image_fit || "cover",
                            ctaPrimary: item.cta_primary_text && item.cta_primary_text !== "-" ? { text: item.cta_primary_text, link: item.cta_primary_link || "/produtos" } : null,
                            ctaSecondary: item.cta_secondary_text && item.cta_secondary_text !== "-" ? { text: item.cta_secondary_text, link: item.cta_secondary_link || "/quizz" } : null
                            };
                          });
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

                    const coordinateMap: Record<string, number> = {
                        left: 10,
                        center: 50,
                        right: 90,
                        top: 10,
                        bottom: 90
                    };

                    const activeImageUrl = (isMobile && slide.mobile_image_url) ? slide.mobile_image_url : slide.image_url;
                    const activeHeight = isMobile ? (slide.mobile_carousel_height || '400px') : (slide.carousel_height || '700px');

                    return (
                        <div
                            key={index}
                            className={`${styles.carouselSlide} ${index === currentSlide ? styles.activeSlide : ''}`}
                            style={{
                                backgroundImage: activeImageUrl ? `linear-gradient(${overlay}, ${overlay}), url(${activeImageUrl})` : 'none',
                                backgroundSize: slide.image_fit || 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                display: index === currentSlide ? 'block' : 'none',
                                width: '100%',
                                height: activeHeight,
                                position: 'relative',
                                transition: 'opacity 0.8s ease-in-out'
                            }}
                        >
                            <div className={`${styles.heroContent}`} style={{
                                maxWidth: slide.content_max_width || '500px',
                                padding: '40px',
                                borderRadius: '24px',
                                background: slide.glassmorphism ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                backdropFilter: slide.glassmorphism ? 'blur(12px)' : 'none',
                                WebkitBackdropFilter: slide.glassmorphism ? 'blur(12px)' : 'none',
                                border: slide.glassmorphism ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                                boxShadow: slide.glassmorphism ? '0 10px 40px rgba(0,0,0,0.15)' : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'absolute',
                                left: isMobile ? '50%' : `${coordinateMap[slide.alignment] + (parseInt(slide.offset_x) || 0)}%`,
                                top: isMobile ? '50%' : `${coordinateMap[slide.vertical_alignment] + (parseInt(slide.offset_y) || 0)}%`,
                                transform: 'translate(-50%, -50%)',
                                textAlign: isMobile ? 'center' : (slide.alignment === 'center' ? 'center' : slide.alignment === 'right' ? 'right' : 'left') as any,
                                pointerEvents: 'auto',
                                width: isMobile ? '90%' : 'fit-content',
                            }}>
                                {slide.badge && (
                                    <span
                                        className="scientific-badge"
                                        style={{
                                            backgroundColor: slide.badge_bg_color || '#4a7c59',
                                            color: slide.badge_color || '#ffffff',
                                            marginBottom: '1rem',
                                            display: 'inline-block',
                                            alignSelf: isMobile ? 'center' : (slide.alignment === 'right' ? 'flex-end' : slide.alignment === 'center' ? 'center' : 'flex-start')
                                        }}
                                    >
                                        {slide.badge}
                                    </span>
                                )}
                                {slide.title && (
                                    <h1 style={{
                                        color: slide.title_color || '#ffffff',
                                        fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                                        lineHeight: 1.1,
                                        fontWeight: 800,
                                        marginBottom: '1rem',
                                        textShadow: slide.glassmorphism ? 'none' : '0 2px 10px rgba(0,0,0,0.2)'
                                    }}>
                                        {slide.title}
                                    </h1>
                                )}
                                {slide.description && (
                                    <p style={{
                                        color: slide.description_color || '#ffffff',
                                        fontSize: '1.1rem',
                                        opacity: 0.9,
                                        marginBottom: '2rem',
                                        maxWidth: '100%'
                                    }}>
                                        {slide.description}
                                    </p>
                                )}
                                <div className={styles.heroActions} style={{
                                    justifyContent: isMobile ? 'center' : (slide.alignment === 'right' ? 'flex-end' : slide.alignment === 'center' ? 'center' : 'flex-start')
                                }}>
                                    {slide.ctaPrimary && <Link href={slide.ctaPrimary.link} className="btn-primary" style={{ padding: '0.8rem 2rem' }}>{slide.ctaPrimary.text}</Link>}
                                    {slide.ctaSecondary && (
                                        <Link
                                            href={slide.ctaSecondary.link}
                                            className="btn-outline"
                                            style={{
                                                color: 'white',
                                                borderColor: 'white',
                                                background: 'rgba(255,255,255,0.1)',
                                                padding: '0.8rem 2rem'
                                            }}
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
                                    <p className={styles.reviewComment}>&quot;{rev.comment}&quot;</p>
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
        </main >
    );
}
