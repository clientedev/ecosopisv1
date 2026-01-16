"use client";
import Link from "next/link";
import styles from "./Header.module.css";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Header() {
    const [isAdmin, setIsAdmin] = useState(false);

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
                if (payload.role === 'admin') {
                    setIsAdmin(true);
                }
            } catch (e) {
                console.error("Error parsing token", e);
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsAdmin(false);
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
                                width={50}
                                height={50}
                                style={{ objectFit: 'contain', marginRight: '10px' }}
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
                    {isAdmin && <Link href="/admin/dashboard" style={{ color: 'var(--primary-green)', fontWeight: 'bold' }}>PAINEL ADMIN</Link>}
                    {(isAdmin || (typeof window !== 'undefined' && localStorage.getItem("token"))) && (
                        <button 
                            onClick={handleLogout} 
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#ef4444', 
                                cursor: 'pointer', 
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginLeft: '10px'
                            }}
                        >
                            SAIR
                        </button>
                    )}
                </nav>

                <div className={styles.actions}>
                    <Link href="/perfil" className={styles.actionIcon}>CONTA</Link>
                    <Link href="/carrinho" className={styles.actionIcon}>CARRINHO</Link>
                </div>
            </div>
        </header>
    );
}
