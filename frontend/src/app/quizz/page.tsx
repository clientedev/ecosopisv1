"use client";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";
import { useCart } from "@/context/CartContext";

const questionsPele = [
  {
    id: 1,
    question: "Como você sente sua pele ao acordar?",
    options: [
      { text: "Oleosa em todo o rosto", type: "skin:oily" },
      { text: "Oleosa apenas na zona T", type: "skin:mixed" },
      { text: "Normal/Equilibrada", type: "skin:normal" },
      { text: "Seca ou repuxando", type: "skin:dry" },
    ]
  },
  {
    id: 2,
    question: "Qual sua maior preocupação hoje?",
    options: [
      { text: "Acne e cravos", concern: "acne" },
      { text: "Manchas e tom irregular", concern: "spots" },
      { text: "Linhas de expressão", concern: "aging" },
      { text: "Sensibilidade e vermelhidão", concern: "sensitivity" },
    ]
  },
  {
    id: 3,
    question: "Com que frequência você usa protetor solar?",
    options: [
      { text: "Todos os dias", type: "skin:protected" },
      { text: "Às vezes", type: "skin:exposed" },
      { text: "Quase nunca", type: "skin:vulnerable" },
    ]
  },
  {
    id: 4,
    question: "Como você descreveria seus poros?",
    options: [
      { text: "Dilatados e visíveis", type: "skin:oily" },
      { text: "Visíveis apenas no nariz", type: "skin:mixed" },
      { text: "Quase imperceptíveis", type: "skin:normal" },
      { text: "Pequenos, mas com descamação", type: "skin:dry" },
    ]
  },
  {
    id: 5,
    question: "Sua pele costuma ficar irritada com facilidade?",
    options: [
      { text: "Sim, muito sensível", type: "sensitivity" },
      { text: "Às vezes, dependendo do produto", type: "sensitivity" },
      { text: "Raramente", type: "skin:normal" },
      { text: "Nunca", type: "skin:normal" },
    ]
  },
  {
    id: 6,
    question: "Qual sua faixa etária?",
    options: [
      { text: "Menos de 25 anos", type: "acne" },
      { text: "25 a 40 anos", type: "antioxidante" },
      { text: "Mais de 40 anos", type: "aging" },
    ]
  },
  {
    id: 7,
    question: "Como sua pele reage ao sol?",
    options: [
      { text: "Fica vermelha e arde", type: "sensitivity" },
      { text: "Fica vermelha e depois bronzeia", type: "skin:mixed" },
      { text: "Bronzeia com facilidade", type: "skin:normal" },
    ]
  },
  {
    id: 8,
    question: "Você costuma sentir a pele 'repuxar' após a limpeza?",
    options: [
      { text: "Sempre", type: "skin:dry" },
      { text: "Às vezes", type: "skin:mixed" },
      { text: "Raramente", type: "skin:normal" },
      { text: "Pelo contrário, sinto alívio", type: "skin:oily" },
    ]
  },
  {
    id: 9,
    question: "Qual o seu principal objetivo com o tratamento?",
    options: [
      { text: "Controlar oleosidade e acne", type: "acne" },
      { text: "Clarear manchas", type: "spots" },
      { text: "Reduzir rugas e firmeza", type: "aging" },
      { text: "Hidratação intensa", type: "hidratante" },
    ]
  },
  {
    id: 10,
    question: "Você faz uso de maquiagem diariamente?",
    options: [
      { text: "Sim, maquiagem pesada", type: "skin:oily" },
      { text: "Sim, maquiagem leve", type: "skin:normal" },
      { text: "Apenas ocasionalmente", type: "skin:normal" },
      { text: "Não uso", type: "skin:normal" },
    ]
  }
];

