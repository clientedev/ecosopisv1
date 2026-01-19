"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function Home() {
    const [recentProducts, setRecentProducts] = useState([]);
    const [slides, setSlides] = useState<any[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const fetchCarousel = async () => {
            try {
                const res = await fetch('/api/carousel');
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > 0) {
                        const dbSlides = data.map((item: any) => ({
                            badge: item.badge && item.badge !== "-" ? item.badge : null,
                            title: item.title && item.title !== "-" ? item.title : null,
                            description: item.description && item.description !== "-" ? item.description : null,
                            image_url: item.image_url,
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
                const data = await res.json();
                setRecentProducts(data.slice(0, 4));
            } catch (error) {
                console.error("Error fetching recent products:", error);
            }
        };
        fetchRecent();
    }, []);

    return (
        <main>
            <Header />

            {/* Hero Carousel */}
            <section className={styles.heroCarousel}>
                {slides.map((slide, index) => (
                    <div 
                        key={index} 
                        className={`${styles.carouselSlide} ${index === currentSlide ? styles.activeSlide : ''}`}
                        style={{ 
                            backgroundImage: slide.image_url ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${slide.image_url})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            minHeight: '500px',
                            display: index === currentSlide ? 'flex' : 'none',
                            alignItems: 'center',
                            width: '100%',
                            height: '500px'
                        }}
                    >
                        <div className={`container ${styles.heroContent}`} style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            display: 'block'
                        }}>
                            {slide.badge && (
                                <div style={{ 
                                    position: 'absolute', 
                                    left: slide.elements_config?.badge?.x ?? 50, 
                                    top: slide.elements_config?.badge?.y ?? 50,
                                    width: slide.elements_config?.badge?.width ?? 200,
                                    zIndex: 10
                                }}>
                                    <span className="scientific-badge">{slide.badge}</span>
                                </div>
                            )}
                            {slide.title && (
                                <div style={{ 
                                    position: 'absolute', 
                                    left: slide.elements_config?.title?.x ?? 50, 
                                    top: slide.elements_config?.title?.y ?? 100,
                                    width: slide.elements_config?.title?.width ?? 500,
                                    zIndex: 10
                                }}>
                                    <h1>{slide.title}</h1>
                                </div>
                            )}
                            {slide.description && (
                                <div style={{ 
                                    position: 'absolute', 
                                    left: slide.elements_config?.description?.x ?? 50, 
                                    top: slide.elements_config?.description?.y ?? 220,
                                    width: slide.elements_config?.description?.width ?? 500,
                                    zIndex: 10
                                }}>
                                    <p>{slide.description}</p>
                                </div>
                            )}
                            {slide.ctaPrimary && (
                                <div style={{ 
                                    position: 'absolute', 
                                    left: slide.elements_config?.buttons?.x ?? 50, 
                                    top: slide.elements_config?.buttons?.y ?? 350,
                                    width: slide.elements_config?.buttons?.width ?? 400,
                                    display: 'flex',
                                    gap: '15px',
                                    flexWrap: 'wrap',
                                    zIndex: 10
                                }}>
                                    <Link href={slide.ctaPrimary.link} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>{slide.ctaPrimary.text}</Link>
                                    {slide.ctaSecondary && <Link href={slide.ctaSecondary.link} className="btn-outline" style={{ whiteSpace: 'nowrap' }}>{slide.ctaSecondary.text}</Link>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
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

            <Footer />
        </main>
    );
}
