"use client";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import styles from "./ClientDayModal.module.css";

export default function ClientDayModal() {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
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
            aria-label="Dia do Cliente Ecosopis"
        >
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={close} aria-label="Fechar modal">
                    ✕
                </button>

                <div className={styles.content}>
                    <div className={styles.tag}>Especial Dia do Cliente</div>

                    <h2 className={styles.title}>15% OFF em todo o site</h2>

                    <p className={styles.description}>
                        Hoje suas compras acima de <strong>R$&nbsp;50,00</strong> ganham 15% de desconto especial.
                    </p>

                    <div className={styles.autoApplyNotice}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>O desconto entra automaticamente no seu carrinho</span>
                    </div>

                    <p className={styles.validity}>
                        Válido somente hoje até as 23h59
                    </p>

                    <div className={styles.actions}>
                        <button className={styles.primaryBtn} onClick={handleGoToProducts}>
                            Aproveitar desconto
                        </button>
                        <button className={styles.secondaryBtn} onClick={close}>
                            Continuar navegando
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}