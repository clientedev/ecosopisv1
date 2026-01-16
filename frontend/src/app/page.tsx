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

    const [currentSlide, setCurrentSlide] = useState(0);

    const slides = [
        {
            badge: "ALTA PERFORMANCE NATURAL",
            title: "Eficácia comprovada com ativos botânicos purificados.",
            description: "Desenvolvemos fórmulas minimalistas e potentes para resultados reais, sem componentes sintéticos agressivos.",
            ctaPrimary: { text: "VER PRODUTOS", link: "/produtos" },
            ctaSecondary: { text: "FAZER QUIZZ PERSONALIZADO", link: "/quizz" }
        },
        {
            badge: "CIÊNCIA E NATUREZA",
            title: "O poder das plantas com tecnologia de ponta.",
            description: "Fórmulas exclusivas que respeitam a sua pele e o planeta.",
            ctaPrimary: { text: "CONHEÇA A LINHA", link: "/produtos" },
            ctaSecondary: { text: "SAIBA MAIS", link: "/sobre" }
        }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length]);

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : '');
                const res = await fetch(`${apiUrl}/products/`);
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
                        style={{ display: index === currentSlide ? 'block' : 'none' }}
                    >
                        <div className={`container ${styles.heroContent}`}>
                            <span className="scientific-badge">{slide.badge}</span>
                            <h1>{slide.title}</h1>
                            <p>{slide.description}</p>
                            <div className={styles.heroActions}>
                                <Link href={slide.ctaPrimary.link} className="btn-primary">{slide.ctaPrimary.text}</Link>
                                <Link href={slide.ctaSecondary.link} className="btn-outline">{slide.ctaSecondary.text}</Link>
                            </div>
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
