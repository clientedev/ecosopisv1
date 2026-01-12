"use client";
import { useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

const questions = [
  {
    id: 1,
    question: "Como você sente sua pele ao acordar?",
    options: [
      { text: "Oleosa em todo o rosto", type: "oily" },
      { text: "Oleosa apenas na zona T", type: "mixed" },
      { text: "Normal/Equilibrada", type: "normal" },
      { text: "Seca ou repuxando", type: "dry" },
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
  const [result, setResult] = useState<string | null>(null);

  const handleAnswer = (answer: any) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      processResult(newAnswers);
    }
  };

  const processResult = (finalAnswers: any) => {
    // Simple logic for recommendation
    const skinType = finalAnswers[0].type;
    setResult(`Seu tipo de pele é ${skinType}. Recomendamos nossa linha de limpeza profunda e sérum hidratante leve.`);
  };

  return (
    <main>
      <Header />
      <div className="container" style={{ padding: '100px 0', maxWidth: '600px' }}>
        {!result ? (
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
            <p className={styles.resultText}>{result}</p>
            <button className="btn-primary" onClick={() => window.location.href='/produtos'}>
              VER MEUS PRODUTOS IDEAIS
            </button>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
