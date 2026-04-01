"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
    return (
        <main>
            <Header />
            <div className={styles.aboutContainer}>
                <section className={styles.hero}>
                    <div className="container">
                        <h1>Nossa Essência</h1>
                        <p className={styles.subtitle}>Beleza consciente, vegana e natural para o seu dia a dia.</p>
                    </div>
                </section>

                <section className={styles.content}>
                    <div className="container">
                        <div className={styles.grid}>
                            <div className={styles.textBlock}>
                                <h2>Quem Somos</h2>
                                <p>
                                    A ECOSOPIS nasceu do desejo de transformar a rotina de cuidados pessoais em um momento de conexão com a natureza. 
                                    Acreditamos que a beleza não deve custar o bem-estar do nosso planeta nem a vida de seres inocentes.
                                </p>
                                <p>
                                    Nossa jornada começou com a produção artesanal de saboaria natural, buscando ingredientes puros e potentes 
                                    que a nossa biodiversidade oferece. Hoje, somos referência em cosmética vegana e orgânica, unindo 
                                    ciência e tradição.
                                </p>
                                <div className={styles.buttonWrapper}>
                                    <Link href="/sobre/materia-prima" className={styles.ctaButton}>
                                        Conheça nossa matéria-prima
                                    </Link>
                                </div>
                            </div>
                            <div className={styles.imageBlock}>
                                <div className={styles.imageWrapper}>
                                    <Image 
                                        src="/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png" 
                                        alt="Produção Ecosopis"
                                        fill
                                        style={{ objectFit: 'cover' }}
                                        unoptimized
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.values}>
                    <div className="container">
                        <div className={styles.valuesGrid}>
                            <div className={styles.valueItem}>
                                <div className={styles.icon}>🌿</div>
                                <h3>100% Natural</h3>
                                <p>Ingredientes selecionados da terra, sem químicas agressivas ou sintéticos.</p>
                            </div>
                            <div className={styles.valueItem}>
                                <div className={styles.icon}>🐰</div>
                                <h3>Cruelty Free</h3>
                                <p>Nenhum teste em animais. Respeito total a todas as formas de vida.</p>
                            </div>
                            <div className={styles.valueItem}>
                                <div className={styles.icon}>♻️</div>
                                <h3>Sustentável</h3>
                                <p>Embalagens pensadas para minimizar o impacto ambiental e gerar menos lixo.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.mission}>
                    <div className="container">
                        <div className={styles.missionBox}>
                            <h2>Nossa Missão</h2>
                            <p>
                                &ldquo;Democratizar o acesso a cosméticos de alta performance que sejam gentis com a pele e com o mundo, 
                                promovendo um consumo consciente e regenerativo.&rdquo;
                            </p>
                        </div>
                    </div>
                </section>
            </div>
            <Footer />
        </main>
    );
}
