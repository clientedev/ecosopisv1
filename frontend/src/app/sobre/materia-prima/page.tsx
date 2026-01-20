"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "../page.module.css";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function MateriaPrimaPage() {
  const [selectedIngredient, setSelectedIngredient] = useState(null);

  const materiasPrimas = [
    {
      id: 1,
      name: "Lavanda Francesa",
      description: "Propriedades calmantes e relaxantes, ideal para o bem-estar mental e cuidado com a pele.",
      fullDescription: "A Lavanda Francesa (Lavandula angustifolia) é mundialmente reconhecida por seu aroma floral delicado e suas propriedades terapêuticas. No cuidado com a pele, atua como um potente cicatrizante e regenerador celular. É excelente para acalmar irritações, queimaduras leves e promover o relaxamento profundo antes de dormir.",
      image: "/attached_assets/stock_images/lavender_flowers_field.jpg",
      benefits: ["Calmante", "Antisséptica", "Cicatrizante"],
      curiosity: "São necessários cerca de 150kg de flores de lavanda para produzir apenas 1kg de óleo essencial puro."
    },
    {
      id: 2,
      name: "Óleo de Coco Orgânico",
      description: "Hidratação profunda e natural, rico em ácidos graxos que nutrem a barreira cutânea.",
      fullDescription: "Extraído da polpa do coco fresco, nosso óleo de coco é prensado a frio para manter todas as suas vitaminas e antioxidantes. Rico em ácido láurico, possui propriedades antibacterianas naturais e penetra profundamente nos fios de cabelo e camadas da pele, proporcionando uma hidratação que dura o dia todo.",
      image: "/attached_assets/stock_images/organic_coconut_oil.jpg",
      benefits: ["Hidratante", "Nutritivo", "Antifúngico"],
      curiosity: "O óleo de coco é um dos poucos óleos que consegue penetrar no eixo do cabelo, reduzindo a perda de proteína."
    },
    {
      id: 3,
      name: "Argila Verde",
      description: "Poderosa ação desintoxicante e controle de oleosidade para peles mistas e oleosas.",
      fullDescription: "A Argila Verde é rica em diversos minerais como silício, magnésio e ferro. Sua cor deve-se à presença de óxido de ferro associado ao magnésio e cálcio. Possui ação absorvente, combatendo edemas, sendo secativa, emoliente, antisséptica, bactericida, analgésica e cicatrizante no tratamento de peles oleosas e acnéicas.",
      image: "/attached_assets/stock_images/green_clay_powder.jpg",
      benefits: ["Detox", "Controle de brilho", "Remineralizante"],
      curiosity: "A argila verde é extraída de rochas vulcânicas e é considerada a mais rica em minerais entre todas as cores de argila."
    },
    {
      id: 4,
      name: "Manteiga de Karité",
      description: "Proteção intensa contra o ressecamento, proporcionando elasticidade e maciez.",
      fullDescription: "Originária da savana africana, a Manteiga de Karité é um tesouro para a pele seca. É composta por uma mistura complexa de ácidos graxos e vitaminas A e E. Atua como um filtro solar natural leve e é um ingrediente indispensável para prevenir estrias e tratar áreas extremamente ressecadas como cotovelos e calcanhares.",
      image: "/attached_assets/stock_images/shea_butter_nuts.jpg",
      benefits: ["Ultra-hidratante", "Protetora", "Suavizante"],
      curiosity: "Na África, o Karité é conhecido como 'Ouro das Mulheres' porque sua extração e processamento sustentam comunidades femininas inteiras."
    },
    {
      id: 5,
      name: "Alecrim",
      description: "Estimulante natural que revigora a pele e auxilia na circulação.",
      fullDescription: "O Alecrim é um poderoso antioxidante e tônico. Na pele, ajuda a tonificar e firmar os tecidos, enquanto no couro cabeludo estimula a circulação sanguínea, auxiliando no crescimento saudável dos fios e no combate à caspa.",
      image: "/attached_assets/stock_images/rosemary_sprig.jpg",
      benefits: ["Tonificante", "Antioxidante", "Estimulante"],
      curiosity: "Na Grécia antiga, estudantes usavam ramos de alecrim no cabelo para melhorar a memória durante os exames."
    },
    {
      id: 6,
      name: "Calêndula",
      description: "Cuidado gentil para peles sensíveis e delicadas.",
      fullDescription: "Conhecida por suas propriedades anti-inflamatórias, a Calêndula é o ingrediente perfeito para acalmar peles sensibilizadas, irritadas ou com dermatites. É muito utilizada em produtos infantis e pós-sol por sua suavidade extrema.",
      image: "/attached_assets/stock_images/calendula_flowers.jpg",
      benefits: ["Anti-inflamatória", "Suave", "Regeneradora"],
      curiosity: "As flores de calêndula se abrem ao sol e se fecham à noite, sendo chamadas de 'relógio dos fazendeiros'."
    }
  ];

  return (
    <main>
      <Header />
      <div className={styles.materiaContainer}>
        <section className={styles.hero}>
          <div className="container">
            <h1>Nossa Matéria-Prima</h1>
            <p className={styles.subtitle}>Clique em cada ingrediente para descobrir seus segredos e benefícios.</p>
          </div>
        </section>

        <section className={styles.gridSection}>
          <div className="container">
            <div className={styles.cardsGrid}>
              {materiasPrimas.map((item) => (
                <div 
                  key={item.id} 
                  className={`${styles.card} ${selectedIngredient?.id === item.id ? styles.activeCard : ''}`}
                  onClick={() => setSelectedIngredient(selectedIngredient?.id === item.id ? null : item)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.cardImage}>
                    <div style={{ position: 'relative', width: '100%', height: '240px' }}>
                      <Image 
                        src={item.image} 
                        alt={item.name}
                        fill
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          // Fallback to emoji if image fails
                          e.target.style.display = 'none';
                        }}
                      />
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
                    
                    {selectedIngredient?.id === item.id && (
                      <div className={styles.expandedContent}>
                        <hr className={styles.divider} />
                        <h4>Sobre este ingrediente</h4>
                        <p>{item.fullDescription}</p>
                        <div className={styles.curiosityBox}>
                          <strong>Curiosidade:</strong> {item.curiosity}
                        </div>
                      </div>
                    )}
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
