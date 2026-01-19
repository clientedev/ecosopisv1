"use client";
import Link from "next/link";
import styles from "./Header.module.css";
import Image from "next/image";
import { useEffect, useState } from "react";
import { User, LogOut, Settings, LayoutDashboard, ChevronDown } from "lucide-react";

export default function Header() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [user, setUser] = useState<{ name: string, email: string, role: string } | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));

                const payload = JSON.parse(jsonPayload);
                // The token payload contains 'sub' (user_id), but we need the name.
                // For now, let's fetch the user profile or parse name if available.
                // Ideally, the token should include the name or we fetch it.
                
                const fetchProfile = async () => {
                    try {
                        const res = await fetch('/api/auth/me', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            const userData = await res.json();
                            setUser({
                                name: userData.full_name,
                                email: userData.email,
                                role: userData.role
                            });
                            if (userData.role === 'admin') {
                                setIsAdmin(true);
                            }
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
            <div className={`container ${styles.headerContent}`}>
                <div className={styles.logo}>
                    <Link href="/">
                        <div className={styles.logoContainer}>
                            <Image
                                src="/attached_assets/image_1768566026984.png"
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

                <nav className={styles.nav}>
                    <Link href="/produtos">PRODUTOS</Link>
                    <Link href="/quizz">QUIZZ</Link>
                    <Link href="/box">BOX SURPRESA</Link>
                    <Link href="/sobre">SOBRE</Link>
                </nav>

                <div className={styles.actions}>
                    <Link href="/carrinho" className={styles.actionIcon}>CARRINHO</Link>
                    
                    {user ? (
                        <div className={styles.userMenuContainer}>
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
                        <Link href="/conta" className={styles.actionIcon}>ENTRAR</Link>
                    )}
                </div>
            </div>
        </header>
    );
}
