import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default function BoxPage() {
    return (
        <main>
            <Header />
            <div className={`container ${styles.boxContainer}`}>
                <div className={styles.heroSection}>
                    <div className={styles.heroContent}>
                        <span className="scientific-badge">ROTINA MENSAL</span>
                        <h1 className={styles.title}>BOX SURPRESA ECOSOPIS</h1>
                        <p className={styles.subtitle}>
                            Um convite mensal para redescobrir sua beleza natural. Receba em casa uma curadoria exclusiva de ativos botânicos, formulada especialmente para o que sua pele e alma precisam no momento.
                        </p>
                        <div className={styles.heroStats}>
                            <div className={styles.statItem}>
                                <strong>+2000</strong>
                                <span>Assinantes Felizes</span>
                            </div>
                            <div className={styles.statItem}>
                                <strong>100%</strong>
                                <span>Vegano & Cruelty-free</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.heroImagePlaceholder}>
                        <div className={styles.glassCard}>
                            <h3>O que vem no seu Box?</h3>
                            <ul>
                                <li>✨ 1 Lançamento Exclusivo</li>
                                <li>🌿 2 Produtos Full-size</li>
                                <li>💎 2 Miniaturas Luxo</li>
                                <li>📖 Guia de Rotina Botânica</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className={styles.howItWorks}>
                    <h2 className={styles.sectionHeading}>Como funciona sua rotina?</h2>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepNumber}>01</div>
                            <h3>Escolha seu Plano</h3>
                            <p>Selecione a recorrência que melhor se adapta ao seu estilo de vida.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepNumber}>02</div>
                            <h3>Perfil de Beleza</h3>
                            <p>Após assinar, você preenche um breve perfil para nossa IA personalizar seu box.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepNumber}>03</div>
                            <h3>Receba e Brilhe</h3>
                            <p>Todo mês, uma caixa cheia de aromas e texturas naturais chega até você.</p>
                        </div>
                    </div>
                </div>

                <div className={styles.pricing}>
                    <h2 className={styles.sectionHeading}>Escolha sua Jornada</h2>
                    <div className={styles.plans}>
                        <div className={styles.plan}>
                            <div className={styles.planHeader}>
                                <h3>PLANO MENSAL</h3>
                                <p>Ideal para quem quer experimentar</p>
                            </div>
                            <div className={styles.planPriceWrapper}>
                                <span className={styles.currency}>R$</span>
                                <span className={styles.amount}>129</span>
                                <span className={styles.cents}>,90</span>
                                <span className={styles.period}>/mês</span>
                            </div>
                            <ul className={styles.planBenefits}>
                                <li>✓ Sem fidelidade</li>
                                <li>✓ Cancele quando quiser</li>
                                <li>✓ Itens personalizados</li>
                            </ul>
                            <button className="btn-primary" style={{ width: '100%' }} onClick={() => handleSubscribe('PLANO MENSAL', 129.90)}>ASSINAR AGORA</button>
                        </div>
                        <div className={`${styles.plan} ${styles.planHighlight}`}>
                            <div className={styles.bestValueBadge}>MELHOR CUSTO-BENEFÍCIO</div>
                            <div className={styles.planHeader}>
                                <h3>PLANO TRIMESTRAL</h3>
                                <p>Para uma rotina de cuidados real</p>
                            </div>
                            <div className={styles.planPriceWrapper}>
                                <span className={styles.currency}>R$</span>
                                <span className={styles.amount}>109</span>
                                <span className={styles.cents}>,90</span>
                                <span className={styles.period}>/mês</span>
                            </div>
                            <p className={styles.planSavings}>Economize R$ 60 no período</p>
                            <ul className={styles.planBenefits}>
                                <li>✓ Frete Grátis</li>
                                <li>✓ Brinde exclusivo no 1º box</li>
                                <li>✓ Prioridade em lançamentos</li>
                            </ul>
                            <button className="btn-primary" style={{ width: '100%', backgroundColor: '#fff', color: '#2d5a27' }} onClick={() => handleSubscribe('PLANO TRIMESTRAL', 109.90)}>ASSINAR AGORA</button>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}

const handleSubscribe = async (plan: string, price: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = `/conta?redirect=/box`;
        return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
    try {
        const res = await fetch(`${apiUrl}/orders/subscribe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ plan_name: plan, price: price })
        });
        if (res.ok) {
            const data = await res.json();
            window.location.href = data.payment_url;
        }
    } catch (error) {
        console.error(error);
    }
};
