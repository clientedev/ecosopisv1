"use client";
import Link from "next/link";
import styles from "./Header.module.css";
import Image from "next/image";

export default function Header() {
    return (
        <header className={styles.header}>
            <div className={`container ${styles.headerContent}`}>
                <div className={styles.logo}>
                    <Link href="/">
                        <div className={styles.logoContainer}>
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
                    <Link href="/conta" className={styles.actionIcon}>CONTA</Link>
                    <Link href="/carrinho" className={styles.actionIcon}>CARRINHO</Link>
                </div>
            </div>
        </header>
    );
}
