"use client";
import Link from "next/link";
import styles from "./Header.module.css";
import Image from "next/image";
import { useEffect, useState } from "react";
import { User, LogOut, Settings, LayoutDashboard, ChevronDown, Menu, X, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function Header() {
    const { cartCount } = useCart();
    const [isAdmin, setIsAdmin] = useState(false);
    const [user, setUser] = useState<{ name: string, email: string, role: string } | null>(null);
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

        const token = localStorage.getItem("token");
        if (token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));

                const payload = JSON.parse(jsonPayload);
                // The token payload contains 'sub' (user_id), but we need the name.
                // For now, let's fetch the user profile or parse name if available.
                // Ideally, the token should include the name or we fetch it.

                const fetchProfile = async () => {
                    try {
                        const response = await fetch('/api/auth/me', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.status === 401) {
                            localStorage.removeItem("token");
                            setUser(null);
                            setIsAdmin(false);
                            return;
                        }
                        if (response.ok) {
                            const userData = await response.json();
                            setUser({
                                name: userData.full_name,
                                email: userData.email,
                                role: userData.role
                            });
                            if (userData.role === 'admin') {
                                setIsAdmin(true);
                            }
                        } else if (response.status === 401) {
                            // Clear invalid token
                            localStorage.removeItem("token");
                            setUser(null);
                            setIsAdmin(false);
                        }
                    } catch (err) {
                        console.error("Error fetching profile", err);
                    }
                };
                fetchProfile();
            } catch (e) {
                console.error("Error parsing token", e);
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setUser(null);
        setIsAdmin(false);
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
                                src="/logo_final.png"
                                alt="ECOSOPIS Logo"
                                width={100}
                                height={100}
                                className={styles.logoImage}
                                priority
                            />
                            <span className={styles.logoText}>ECOSOPIS</span>
                        </div>
                    </Link>
                </div>

                <nav className={`${styles.nav} ${isMobileMenuOpen ? styles.navOpen : ''}`}>
                    <Link href="/produtos" onClick={() => setIsMobileMenuOpen(false)}>PRODUTOS</Link>
                    <Link href="/novidades" onClick={() => setIsMobileMenuOpen(false)}>NOVIDADES</Link>
                    <Link href="/quizz" onClick={() => setIsMobileMenuOpen(false)}>QUIZZ</Link>
                    <Link href="/sobre" onClick={() => setIsMobileMenuOpen(false)}>SOBRE</Link>
                    {/* Mobile-only action buttons inside overlay */}
                    <div className={styles.mobileActions}>
                        <Link href="/carrinho" className={styles.actionIcon} onClick={() => setIsMobileMenuOpen(false)}>
                            <div className={styles.cartLinkContent}>
                                🛒 CARRINHO
                                {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
                            </div>
                        </Link>
                        {user ? (
                            <>
                                <Link href="/perfil" className={styles.actionIcon} onClick={() => setIsMobileMenuOpen(false)}>👤 MINHA CONTA</Link>
                                {isAdmin && (
                                    <Link href="/admin/dashboard" className={styles.actionIcon} onClick={() => setIsMobileMenuOpen(false)}>⚙️ ADMIN</Link>
                                )}
                                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                    Sair
                                </button>
                            </>
                        ) : (
                            <Link href="/conta" className={styles.actionIcon} onClick={() => setIsMobileMenuOpen(false)}>ENTRAR</Link>
                        )}
                    </div>
                </nav>

                <div className={styles.actions} style={{ position: 'relative', zIndex: 1000 }}>
                    <Link href="/carrinho" className={`${styles.actionIcon} ${styles.desktopOnlyAction}`}>
                        <div className={styles.cartIconWrapper}>
                            <ShoppingCart size={22} />
                            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
                            <span className={styles.cartLabel}>CARRINHO</span>
                        </div>
                    </Link>

                    {user ? (

                        <div className={`${styles.userMenuContainer} ${styles.desktopOnlyAction}`}>
                            <button
                                className={styles.userButton}
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                            >
                                <div className={styles.avatar}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={styles.userName}>{user.name.split(' ')[0]}</span>
                                <ChevronDown size={16} className={`${styles.chevron} ${isMenuOpen ? styles.chevronOpen : ''}`} />
                            </button>

                            {isMenuOpen && (
                                <div className={styles.dropdown}>
                                    <div className={styles.dropdownHeader}>
                                        <strong>{user.name}</strong>
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
                        <Link href="/conta" className={`${styles.actionIcon} ${styles.desktopOnlyAction}`}>ENTRAR</Link>
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
        </header>
    );
}
