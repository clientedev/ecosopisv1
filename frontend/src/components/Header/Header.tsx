"use client";
import Link from "next/link";
import styles from "./Header.module.css";
import Image from "next/image";
import { useEffect, useState } from "react";
import { User, LogOut, Settings, LayoutDashboard, ChevronDown, Menu, X, ShoppingCart, Package, Newspaper, Zap, Info, Sparkles, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
    const { cartCount, cartTotal } = useCart();
    const { user, logout } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [announcement, setAnnouncement] = useState<{
        text: string,
        bg_color: string,
        text_color: string,
        is_active: boolean,
        is_scrolling: boolean,
        scroll_speed: number,
        repeat_text: boolean
    } | null>(null);

    useEffect(() => {
        const fetchAnnouncement = async () => {
            try {
                const res = await fetch('/api/products/announcement');
                if (res.ok) {
                    const data = await res.json();
                    setAnnouncement(data);
                }
            } catch (err) {
                console.error("Error fetching announcement", err);
            }
        };
        fetchAnnouncement();
    }, []);

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
        window.location.href = "/";
    };

    return (
        <header className={styles.header}>
            {announcement && announcement.is_active && (
                <div
                    className={styles.announcementBar}
                    style={{
                        backgroundColor: announcement.bg_color,
                        color: announcement.text_color,
                    }}
                >
                    {announcement.is_scrolling ? (
                        <div
                            className={styles.marqueeContent}
                            style={{ animationDuration: `${announcement.scroll_speed || 20}s` }}
                        >
                            {/* Original phrases */}
                            {announcement.text.split('||').map((phrase, i) => (
                                <span key={i} style={{ marginRight: '50px' }}>{phrase.trim()}</span>
                            ))}
                            {/* Conditional repetition for a smoother loop */}
                            {announcement.repeat_text !== false && announcement.text.split('||').map((phrase, i) => (
                                <span key={`rep-${i}`} style={{ marginRight: '50px' }}>{phrase.trim()}</span>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.staticText}>
                            {announcement.text.split('||')[0].trim()}
                        </div>
                    )}
                </div>
            )}
            <div className={`container ${styles.headerContent}`}>
                <div className={styles.logo}>
                    <Link href="/">
                        <div className={styles.logoContainer}>
                            <Image
                                src="/logo_nova_transparent.png"
                                alt="ECOSOPIS Logo"
                                width={669}
                                height={373}
                                sizes="(max-width: 900px) 170px, (max-width: 1200px) 220px, 260px"
                                quality={100}
                                className={styles.logoImage}
                                priority
                            />
                        </div>
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <nav className={styles.desktopNav}>
                    <Link href="/produtos">PRODUTOS</Link>
                    <Link href="/novidades">NOVIDADES</Link>
                    <Link href="/quizz">QUIZZ</Link>
                    <Link href="/lia" className={styles.liaLink}>
                        <Sparkles size={16} />
                        LIA AI
                    </Link>
                    <Link href="/sobre">SOBRE</Link>
                </nav>

                {/* Mobile Navigation (Side Drawer) */}
                <div className={`${styles.mobileNav} ${isMobileMenuOpen ? styles.mobileNavOpen : ''}`}>
                    <div className={styles.mobileMenuInner}>
                        <div className={styles.mobileMenuHeader}>
                            <div className={styles.logoContainer}>
                                <Image
                                    src="/logo_nova_transparent.png"
                                    alt="ECOSOPIS Logo"
                                    width={120}
                                    height={50}
                                    className={styles.mobileMenuLogo}
                                />
                            </div>
                            <button 
                                className={styles.mobileMenuButton} 
                                onClick={() => setIsMobileMenuOpen(false)}
                                style={{ display: 'flex' }}
                            >
                                <X size={28} />
                            </button>
                        </div>

                        <div className={styles.mobileMenuContent}>
                            <Link href="/produtos" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                <Package size={22} />
                                PRODUTOS
                            </Link>
                            <Link href="/atacado" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                <Truck size={22} />
                                ATACADO
                            </Link>
                            <Link href="/novidades" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                <Newspaper size={22} />
                                NOVIDADES
                            </Link>
                            <Link href="/quizz" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                <Zap size={22} />
                                QUIZZ
                            </Link>
                            <Link href="/lia" className={`${styles.mobileNavItem} ${styles.mobileLiaItem}`} onClick={() => setIsMobileMenuOpen(false)}>
                                <Sparkles size={22} />
                                LIA AI
                            </Link>
                            <Link href="/sobre" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                <Info size={22} />
                                SOBRE
                            </Link>
                        </div>

                        <div className={styles.mobileMenuFooter}>
                            <div className={styles.mobileActions}>
                                <Link href="/carrinho" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                    <ShoppingCart size={22} />
                                    CARRINHO
                                    {cartCount > 0 && <span className={styles.cartBadge} style={{ position: 'static', marginLeft: 'auto' }}>{cartCount}</span>}
                                </Link>
                                {user ? (
                                    <>
                                        <Link href="/perfil" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                            <User size={22} />
                                            MINHA CONTA
                                        </Link>
                                        {isAdmin && (
                                            <Link href="/admin/dashboard" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                                <LayoutDashboard size={22} />
                                                PAINEL ADMIN
                                            </Link>
                                        )}
                                        <button 
                                            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                                            className={styles.mobileLogoutBtn}
                                        >
                                            <LogOut size={20} />
                                            Sair da Conta
                                        </button>
                                    </>
                                ) : (
                                    <Link href="/conta" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
                                        <User size={22} />
                                        ENTRAR / CADASTRAR
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.actions} style={{ position: 'relative', zIndex: 1000 }}>
                    <Link href="/carrinho" className={styles.actionIcon}>
                        <div className={styles.cartIconWrapper}>
                            <ShoppingCart size={22} />
                            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
                            <span className={styles.cartLabel}>CARRINHO</span>
                        </div>
                    </Link>

                    {user ? (

                        <div className={styles.userMenuContainer}>
                            <button
                                className={styles.userButton}
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                            >
                                <div className={styles.avatar} style={{ overflow: 'hidden' }}>
                                    {/* @ts-ignore */}
                                    {user.profile_picture ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.profile_picture} alt={user.full_name || "User"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        (user.full_name || user.email || "U").charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className={styles.userName}>{(user.full_name || user.email || "User").split(' ')[0]}</span>
                                <ChevronDown size={16} className={`${styles.chevron} ${isMenuOpen ? styles.chevronOpen : ''}`} />
                            </button>

                            {isMenuOpen && (
                                <div className={styles.dropdown}>
                                    <div className={styles.dropdownHeader}>
                                        <strong>{user.full_name || "Membro Ecosopis"}</strong>
                                        <span>{user.email}</span>
                                    </div>
                                    <hr className={styles.divider} />
                                    <Link href="/perfil" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                                        <User size={18} />
                                        Minha Conta
                                    </Link>
                                    {isAdmin && (
                                        <Link href="/admin/dashboard" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                                            <LayoutDashboard size={18} />
                                            Painel Admin
                                        </Link>
                                    )}
                                    <hr className={styles.divider} />
                                    <button onClick={handleLogout} className={`${styles.dropdownItem} ${styles.logoutAction}`}>
                                        <LogOut size={18} />
                                        Sair
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/conta" className={styles.actionIcon}>
                            <User size={22} style={{ marginRight: 5 }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'none' }} className={styles.desktopTextInfo}>ENTRAR</span>
                        </Link>
                    )}

                    <button
                        className={styles.mobileMenuButton}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Global Cart Status Bar */}
            {cartCount > 0 && (
                <div style={{
                    backgroundColor: '#f0fdf4',
                    borderTop: '1px solid #dcfce7',
                    borderBottom: '1px solid #dcfce7',
                    padding: '8px 0',
                    fontSize: '0.85rem',
                    color: '#166534',
                    textAlign: 'center',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '20px',
                    flexWrap: 'wrap',
                    fontWeight: 500
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} /> 
                        Frete Grátis (Sul/Sudeste): {cartTotal >= 148.90 ? <strong style={{color: '#f59e0b'}}>ALCANÇADO!</strong> : <strong>Faltam R$ {(148.90 - cartTotal).toFixed(2).replace('.', ',')}</strong>}
                    </span>
                </div>
            )}
        </header>
    );
}
