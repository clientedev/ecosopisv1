"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./ChatIA.module.css";
import Image from "next/image";

import { usePathname } from "next/navigation";

interface ChatIAProps {
    isOpen?: boolean;
    onToggle?: () => void;
}

export default function ChatIA({ isOpen: controlledOpen, onToggle }: ChatIAProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const pathname = usePathname();
    const isHomePage = pathname === "/";


    const [messages, setMessages] = useState([
        { role: "assistant", content: "Olá! Eu sou a Lia 🌿 Sua consultora de beleza natural da Ecosopis. Pode me contar qual é o seu maior desafio com a pele agora?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setInternalOpen(prev => !prev);
        }
    };

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
                content: "Desculpe, tive um probleminha de conexão. Pode tentar novamente? 🌿"
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                className={styles.chatButton}
                onClick={handleToggle}
                aria-label="Converse com a Lia"
                data-animated={isHomePage ? "true" : "false"}
            >
                <div className={styles.buttonContent}>
                    <div className={styles.chatIconWrapper}>
                        <Image
                            src="/lia.jpg"
                            alt="Lia"
                            width={28}
                            height={28}
                            className={styles.chatIcon}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span className={styles.onlineDot}></span>
                    </div>
                    <span className={styles.btnText}>Fale com a Lia</span>
                </div>
            </button>

            {isOpen && (
                <div className={styles.chatWindow}>
                    <div className={styles.chatHeader}>
                        <div className={styles.headerInfo}>
                            <div className={styles.avatarContainer}>
                                <Image
                                    src="/lia.jpg"
                                    alt="Lia"
                                    width={40}
                                    height={40}
                                    className={styles.miniAvatar}
                                />
                                <div className={styles.onlineStatus}></div>
                            </div>
                            <div className={styles.headerTitles}>
                                <h3>Lia</h3>
                                <span>Consultora ECOSOPIS • online agora</span>
                            </div>
                        </div>
                        <button className={styles.closeBtn} onClick={handleToggle}>✕</button>
                    </div>

                    <div className={styles.chatMessages} ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className={styles.msgAvatar}>
                                        <Image src="/lia.jpg" alt="Lia" width={22} height={22} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <span>{msg.content}</span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className={`${styles.message} ${styles.assistantMessage} ${styles.typing}`}>
                                <div className={styles.msgAvatar}>
                                    <Image src="/lia.jpg" alt="Lia" width={22} height={22} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                </div>
                                <span><span></span><span></span><span></span></span>
                            </div>
                        )}
                    </div>

                    <div className={styles.chatInput}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Me conta qual é sua dúvida..."
                            disabled={isLoading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading}
                            className={isLoading ? styles.loadingBtn : ""}
                        >
                            {isLoading ? "..." : "➤"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
