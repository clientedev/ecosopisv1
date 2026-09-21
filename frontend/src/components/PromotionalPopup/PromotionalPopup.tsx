"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./PromotionalPopup.module.css";
import { X, Copy, Check, Sparkles } from "lucide-react";

interface PopupConfig {
    is_active: boolean;
    title: string;
    description: string;
    image_url: string | null;
    button_text: string;
    button_link: string;
    frequency: string;
    delay_seconds: number;
    coupon_code: string | null;
    discount_type: string | null;
    discount_value: number | null;
    min_purchase_value: number | null;
}

export default function PromotionalPopup() {
    const [config, setConfig] = useState<PopupConfig | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Fetch active popup configuration
    useEffect(() => {
        let isMounted = true;

        async function fetchPopup() {
            try {
                const res = await fetch("/api/popup", {
                    next: { revalidate: 60 }
                });
                if (!res.ok) return;

                const data: PopupConfig = await res.json();
                if (!isMounted || !data || !data.is_active) return;

                // Frequency rules check
                const frequency = data.frequency || "once_per_session";

                if (frequency === "once_per_session") {
                    const sessionDismissed = sessionStorage.getItem("ecosopis_popup_dismissed");
                    if (sessionDismissed) return;
                } else if (frequency === "once_per_day") {
                    const dayDismissed = localStorage.getItem("ecosopis_popup_dismissed_at");
                    if (dayDismissed) {
                        const elapsed = Date.now() - parseInt(dayDismissed, 10);
                        const twentyFourHours = 24 * 60 * 60 * 1000;
                        if (elapsed < twentyFourHours) return;
                    }
                }

                setConfig(data);

                // Schedule appearance according to configured delay
                const delayMs = Math.max(1, data.delay_seconds ?? 3) * 1000;
                const timer = setTimeout(() => {
                    if (isMounted) {
                        setIsOpen(true);
                    }
                }, delayMs);

                return () => clearTimeout(timer);
            } catch (err) {
                console.error("Erro ao verificar pop-up promocional:", err);
            }
        }

        fetchPopup();

        return () => {
            isMounted = false;
        };
    }, []);

    // Close handler
    const handleClose = useCallback(() => {
        setIsOpen(false);
        if (!config) return;

        const freq = config.frequency || "once_per_session";
        if (freq === "once_per_session") {
            sessionStorage.setItem("ecosopis_popup_dismissed", "true");
        } else if (freq === "once_per_day") {
            localStorage.setItem("ecosopis_popup_dismissed_at", Date.now().toString());
        } else {
            sessionStorage.setItem("ecosopis_popup_dismissed", "true");
        }
    }, [config]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleClose]);

    // Copy coupon code to clipboard
    const handleCopyCoupon = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!config?.coupon_code) return;

        navigator.clipboard.writeText(config.coupon_code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }).catch(() => {
            // Fallback
            const el = document.createElement("textarea");
            el.value = config.coupon_code || "";
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    if (!isOpen || !config) return null;

    let discountLabel = "Desconto Exclusivo";
    if (config.discount_type === "percentage" && config.discount_value) {
        discountLabel = `${config.discount_value}% DE DESCONTO`;
    } else if (config.discount_type === "fixed" && config.discount_value) {
        discountLabel = `R$ ${config.discount_value.toFixed(2)} DE DESCONTO`;
    }

    return (
        <div className={styles.backdrop} onClick={handleClose}>
            <div
                className={styles.popup}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="popup-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleClose}
                    aria-label="Fechar pop-up promocional"
                >
                    <X size={18} />
                </button>

                {/* Banner / Image */}
                {config.image_url ? (
                    <div className={styles.imageContainer}>
                        <img
                            src={config.image_url}
                            alt={config.title}
                            className={styles.image}
                        />
                    </div>
                ) : (
                    <div className={styles.headerGradient}>
                        <Sparkles size={36} />
                    </div>
                )}

                {/* Body Content */}
                <div className={styles.content}>
                    <span className={styles.badge}>
                        OFERTA ESPECIAL
                    </span>

                    <h3 id="popup-title" className={styles.title}>
                        {config.title}
                    </h3>

                    {config.description ? (
                        <p className={styles.description}>
                            {config.description}
                        </p>
                    ) : null}

                    {/* Highlighted Coupon Box */}
                    {config.coupon_code ? (
                        <div className={styles.couponBox}>
                            <div className={styles.couponLeft}>
                                <span className={styles.discountTag}>{discountLabel}</span>
                                <div className={styles.couponCode}>{config.coupon_code}</div>
                            </div>
                            <button
                                type="button"
                                className={`${styles.copyBtn} ${copied ? styles.copiedBtn : ""}`}
                                onClick={handleCopyCoupon}
                                title="Copiar código do cupom"
                            >
                                {copied ? (
                                    <>
                                        <Check size={14} /> Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} /> Copiar
                                    </>
                                )}
                            </button>
                        </div>
                    ) : null}

                    {/* Action Button */}
                    <Link
                        href={config.button_link || "/produtos"}
                        className={styles.actionBtn}
                        onClick={handleClose}
                    >
                        {config.button_text || "Aproveitar Desconto"} →
                    </Link>

                    {config.min_purchase_value && config.min_purchase_value > 0 ? (
                        <p className={styles.minPurchaseText}>
                            *Válido em compras acima de R$ {config.min_purchase_value.toFixed(2)}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
