"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./ChatIA.module.css";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

interface ChatIAProps {
    isOpen?: boolean;
    onToggle?: () => void;
}

const getMentionedProducts = (content: string, products: any[]) => {
    if (!content || !products?.length) return [];
    const cleanContent = content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matches: any[] = [];
    const keywordMap: Record<string, string[]> = {
        "sabonete-acafrao-dolomita": ["acafrao", "acafrão"],
        "sabonete-clareador-argila-branca": ["argila branca"],
        "sabonete-intimo-barbatimao": ["sabonete intimo", "barbatimao"],
        "sabonete-argila-verde": ["argila verde"],
        "sabonete-carvao-ativado": ["carvao", "carvão"],
        "sabonete-rosa-mosqueta-argila-rosa": ["argila rosa"],
        "sabonete-liquido-barbatimao": ["sabonete liquido"],
        "creme-oleosidade-acne": ["creme para oleosidade", "creme para acne", "creme acne"],
        "creme-pes-de-anjo": ["pes de anjo", "creme para pes", "rachadura"],
        "desodorante-clareador-solido": ["desodorante"],
        "tonico-facial-antioxidante": ["tonico", "tônico"],
        "manteiga-ojon": ["ojon"],
        "oleo-rosa-mosqueta-puro": ["rosa mosqueta 100%", "rosa mosqueta puro"],
        "oleo-rosa-mosqueta-20ml": ["rosa mosqueta 20ml"],
        "refil-rosa-mosqueta": ["refil rosa mosqueta"],
        "oleo-alecrim": ["oleo de alecrim", "oleo alecrim"],
        "oleo-semente-uva": ["semente de uva"],
        "oleo-ricino": ["ricino"],
        "oleo-abacate": ["abacate"],
        "oleo-argan": ["argan"],
        "oe-lavanda": ["lavanda"],
        "oe-menta": ["menta", "hortela"],
        "oe-melaleuca": ["melaleuca", "tea tree"],
        "oe-laranja": ["laranja"],
        "kit-acne": ["kit acne", "kit para acne"],
        "kit-acafrao-argila": ["kit sabonetes"],
        "kit-clareamento": ["kit clareamento", "kit clareador"],
        "kit-60-sabonetes": ["60 unidades"],
        "kit-atacado-geral": ["kit atacado"]
    };
    products.forEach(p => {
        const slug = p.slug;
        const keywords = keywordMap[slug] || [];
        const keywordMatch = keywords.some(kw => cleanContent.includes(kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
        const nameClean = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const exactMatch = cleanContent.includes(nameClean);
        const isGeneralRosaMosqueta = slug.includes("rosa-mosqueta") && cleanContent.includes("rosa mosqueta");
        if ((keywordMatch || exactMatch || isGeneralRosaMosqueta) && !matches.some(m => m.id === p.id)) {
            matches.push(p);
        }
    });
    return matches;
};

export default function ChatIA({ isOpen: controlledOpen, onToggle }: ChatIAProps = {}) {
    const { addToCart } = useCart();
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/products")
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(() => {});
    }, []);
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
                            width={56}
                            height={56}
                            className={styles.chatIcon}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                        {isHomePage && (
                            <Image
                                src="/static/attached_assets/generated_images/lia_avatar.webp"
                                alt="Lia Animada"
                                width={56}
                                height={56}
                                className={styles.chatIconAnimated}
                                style={{ borderRadius: '50%', objectFit: 'cover' }}
                                priority
                                unoptimized
                            />
                        )}
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
                        {messages.map((msg, idx) => {
                            const mentionedProducts = msg.role === 'assistant'
                                ? getMentionedProducts(msg.content, products)
                                : [];
                            return (
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
                                    {mentionedProducts.length > 0 && (
                                        <div className={styles.productCards}>
                                            {mentionedProducts.map(p => (
                                                <div key={p.id} className={styles.productCard}>
                                                    <img src={p.image_url || "/placeholder.jpg"} alt={p.name} className={styles.productCardImg} />
                                                    <div className={styles.productCardInfo}>
                                                        <span className={styles.productCardName}>{p.name}</span>
                                                        <span className={styles.productCardPrice}>R$ {p.price.toFixed(2).replace('.', ',')}</span>
                                                    </div>
                                                    <button
                                                        className={styles.productCardBtn}
                                                        onClick={() => addToCart(p)}
                                                    >
                                                        + Carrinho
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
