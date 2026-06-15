"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import NewsSection from "@/components/NewsSection/NewsSection";
import ChatIA from "@/components/ChatIA/ChatIA";
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
    Send,
    X,
    ChevronRight,
    Search,
    Sun,
    Moon,
    ArrowDown,
    Heart,
    Users
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
    const { addToCart } = useCart();
    const { activeTheme } = useTheme();
    const { user, token } = useAuth();
    const isValentines = activeTheme === 'valentines_day';
    const [cupMatches, setCupMatches] = useState<any[]>([]);
    const [loadingCupMatches, setLoadingCupMatches] = useState(false);
    const [cupGuessInputs, setCupGuessInputs] = useState<Record<number, { score_a: string; score_b: string }>>({});
    const [cupFeedback, setCupFeedback] = useState<Record<number, { text: string; type: "success" | "error" }>>({});
    const [savingGuessId, setSavingGuessId] = useState<number | null>(null);
    const [bolaoDiscount, setBolaoDiscount] = useState<number>(10);

    const fetchCupMatches = async () => {
        setLoadingCupMatches(true);
        try {
            const headers: Record<string, string> = {};
            const storedToken = localStorage.getItem("token") || token;
            if (storedToken) {
                headers["Authorization"] = `Bearer ${storedToken}`;
            }
            const res = await fetch("/api/world-cup/matches", { headers });
            if (res.ok) {
                const data = await res.json();
                setCupMatches(data);
                
                const initialInputs: Record<number, { score_a: string; score_b: string }> = {};
                data.forEach((match: any) => {
                    if (match.user_guess) {
                        initialInputs[match.id] = {
                            score_a: String(match.user_guess.guess_score_a),
                            score_b: String(match.user_guess.guess_score_b)
                        };
                    } else {
                        initialInputs[match.id] = { score_a: "", score_b: "" };
                    }
                });
                setCupGuessInputs(initialInputs);
            }
        } catch (err) {
            console.error("Error fetching cup matches:", err);
        } finally {
            setLoadingCupMatches(false);
        }
    };

    useEffect(() => {
        if (activeTheme === "copa_do_mundo") {
            fetchCupMatches();
            // Fetch discount config
            fetch("/api/world-cup/config")
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data?.bolao_discount_percentage) setBolaoDiscount(data.bolao_discount_percentage); })
                .catch(() => {});
        }
    }, [activeTheme, user]);

    const handleSaveGuess = async (matchId: number) => {
        const input = cupGuessInputs[matchId];
        if (!input || input.score_a === "" || input.score_b === "") {
            setCupFeedback(prev => ({
                ...prev,
                [matchId]: { text: "Por favor, preencha os dois placares.", type: "error" }
            }));
            return;
        }

        const score_a = parseInt(input.score_a);
        const score_b = parseInt(input.score_b);
        if (isNaN(score_a) || isNaN(score_b) || score_a < 0 || score_b < 0) {
            setCupFeedback(prev => ({
                ...prev,
                [matchId]: { text: "Placares inválidos.", type: "error" }
            }));
            return;
        }

        setSavingGuessId(matchId);
        setCupFeedback(prev => ({ ...prev, [matchId]: { text: "", type: "success" } }));

        try {
            const storedToken = localStorage.getItem("token") || token;
            const res = await fetch("/api/world-cup/guess", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${storedToken}`
                },
                body: JSON.stringify({
                    match_id: matchId,
                    guess_score_a: score_a,
                    guess_score_b: score_b
                })
            });

            if (res.ok) {
                setCupFeedback(prev => ({
                    ...prev,
                    [matchId]: { text: "Palpite salvo com sucesso! 🇧🇷⚽", type: "success" }
                }));
                await fetchCupMatches();
            } else {
                const errData = await res.json();
                setCupFeedback(prev => ({
                    ...prev,
                    [matchId]: { text: errData.detail || "Erro ao salvar palpite.", type: "error" }
                }));
            }
        } catch (err) {
            setCupFeedback(prev => ({
                ...prev,
                [matchId]: { text: "Erro de conexão.", type: "error" }
            }));
        } finally {
            setSavingGuessId(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Cupom copiado com sucesso! 🎉");
    };
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
    const [isChatOpen, setIsChatOpen] = useState(false);
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
                const res = await fetch('/api/reviews/approved?limit=8');
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
        ? slides.filter(s => s.mobile_image_url || s.image_url)
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
                            ctaSecondary: item.cta_secondary_text && item.cta_secondary_text !== "-" ? { text: item.cta_secondary_text, link: item.cta_secondary_link || "/quizz" } : null,
                            show_content: item.show_content !== false,
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
        const currentDeviceSlides = isMobile
            ? slides.filter(s => s.mobile_image_url || s.image_url)
            : slides.filter(s => s.image_url);
        if (currentDeviceSlides.length <= 1) return;

        const duration = currentDeviceSlides[currentSlide]?.slide_duration_ms ?? 8000;

        const timer = setTimeout(() => {
            setCurrentSlide(prev => (prev + 1) % currentDeviceSlides.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [isMobile, slides, currentSlide]);

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

    const [overlayVisible, setOverlayVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
    // Reset overlay on slide change
    useEffect(() => {
        setOverlayVisible(false);
        const timer = setTimeout(() => setOverlayVisible(true), 1500);
        return () => clearTimeout(timer);
    }, [currentSlide]);

    // Valentine's floating hearts
    const [hearts, setHearts] = useState<{id: number; x: number; size: number; delay: number; duration: number}[]>([]);
    useEffect(() => {
        if (!isValentines) { setHearts([]); return; }
        const generated = Array.from({ length: 16 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            size: 16 + Math.random() * 24,
            delay: Math.random() * 4,
            duration: 5 + Math.random() * 6,
        }));
        setHearts(generated);
    }, [isValentines]);
    const [displayedTip, setDisplayedTip] = useState("");
    const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const typeTip = (text: string) => {
        setDisplayedTip("");
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        let i = 0;
        typingIntervalRef.current = setInterval(() => {
            if (i < text.length) {
                setDisplayedTip(prev => prev + text.charAt(i));
                i++;
            } else {
                if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
            }
        }, 30);
    };

    const openGoalModal = (goal: string) => {
        setSelectedGoal(goal);
        setActiveGoal(goal);
        setIsModalOpen(true);
        
        const tips: {[key: string]: string} = {
            clareamento: "Para clareamento, a constância é chave. Use o Sabonete de Argila Branca diariamente no banho e o Óleo de Rosa Mosqueta apenas à noite para regeneração.",
            acne: "A argila verde é um ímã de impurezas. Lave o rosto em movimentos circulares para desobstruir os poros sem agredir a barreira cutânea.",
            foliculite: "O açafrão atua na raiz do problema, reduzindo a inflamação enquanto a dolomita acalma e clareia a região afetada."
        };
        
        if (tips[goal]) typeTip(tips[goal]);

        // Track the choice
        fetch('/api/metrics/log/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: null, click_type: `goal_${goal}` })
        }).catch(() => {});
    };

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
                    context: selectedGoal ? `O usuário está interessado em ${selectedGoal}.` : ""
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

    const [routineSteps, setRoutineSteps] = useState<{am: any[], pm: any[]}>({am: [], pm: []});
    const [routineLoading, setRoutineLoading] = useState(false);

    const buildRoutine = (goal: string) => {
        setRoutineLoading(true);
        // Simulate AI thinking
        setTimeout(() => {
            const routines: {[key: string]: {am: any[], pm: any[]}} = {
                clareamento: {
                    am: [
                        { ...findProductBySlug('sabonete-acafrao-dolomita'), step: 'Limpeza', instruction: 'Lavar o rosto com água fria' },
                        { name: 'Protetor Solar', step: 'Proteção', instruction: 'Aplicar após a limpeza (não incluso no kit)', isExternal: true }
                    ],
                    pm: [
                        { ...findProductBySlug('sabonete-acafrao-dolomita'), step: 'Limpeza', instruction: 'Remover impurezas do dia' },
                        { ...findProductBySlug('kit-clareamento'), step: 'Tratamento', instruction: 'Aplicar o Óleo de Rosa Mosqueta' }
                    ]
                },
                acne: {
                    am: [
                        { ...findProductBySlug('sabonete-argila-verde'), step: 'Limpeza', instruction: 'Controlar oleosidade matinal' }
                    ],
                    pm: [
                        { ...findProductBySlug('sabonete-argila-verde'), step: 'Limpeza', instruction: 'Limpeza profunda' },
                        { ...findProductBySlug('kit-acne'), step: 'Tratamento', instruction: 'Aplicar Argila Verde para tratamento profundo (2x semana)' }
                    ]
                },
                foliculite: {
                    am: [
                        { ...findProductBySlug('sabonete-acafrao-dolomita'), step: 'Limpeza', instruction: 'Ação anti-inflamatória matinal' }
                    ],
                    pm: [
                        { ...findProductBySlug('sabonete-acafrao-dolomita'), step: 'Limpeza', instruction: 'Preparar a pele para o descanso' },
                        { ...findProductBySlug('sabonete-clareador-argila-branca'), step: 'Esfoliação', instruction: 'Esfoliar suavemente (3x semana)' }
                    ]
                }
            };
            setRoutineSteps(routines[goal] || {am: [], pm: []});
            setRoutineLoading(false);
            scrollToSection('minha-rotina');
        }, 1500);
    };

    const addRoutineToCart = () => {
        const allItems = [...routineSteps.am, ...routineSteps.pm];
        allItems.forEach(item => {
            if (item.id && !item.isExternal) {
                addToCart(item);
            }
        });
        alert('Todos os produtos da sua rotina foram adicionados ao carrinho!');
    };

    const findProductBySlug = (slug: string) => allProducts.find(p => p.slug === slug);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const staticReviews = [
        {
            id: 's1',
            user_name: 'j***a',
            rating: 5,
            comment: 'Amei demais!! Comprei o sabonete de açafrão sem muita expectativa e fiquei impressionada. Uso há 3 semanas e já noto a diferença nas manchas do braço. Entregou super rápido e a embalagem veio impecável. Com certeza vou comprar de novo!',
            source: 'Shopee',
            date: 'há 2 semanas',
            product: 'Sabonete de Açafrão e Dolomita'
        },
        {
            id: 's2',
            user_name: 'M***i S.',
            rating: 5,
            comment: 'Produto excelente! Tenho foliculite há anos e nada resolvia. Comecei a usar o sabonete da Ecosopis e em menos de 1 mês já vi resultados que nunca vi com outros produtos. Minha pele ficou muito mais uniforme e sem aquelas bolinhas. Super recomendo!',
            source: 'Shopee',
            date: 'há 1 mês',
            product: 'Sabonete de Açafrão e Dolomita'
        },
        {
            id: 's3',
            user_name: 'C***a R.',
            rating: 5,
            comment: 'Kit clareamento chegou rapidinho e veio com nota fiscal. Estou no início do tratamento mas já sinto a pele mais suave. Os produtos têm um cheiro muito agradável e a textura é ótima. Loja confiável, já indiquei para minhas amigas!',
            source: 'Shopee',
            date: 'há 3 semanas',
            product: 'Kit Clareamento Potente'
        },
        {
            id: 's4',
            user_name: 'T***a M.',
            rating: 5,
            comment: 'O óleo de rícino é puro mesmo, sem cheiro forte, absorve bem. Estou usando nas sobrancelhas e cílios e já estão crescendo mais. Entrega super rápida, vim aqui deixar meu agradecimento. Já fiz meu segundo pedido!',
            source: 'Shopee',
            date: 'há 5 dias',
            product: 'Óleo Vegetal de Rícino'
        },
        {
            id: 's5',
            user_name: 'P***a L.',
            rating: 5,
            comment: 'Desodorante clareador surpreendeu! Sou negra e tenho muita dificuldade com manchas na axila. Uso há 6 semanas e a diferença é visível. Não irrita, não mancha roupa, e o efeito clareador é real. Produto 10 estrelas se pudesse!',
            source: 'Shopee',
            date: 'há 1 mês',
            product: 'Desodorante Clareador Sólido'
        },
        {
            id: 's6',
            user_name: 'R***a B.',
            rating: 5,
            comment: 'Comprei o tônico facial e fiquei apaixonada. Minha pele estava muito oleosa e com poros abertos. Depois de 2 semanas de uso, a oleosidade diminuiu bastante. A marca é séria, natural de verdade e com resultado comprovado. Voltarei sempre!',
            source: 'Shopee',
            date: 'há 2 semanas',
            product: 'Tônico Facial Antioxidante'
        },
    ];

    return (
        <main>
            <Header />
            <section className={styles.heroCarousel}>
                {isValentines && hearts.map(h => (
                    <div
                        key={h.id}
                        aria-hidden="true"
                        style={{
                            position: 'fixed',
                            left: `${h.x}vw`,
                            bottom: '-60px',
                            fontSize: `${h.size}px`,
                            opacity: 0,
                            pointerEvents: 'none',
                            zIndex: 9999,
                            animation: `floatHeart ${h.duration}s ${h.delay}s ease-in forwards`,
                            userSelect: 'none',
                        }}
                    >❤️</div>
                ))}
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
                        ? (slide.mobile_image_url || slide.image_url || "")
                        : (slide.image_url || "");
                    const activeHeight = isMobile ? (slide.mobile_carousel_height || '400px') : (slide.carousel_height || '700px');

                    return (
                        <div
                            key={index}
                            className={`${styles.carouselSlide} ${index === currentSlide ? styles.activeSlide : ''}`}
                            style={{
                                display: index === currentSlide ? 'block' : 'none',
                                width: '100%',
                                height: activeHeight,
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'opacity 0.8s ease-in-out'
                            }}
                        >
                            {activeImageUrl && (
                                <>
                                    <Image
                                        src={activeImageUrl}
                                        alt={slide.title || 'Slide'}
                                        fill
                                        style={{ objectFit: (slide.image_fit as any) || 'cover', objectPosition: 'center', zIndex: 0 }}
                                        priority={index === 0}
                                        sizes="100vw"
                                        unoptimized={activeImageUrl.startsWith('/api/')}
                                    />
                                    {/* Normal overlay */}
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: overlay,
                                        zIndex: 1
                                    }} />
                                    {/* Valentine's Day pink film */}
                                    {isValentines && (
                                        <div
                                            data-valentines-overlay="true"
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                background: 'rgba(230, 63, 111, 0.28)',
                                                zIndex: 2,
                                                pointerEvents: 'none',
                                                mixBlendMode: 'multiply',
                                            }}
                                        />
                                    )}
                                </>
                            )}
                            {/* Only render content box if there's something to show */}
                            {(slide.badge || slide.title || slide.description || slide.ctaPrimary || slide.ctaSecondary) && (
                                <div
                                    className={
                                        `${styles.heroContent} ` +
                                        (slide.show_content !== false
                                            ? (overlayVisible ? styles.heroContentVisible : styles.heroContentHidden)
                                            : '')
                                    }
                                    style={{
                                        maxWidth: slide.content_max_width || '520px',
                                        padding: isMobile ? '24px 20px' : '40px',
                                        borderRadius: '24px',
                                        background: 'rgba(20, 20, 20, 0.45)',
                                        backdropFilter: 'blur(16px)',
                                        WebkitBackdropFilter: 'blur(16px)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'absolute',
                                        left: isMobile ? '50%' : `${coordinateMap[slide.alignment] + (parseInt(slide.offset_x) || 0)}%`,
                                        top: isMobile ? '50%' : `${coordinateMap[slide.vertical_alignment] + (parseInt(slide.offset_y) || 0)}%`,
                                        transform: 'translate(-50%, -50%)',
                                        textAlign: isMobile ? 'center' : (slide.alignment === 'center' ? 'center' : slide.alignment === 'right' ? 'right' : 'left') as any,
                                        pointerEvents: 'auto',
                                        width: isMobile ? '92%' : 'fit-content',
                                        zIndex: 3,
                                        opacity: slide.show_content !== false ? (overlayVisible ? 1 : 0) : 1,
                                        transition: slide.show_content !== false ? 'opacity 0.8s ease' : 'none',
                                    }}
                                >
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
                            )}
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

            {/* NEW: World Cup Guesses Section (Bolão) */}
            {activeTheme === "copa_do_mundo" && (
                <section style={{
                    padding: "4rem 1rem",
                    background: "linear-gradient(135deg, rgba(16, 124, 65, 0.05) 0%, rgba(0, 39, 118, 0.05) 100%)",
                    borderBottom: "1px solid rgba(16, 124, 65, 0.1)",
                }}>
                    <div style={{
                        maxWidth: "1200px",
                        margin: "0 auto",
                        background: "rgba(255, 255, 255, 0.85)",
                        backdropFilter: "blur(16px)",
                        border: "1.5px solid rgba(16, 124, 65, 0.2)",
                        borderRadius: "24px",
                        padding: isMobile ? "2rem 1.5rem" : "3rem",
                        boxShadow: "0 10px 40px rgba(16, 124, 65, 0.08)",
                        position: "relative",
                        overflow: "hidden"
                    }}>
                        {/* Decorative flags/elements background */}
                        <div style={{
                            position: "absolute",
                            top: "-30px",
                            right: "-30px",
                            fontSize: "6rem",
                            opacity: 0.12,
                            pointerEvents: "none",
                            userSelect: "none"
                        }}>⚽</div>
                        <div style={{
                            position: "absolute",
                            bottom: "-20px",
                            left: "-20px",
                            fontSize: "6rem",
                            opacity: 0.1,
                            pointerEvents: "none",
                            userSelect: "none"
                        }}>🇧🇷</div>

                        <div style={{ textAlign: "center", marginBottom: "2.5rem", position: "relative", zIndex: 1 }}>
                            <span style={{
                                background: "rgba(247, 200, 21, 0.25)",
                                color: "#0a522b",
                                padding: "6px 16px",
                                borderRadius: "20px",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "1px"
                            }}>
                                🏆 Bolão Ecosopis Copa 2026
                            </span>
                            <h2 style={{
                                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                                fontWeight: 800,
                                color: "#002776",
                                marginTop: "0.75rem",
                                marginBottom: "0.5rem"
                            }}>
                                Palpites dos Jogos do Brasil 🇧🇷
                            </h2>
                            <p style={{
                                color: "#4a4a4a",
                                fontSize: "1.05rem",
                                maxWidth: "600px",
                                margin: "0 auto",
                                lineHeight: 1.5
                            }}>
                                Acerte o placar cheio de qualquer jogo do Brasil e ganhe na hora um cupom de <strong>{bolaoDiscount}% de desconto</strong> para usar em nosso site!
                            </p>
                        </div>

                        {!user ? (
                            <div style={{
                                textAlign: "center",
                                padding: "2.5rem",
                                background: "linear-gradient(135deg, rgba(0,39,118,0.05) 0%, rgba(16,124,65,0.05) 100%)",
                                borderRadius: "20px",
                                border: "1.5px dashed rgba(0, 39, 118, 0.25)",
                                maxWidth: "550px",
                                margin: "0 auto",
                                position: "relative",
                                zIndex: 1
                            }}>
                                <span style={{ fontSize: "3rem", display: "block", marginBottom: "0.75rem" }}>🏆</span>
                                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#002776", marginBottom: "0.5rem" }}>
                                    Participe do Bolão e Ganhe {bolaoDiscount}% de Desconto!
                                </h3>
                                <p style={{ fontSize: "0.95rem", color: "#555", marginBottom: "1.5rem", lineHeight: 1.5 }}>
                                    Entre na sua conta ou crie uma gratuitamente para salvar seus palpites e resgatar seus prêmios. É rápido e fácil!
                                </p>
                                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                                    <Link href="/conta" className="btn-primary" style={{ padding: "0.85rem 2rem", display: "inline-block", textDecoration: "none", fontWeight: 700 }}>
                                        Entrar na Conta
                                    </Link>
                                    <Link href="/conta" className="btn-outline" style={{ padding: "0.85rem 2rem", display: "inline-block", textDecoration: "none", fontWeight: 700 }}>
                                        Criar Conta Grátis
                                    </Link>
                                </div>
                            </div>
                        ) : loadingCupMatches ? (
                            <div style={{ textAlign: "center", padding: "3rem" }}>
                                <div style={{
                                    border: "4px solid rgba(16, 124, 65, 0.1)",
                                    borderLeftColor: "#107c41",
                                    borderRadius: "50%",
                                    width: "36px",
                                    height: "36px",
                                    animation: "spin 1s linear infinite",
                                    margin: "0 auto 1rem auto"
                                }} />
                                <p style={{ color: "#666", fontSize: "0.95rem" }}>Carregando jogos do Brasil...</p>
                            </div>
                        ) : (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                                gap: "2rem",
                                position: "relative",
                                zIndex: 1
                            }}>
                                {cupMatches.map((match) => {
                                    const input = cupGuessInputs[match.id] || { score_a: "", score_b: "" };
                                    const feedback = cupFeedback[match.id];
                                    const isSaving = savingGuessId === match.id;
                                    
                                    const matchDate = new Date(match.match_time);
                                    const dateStr = matchDate.toLocaleDateString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric"
                                    });
                                    const timeStr = matchDate.toLocaleTimeString("pt-BR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: false
                                    });

                                    return (
                                        <div
                                            key={match.id}
                                            style={{
                                                background: match.is_unlocked ? "white" : "#f8f9fa",
                                                border: match.is_finalized 
                                                    ? "2px solid #bae6fd" 
                                                    : match.is_unlocked 
                                                        ? "2px solid rgba(16, 124, 65, 0.15)" 
                                                        : "2px solid #e9ecef",
                                                borderRadius: "20px",
                                                padding: "2rem 1.5rem",
                                                boxShadow: match.is_unlocked ? "0 4px 15px rgba(0,0,0,0.03)" : "none",
                                                position: "relative",
                                                transition: "all 0.3s ease",
                                                opacity: match.is_unlocked ? 1 : 0.65,
                                            }}
                                        >
                                            {/* Top match header */}
                                            <div style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: "1.25rem",
                                                borderBottom: "1px solid #f1f3f5",
                                                paddingBottom: "0.75rem"
                                            }}>
                                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#666" }}>
                                                    📅 {dateStr} às {timeStr}h
                                                </span>
                                                <span style={{
                                                    fontSize: "0.72rem",
                                                    fontWeight: 700,
                                                    padding: "3px 8px",
                                                    borderRadius: "12px",
                                                    background: match.is_finalized 
                                                        ? "#e0f2fe" 
                                                        : match.cutoff_passed 
                                                            ? "#fee2e2" 
                                                            : match.is_unlocked 
                                                                ? "#dcfce7" 
                                                                : "#f1f3f5",
                                                    color: match.is_finalized 
                                                        ? "#0369a1" 
                                                        : match.cutoff_passed 
                                                            ? "#b91c1c" 
                                                            : match.is_unlocked 
                                                                ? "#15803d" 
                                                                : "#6c757d",
                                                    textTransform: "uppercase"
                                                }}>
                                                    {match.is_finalized 
                                                        ? "Finalizado" 
                                                        : match.cutoff_passed 
                                                            ? "Fechado" 
                                                            : match.is_unlocked 
                                                                ? "Aberto" 
                                                                : "🔒 Bloqueado"}
                                                </span>
                                            </div>

                                            {/* Stadium and Teams */}
                                            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                                                <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
                                                    📍 {match.stadium || "Estádio da Copa"}
                                                </div>
                                                
                                                <div style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "1rem",
                                                    fontSize: "1.25rem",
                                                    fontWeight: 700,
                                                    color: "#1a1a1a"
                                                }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        🇧🇷 {match.team_a}
                                                    </span>
                                                    <span style={{ color: "#aaa", fontWeight: 400 }}>vs</span>
                                                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        {match.team_b === "Haiti" ? "🇭🇹" : "🇨🇴"} {match.team_b}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Content based on status */}
                                            {!match.is_unlocked ? (
                                                <div style={{
                                                    textAlign: "center",
                                                    padding: "1rem",
                                                    color: "#777",
                                                    fontSize: "0.88rem",
                                                    background: "#f1f3f5",
                                                    borderRadius: "12px",
                                                    border: "1px solid #e9ecef"
                                                }}>
                                                    🔒 Jogo bloqueado: palpite liberado apenas após concluir o jogo anterior.
                                                </div>
                                            ) : match.is_finalized ? (
                                                <div style={{ textAlign: "center" }}>
                                                    {/* Official result */}
                                                    <div style={{
                                                        background: "#bae6fd",
                                                        padding: "0.75rem",
                                                        borderRadius: "12px",
                                                        fontSize: "1.1rem",
                                                        fontWeight: 700,
                                                        color: "#0369a1",
                                                        marginBottom: "1rem"
                                                    }}>
                                                        Placar Oficial: {match.score_a} x {match.score_b}
                                                    </div>

                                                    {/* User result */}
                                                    {match.user_guess ? (
                                                        <div style={{
                                                            padding: "1rem",
                                                            borderRadius: "12px",
                                                            background: match.user_guess.is_correct ? "#dcfce7" : "#fee2e2",
                                                            border: match.user_guess.is_correct ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                                            fontSize: "0.92rem",
                                                            color: match.user_guess.is_correct ? "#15803d" : "#b91c1c"
                                                        }}>
                                                            <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                                                                Seu palpite foi: {match.user_guess.guess_score_a} x {match.user_guess.guess_score_b}
                                                            </div>
                                                            {match.user_guess.is_correct ? (
                                                                <div>
                                                                    🎉 Parabéns! Você acertou em cheio!
                                                                    <div style={{
                                                                        marginTop: "10px",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        gap: "8px",
                                                                        background: "white",
                                                                        padding: "6px 12px",
                                                                        borderRadius: "8px",
                                                                        border: "1px dashed #22c55e"
                                                                    }}>
                                                                        <strong style={{ fontSize: "1rem", color: "#107c41" }}>
                                                                            {match.user_guess.reward_coupon_code}
                                                                        </strong>
                                                                        <button 
                                                                            onClick={() => copyToClipboard(match.user_guess.reward_coupon_code)}
                                                                            style={{
                                                                                border: "none",
                                                                                background: "#107c41",
                                                                                color: "white",
                                                                                fontSize: "0.75rem",
                                                                                padding: "4px 8px",
                                                                                borderRadius: "6px",
                                                                                fontWeight: 700,
                                                                                cursor: "pointer"
                                                                            }}
                                                                        >
                                                                            Copiar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div>Não foi dessa vez! Boa sorte no próximo jogo. 🍀</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: "0.85rem", color: "#888" }}>
                                                            Você não enviou palpite para este jogo.
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    {/* Guesses input area */}
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: "10px",
                                                        marginBottom: "1.25rem"
                                                    }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            disabled={match.cutoff_passed || isSaving}
                                                            value={input.score_a}
                                                            onChange={(e) => setCupGuessInputs(prev => ({
                                                                ...prev,
                                                                [match.id]: { ...input, score_a: e.target.value }
                                                            }))}
                                                            style={{
                                                                width: "60px",
                                                                padding: "0.6rem",
                                                                borderRadius: "10px",
                                                                border: "1.5px solid #ccc",
                                                                textAlign: "center",
                                                                fontSize: "1.2rem",
                                                                fontWeight: 700
                                                            }}
                                                        />
                                                        <span style={{ fontSize: "1.2rem", color: "#666", fontWeight: 700 }}>x</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            disabled={match.cutoff_passed || isSaving}
                                                            value={input.score_b}
                                                            onChange={(e) => setCupGuessInputs(prev => ({
                                                                ...prev,
                                                                [match.id]: { ...input, score_b: e.target.value }
                                                            }))}
                                                            style={{
                                                                width: "60px",
                                                                padding: "0.6rem",
                                                                borderRadius: "10px",
                                                                border: "1.5px solid #ccc",
                                                                textAlign: "center",
                                                                fontSize: "1.2rem",
                                                                fontWeight: 700
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Save Button */}
                                                    {!match.cutoff_passed && (
                                                        <button
                                                            onClick={() => handleSaveGuess(match.id)}
                                                            disabled={isSaving}
                                                            className="btn-primary"
                                                            style={{
                                                                width: "100%",
                                                                padding: "0.7rem",
                                                                borderRadius: "10px",
                                                                border: "none",
                                                                fontSize: "0.9rem",
                                                                fontWeight: 700,
                                                                cursor: isSaving ? "not-allowed" : "pointer"
                                                            }}
                                                        >
                                                            {isSaving 
                                                                ? "Salvando..." 
                                                                : match.user_guess 
                                                                    ? "⚽ Atualizar Palpite" 
                                                                    : "⚽ Enviar Palpite"}
                                                        </button>
                                                    )}

                                                    {/* Guess Feedback messages */}
                                                    {feedback && (
                                                        <div style={{
                                                            fontSize: "0.82rem",
                                                            textAlign: "center",
                                                            marginTop: "8px",
                                                            fontWeight: 600,
                                                            color: feedback.type === "success" ? "#15803d" : "#b91c1c"
                                                        }}>
                                                            {feedback.text}
                                                        </div>
                                                    )}

                                                    {/* Cutoff message or current guess confirmation */}
                                                    {match.cutoff_passed ? (
                                                        <div style={{
                                                            textAlign: "center",
                                                            fontSize: "0.85rem",
                                                            color: "#b91c1c",
                                                            fontWeight: 600,
                                                            padding: "6px",
                                                            background: "#fee2e2",
                                                            borderRadius: "8px"
                                                        }}>
                                                            ⏳ Palpites fechados 1 hora antes do início do jogo.
                                                        </div>
                                                    ) : (
                                                        match.user_guess && (
                                                            <div style={{
                                                                textAlign: "center",
                                                                fontSize: "0.8rem",
                                                                color: "#666",
                                                                marginTop: "10px"
                                                            }}>
                                                                Placar atual: <strong>{match.user_guess.guess_score_a} x {match.user_guess.guess_score_b}</strong> (pode alterar até 1h antes do jogo)
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* NEW: Stats & Brand Commitment Section */}
            <section className={styles.statsSection}>
                <div className="container">
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}><Heart size={32} /></div>
                            <h3>+200 MIL</h3>
                            <p>Pedidos enviados com amor</p>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}><Users size={32} /></div>
                            <h3>+50 MIL</h3>
                            <p>Clientes transformadas</p>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}><ShieldCheck size={32} /></div>
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
                        <p className={styles.historyHighlight}>O natural que funciona.</p>
                    </div>
                </div>
            </section>

            {/* Bestsellers Ranking - Product Cards */}
            <section className={styles.bestsellersSection}>
                <div className="container">
                    <div className={styles.bestsellersHeader}>
                        <h2 className={styles.sectionTitle}>Os Mais Vendidos 👑</h2>
                        <p>Os produtos e protocolos que estão transformando a pele das nossas clientes.</p>
                    </div>
                    <div className={styles.bestsellersGrid}>
                        <div className={styles.bestsellerWrapper}>
                            <div className={`${styles.rankBadge} ${styles.rankBadgeTop1}`}>👑 TOP 1 - MAIS VENDIDO</div>
                            {findProductBySlug('sabonete-acafrao-dolomita') && (
                                <ProductCard product={findProductBySlug('sabonete-acafrao-dolomita')} badge="Nosso mais vendido" showMarketplace={false} />
                            )}
                        </div>
                        <div className={styles.bestsellerWrapper}>
                            <div className={`${styles.rankBadge} ${isValentines ? styles.rankBadgeHeart : styles.rankBadgeStar}`}>
                                {isValentines ? '❤️' : '✨'} QUERIDINHO DAS CLIENTES
                            </div>
                            {findProductBySlug('kit-clareamento') && (
                                <ProductCard product={findProductBySlug('kit-clareamento')} showMarketplace={false} />
                            )}
                        </div>
                        <div className={styles.bestsellerWrapper}>
                            <div className={`${styles.rankBadge} ${isValentines ? styles.rankBadgeHeart : styles.rankBadgeStar}`}>
                                {isValentines ? '❤️' : '✨'} QUERIDINHO DAS CLIENTES
                            </div>
                            {findProductBySlug('oleo-ricino') && (
                                <ProductCard product={findProductBySlug('oleo-ricino')} showMarketplace={false} />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Reviews Section - Moved up for Social Proof */}
            <section className={styles.reviewsSection}>
                <div className="container">
                    <h2 className={styles.sectionTitle} style={{ textAlign: 'center', marginBottom: '40px' }}>EXPERIÊNCIAS ECOSOPIS</h2>

                    <div className={styles.reviewsMarqueeWrapper}>
                        {reviews.length > 0 || staticReviews.length > 0 ? (
                            <div className={styles.reviewsTrack}>
                                {/* Render First Set */}
                                {[...staticReviews, ...reviews].map((rev: any, index: number) => (
                                    <div key={`rev-1-${rev.id || index}`} className={styles.reviewCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <div className={styles.reviewStars}>
                                                {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                            </div>
                                            {rev.date && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>{rev.date}</span>}
                                        </div>

                                        {rev.product && (
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-green)', background: 'rgba(74,124,89,0.08)', padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginBottom: '8px' }}>
                                                {rev.product}
                                            </span>
                                        )}

                                        <p className={styles.reviewComment}>&quot;{rev.comment}&quot;</p>

                                        {rev.imageUrl && (
                                            <div style={{ position: 'relative', width: '100%', height: '150px', marginTop: '10px', borderRadius: '8px', overflow: 'hidden' }}>
                                                <Image src={rev.imageUrl} alt="Antes e Depois" fill style={{ objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>ANTES → DEPOIS</div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--neutral-gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                                                    {rev.user_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={styles.reviewAuthor}>{rev.user_name}</span>
                                            </div>
                                            {rev.source && rev.source !== 'Shopee' && (
                                                <span style={{ fontSize: '0.65rem', background: 'var(--neutral-gray-100)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--neutral-gray-200)' }}>
                                                    ✓ {rev.source}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {/* Render Second Set for Seamless Infinite Scroll */}
                                {[...staticReviews, ...reviews].map((rev: any, index: number) => (
                                    <div key={`rev-2-${rev.id || index}`} className={styles.reviewCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <div className={styles.reviewStars}>
                                                {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                            </div>
                                            {rev.date && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>{rev.date}</span>}
                                        </div>

                                        {rev.product && (
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-green)', background: 'rgba(74,124,89,0.08)', padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginBottom: '8px' }}>
                                                {rev.product}
                                            </span>
                                        )}

                                        <p className={styles.reviewComment}>&quot;{rev.comment}&quot;</p>

                                        {rev.imageUrl && (
                                            <div style={{ position: 'relative', width: '100%', height: '150px', marginTop: '10px', borderRadius: '8px', overflow: 'hidden' }}>
                                                <Image src={rev.imageUrl} alt="Antes e Depois" fill style={{ objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>ANTES → DEPOIS</div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--neutral-gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                                                    {rev.user_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={styles.reviewAuthor}>{rev.user_name}</span>
                                            </div>
                                            {rev.source && rev.source !== 'Shopee' && (
                                                <span style={{ fontSize: '0.65rem', background: 'var(--neutral-gray-100)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--neutral-gray-200)' }}>
                                                    ✓ {rev.source}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ textAlign: 'center', opacity: 0.7 }}>
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

            {/* Goal Selector Section - Redesigned as a 'Diagnostic' */}
            <section id="diagnostico" className={styles.diagnosticSection} ref={goalsRef}>
                <div className="container">
                    <div className={styles.diagnosticHeader}>
                        <span className={styles.sectionBadge}>CONSULTORIA EXPRESS</span>
                        <h2 className={styles.diagnosticTitle}>Selecione seu desafio hoje</h2>
                        <p className={styles.diagnosticSubtitle}>Receba uma recomendação personalizada da nossa I.A. em segundos.</p>
                    </div>
                    
                    <div className={styles.diagnosticGrid}>
                        <div className={styles.diagnosticCard} onClick={() => openGoalModal('clareamento')}>
                            <div className={styles.diagnosticIcon}><Sparkles size={40} /></div>
                            <div className={styles.diagnosticContent}>
                                <h3>Pele com Manchas</h3>
                                <p>Para uniformizar a pele e clarear marcas</p>
                                <span className={styles.diagnosticAction}>QUERO TRATAR <ChevronRight size={16} /></span>
                            </div>
                        </div>
                        
                        <div className={styles.diagnosticCard} onClick={() => openGoalModal('acne')}>
                            <div className={styles.diagnosticIcon}><Zap size={40} /></div>
                            <div className={styles.diagnosticContent}>
                                <h3>Acne e Oleosidade</h3>
                                <p>Para controlar oleosidade e reduzir espinhas</p>
                                <span className={styles.diagnosticAction}>QUERO TRATAR <ChevronRight size={16} /></span>
                            </div>
                        </div>
                        
                        <div className={styles.diagnosticCard} onClick={() => openGoalModal('foliculite')}>
                            <div className={styles.diagnosticIcon}><Droplets size={40} /></div>
                            <div className={styles.diagnosticContent}>
                                <h3>Foliculite e Pelos <span className={styles.popularMiniBadge}>Nosso mais vendido</span></h3>
                                <p>Adeus foliculite, pele lisa e uniforme</p>
                                <span className={styles.diagnosticAction}>QUERO TRATAR <ChevronRight size={16} /></span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* NEW: Minha Rotina Ideal Section */}
            <section id="minha-rotina" className={styles.routineBuilderSection}>
                <div className="container">
                    <div className={styles.routineBuilderHeader}>
                        <h2>Minha Rotina Ideal <span className={styles.liaBadge}>com Lia</span></h2>
                        <p>Seu fluxograma personalizado de cuidados, gerado em tempo real pela nossa I.A.</p>
                    </div>

                    {!routineSteps.am.length && !routineLoading ? (
                        <div className={styles.routinePlaceholder}>
                            <div className={styles.liaLargeAvatar}>
                                <Image src="/static/attached_assets/generated_images/lia_avatar.webp" alt="Lia" fill />
                            </div>
                            <h3>Vamos montar sua rotina ideal?</h3>
                            <p>Escolha um objetivo abaixo para a Lia criar seu cronograma personalizado em segundos.</p>
                            <div className={styles.routineGoalButtons}>
                                <button className="btn-outline" onClick={() => buildRoutine('clareamento')}>CLAREAR MANCHAS</button>
                                <button className="btn-outline" onClick={() => buildRoutine('acne')}>REDUZIR ACNE</button>
                                <button className="btn-outline" onClick={() => buildRoutine('foliculite')}>TRATAR FOLICULITE</button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.routineFlowContainer}>
                            {routineLoading ? (
                                <div className={styles.routineLoading}>
                                    <div className={styles.spinner}></div>
                                    <p>Lia está analisando seus objetivos...</p>
                                </div>
                            ) : (
                                <div className={styles.routineTimeline}>
                                    {/* Morning Routine */}
                                    <div className={styles.timelineBlock}>
                                        <div className={styles.timelineHeader}>
                                            <div className={styles.timelineIcon}><Sun size={32} /></div>
                                            <h3>Passos Principais</h3>
                                        </div>
                                        <div className={styles.timelineFlow}>
                                            {routineSteps.am.map((item, idx) => (
                                                <div key={idx} className={styles.flowStep}>
                                                    <div className={styles.stepImageWrapper}>
                                                        {item.image_url ? (
                                                            <Image src={item.image_url} alt={item.name} fill className={styles.stepImage} />
                                                        ) : (
                                                            <div className={styles.stepImagePlaceholder} />
                                                        )}
                                                        <div className={styles.stepNumberOverlay}>{idx + 1}</div>
                                                    </div>
                                                    <div className={styles.stepContent}>
                                                        <span className={styles.stepLabel}>{item.step}</span>
                                                        <h4>{item.name}</h4>
                                                        <p>{item.instruction}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.timelineConnector}>
                                        <ArrowRight size={32} className={styles.connectorIcon} />
                                    </div>

                                    {/* Night Routine */}
                                    <div className={styles.timelineBlock}>
                                        <div className={styles.timelineHeader}>
                                            <div className={styles.timelineIcon}><Moon size={32} /></div>
                                            <h3>Complementares e Extras</h3>
                                        </div>
                                        <div className={styles.timelineFlow}>
                                            {routineSteps.pm.map((item, idx) => (
                                                <div key={idx} className={styles.flowStep}>
                                                    <div className={styles.stepImageWrapper}>
                                                        {item.image_url ? (
                                                            <Image src={item.image_url} alt={item.name} fill className={styles.stepImage} />
                                                        ) : (
                                                            <div className={styles.stepImagePlaceholder} />
                                                        )}
                                                        <div className={styles.stepNumberOverlay}>{idx + 1}</div>
                                                    </div>
                                                    <div className={styles.stepContent}>
                                                        <span className={styles.stepLabel}>{item.step}</span>
                                                        <h4>{item.name}</h4>
                                                        <p>{item.instruction}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.routineFooter}>
                                        <div className={styles.routineSummary}>
                                            <div className={styles.summaryInfo}>
                                                <h4>Total do Protocolo:</h4>
                                                <span>{routineSteps.am.length + routineSteps.pm.length} etapas personalizadas</span>
                                            </div>
                                            <button className="btn-primary" onClick={addRoutineToCart}>ADICIONAR TUDO AO CARRINHO</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Goal Modal - Redesigned & Interactive */}
            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.modalClose} onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        
                        <div className={styles.modalBody}>
                            <div className={styles.modalLayout}>
                                {/* Left Side: Product Recommendation */}
                                <div className={styles.modalProductSide}>
                                    <span className={styles.modalBadge}>
                                        {selectedGoal === 'clareamento' ? 'FOCO EM CLAREAMENTO' : 
                                         selectedGoal === 'acne' ? 'CONTROLE DE ACNE' : 'PELE LISA'}
                                    </span>
                                    <h2>
                                        {selectedGoal === 'clareamento' ? 'Seu Caminho para uma Pele Uniforme' : 
                                         selectedGoal === 'acne' ? 'Pele Saudável e sem Oleosidade' : 'Adeus Foliculite e Irritações'}
                                    </h2>
                                    <p className={styles.modalGoalDescription}>
                                        {selectedGoal === 'clareamento' ? 'Uma rotina focada em uniformizar e iluminar sua pele.' : 
                                         selectedGoal === 'acne' ? 'Controle a oleosidade e cuide da acne com uma rotina simples e eficaz. Comece com o sabonete ou potencialize os resultados com o kit completo. O sabonete pode ser usado de manhã e à noite. O kit inclui também o creme facial para uso diário, ambos para qualquer hora do dia.' : 
                                         'Nosso mais vendido para quem busca uma pele mais uniforme, auxiliando no cuidado com foliculite e manchas.'}
                                    </p>
                                    
                                    <div className={styles.modalMainProduct}>
                                        {selectedGoal === 'clareamento' ? findProductBySlug('kit-clareamento') && (
                                            <ProductCard product={findProductBySlug('kit-clareamento')} badge="RECOMENDADO" isRecommended={true} showMarketplace={false} />
                                        ) : selectedGoal === 'acne' ? findProductBySlug('kit-acne') && (
                                            <ProductCard product={findProductBySlug('kit-acne')} badge="MAIS EFICAZ" isRecommended={true} showMarketplace={false} />
                                        ) : findProductBySlug('sabonete-acafrao-dolomita') && (
                                            <ProductCard product={findProductBySlug('sabonete-acafrao-dolomita')} badge="O FAVORITO" isRecommended={true} showMarketplace={false} />
                                        )}
                                    </div>
                                    
                                    {selectedGoal !== 'foliculite' && (
                                        <div className={styles.modalAlternativeSection}>
                                            <h4>Também recomendamos:</h4>
                                            <div className={styles.modalAltGrid}>
                                                {selectedGoal === 'clareamento' ? findProductBySlug('sabonete-acafrao-dolomita') && (
                                                    <ProductCard product={findProductBySlug('sabonete-acafrao-dolomita')} showMarketplace={false} />
                                                ) : selectedGoal === 'acne' ? findProductBySlug('sabonete-argila-verde') && (
                                                    <ProductCard product={findProductBySlug('sabonete-argila-verde')} showMarketplace={false} />
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Lia Interactive Box */}
                                <div className={styles.modalLiaSide}>
                                    <div className={styles.liaHeaderLarge}>
                                        <div className={styles.liaLargeAvatar}>
                                            <Image src="/static/attached_assets/generated_images/lia_avatar.webp" alt="Lia" fill />
                                        </div>
                                        <div className={styles.liaHeaderText}>
                                            <h3>Consultoria com a Lia</h3>
                                            <span>IA Especialista em Skincare</span>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.liaBubbleBox}>
                                        <div className={styles.liaMessageBubble}>
                                            <p className={styles.typingText}>{displayedTip}<span className={styles.cursor}>|</span></p>
                                        </div>
                                    </div>

                                    <div className={styles.modalChatBox}>
                                        <div className={styles.miniChatMessages}>
                                            {chatMessages.length === 0 && !chatLoading && (
                                                <p className={styles.miniChatEmpty}>Ainda não há mensagens. Pergunte algo!</p>
                                            )}
                                            {chatMessages.slice(-3).map((msg, idx) => (
                                                <div key={idx} className={`${styles.miniMessage} ${styles[msg.role]}`}>
                                                    <strong>{msg.role === 'user' ? 'Você: ' : 'Lia: '}</strong>
                                                    {msg.content}
                                                </div>
                                            ))}
                                            {chatLoading && (
                                                <div className={styles.miniMessage}>
                                                    <em>Lia está processando...</em>
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.modalChatInput}>
                                            <input 
                                                placeholder="Pergunte algo para a Lia..." 
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                            />
                                            <button onClick={sendChatMessage}><Send size={18} /></button>
                                        </div>
                                        <p className={styles.miniChatDisclaimer}>A Lia responderá aqui e no chat principal abaixo.</p>
                                    </div>

                                    <div className={styles.modalActionGroup}>
                                        <button className="btn-primary" onClick={() => setIsModalOpen(false)}>CONTINUAR COMPRANDO</button>
                                        <button className="btn-outline" onClick={() => { setIsModalOpen(false); scrollToSection('rotina-ia'); }}>MAIS DÚVIDAS?</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Decision shortcuts */}
            <section className={styles.shortcutsSection}>
                <div className={styles.shortcutsOverlay}></div>
                <div className="container" style={{ position: 'relative', zIndex: 2 }}>
                    <div className={styles.shortcutsHeader}>
                        <h2 style={{ color: 'white' }}>Não sabe por onde começar?</h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)' }}>Atalhos rápidos para quem quer resultados agora.</p>
                    </div>
                    <div className={styles.shortcutGrid}>
                        <div className={styles.shortcutCard}>
                            <div className={styles.shortcutBadge}>🔥 TOP 1</div>
                            <h3>O mais vendido de todos</h3>
                            <p>Sabonete de Açafrão</p>
                            <button onClick={() => openGoalModal('foliculite')} className="btn-outline">VER DETALHES</button>
                        </div>
                        <div className={styles.shortcutCard}>
                            <div className={styles.shortcutBadge}>🎁 KIT INICIAL</div>
                            <h3>Melhor kit para iniciantes</h3>
                            <p>Kit Clareamento Potente</p>
                            <button onClick={() => openGoalModal('clareamento')} className="btn-outline">ESCOLHER ESSE TRATAMENTO</button>
                        </div>
                        <div className={styles.shortcutCard}>
                            <div className={styles.shortcutBadge}>✨ MAIS EFICAZ</div>
                            <h3>Melhor opção para acne</h3>
                            <p>Kit Acne e Oleosidade</p>
                            <button onClick={() => openGoalModal('acne')} className="btn-outline">QUERO ESSE PRODUTO</button>
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
                                <div className={styles.aiAvatar}>
                                    <Image src="/static/attached_assets/generated_images/lia_avatar.webp" alt="Lia" fill />
                                </div>
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

            {/* Floating Lia Chat - ChatIA flutuante controlado pelo estado da pagina */}
            <ChatIA isOpen={isChatOpen} onToggle={() => setIsChatOpen(prev => !prev)} />


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

            <Footer />
        </main >
    );
}
