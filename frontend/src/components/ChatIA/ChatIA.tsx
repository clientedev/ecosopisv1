"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./ChatIA.module.css";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

const WHATSAPP_NUMBER = "+55 11 95155-9212";
const WHATSAPP_LINK = "https://wa.me/5511951559212?text=Ol%C3%A1!%20Gostaria%20de%20atendimento%20humano%20na%20Ecosopis.";

const SUGGESTIONS = [
    { label: "🌿 Foliculite & Pelos", prompt: "O que posso usar para foliculite e pelos encravados?" },
    { label: "✨ Clarear Manchas", prompt: "Como clarear manchas e melasma de forma natural?" },
    { label: "🍃 Acne & Oleosidade", prompt: "Qual o melhor tratamento para acne e pele oleosa?" },
    { label: "💬 Atendimento Humano", isWhatsApp: true },
];

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

function renderFormattedText(text: string) {
    if (!text) return null;
    return text.split("\n").map((line, lineIdx) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
            <span key={lineIdx} style={{ display: "block", minHeight: line ? "auto" : "8px" }}>
                {parts.map((part, pIdx) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                        return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                })}
            </span>
        );
    });
}

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
        {
            role: "assistant",
            content: "Olá! Eu sou a Lia 🌿 Sua consultora de beleza natural da Ecosopis. Pode me contar qual é o seu maior desafio com a pele agora?\n\n💬 Deseja atendimento humano? Nos chame no WhatsApp +55 11 95155-9212."
        }
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

    const sendMessage = async (textToSend?: string) => {
        const text = (textToSend || input).trim();
        if (!text || isLoading) return;

        const userMsg = { role: "user", content: text };
        setMessages(prev => [...prev, userMsg]);
        if (!textToSend) setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
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
                content: "Desculpe, tive uma instabilidade momentânea na conexão. Pode tentar novamente? Se preferir, nos chame no WhatsApp +55 11 95155-9212! 🌿"
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
                        <div className={styles.headerActions}>
                            <a
                                href={WHATSAPP_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.headerWhatsappBtn}
                                title="Falar no WhatsApp com Atendente Humano"
                            >
                                <span className={styles.pulseDot}></span>
                                WhatsApp Humano
                            </a>
                            <button className={styles.closeBtn} onClick={handleToggle} aria-label="Fechar chat">✕</button>
                        </div>
                    </div>

                    <div className={styles.suggestionsBar}>
                        {SUGGESTIONS.map((item, sIdx) => (
                            <button
                                key={sIdx}
                                className={styles.suggestionChip}
                                onClick={() => {
                                    if (item.isWhatsApp) {
                                        window.open(WHATSAPP_LINK, "_blank");
                                    } else if (item.prompt) {
                                        sendMessage(item.prompt);
                                    }
                                }}
                                disabled={isLoading}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className={styles.chatMessages} ref={scrollRef}>
                        {messages.map((msg, idx) => {
                            const mentionedProducts = msg.role === 'assistant'
                                ? getMentionedProducts(msg.content, products)
                                : [];
                            const hasWhatsAppMention = msg.role === 'assistant' && (
                                msg.content.includes("95155-9212") ||
                                msg.content.toLowerCase().includes("whatsapp") ||
                                msg.content.toLowerCase().includes("atendimento humano")
                            );
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
                                    <div className={styles.msgText}>
                                        {renderFormattedText(msg.content)}
                                    </div>

                                    {hasWhatsAppMention && (
                                        <div className={styles.whatsappCard}>
                                            <span className={styles.whatsappCardTitle}>💬 Prefere falar diretamente com uma pessoa?</span>
                                            <a
                                                href={WHATSAPP_LINK}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.whatsappActionBtn}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z" />
                                                </svg>
                                                <span>Falar no WhatsApp: <strong>{WHATSAPP_NUMBER}</strong></span>
                                            </a>
                                        </div>
                                    )}

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
                            onClick={() => sendMessage()}
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
