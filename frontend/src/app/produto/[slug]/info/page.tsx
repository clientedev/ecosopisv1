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
    QrCode,
    Download
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface ProductDetail {
    curiosidades: string;
    modo_de_uso: string;
    ingredientes: string;
    cuidados: string;
    contraindicacoes: string;
    observacoes: string;
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
}

export default function ProductTechnicalPage() {
    const params = useParams();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeImage, setActiveImage] = useState("");

    // Chat state
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

    return (
        <div className={styles.pageContainer}>
            <header className={styles.hero}>
                <Link href={`/produtos/${product.slug}`} className={styles.backLink}>
                    <ArrowLeft size={18} /> Voltar ao Produto
                </Link>

                <div className={styles.badge}>Ficha Técnica Premium</div>
                <h1>{product.name}</h1>
                <p>Equilíbrio botânico, consciência e pureza em cada detalhe.</p>
                <div className={styles.heroMeta}>
                    {product.price ? <span>R$ {product.price.toFixed(2).replace(".", ",")}</span> : <span>Sem preço exibido</span>}
                    <span>SKU: {product.slug}</span>
                </div>
            </header>

            {/* Image Gallery Section */}
            <section className={styles.gallerySection}>
                <div className={styles.galleryContainer}>
                    <div className={styles.mainImage}>
                        <Image
                            src={getImageUrl(activeImage)}
                            alt={product.name}
                            fill
                            priority
                            unoptimized
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
                                    <Image src={getImageUrl(img)} alt={`Thumbnail ${idx}`} fill unoptimized />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <main className={styles.content}>
                <div className={styles.grid}>
                    {/* Curiosidades */}
                    <section className={styles.card} style={{ animationDelay: '0.1s' }}>
                        <div className={styles.sectionTitle}>
                            <div className={styles.sectionIcon}><Sparkles size={22} /></div>
                            Curiosidades
                        </div>
                        <div className={styles.textBlock}>
                            {details?.curiosidades || "Nossas fórmulas são criadas com amor e respeito à natureza, focando em resultados reais sem agredir o meio ambiente. Cada ingrediente é selecionado por sua pureza e eficácia terapêutica."}
                        </div>
                    </section>

                    {/* Modo de Uso */}
                    <section className={styles.card} style={{ animationDelay: '0.2s' }}>
                        <div className={styles.sectionTitle}>
                            <div className={styles.sectionIcon}><Zap size={22} /></div>
                            Modo de Uso
                        </div>
                        <div className={styles.textBlock}>
                            {details?.modo_de_uso || "Aplique sobre a pele úmida, massageando suavemente em movimentos circulares. Enxágue bem. Sinta a textura e o aroma natural envolverem seus sentidos."}
                        </div>
                    </section>

                    {/* Ingredientes */}
                    <section className={styles.card} style={{ animationDelay: '0.3s' }}>
                        <div className={styles.sectionTitle}>
                            <div className={styles.sectionIcon}><Droplets size={22} /></div>
                            Ingredientes
                        </div>
                        <div className={styles.textBlock}>
                            {details?.ingredientes || "Composição baseada em óleos vegetais prensados a frio, extratos botânicos concentrados e óleos essenciais puros. Totalmente livre de sulfatos, parabenos, petrolatos e fragrâncias sintéticas."}
                        </div>
                    </section>

                    {/* Cuidados */}
                    <section className={styles.card} style={{ animationDelay: '0.4s' }}>
                        <div className={styles.sectionTitle}>
                            <div className={styles.sectionIcon}><ShieldAlert size={22} /></div>
                            Cuidados
                        </div>
                        <div className={styles.textBlock}>
                            {details?.cuidados || "Mantenha em local seco, arejado e ao abrigo da luz solar direta. Após o uso, prefira saboneteiras que drenem a água para preservar a integridade e durabilidade do seu produto natural."}
                        </div>
                    </section>

                    {/* Contraindicações */}
                    <section className={styles.card} style={{ animationDelay: '0.5s' }}>
                        <div className={styles.sectionTitle}>
                            <div className={styles.sectionIcon}><Stethoscope size={22} /></div>
                            Contraindicações
                        </div>
                        <div className={styles.textBlock}>
                            {details?.contraindicacoes || "Uso externo. Em caso de irritação, suspenda o uso. Recomendamos verificar a lista de ingredientes caso possua sensibilidade ou alergias conhecidas a óleos essenciais específicos."}
                        </div>
                    </section>

                    {/* Observações */}
                    <section className={styles.card} style={{ animationDelay: '0.6s' }}>
                        <div className={styles.sectionTitle}>
                            <div className={styles.sectionIcon}><ClipboardList size={22} /></div>
                            Observações
                        </div>
                        <div className={styles.textBlock}>
                            {details?.observacoes || "Por ser um produto genuinamente artesanal e botânico, pode apresentar variações sutis de cor e formato. Estas características são a garantia de um processo humano e vivo, que não altera sua eficácia."}
                        </div>
                    </section>
                </div>

                <div className={styles.buySection}>
                    <h2>Gostou desta experiência natural?</h2>
                    <p>Adicione {product.name} ao seu ritual de autocuidado agora mesmo.</p>
                    <Link href={`/produtos/${product.slug}`} className={styles.buyBtn}>
                        <ShoppingBag size={20} /> QUERO COMPRAR AGORA
                    </Link>
                </div>

                {/* Inline Chat Section */}
                <div className={styles.chatSection}>
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
                                <p>Olá! Pergunte qualquer coisa sobre <strong>{product.name}</strong>: ingredientes, modo de uso, pele sensível, combinações e muito mais.</p>
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

                <footer className={styles.footer}>
                    <div className={styles.footerLogoWrap}>
                        <Image
                            src="/logo_final.png"
                            alt="Ecosopis Logo"
                            width={140}
                            height={45}
                            className={styles.footerLogo}
                        />
                    </div>
                    &copy; {new Date().getFullYear()} Ecosopis Cosmética Natural. Todos os direitos reservados.<br />
                    Tecnologia e Natureza em equilíbrio para sua pele.
                </footer>
            </main>
        </div>
    );
}