const questionsCabelo = [
  {
    id: 1,
    question: "Como é a raiz do seu cabelo?",
    options: [
      { text: "Oleosa (preciso lavar todo dia)", type: "hair:oily" },
      { text: "Normal", type: "hair:normal" },
      { text: "Seca", type: "hair:dry" },
    ]
  },
  {
    id: 2,
    question: "Seu cabelo possui química?",
    options: [
      { text: "Sim, coloração ou descoloração", type: "hair:colored" },
      { text: "Sim, progressiva ou alisamento", type: "hair:processed" },
      { text: "Não, é natural", type: "hair:natural" },
    ]
  },
  {
    id: 3,
    question: "Qual o principal problema que você nota?",
    options: [
      { text: "Queda ou quebra", concern: "hair:damaged" },
      { text: "Frizz e falta de brilho", concern: "hair:dry" },
      { text: "Oleosidade excessiva", concern: "hair:oily" },
      { text: "Ponta dupla", concern: "hair:split" },
    ]
  },
  {
    id: 4,
    question: "Qual o seu tipo de curvatura?",
    options: [
      { text: "Liso", type: "hair:straight" },
      { text: "Ondulado", type: "hair:wavy" },
      { text: "Cacheado", type: "hair:curly" },
      { text: "Crespo", type: "hair:coily" },
    ]
  },
  {
    id: 5,
    question: "Com que frequência você lava o cabelo?",
    options: [
      { text: "Diariamente", type: "hair:oily" },
      { text: "Dia sim, dia não", type: "hair:normal" },
      { text: "2 a 3 vezes por semana", type: "hair:dry" },
    ]
  },
  {
    id: 6,
    question: "Você usa ferramentas de calor (chapinha/secador)?",
    options: [
      { text: "Uso diariamente", type: "hair:damaged" },
      { text: "Uso frequentemente", type: "hair:dry" },
      { text: "Uso raramente", type: "hair:normal" },
      { text: "Não uso", type: "hair:natural" },
    ]
  },
  {
    id: 7,
    question: "Como você sente as pontas do seu cabelo?",
    options: [
      { text: "Secas e ásperas", type: "hair:dry" },
      { text: "Espigadas e com pontas duplas", type: "hair:split" },
      { text: "Macias e saudáveis", type: "hair:normal" },
    ]
  },
  {
    id: 8,
    question: "Seu cabelo embaraça com facilidade?",
    options: [
      { text: "Sim, muito", type: "hair:dry" },
      { text: "Apenas após a lavagem", type: "hair:normal" },
      { text: "Não, quase nunca", type: "hair:normal" },
    ]
  },
  {
    id: 9,
    question: "Qual o volume do seu cabelo?",
    options: [
      { text: "Pouco volume / Fios finos", type: "hair:fine" },
      { text: "Volume médio", type: "hair:normal" },
      { text: "Muito volume / Fios grossos", type: "hair:thick" },
    ]
  },
  {
    id: 10,
    question: "Qual o seu objetivo capilar?",
    options: [
      { text: "Crescimento e força", type: "hair:damaged" },
      { text: "Hidratação e brilho", type: "hair:dry" },
      { text: "Definição", type: "hair:curly" },
      { text: "Controle de frizz", type: "hair:dry" },
    ]
  }
];

