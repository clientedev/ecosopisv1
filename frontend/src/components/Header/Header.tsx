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
                        <Image
                            src="https://acdn-us.mitiendanube.com/stores/003/178/794/themes/common/logo-65144578-1764594496-26e39c18ae7ef0f89bef32b1271fd7561764594496-640-0.webp"
                            alt="ECOSOPIS"
                            width={150}
                            height={50}
                            style={{ objectFit: 'contain' }}
                        />
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
