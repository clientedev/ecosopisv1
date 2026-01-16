"use client";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";

const questions = [
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
  }
];

export default function QuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<any>([]);
  const [result, setResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [skinTypeLabel, setSkinTypeLabel] = useState("");

  const handleAnswer = (answer: any) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      processResult(newAnswers);
    }
  };

  const processResult = async (finalAnswers: any) => {
    setLoading(true);
    const skinTag = finalAnswers[0].type;
    const concernTag = finalAnswers[1].concern;
    
    setSkinTypeLabel(finalAnswers[0].text.toLowerCase());

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/products/`);
      const allProducts = await res.json();
      
      // Filter products based on tags
      const recommendations = allProducts.filter((p: any) => {
        if (!p.tags) return false;
        const tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags);
        return tags.includes(skinTag) || tags.includes(concernTag) || tags.includes("todos-os-tipos-de-pele");
      });

      setResult(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Header />
      <div className="container" style={{ padding: '100px 0', maxWidth: '800px' }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <h2>Analisando sua pele...</h2>
            <p>Buscando os melhores ativos botânicos para você.</p>
          </div>
        ) : result.length === 0 ? (
          <div className={styles.quizBox}>
            <span className="scientific-badge">PASSO {step + 1} DE {questions.length}</span>
            <h2 className={styles.question}>{questions[step].question}</h2>
            <div className={styles.options}>
              {questions[step].options.map((opt, idx) => (
                <button 
                  key={idx} 
                  className={styles.optionBtn}
                  onClick={() => handleAnswer(opt)}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.resultBox}>
            <h2 className={styles.resultTitle}>SEU RESULTADO</h2>
            <p className={styles.resultText}>
              Identificamos que sua pele está <strong>{skinTypeLabel}</strong>. 
              Com base nisso, selecionamos estes produtos de alta performance para sua rotina:
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
