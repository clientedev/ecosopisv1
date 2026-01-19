"use client";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";

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

  const activeQuestions = quizType === "pele" ? questionsPele : questionsCabelo;

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/products/`);
      const allProducts = await res.json();
      
      // Filtrar produtos que correspondem às tags mais frequentes
      let recommendations = allProducts.filter((p: any) => {
        if (!p.tags) return false;
        const pTags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags);
        // Prioridade para as 2 principais tags do usuário
        return pTags.some((t: string) => sortedTags.slice(0, 2).includes(t));
      });

      // Garantir diversidade se tiver poucos resultados
      if (recommendations.length < 2) {
        recommendations = allProducts.filter((p: any) => {
          const pTags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags);
          return pTags.some((t: string) => sortedTags.includes(t)) || pTags.includes("todos-os-tipos");
        });
      }

      setResult(recommendations.slice(0, 4));
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!quizType) {
    return (
      <main>
        <Header />
        <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '40px', color: '#2d5a27' }}>O QUE VAMOS CUIDAR HOJE?</h1>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button 
              className={styles.optionBtn} 
              style={{ padding: '40px', fontSize: '1.5rem', minWidth: '250px' }}
              onClick={() => setQuizType("pele")}
            >
              🌿 MINHA PELE
            </button>
            <button 
              className={styles.optionBtn} 
              style={{ padding: '40px', fontSize: '1.5rem', minWidth: '250px' }}
              onClick={() => setQuizType("cabelo")}
            >
              ✨ MEU CABELO
            </button>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <Header />
      <div className="container" style={{ padding: '100px 0', maxWidth: '800px' }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <h2>Analisando seu perfil...</h2>
            <p>Buscando os melhores ativos botânicos para você.</p>
          </div>
        ) : result.length === 0 ? (
          <div className={styles.quizBox}>
            <span className="scientific-badge">PASSO {step + 1} DE {activeQuestions.length}</span>
            <h2 className={styles.question}>{activeQuestions[step].question}</h2>
            <div className={styles.options}>
              {activeQuestions[step].options.map((opt, idx) => (
                <button 
                  key={idx} 
                  className={styles.optionBtn}
                  onClick={() => handleAnswer(opt)}
                >
                  {opt.text}
                </button>
              ))}
            </div>
            <button 
              style={{ marginTop: '20px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
              onClick={() => { setQuizType(null); setStep(0); setAnswers([]); }}
            >
              ← Voltar ao início
            </button>
          </div>
        ) : (
          <div className={styles.resultBox}>
            <h2 className={styles.resultTitle}>SEU RESULTADO</h2>
            <p className={styles.resultText}>
              Com base no seu perfil, selecionamos estes produtos de alta performance para sua rotina:
            </p>
            
            <div className={styles.recommendationsGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '30px 0' }}>
              {result.map((product) => (
                <div key={product.id} className={styles.productCard} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ position: 'relative', height: '150px', marginBottom: '10px' }}>
                    <Image 
                      src={product.image_url} 
                      alt={product.name} 
                      fill 
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <h3 style={{ fontSize: '1rem', margin: '10px 0' }}>{product.name}</h3>
                  <p style={{ color: '#2d5a27', fontWeight: 'bold' }}>R$ {product.price.toFixed(2)}</p>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '8px 15px', fontSize: '0.8rem', marginTop: '10px' }}
                    onClick={() => window.location.href=`/produtos/${product.slug}`}
                  >
                    Ver Detalhes
                  </button>
                </div>
              ))}
            </div>

            <button className="btn-secondary" onClick={() => window.location.reload()}>
              REFAZER QUIZZ
            </button>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
