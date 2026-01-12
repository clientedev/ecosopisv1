import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";

export default function Home() {
    return (
        <main>
            <Header />

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={`container ${styles.heroContent}`}>
                    <span className="scientific-badge">NATURAL & VEGANO</span>
                    <h1>O poder da natureza com alto rigor científico.</h1>
                    <p>Cosméticos de alta performance para a sua pele, sem crueldade animal.</p>
                    <div className={styles.heroActions}>
                        <Link href="/produtos" className="btn-primary">VER PRODUTOS</Link>
                        <Link href="/quizz" className="btn-outline">FAZER QUIZZ DE PELE</Link>
                    </div>
                </div>
            </section>

            {/* Featured Grid Section (Placeholder) */}
            <section className={styles.section}>
                <div className="container">
                    <h2 className={styles.sectionTitle}>MAIS VENDIDOS</h2>
                    <div className={styles.productGrid}>
                        {/* Product Cards will go here */}
                        <div style={{ textAlign: 'center', padding: '100px', backgroundColor: 'var(--neutral-gray-100)' }}>
                            Em breve: Cards de produtos com estética Principia
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
