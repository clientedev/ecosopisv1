"use client";
import React, { useState, useRef, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./lia.module.css";
import Image from "next/image";
import { Send, Sparkles, MessageCircle, Info, Zap, Leaf } from "lucide-react";

const SUGGESTIONS = [
    { icon: <Leaf size={18} />, text: "Quais produtos são bons para pele seca?" },
    { icon: <Zap size={18} />, text: "Como funciona o desodorante natural?" },
    { icon: <Info size={18} />, text: "Quais os benefícios dos óleos essenciais?" },
    { icon: <MessageCircle size={18} />, text: "Dicas para uma rotina de skincare vegana." }
];

export default function LiaPage() {
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Olá! Eu sou a Lia, sua consultora de inteligência artificial da ECOSOPIS. Estou aqui para ajudar você a descobrir o melhor da beleza natural e científica. Como posso te ajudar hoje?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const sendMessage = async (text: string = input) => {
        const messageToSend = text.trim();
        if (!messageToSend || isLoading) return;

        const userMsg = { role: "user", content: messageToSend };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: messageToSend })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
            } else {
                throw new Error("Failed to get response");
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Poxa, tive um pequeno problema técnico. Pode tentar me perguntar de novo em alguns instantes?"
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageWrapper}>
            <Header />
            
            <main className={styles.mainContent}>
                <div className="container">
                    <div className={styles.liaContainer}>
                        {/* Sidebar / Info */}
                        <div className={styles.liaSidebar}>
                            <div className={styles.liaBranding}>
                                <div className={styles.liaAvatar}>
                                    <Image 
                                        src="/lia.png" 
                                        alt="LIA AI" 
                                        width={80} 
                                        height={80} 
                                        className={styles.avatarImg}
                                    />
                                    <div className={styles.onlineBadge}></div>
                                </div>
                                <h1>Lia AI</h1>
                                <p>Sua guia especializada na interseção entre o poder da botânica e a alta tecnologia cosmética.</p>
                                <div className={styles.natureTag}>
                                    <Leaf size={14} />
                                    <span>Ciência Natural Ativa</span>
                                </div>
                            </div>

                            <div className={styles.suggestionsSection}>
                                <h2>O que perguntar?</h2>
                                <div className={styles.suggestionsGrid}>
                                    {SUGGESTIONS.map((s, i) => (
                                        <button 
                                            key={i} 
                                            className={styles.suggestionItem}
                                            onClick={() => sendMessage(s.text)}
                                        >
                                            {s.icon}
                                            <span>{s.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Chat Interface */}
                        <div className={styles.chatWrapper}>
                            <div className={styles.chatMessages} ref={scrollRef}>
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                                    >
                                        <div className={styles.messageContent}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className={`${styles.message} ${styles.assistantMessage} ${styles.typing}`}>
                                        <span className={styles.dot}></span>
                                        <span className={styles.dot}></span>
                                        <span className={styles.dot}></span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.chatInputArea}>
                                <div className={styles.inputContainer}>
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                        placeholder="Pergunte qualquer coisa sobre nossos produtos ou rotinas..."
                                        disabled={isLoading}
                                    />
                                    <button 
                                        className={styles.sendButton}
                                        onClick={() => sendMessage()}
                                        disabled={isLoading || !input.trim()}
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                                <p className={styles.disclaimer}>
                                    A Lia pode cometer erros. Verifique informações importantes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className={styles.decorLeaf1}><Leaf size={120} /></div>
                <div className={styles.decorLeaf2}><Leaf size={80} /></div>
            </main>

            <Footer />
        </div>
    );
}
