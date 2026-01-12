"use client";
import { useState } from "react";
import styles from "./ChatIA.module.css";

export default function ChatIA() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Olá! Sou a consultora de beleza da ECOSOPIS. Como posso ajudar você hoje?" }
    ]);
    const [input, setInput] = useState("");

    const sendMessage = () => {
        if (!input.trim()) return;

        setMessages([...messages, { role: "user", content: input }]);
        setInput("");

        // Simulate AI response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Obrigada pela sua pergunta! Para uma resposta personalizada, recomendo nosso Quizz de Pele. 🌿"
            }]);
        }, 1000);
    };

    return (
        <>
            <button
                className={styles.chatButton}
                onClick={() => setIsOpen(!isOpen)}
            >
                💬
            </button>

            {isOpen && (
                <div className={styles.chatWindow}>
                    <div className={styles.chatHeader}>
                        <h3>Consultora ECOSOPIS</h3>
                        <button onClick={() => setIsOpen(false)}>✕</button>
                    </div>

                    <div className={styles.chatMessages}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                            >
                                {msg.content}
                            </div>
                        ))}
                    </div>

                    <div className={styles.chatInput}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Digite sua pergunta..."
                        />
                        <button onClick={sendMessage}>Enviar</button>
                    </div>
                </div>
            )}
        </>
    );
}
