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
    const tagsToSearch = finalAnswers.map((a: any) => a.type || a.concern).filter(Boolean);
    
    setResultLabel(finalAnswers[0].text.toLowerCase());

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/products/`);
      const allProducts = await res.json();
      
      const recommendations = allProducts.filter((p: any) => {
        if (!p.tags) return false;
        const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags);
        return tags.some((t: string) => tagsToSearch.includes(t)) || tags.includes("todos-os-tipos");
      });

      setResult(recommendations);
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
