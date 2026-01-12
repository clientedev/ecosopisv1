import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default function BoxPage() {
    return (
        <main>
            <Header />
            <div className={`container ${styles.boxContainer}`}>
                <div className={styles.hero}>
                    <span className="scientific-badge">EXPERIÊNCIA MENSAL</span>
                    <h1 className={styles.title}>BOX SURPRESA ECOSOPIS</h1>
                    <p className={styles.subtitle}>
                        Uma seleção personalizada de produtos naturais e veganos,
                        entregue mensalmente na sua porta.
                    </p>
                </div>

                <div className={styles.features}>
                    <div className={styles.feature}>
                        <h3>🌿 PERSONALIZADO</h3>
                        <p>Produtos selecionados de acordo com seu tipo de pele e necessidades.</p>
                    </div>
                    <div className={styles.feature}>
                        <h3>📦 SURPRESA</h3>
                        <p>Descubra novos produtos e ativos todos os meses.</p>
                    </div>
                    <div className={styles.feature}>
                        <h3>💚 SUSTENTÁVEL</h3>
                        <p>100% vegano, cruelty-free e com embalagem eco-friendly.</p>
                    </div>
                </div>

                <div className={styles.pricing}>
                    <h2>PLANOS</h2>
                    <div className={styles.plans}>
                        <div className={styles.plan}>
                            <h3>MENSAL</h3>
                            <p className={styles.planPrice}>R$ 129,90/mês</p>
                            <button className="btn-primary">ASSINAR</button>
                        </div>
                        <div className={`${styles.plan} ${styles.planHighlight}`}>
                            <span className="scientific-badge">MAIS POPULAR</span>
                            <h3>TRIMESTRAL</h3>
                            <p className={styles.planPrice}>R$ 109,90/mês</p>
                            <p className={styles.planSavings}>Economize R$ 60</p>
                            <button className="btn-primary">ASSINAR</button>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
