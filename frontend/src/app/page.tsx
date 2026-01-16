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

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
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

            {/* Hero Carousel - Simple Implementation */}
            <section className={styles.heroCarousel}>
                <div className={styles.carouselSlide}>
                    <div className={`container ${styles.heroContent}`}>
                        <span className="scientific-badge">ALTA PERFORMANCE NATURAL</span>
                        <h1>Eficácia comprovada com ativos botânicos purificados.</h1>
                        <p>Desenvolvemos fórmulas minimalistas e potentes para resultados reais, sem componentes sintéticos agressivos.</p>
                        <div className={styles.heroActions}>
                            <Link href="/produtos" className="btn-primary">VER PRODUTOS</Link>
                            <Link href="/quizz" className="btn-outline">FAZER QUIZZ PERSONALIZADO</Link>
                        </div>
                    </div>
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
