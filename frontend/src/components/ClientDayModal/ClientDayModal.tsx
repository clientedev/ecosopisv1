"use client";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import styles from "./ClientDayModal.module.css";

export default function ClientDayModal() {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        const now = new Date();
        const deadline = new Date("2026-09-16T00:00:00-03:00");
        if (now >= deadline) return;

        const seen = sessionStorage.getItem("cdm_seen");
        if (seen) return;

        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
    }, []);

    const close = useCallback(() => {
        setVisible(false);
        sessionStorage.setItem("cdm_seen", "1");
    }, []);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText("DIADOCLIENTE").catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const handleGoToProducts = useCallback(() => {
        close();
        router.push("/produtos");
    }, [close, router]);

    if (!mounted || !visible) return null;

    return createPortal(
        <div
            className={styles.overlay}
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
            aria-modal="true"
            role="dialog"
            aria-label="Promoção Dia do Cliente"
        >
            <div className={styles.modal}>
                <div className={styles.topStrip}>
                    <span>?</span>
                    <span className={styles.stripText}>DIA DO CLIENTE</span>
                    <span>?</span>
                </div>

                <button className={styles.closeBtn} onClick={close} aria-label="Fechar">
                    ?
                </button>

                <div className={styles.body}>
                    <div className={styles.badge}>
                        <span className={styles.badgeNum}>15%</span>
                        <span className={styles.badgeOff}>OFF</span>
                    </div>

                    <h2 className={styles.title}>Presente<br />da Ecosopis</h2>

                    <p className={styles.sub}>
                        Cuidado real vem da natureza.<br />
                        Hoje a gente facilita o caminho.
                    </p>

                    <p className={styles.rule}>
                        Em compras acima de <strong>R$&nbsp;50,00</strong> · Válido até meia-noite
                    </p>

                    <div className={styles.couponRow}>
                        <div className={styles.couponBox}>DIADOCLIENTE</div>
                        <button
                            className={copied ? `${styles.copyBtn} ${styles.copyBtnDone}` : styles.copyBtn}
                            onClick={handleCopy}
                        >
                            {copied ? "Copiado ?" : "Copiar"}
                        </button>
                    </div>

                    <p className={styles.couponHint}>
                        O cupom é aplicado automaticamente no carrinho
                    </p>

                    <button className={styles.ctaBtn} onClick={handleGoToProducts}>
                        Quero aproveitar
                        <span className={styles.ctaArrow}>?</span>
                    </button>

                    <button className={styles.skipBtn} onClick={close}>
                        Agora não
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
