"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";
import Link from "next/link";

export default function MateriaPrimaPage() {
  const materiasPrimas = [
    {
      id: 1,
      name: "Lavanda Francesa",
      description: "Propriedades calmantes e relaxantes, ideal para o bem-estar mental e cuidado com a pele.",
      image: "/attached_assets/lavanda.png",
      benefits: ["Calmante", "Antisséptica", "Cicatrizante"]
    },
    {
      id: 2,
      name: "Óleo de Coco Orgânico",
      description: "Hidratação profunda e natural, rico em ácidos graxos que nutrem a barreira cutânea.",
      image: "/attached_assets/coco.png",
      benefits: ["Hidratante", "Nutritivo", "Antifúngico"]
    },
    {
      id: 3,
      name: "Argila Verde",
      description: "Poderosa ação desintoxicante e controle de oleosidade para peles mistas e oleosas.",
      image: "/attached_assets/argila.png",
      benefits: ["Detox", "Controle de brilho", "Remineralizante"]
    },
    {
      id: 4,
      name: "Manteiga de Karité",
      description: "Proteção intensa contra o ressecamento, proporcionando elasticidade e maciez.",
      image: "/attached_assets/karite.png",
      benefits: ["Ultra-hidratante", "Protetora", "Suavizante"]
    }
  ];

  return (
    <main>
      <Header />
      <div className={styles.materiaContainer}>
        <section className={styles.hero}>
          <div className="container">
            <h1>Nossa Matéria-Prima</h1>
            <p className={styles.subtitle}>Conheça a pureza dos ingredientes que dão vida aos nossos produtos.</p>
          </div>
        </section>

        <section className={styles.gridSection}>
          <div className="container">
            <div className={styles.cardsGrid}>
              {materiasPrimas.map((item) => (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardImage}>
                    <div style={{ position: 'relative', width: '100%', height: '200px' }}>
                      <div className={styles.placeholderImg}>🌿</div>
                    </div>
                  </div>
                  <div className={styles.cardContent}>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className={styles.benefits}>
                      {item.benefits.map((benefit, idx) => (
                        <span key={idx} className={styles.tag}>{benefit}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.backButtonSection}>
          <div className="container">
            <Link href="/sobre" className={styles.buttonSecondary}>
              Voltar para Sobre
            </Link>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