export default function QuizPage() {
  const [quizType, setQuizType] = useState<"pele" | "cabelo" | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<any>([]);
  const [result, setResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultLabel, setResultLabel] = useState("");
  const { addToCart: contextAddToCart } = useCart();

  const activeQuestions = quizType === "pele" ? questionsPele : questionsCabelo;
  const progress = (step / activeQuestions.length) * 100;

  const handleAnswer = (answer: any) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    if (step < activeQuestions.length - 1) {
      setStep(step + 1);
    } else {
      processResult(newAnswers);
    }
  };

  const processResult = async (finalAnswers: any) => {
    setLoading(true);
    
    // Contagem de tags para recomendação inteligente
    const tagCounts: { [key: string]: number } = {};
    finalAnswers.forEach((a: any) => {
      const tag = a.type || a.concern;
      if (tag) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });

    // Ordenar tags por relevância
    const sortedTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag);

    try {
      // Usar o rewrite configurado no next.config.mjs
      const res = await fetch('/api/products');
      const allProducts = await res.json();
      
      // Filtrar produtos que correspondem às tags mais frequentes
      let recommendations = allProducts.filter((p: any) => {
        if (!p.tags) return false;
        const pTags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags);
        return pTags.some((t: string) => sortedTags.slice(0, 2).includes(t));
      }).map((p: any) => {
        // Adicionar explicação baseada nas tags
        const pTags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags);
        const matchedTags = pTags.filter((t: string) => sortedTags.includes(t));
        
        let reason = "Ideal para o seu perfil.";
        if (matchedTags.includes('acne')) reason = "Ajuda no controle ativo de espinhas e inflamações.";
        else if (matchedTags.includes('skin:oily')) reason = "Equilibra a oleosidade excessiva sem ressecar.";
        else if (matchedTags.includes('spots')) reason = "Atua na uniformização do tom e clareamento de manchas.";
        else if (matchedTags.includes('hair:damaged')) reason = "Restaura a fibra capilar e devolve a força aos fios.";
        else if (matchedTags.includes('hair:dry')) reason = "Nutrição profunda para cabelos que precisam de brilho.";
        else if (matchedTags.includes('sensitivity')) reason = "Fórmula calmante para peles que irritam facilmente.";
        
        return { ...p, explanation: reason };
      });

      // Garantir diversidade se tiver poucos resultados
      if (recommendations.length < 2) {
        recommendations = allProducts.filter((p: any) => {
          const pTags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags);
          return pTags.some((t: string) => sortedTags.includes(t)) || pTags.includes("todos-os-tipos");
        }).map((p: any) => ({ ...p, explanation: "Essencial para manter sua rotina equilibrada." }));
      }

      setResult(recommendations.slice(0, 4));
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: any) => {
    contextAddToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url
    });
  };

  const addAllToCart = () => {
    result.forEach((product: any) => {
      contextAddToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url
      });
    });
  };

  if (!quizType) {
    return (
      <main className={styles.main}>
        <Header />
        <div className={styles.heroContainer}>
          <div className={styles.floatingLeaves}>
            <span className={styles.leaf}>🌿</span>
            <span className={styles.leaf}>🌸</span>
            <span className={styles.leaf}>🍃</span>
          </div>
          <h1 className={styles.mainTitle}>SEU MOMENTO DE AUTOCUIDADO</h1>
          <p className={styles.subtitle}>Vamos descobrir o que sua beleza natural precisa hoje?</p>
          <div className={styles.choiceGrid}>
            <button 
              className={styles.choiceCard}
              onClick={() => setQuizType("pele")}
            >
              <div className={styles.iconWrapper}>🌿</div>
              <h3>MINHA PELE</h3>
              <p>Rotina facial personalizada</p>
            </button>
            <button 
              className={styles.choiceCard}
              onClick={() => setQuizType("cabelo")}
            >
              <div className={styles.iconWrapper}>✨</div>
              <h3>MEU CABELO</h3>
              <p>Cronograma capilar botânico</p>
            </button>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.quizWrapper}>
        <div className={styles.progressContainer}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
          <span className={styles.progressText}>Sua jornada: {Math.round(progress)}%</span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <h2>Sincronizando com a Natureza...</h2>
            <p>Nossa IA está combinando ativos botânicos para seu perfil.</p>
          </div>
        ) : result.length === 0 ? (
          <div className={styles.quizCard}>
            <div className={styles.stepBadge}>PASSO {step + 1} DE {activeQuestions.length}</div>
            <h2 className={styles.questionText}>{activeQuestions[step].question}</h2>
            <div className={styles.optionsGrid}>
              {activeQuestions[step].options.map((opt, idx) => (
                <button 
                  key={idx} 
                  className={styles.optionButton}
                  onClick={() => handleAnswer(opt)}
                >
                  <span className={styles.optionIndicator}>{String.fromCharCode(65 + idx)}</span>
                  {opt.text}
                </button>
              ))}
            </div>
            <button 
              className={styles.backButton}
              onClick={() => { setQuizType(null); setStep(0); setAnswers([]); }}
            >
              ← Voltar ao início
            </button>
          </div>
        ) : (
          <div className={styles.resultAnimation}>
            <div className={styles.resultActions}>
              <div className={styles.successBadge}>✨ Recomendação Pronta</div>
              <button className={styles.addAllBtn} onClick={addAllToCart}>
                🛒 ADICIONAR TUDO AO CARRINHO
              </button>
            </div>
            <h2 className={styles.resultHeading}>SUA ROTINA IDEAL</h2>
            <p className={styles.resultDescription}>
              Selecionamos estes tesouros naturais para potencializar sua beleza única:
            </p>
            
            <div className={styles.recommendationList}>
              {result.map((product) => (
                <div key={product.id} className={styles.productGlassCard}>
                  <div className={styles.productImageFrame}>
                    <Image 
                      src={product.image_url} 
                      alt={product.name} 
                      fill 
                      style={{ objectFit: 'contain' }}
                      unoptimized
                    />
                  </div>
                  <div className={styles.productInfo}>
                    <h3>{product.name}</h3>
                    <p className={styles.explanationText}>{product.explanation}</p>
                    <p className={styles.productPrice}>R$ {product.price.toFixed(2)}</p>
                    <div className={styles.productActions}>
                      <button 
                        className={styles.detailsBtn}
                        onClick={() => window.location.href=`/produtos/${product.slug}`}
                      >
                        Ver Detalhes
                      </button>
                      <button 
                        className={styles.cartAddBtn}
                        onClick={() => addToCart(product)}
                        title="Adicionar ao carrinho"
                      >
                        🛒
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className={styles.restartBtn} onClick={() => window.location.reload()}>
              REFAZER JORNADA
            </button>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
