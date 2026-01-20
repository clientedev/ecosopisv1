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
      image: "/attached_assets/generated_images/lavender_flowers_field_photography.png",
      benefits: ["Calmante", "Antisséptica", "Cicatrizante"],
      curiosity: "São necessários cerca de 150kg de flores de lavanda para produzir apenas 1kg de óleo essencial puro."
    },
    {
      id: 2,
      name: "Óleo de Coco Orgânico",
      description: "Hidratação profunda e natural, rico em ácidos graxos que nutrem a barreira cutânea.",
      fullDescription: "Extraído da polpa do coco fresco, nosso óleo de coco é prensado a frio para manter todas as suas vitaminas e antioxidantes. Rico em ácido láurico, possui propriedades antibacterianas naturais e penetra profundamente nos fios de cabelo e camadas da pele, proporcionando uma hidratação que dura o dia todo.",
      image: "/attached_assets/generated_images/organic_coconut_oil_in_a_glass_jar.png",
      benefits: ["Hidratante", "Nutritivo", "Antifúngico"],
      curiosity: "O óleo de coco é um dos poucos óleos que consegue penetrar no eixo do cabelo, reduzindo a perda de proteína."
    },
    {
      id: 3,
      name: "Argila Verde",
      description: "Poderosa ação desintoxicante e controle de oleosidade para peles mistas e oleosas.",
      fullDescription: "A Argila Verde é rica em diversos minerais como silício, magnésio e ferro. Sua cor deve-se à presença de óxido de ferro associado ao magnésio e cálcio. Possui ação absorvente, combatendo edemas, sendo secativa, emoliente, antisséptica, bactericida, analgésica e cicatrizante no tratamento de peles oleosas e acnéicas.",
      image: "/attached_assets/generated_images/green_clay_powder_in_a_wooden_bowl.png",
      benefits: ["Detox", "Controle de brilho", "Remineralizante"],
      curiosity: "A argila verde é extraída de rochas vulcânicas e é considerada a mais rica em minerais entre todas as cores de argila."
    },
    {
      id: 4,
      name: "Manteiga de Karité",
      description: "Proteção intensa contra o ressecamento, proporcionando elasticidade e maciez.",
      fullDescription: "Originária da savana africana, a Manteiga de Karité é um tesouro para a pele seca. É composta por uma mistura complexa de ácidos graxos e vitaminas A e E. Atua como um filtro solar natural leve e é um ingrediente indispensável para prevenir estrias e tratar áreas extremamente ressecadas como cotovelos e calcanhares.",
      image: "/attached_assets/generated_images/shea_butter_nuts_and_raw_butter.png",
      benefits: ["Ultra-hidratante", "Protetora", "Suavizante"],
      curiosity: "Na África, o Karité é conhecido como 'Ouro das Mulheres' porque sua extração e processamento sustentam comunidades femininas inteiras."
    },
    {
      id: 5,
      name: "Alecrim",
      description: "Estimulante natural que revigora a pele e auxilia na circulação.",
      fullDescription: "O Alecrim é um poderoso antioxidante e tônico. Na pele, ajuda a tonificar e firmar os tecidos, enquanto no couro cabeludo estimula a circulação sanguínea, auxiliando no crescimento saudável dos fios e no combate à caspa.",
      image: "/attached_assets/generated_images/fresh_rosemary_sprigs_on_a_table.png",
      benefits: ["Tonificante", "Antioxidante", "Estimulante"],
      curiosity: "Na Grécia antiga, estudantes usavam ramos de alecrim no cabelo para melhorar a memória durante os exames."
    },
    {
      id: 6,
      name: "Calêndula",
      description: "Cuidado gentil para peles sensíveis e delicadas.",
      fullDescription: "Conhecida por suas propriedades anti-inflamatórias, a Calêndula é o ingrediente perfeito para acalmar peles sensibilizadas, irritadas ou com dermatites. É muito utilizada em produtos infantis e pós-sol por sua suavidade extrema.",
      image: "/attached_assets/generated_images/orange_calendula_flowers_close-up.png",
      benefits: ["Anti-inflamatória", "Suave", "Regeneradora"],
      curiosity: "As flores de calêndula se abrem ao sol e se fecham à noite, sendo chamadas de 'relógio dos fazendeiros'."
    },
    {
      id: 7,
      name: "Aloe Vera (Babosa)",
      description: "Hidratação profunda e efeito calmante para todos os tipos de pele.",
      fullDescription: "A Aloe Vera é rica em polissacarídeos, vitaminas e minerais. Seu gel tem propriedades hidratantes, calmantes e refrescantes. É excelente para hidratar sem pesar e acalmar a pele após exposição solar ou depilação.",
      image: "/attached_assets/generated_images/aloe_vera_plant_close-up.png",
      benefits: ["Hidratante", "Refrescante", "Calmante"],
      curiosity: "Cleópatra considerava a Aloe Vera o 'segredo de sua beleza' e a usava em seus banhos diários."
    },
    {
      id: 8,
      name: "Óleo de Amêndoas Doces",
      description: "Elasticidade e nutrição profunda para peles secas e gestantes.",
      fullDescription: "Rico em vitaminas A e B, o Óleo de Amêndoas Doces tem alto poder de penetração. É ideal para massagens e para prevenir estrias, mantendo a pele macia e elástica.",
      image: "/attached_assets/generated_images/sweet_almond_oil_in_a_bottle_with_almonds.png",
      benefits: ["Nutritivo", "Elastizante", "Suavizante"],
      curiosity: "É um dos óleos mais antigos utilizados pela humanidade para cuidados com a pele, datando de civilizações egípcias."
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
                        unoptimized
                      />
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
                    
                    <div 
                      className={styles.expandedContent}
                      style={{ 
                        maxHeight: selectedIngredient?.id === item.id ? '1000px' : '0',
                        overflow: 'hidden',
                        transition: 'max-height 0.5s ease-in-out',
                        opacity: selectedIngredient?.id === item.id ? 1 : 0,
                        marginTop: selectedIngredient?.id === item.id ? '20px' : '0'
                      }}
                    >
                      <hr className={styles.divider} />
                      <h4>Sobre este ingrediente</h4>
                      <p>{item.fullDescription}</p>
                      <div className={styles.curiosityBox}>
                        <strong>Curiosidade:</strong> {item.curiosity}
                      </div>
                    </div>
                    
                    <div className={styles.cardFooter}>
                      <span className={styles.readMore}>
                        {selectedIngredient?.id === item.id ? "Ver menos" : "Ver mais detalhes"}
                      </span>
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
