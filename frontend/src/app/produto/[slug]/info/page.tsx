"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import {
    Zap,
    Droplets,
    ShieldAlert,
    Stethoscope,
    ClipboardList,
    ArrowLeft,
    Sparkles,
    ShoppingBag,
    MessageSquare,
    Send,
    Leaf,
    Heart,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getStaticProductData } from "@/lib/productData";

interface ProductDetail {
    curiosidades: string;
    modo_de_uso: string;
    ingredientes: string;
    cuidados: string;
    contraindicacoes: string;
    observacoes: string;
    beneficios: string | null;
}

interface Product {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number;
    image_url: string;
    images: string[];
    details?: ProductDetail;
    beneficios?: string; // Adding this for safety if it comes directly
}

export default function ProductTechnicalPage() {
    const params = useParams();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeImage, setActiveImage] = useState("");

    const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/products/${params.slug}`);
                if (res.ok) {
                    const data = await res.json();
                    // Garante que textos estáticos sempre apareçam
                    const staticData = getStaticProductData(data.slug);
                    if (staticData) {
                        if (data.details) {
                            data.details.ingredientes = data.details.ingredientes || staticData.ativos;
                            data.details.modo_de_uso = data.details.modo_de_uso || staticData.modo_de_uso;
                            data.details.beneficios = data.details.beneficios || staticData.beneficios;
                            data.details.curiosidades = data.details.curiosidades || staticData.curiosidades;
                        } else {
                            data.details = {
                                ingredientes: staticData.ativos,
                                modo_de_uso: staticData.modo_de_uso,
                                beneficios: staticData.beneficios,
                                curiosidades: staticData.curiosidades,
                                cuidados: null,
                                contraindicacoes: null,
                                observacoes: null,
                            };
                        }
                    }
                    setProduct(data);
                    setActiveImage(data.image_url || (data.images && data.images[0]) || "/logo_final.png");
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error("Error fetching product info:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (params.slug) {
            fetchProduct();
        }
    }, [params.slug]);

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, chatLoading]);

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading || !product) return;
        const userMsg = { role: 'user', content: chatInput };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Pergunta sobre o produto "${product.name}": ${chatInput}` })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, tive um problema de conexão. Tente novamente!' }]);
        } finally {
            setChatLoading(false);
        }
    };

    const getImageUrl = (url: string) => {
        if (!url) return "/logo_final.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        if (url.startsWith("attached_assets/")) return `/static/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '20px', background: '#fbfbfb' }}>
                <div className="loader"></div>
                <p style={{ color: '#2d5a27', fontWeight: 600, fontFamily: 'Inter' }}>Sintonizando frequências naturais...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className={styles.emptyState}>
                <h2>Ops! Produto não encontrado.</h2>
                <p>Parece que este produto voltou para a natureza ou o link está incorreto.</p>
                <Link href="/produtos" className="btn-primary" style={{ marginTop: '20px', display: 'inline-block', textDecoration: 'none' }}>
                    Ver Catálogo
                </Link>
            </div>
        );
    }

    const details = product.details;
    const allImages = [product.image_url, ...(product.images || [])].filter(Boolean);

    const primaryCards = [
        {
            icon: <Droplets size={24} />,
            title: "Ativos / Ingredientes",
            content: details?.ingredientes,
            delay: "0.1s",
            featured: true
        },
        {
            icon: <Zap size={24} />,
            title: "Ritual de Uso",
            content: details?.modo_de_uso,
            delay: "0.2s",
            featured: true
        },
        {
            icon: <Heart size={24} />,
            title: "Benefícios Reais",
            content: details?.beneficios || (product as any).benefits,
            delay: "0.3s",
            featured: true
        },
    ];

    const secondaryCards = [
        {
            icon: <Sparkles size={20} />,
            title: "Curiosidades",
            content: details?.curiosidades,
            delay: "0.4s"
        },
        {
            icon: <Leaf size={20} />,
            title: "Destaque Sustentável",
            content: "Nossas fórmulas são biodegradáveis e as embalagens são pensadas para reduzir o impacto ambiental. Ao escolher Ecosopis, você apoia o consumo consciente e a preservação das nossas águas.",
            delay: "0.45s"
        },
        {
            icon: <ShieldAlert size={20} />,
            title: "Cuidados",
            content: details?.cuidados,
            delay: "0.5s"
        },
        {
            icon: <Stethoscope size={20} />,
            title: "Contraindicações",
            content: details?.contraindicacoes,
            delay: "0.6s"
        },
        {
            icon: <ClipboardList size={20} />,
            title: "Observações",
            content: details?.observacoes,
            delay: "0.7s"
        },
    ];

    return (
        <div className={styles.pageContainer}>



            {/* ── HERO SPLIT ── */}
            <section className={styles.hero}>
                {/* Left – image panel */}
                <div className={styles.heroLeft}>
                    <div className={styles.mainImageWrap}>
                        <Image
                            src={getImageUrl(activeImage)}
                            alt={product.name}
                            fill
                            priority
                            unoptimized
                            style={{ objectFit: 'contain' }}
                        />
                    </div>
                    {allImages.length > 1 && (
                        <div className={styles.thumbnails}>
                            {allImages.map((img, idx) => (
                                <div
                                    key={idx}
                                    className={`${styles.thumbItem} ${activeImage === img ? styles.active : ''}`}
                                    onClick={() => setActiveImage(img)}
                                >
                                    <Image src={getImageUrl(img)} alt={`Imagem ${idx + 1}`} fill unoptimized style={{ objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right – info panel */}
                <div className={styles.heroRight}>
                    <Link href={`/produtos/${product.slug}`} className={styles.backLink}>
                        <ArrowLeft size={16} /> Voltar ao Produto
                    </Link>

                    <span className={styles.badge}>Ficha Técnica</span>

                    <h1 className={styles.heroTitle}>{product.name}</h1>

                    <p className={styles.heroSubtitle}>
                        Equilíbrio botânico, consciência e pureza em cada detalhe.
                    </p>

                    <div className={styles.heroMeta}>
                        {product.price
                            ? <span className={styles.priceTag}>R$ {product.price.toFixed(2).replace(".", ",")}</span>
                            : <span className={styles.priceTag}>Consulte o preço</span>
                        }
                        <span className={styles.skuTag}>SKU: {product.slug}</span>
                    </div>

                </div>
            </section>

            {/* ── CARDS SECTION ── */}
            <section className={styles.cardsSection}>
                <div className={styles.cardsSectionInner}>
                    <p className={styles.cardsSectionLabel}>RITUAL E COMPOSIÇÃO</p>
                    <h2 className={styles.cardsSectionTitle}>O Coração do Produto</h2>
                    
                    <div className={styles.primaryGrid}>
                        {primaryCards.filter(card => card.content).map((card, idx) => (
                            <div
                                key={idx}
                                className={`${styles.card} ${styles.primaryCard}`}
                                style={{ animationDelay: card.delay }}
                            >
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}>{card.icon}</div>
                                    <h3 className={styles.cardTitle}>{card.title}</h3>
                                </div>
                                <p className={styles.cardText}>{card.content}</p>
                            </div>
                        ))}
                    </div>

                    <div className={styles.sectionDivider}>
                        <span></span>
                        <p>SEGURANÇA E CURIOSIDADES</p>
                        <span></span>
                    </div>

                    <div className={styles.secondaryGrid}>
                        {secondaryCards.filter(card => card.content).map((card, idx) => (
                            <div
                                key={idx}
                                className={styles.card}
                                style={{ animationDelay: card.delay }}
                            >
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}>{card.icon}</div>
                                    <h3 className={styles.cardTitle}>{card.title}</h3>
                                </div>
                                <p className={styles.cardText}>{card.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── NATURE BANNER ── */}
            <section className={styles.natureBanner}>
                <div className={styles.natureBannerOverlay}>
                    <p className={styles.bannerLabel}>Cosmética Consciente</p>
                    <h2 className={styles.bannerTitle}>Gostou desta experiência natural?</h2>
                    <p className={styles.bannerText}>
                        Adicione <strong>{product.name}</strong> ao seu ritual de autocuidado agora mesmo.
                    </p>
                    <Link href={`/produtos/${product.slug}`} className={styles.bannerBtn}>
                        <ShoppingBag size={18} /> QUERO COMPRAR AGORA
                    </Link>
                </div>
            </section>

            {/* ── CHAT SECTION ── */}
            <section className={styles.chatSection}>
                <div className={styles.chatInner}>
                    <div className={styles.chatSectionHeader}>
                        <div className={styles.chatSectionIcon}><MessageSquare size={22} /></div>
                        <div>
                            <h2 className={styles.chatTitle}>Dúvidas sobre este produto?</h2>
                            <p className={styles.chatSubtitle}>Nossa consultora Lia responde em segundos 💬</p>
                        </div>
                    </div>

                    <div className={styles.chatBody} ref={chatScrollRef}>
                        {chatMessages.length === 0 && (
                            <div className={styles.chatEmptyState}>
                                <span>👋</span>
                                <p>Olá! Pergunte qualquer coisa sobre <strong>{product.name}</strong>: ativos, modo de uso, pele sensível, combinações e muito mais.</p>
                            </div>
                        )}
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`${styles.chatMsg} ${msg.role === 'user' ? styles.chatMsgUser : styles.chatMsgAI}`}>
                                {msg.content}
                            </div>
                        ))}
                        {chatLoading && (
                            <div className={`${styles.chatMsg} ${styles.chatMsgAI} ${styles.chatTyping}`}>
                                <span></span><span></span><span></span>
                            </div>
                        )}
                    </div>

                    <div className={styles.chatInputRow}>
                        <input
                            type="text"
                            className={styles.chatInput}
                            placeholder={`Pergunte sobre ${product.name}...`}
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                            disabled={chatLoading}
                        />
                        <button
                            className={styles.chatSendBtn}
                            onClick={sendChatMessage}
                            disabled={chatLoading || !chatInput.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className={styles.footer}>
                <div className={styles.footerLogoWrap}>
                    <Image
                        src="/logo_nova_transparent.png"
                        alt="Ecosopis Logo"
                        width={160}
                        height={52}
                        className={styles.footerLogo}
                    />
                </div>
                &copy; {new Date().getFullYear()} Ecosopis Cosmético Natural. Todos os direitos reservados.<br />
                Tecnologia e Natureza em equilíbrio para sua pele.
            </footer>
        </div>
    );
}
