"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import NewsSection from "@/components/NewsSection/NewsSection";
import styles from "./page.module.css";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { 
    Sparkles, 
    Droplets, 
    Zap, 
    CheckCircle2, 
    ArrowRight, 
    Star, 
    ShieldCheck, 
    MessageSquare,
    Send
} from "lucide-react";

export default function Home() {
    const [recentProducts, setRecentProducts] = useState<any[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [activeGoal, setActiveGoal] = useState<string | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewForm, setReviewForm] = useState({ user_name: "", comment: "", rating: 5 });
    const [formStatus, setFormStatus] = useState({ type: "", text: "" });
    const [isMobile, setIsMobile] = useState(false);

    // AI Chat state
    const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([
        { role: 'assistant', content: 'Olá! Sou a Lia, sua consultora de beleza natural. Como posso ajudar com sua rotina hoje?' }
    ]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const goalsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const res = await fetch('/api/reviews/approved');
                if (res.ok) {
                    const data = await res.json();
                    setReviews(data);
                }
            } catch (err) {
                console.error("Error fetching reviews", err);
            }
        };

        const logVisit = async () => {
            try {
                await fetch('/api/metrics/log/visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: '/' })
                });
            } catch (err) {
                console.error("Error logging visit", err);
            }
        };

        fetchReviews();
        logVisit();
    }, []);

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus({ type: "info", text: "Enviando..." });
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: reviewForm.user_name,
                    comment: reviewForm.comment,
                    rating: reviewForm.rating
                })
            });
            if (res.ok) {
                setFormStatus({ type: "success", text: "Sua avaliação foi enviada e será exibida após aprovação! ✨" });
                setReviewForm({ user_name: "", comment: "", rating: 5 });
            } else {
                setFormStatus({ type: "error", text: "Erro ao enviar avaliação." });
            }
        } catch (err) {
            setFormStatus({ type: "error", text: "Erro de conexão." });
        }
    };
    const [slides, setSlides] = useState<any[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    const deviceSlides = isMobile
        ? slides.filter(s => s.mobile_image_url)
        : slides.filter(s => s.image_url);

    const getImageUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        return url;
    };

    useEffect(() => {
        const fetchCarousel = async () => {
            try {
                const res = await fetch('/api/carousel');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const dbSlides = data
                          .filter((item: any) => item.is_active !== false)
                          .map((item: any) => {
                            const desktopUrl = item.image_url ? getImageUrl(item.image_url) : "";
                            const mobileUrl = item.mobile_image_url ? getImageUrl(item.mobile_image_url) : "";
                            return {
                            badge: item.badge && item.badge !== "-" ? item.badge : null,
                            title: item.title && item.title !== "-" ? item.title : null,
                            description: item.description && item.description !== "-" ? item.description : null,
                            image_url: desktopUrl,
                            mobile_image_url: mobileUrl,
                            alignment: item.alignment || "center",
                            vertical_alignment: item.vertical_alignment || "center",
                            content_max_width: item.content_max_width || "500px",
                            glassmorphism: item.glassmorphism || false,
                            title_color: item.title_color,
                            description_color: item.description_color,
                            badge_color: item.badge_color,
                            badge_bg_color: item.badge_bg_color,
                            overlay_color: item.overlay_color,
                            overlay_opacity: item.overlay_opacity,
                            offset_x: item.offset_x || "0%",
                            offset_y: item.offset_y || "0%",
                            carousel_height: item.carousel_height || "700px",
                            mobile_carousel_height: item.mobile_carousel_height || "400px",
                            image_fit: item.image_fit || "cover",
                            ctaPrimary: item.cta_primary_text && item.cta_primary_text !== "-" ? { text: item.cta_primary_text, link: item.cta_primary_link || "/produtos" } : null,
                            ctaSecondary: item.cta_secondary_text && item.cta_secondary_text !== "-" ? { text: item.cta_secondary_text, link: item.cta_secondary_link || "/quizz" } : null
                            };
                          });
                        setSlides(dbSlides);
                    }
                }
            } catch (error) {
                console.error("Error fetching carousel:", error);
            }
        };
        fetchCarousel();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (deviceSlides.length > 0) {
                setCurrentSlide((prev) => (prev + 1) % deviceSlides.length);
            }
        }, 8000);
        return () => clearInterval(timer);
    }, [deviceSlides.length]);

    useEffect(() => {
        setCurrentSlide(0);
    }, [isMobile]);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const res = await fetch('/api/products');
                if (!res.ok) throw new Error("Falha ao carregar produtos");
                const data = await res.json();
                setAllProducts(data);
                setRecentProducts(Array.isArray(data) ? data.slice(0, 4) : []);
            } catch (error) {
                console.error("Error fetching products:", error);
                setRecentProducts([]);
            }
        };
        fetchAll();
    }, []);

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return;
        const userMsg = { role: 'user', content: chatInput };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: chatInput,
                    context: activeGoal ? `O usuário está interessado em ${activeGoal}.` : ""
                })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, tive um problema de conexão. Tente novamente!' }]);
        } finally {
            setChatLoading(false);
        }
    };

    const findProductBySlug = (slug: string) => allProducts.find(p => p.slug === slug);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <main>
            <Header />

            {/* Hero Carousel */}
            <section className={styles.heroCarousel}>
                {deviceSlides.map((slide, index) => {
                    // Helper to convert hex to rgba for overlay
                    const hexToRgba = (hex: string, opacity: number) => {
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    };

                    const overlay = slide.overlay_color && slide.overlay_opacity !== undefined
                        ? hexToRgba(slide.overlay_color, slide.overlay_opacity)
                        : 'rgba(0,0,0,0.3)';

                    const coordinateMap: Record<string, number> = {
                        left: 10,
                        center: 50,
                        right: 90,
                        top: 10,
                        bottom: 90
                    };

                    const activeImageUrl = isMobile
                        ? (slide.mobile_image_url || "")
                        : (slide.image_url || "");
                    const activeHeight = isMobile ? (slide.mobile_carousel_height || '400px') : (slide.carousel_height || '700px');

                    return (
                        <div
                            key={index}
                            className={`${styles.carouselSlide} ${index === currentSlide ? styles.activeSlide : ''}`}
                            style={{
                                backgroundImage: activeImageUrl ? `linear-gradient(${overlay}, ${overlay}), url(${activeImageUrl})` : 'none',
                                backgroundSize: slide.image_fit || 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                display: index === currentSlide ? 'block' : 'none',
                                width: '100%',
                                height: activeHeight,
                                position: 'relative',
                                transition: 'opacity 0.8s ease-in-out'
                            }}
                        >
                            <div className={`${styles.heroContent}`} style={{
                                maxWidth: slide.content_max_width || '500px',
                                padding: '40px',
                                borderRadius: '24px',
                                background: slide.glassmorphism ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                backdropFilter: slide.glassmorphism ? 'blur(12px)' : 'none',
                                WebkitBackdropFilter: slide.glassmorphism ? 'blur(12px)' : 'none',
                                border: slide.glassmorphism ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                                boxShadow: slide.glassmorphism ? '0 10px 40px rgba(0,0,0,0.15)' : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'absolute',
                                left: isMobile ? '50%' : `${coordinateMap[slide.alignment] + (parseInt(slide.offset_x) || 0)}%`,
                                top: isMobile ? '50%' : `${coordinateMap[slide.vertical_alignment] + (parseInt(slide.offset_y) || 0)}%`,
                                transform: 'translate(-50%, -50%)',
                                textAlign: isMobile ? 'center' : (slide.alignment === 'center' ? 'center' : slide.alignment === 'right' ? 'right' : 'left') as any,
                                pointerEvents: 'auto',
                                width: isMobile ? '90%' : 'fit-content',
                            }}>
                                {slide.badge && (
                                    <span
                                        className="scientific-badge"
                                        style={{
                                            backgroundColor: slide.badge_bg_color || '#4a7c59',
                                            color: slide.badge_color || '#ffffff',
                                            marginBottom: '1rem',
                                            display: 'inline-block',
                                            alignSelf: isMobile ? 'center' : (slide.alignment === 'right' ? 'flex-end' : slide.alignment === 'center' ? 'center' : 'flex-start')
                                        }}
                                    >
                                        {slide.badge}
                                    </span>
                                )}
                                {slide.title && (
                                    <h1 style={{
                                        color: slide.title_color || '#ffffff',
                                        fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                                        lineHeight: 1.1,
                                        fontWeight: 800,
                                        marginBottom: '1rem',
                                        textShadow: slide.glassmorphism ? 'none' : '0 2px 10px rgba(0,0,0,0.2)'
                                    }}>
                                        {slide.title}
                                    </h1>
                                )}
                                {slide.description && (
                                    <p style={{
                                        color: slide.description_color || '#ffffff',
                                        fontSize: '1.1rem',
                                        opacity: 0.9,
                                        marginBottom: '2rem',
                                        maxWidth: '100%'
                                    }}>
                                        {slide.description}
                                    </p>
                                )}
                                <div className={styles.heroActions} style={{
                                    justifyContent: isMobile ? 'center' : (slide.alignment === 'right' ? 'flex-end' : slide.alignment === 'center' ? 'center' : 'flex-start')
                                }}>
                                    {slide.ctaPrimary && <Link href={slide.ctaPrimary.link} className="btn-primary" style={{ padding: '0.8rem 2rem' }}>{slide.ctaPrimary.text}</Link>}
                                    {slide.ctaSecondary && (
                                        <Link
                                            href={slide.ctaSecondary.link}
                                            className="btn-outline"
                                            style={{
                                                color: 'white',
                                                borderColor: 'white',
                                                background: 'rgba(255,255,255,0.1)',
                                                padding: '0.8rem 2rem'
                                            }}
                                        >
                                            {slide.ctaSecondary.text}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className={styles.carouselDots}>
                    {deviceSlides.map((_, index) => (
                        <button
                            key={index}
                            className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
                            onClick={() => setCurrentSlide(index)}
                        />
                    ))}
                </div>
            </section>

            {/* Goal Selector Section */}
            <section className={styles.goalsSection} ref={goalsRef}>
                <div className="container">
                    <h2 className={styles.goalTitle}>Qual seu objetivo com a sua pele?</h2>
                    <div className={styles.goalGrid}>
                        <button 
                            className={`${styles.goalCard} ${activeGoal === 'clareamento' ? styles.activeGoal : ''}`}
                            onClick={() => {
                                setActiveGoal('clareamento');
                                scrollToSection('secao-clareamento');
                            }}
                        >
                            <div className={styles.goalIcon}><Sparkles size={32} /></div>
                            <h3>Clareamento de manchas</h3>
                            <p>Uniformizar o tom da pele</p>
                        </button>
                        <button 
                            className={`${styles.goalCard} ${activeGoal === 'acne' ? styles.activeGoal : ''}`}
                            onClick={() => {
                                setActiveGoal('acne');
                                scrollToSection('secao-acne');
                            }}
                        >
                            <div className={styles.goalIcon}><Zap size={32} /></div>
                            <h3>Acne e oleosidade</h3>
                            <p>Controlar oleosidade e poros</p>
                        </button>
                        <button 
                            className={`${styles.goalCard} ${activeGoal === 'foliculite' ? styles.activeGoal : ''}`}
                            onClick={() => {
                                setActiveGoal('foliculite');
                                scrollToSection('secao-foliculite');
                            }}
                        >
                            <div className={styles.goalIcon}><Droplets size={32} /></div>
                            <h3>Foliculite</h3>
                            <p>Reduzir inflamações e pelos</p>
                        </button>
                    </div>
                </div>
            </section>

            {/* Clareamento Section */}
            <section id="secao-clareamento" className={`${styles.dynamicSection} ${activeGoal === 'clareamento' ? styles.highlightedSection : ''}`}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <div>
                            <span className={styles.sectionBadge}>RECOMENDAÇÃO ESPECIAL</span>
                            <h2 className={styles.sectionTitle}>FOCO EM CLAREAMENTO</h2>
                            <p className={styles.sectionSubtitle}>Resultados visíveis e pele uniforme com nossa rotina potente.</p>
                        </div>
                    </div>
                    <div className={styles.productDisplay}>
                        <div className={styles.mainRecommendation}>
                            {findProductBySlug('kit-clareamento') && (
                                <div className={styles.featuredProduct}>
                                    <div className={styles.featuredLabel}>A ESCOLHA Nº 1</div>
                                    <ProductCard 
                                        product={findProductBySlug('kit-clareamento')} 
                                        badge="RESULTADO PROGRESSIVO"
                                        isRecommended={activeGoal === 'clareamento'}
                                    />
                                    <div className={styles.featuredBenefits}>
                                        <h4>Por que começar com este kit?</h4>
                                        <ul>
                                            <li><CheckCircle2 size={16} /> Clareamento gradual e seguro</li>
                                            <li><CheckCircle2 size={16} /> Regeneração celular profunda</li>
                                            <li><CheckCircle2 size={16} /> Ideal para manchas de sol e melasma</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.sideRecommendation}>
                            <h4>Opção para quem quer começar aos poucos:</h4>
                            {findProductBySlug('sabonete-acafrao-dolomita') && (
                                <ProductCard 
                                    product={findProductBySlug('sabonete-acafrao-dolomita')} 
                                    badge="IDEAL PARA INICIANTES"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Acne Section */}
            <section id="secao-acne" className={`${styles.dynamicSection} ${activeGoal === 'acne' ? styles.highlightedSection : ''} ${styles.bgGray}`}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <div>
                            <span className={styles.sectionBadge}>CONTROLE E EQUILÍBRIO</span>
                            <h2 className={styles.sectionTitle}>FOCO EM ACNE E OLEOSIDADE</h2>
                            <p className={styles.sectionSubtitle}>Diga adeus ao brilho excessivo e recupere a saúde dos seus poros.</p>
                        </div>
                    </div>
                    <div className={styles.productDisplay}>
                        <div className={styles.mainRecommendation}>
                            {findProductBySlug('kit-acne') && (
                                <div className={styles.featuredProduct}>
                                    <div className={styles.featuredLabel}>TRATAMENTO COMPLETO</div>
                                    <ProductCard 
                                        product={findProductBySlug('kit-acne')} 
                                        badge="ALTA PROCURA"
                                        isRecommended={activeGoal === 'acne'}
                                    />
                                    <div className={styles.featuredBenefits}>
                                        <h4>Como este kit transforma sua pele:</h4>
                                        <ul>
                                            <li><CheckCircle2 size={16} /> Limpeza profunda sem ressecar</li>
                                            <li><CheckCircle2 size={16} /> Ação secativa e anti-inflamatória</li>
                                            <li><CheckCircle2 size={16} /> Controle da oleosidade o dia todo</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.sideRecommendation}>
                            <h4>Cuidado diário essencial:</h4>
                            {findProductBySlug('sabonete-argila-verde') && (
                                <ProductCard 
                                    product={findProductBySlug('sabonete-argila-verde')} 
                                    badge="MAIS VENDIDO"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Foliculite Section */}
            <section id="secao-foliculite" className={`${styles.dynamicSection} ${activeGoal === 'foliculite' ? styles.highlightedSection : ''}`}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <div>
                            <span className={styles.sectionBadge}>PELE LISA E SEM IRRITAÇÃO</span>
                            <h2 className={styles.sectionTitle}>FOCO EM FOLICULITE</h2>
                            <p className={styles.sectionSubtitle}>Sinta a liberdade de uma pele sem bolinhas e pelos encravados.</p>
                        </div>
                    </div>
                    <div className={styles.productDisplay}>
                        <div className={styles.mainRecommendation}>
                            {findProductBySlug('sabonete-acafrao-dolomita') && (
                                <div className={styles.featuredProduct}>
                                    <div className={styles.featuredLabel}>O FAVORITO</div>
                                    <ProductCard 
                                        product={findProductBySlug('sabonete-acafrao-dolomita')} 
                                        badge="RESULTADO COMPROVADO"
                                        isRecommended={activeGoal === 'foliculite'}
                                    />
                                    <div className={styles.featuredBenefits}>
                                        <h4>O segredo do Açafrão com Dolomita:</h4>
                                        <ul>
                                            <li><CheckCircle2 size={16} /> Redução gradual dos pelos</li>
                                            <li><CheckCircle2 size={16} /> Ação anti-inflamatória potente</li>
                                            <li><CheckCircle2 size={16} /> Cicatrizante natural para áreas sensíveis</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.sideRecommendation}>
                            <h4>Combine para potencializar:</h4>
                            {findProductBySlug('sabonete-clareador-argila-branca') && (
                                <ProductCard 
                                    product={findProductBySlug('sabonete-clareador-argila-branca')} 
                                    badge="UNIFORMIZADOR"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Decision shortcuts */}
            <section className={styles.shortcutsSection}>
                <div className="container">
                    <h2 className={styles.sectionTitle} style={{ textAlign: 'center', marginBottom: '40px' }}>NÃO SABE POR ONDE COMEÇAR?</h2>
                    <div className={styles.shortcutGrid}>
                        <div className={styles.shortcutCard}>
                            <h3>O mais vendido de todos</h3>
                            <p>Sabonete de Açafrão</p>
                            <button onClick={() => scrollToSection('secao-foliculite')} className="btn-outline">VER DETALHES</button>
                        </div>
                        <div className={styles.shortcutCard}>
                            <h3>Melhor kit para iniciantes</h3>
                            <p>Kit Clareamento Potente</p>
                            <button onClick={() => scrollToSection('secao-clareamento')} className="btn-outline">EU QUERO</button>
                        </div>
                        <div className={styles.shortcutCard}>
                            <h3>Melhor opção para acne</h3>
                            <p>Kit Acne e Oleosidade</p>
                            <button onClick={() => scrollToSection('secao-acne')} className="btn-outline">COMEÇAR AGORA</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Routine Section with AI */}
            <section className={styles.routineSection}>
                <div className="container">
                    <div className={styles.routineLayout}>
                        <div className={styles.routineInfo}>
                            <span className={styles.sectionBadge}>SIMPLICIDADE QUE TRANSFORMA</span>
                            <h2 className={styles.sectionTitle}>UMA ROTINA QUE SE ENCAIXA NA SUA VIDA</h2>
                            <p>Recupere a confiança na sua pele com apenas 2 passos diários. Sem complicação, apenas resultados reais.</p>
                            
                            <div className={styles.steps}>
                                <div className={styles.step}>
                                    <div className={styles.stepNumber}>1</div>
                                    <div>
                                        <h4>Lavar com o Sabonete Ideal</h4>
                                        <p>Limpeza profunda e tratamento simultâneo durante o banho.</p>
                                    </div>
                                </div>
                                <div className={styles.step}>
                                    <div className={styles.stepNumber}>2</div>
                                    <div>
                                        <h4>Aplicar o Óleo à Noite</h4>
                                        <p>Tratamento regenerador enquanto você dorme. <br/> <strong>Atenção:</strong> Óleos vegetais são fotossensíveis e devem ser usados apenas à noite.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.aiChatContainer}>
                            <div className={styles.chatHeader}>
                                <div className={styles.aiAvatar}><ShieldCheck size={20} /></div>
                                <div>
                                    <h4>Tire sua dúvida com a Lia</h4>
                                    <span>Nossa consultora inteligente</span>
                                </div>
                            </div>
                            <div className={styles.chatMessages} ref={chatScrollRef}>
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`${styles.message} ${styles[m.role]}`}>
                                        {m.content}
                                    </div>
                                ))}
                                {chatLoading && <div className={styles.message}>Lia está digitando...</div>}
                            </div>
                            <div className={styles.chatInput}>
                                <input 
                                    type="text" 
                                    placeholder="Dúvida sobre a rotina? Pergunte aqui..." 
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                />
                                <button onClick={sendChatMessage}><Send size={18} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof / Stats */}
            <section className={styles.statsSection}>
                <div className="container">
                    <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                            <h3>+200 MIL</h3>
                            <p>Pedidos enviados com amor</p>
                        </div>
                        <div className={styles.statItem}>
                            <h3>+50 MIL</h3>
                            <p>Clientes transformadas</p>
                        </div>
                        <div className={styles.statItem}>
                            <h3>100%</h3>
                            <p>Botânico e Seguro</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Brand History */}
            <section className={styles.historySection}>
                <div className="container">
                    <div className={styles.historyContent}>
                        <h2 className={styles.sectionTitle}>MAIS QUE PRODUTOS, UM COMPROMISSO COM VOCÊ</h2>
                        <p>A Ecosopis nasceu do desejo de unir a sabedoria da natureza com resultados que você pode ver e sentir. Acreditamos que o autocuidado deve ser simples, ético e transformador. Cada fórmula é pensada para que você recupere não apenas a saúde da sua pele, mas a sua confiança diária.</p>
                        <p className={styles.historyHighlight}>"Quem usa, continua usando — porque sua pele sente a diferença nos primeiros usos."</p>
                    </div>
                </div>
            </section>

            {/* Quiz Promo - Redesigned */}
            <section className={styles.quizPromo}>
                <div className={`container ${styles.quizPromoContent}`}>
                    <h2 style={{ fontSize: '2.5rem' }}>Quer uma recomendação personalizada?</h2>
                    <p>Nossa inteligência artificial analisa seu tipo de pele e recomenda a rotina perfeita para você.</p>
                    <Link href="/quizz" className="btn-primary">FAZER O QUIZ AGORA</Link>
                </div>
            </section>

            {/* News Section */}
            <NewsSection />

            {/* Reviews Section */}
            <section className={styles.reviewsSection}>
                <div className="container">
                    <h2 className={styles.sectionTitle} style={{ textAlign: 'center', marginBottom: '40px' }}>EXPERIÊNCIAS ECOSOPIS</h2>

                    <div className={styles.reviewsGrid}>
                        {reviews.length > 0 ? (
                            reviews.map((rev: any) => (
                                <div key={rev.id} className={styles.reviewCard}>
                                    <div className={styles.reviewStars}>
                                        {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                    </div>
                                    <p className={styles.reviewComment}>&quot;{rev.comment}&quot;</p>
                                    <span className={styles.reviewAuthor}>— {rev.user_name}</span>
                                </div>
                            ))
                        ) : (
                            <p style={{ textAlign: 'center', gridColumn: '1/-1', opacity: 0.7 }}>
                                Seja a primeira a compartilhar sua jornada de autocuidado!
                            </p>
                        )}
                    </div>

                    <div className={styles.reviewFormContainer}>
                        <h3>Deixe sua Avaliação</h3>
                        <form onSubmit={handleReviewSubmit} className={styles.reviewForm}>
                            <div className={styles.formRow}>
                                <input
                                    type="text"
                                    placeholder="Seu Nome"
                                    value={reviewForm.user_name}
                                    onChange={(e) => setReviewForm({ ...reviewForm, user_name: e.target.value })}
                                    required
                                />
                                <select
                                    value={reviewForm.rating}
                                    onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value) })}
                                >
                                    <option value="5">5 Estrelas ★★★★★</option>
                                    <option value="4">4 Estrelas ★★★★☆</option>
                                    <option value="3">3 Estrelas ★★★☆☆</option>
                                    <option value="2">2 Estrelas ★★☆☆☆</option>
                                    <option value="1">1 Estrela ★☆☆☆☆</option>
                                </select>
                            </div>
                            <textarea
                                placeholder="Conte sua experiência com nossos produtos botânicos..."
                                value={reviewForm.comment}
                                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                required
                            />
                            <button type="submit" className="btn-primary">ENVIAR AVALIAÇÃO</button>
                            {formStatus.text && (
                                <p className={`${styles.formMessage} ${styles[formStatus.type as keyof typeof styles]}`}>
                                    {formStatus.text}
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            </section>

            <Footer />
        </main >
    );
}
