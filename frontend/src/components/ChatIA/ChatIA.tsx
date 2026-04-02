"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./ChatIA.module.css";
import Image from "next/image";

export default function ChatIA() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Olá! Eu sou a Lia, sua consultora de beleza ECOSOPIS. Como posso cuidar de você hoje?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: "user", content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input })
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
                content: "Desculpe, tive um problema de conexão. Poderia tentar novamente?"
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                className={styles.chatButton}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Converse com a Lia"
            >
                <div className={styles.buttonContent}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={styles.chatIcon}
                    >
                        <path
                            d="M12 21C15.5 21 18.5 19 20 16L22 16.5L21 14.5C21.6 13.5 22 12.3 22 11C22 6 17.5 2 12 2C6.5 2 2 6 2 11C2 13.5 3 15.8 4.7 17.5L3.5 21L7 20C8.5 20.6 10.2 21 12 21Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <span className={styles.btnText}>Converse com a Lia</span>
                </div>
            </button>

            {isOpen && (
                <div className={styles.chatWindow}>
                    <div className={styles.chatHeader}>
                        <div className={styles.headerInfo}>
                            <div className={styles.avatarContainer}>
                                <Image 
                                    src="/lia.png" 
                                    alt="Lia" 
                                    width={40} 
                                    height={40} 
                                    className={styles.miniAvatar}
                                />
                                <div className={styles.onlineStatus}></div>
                            </div>
                            <div className={styles.headerTitles}>
                                <h3>Lia</h3>
                                <span>Consultora ECOSOPIS</span>
                            </div>
                        </div>
                        <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
                    </div>

                    <div className={styles.chatMessages} ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                            >
                                {msg.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div className={`${styles.message} ${styles.assistantMessage} ${styles.typing}`}>
                                <span></span><span></span><span></span>
                            </div>
                        )}
                    </div>

                    <div className={styles.chatInput}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Tire suas dúvidas aqui..."
                            disabled={isLoading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading}
                            className={isLoading ? styles.loadingBtn : ""}
                        >
                            {isLoading ? "..." : "Enviar"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
