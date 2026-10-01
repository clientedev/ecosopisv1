"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Script from "next/script";
import { QrCode, CreditCard, Copy, Check, Loader2, ShieldCheck, AlertCircle, Lock, Info, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./CheckoutTransparente.module.css";

interface CheckoutTransparenteProps {
    orderData: {
        items: any[];
        total: number;
        shippingPrice: number;
        shippingMethod: string;
        address: any;
        customerName: string;
        customerPhone: string;
        customerCpf: string;
        couponCode?: string | null;
        discountAmount?: number;
        cashbackAmount?: number;
    };
    userEmail: string;
    token: string | null;
    onPaymentSuccess: (orderId: number) => void;
    onFallbackToCheckoutPro: () => void;
    validateCustomerData: () => boolean;
}

interface RealInstallment {
    installments: number;
    installment_amount: number;
    total_amount: number;
    installment_rate: number;
    recommended_message: string;
    has_interest: boolean;
}

// ── BANDEIRAS OFICIAIS MERCADO PAGO ──────────────────────────────────────────
const CARD_BRANDS = [
    { id: "visa", name: "Visa", icon: "/images/cards/visa.png" },
    { id: "master", name: "Mastercard", icon: "/images/cards/mastercard.png" },
    { id: "elo", name: "Elo", icon: "/images/cards/elo.png" },
    { id: "amex", name: "American Express", icon: "/images/cards/amex.png" },
    { id: "hipercard", name: "Hipercard", icon: "/images/cards/hipercard.png" },
];



export default function CheckoutTransparente({
    orderData,
    userEmail,
    token,
    onPaymentSuccess,
    onFallbackToCheckoutPro,
    validateCustomerData,
}: CheckoutTransparenteProps) {
    const [selectedTab, setSelectedTab] = useState<"pix" | "card">("pix");
    const [mpLoaded, setMpLoaded] = useState(false);
    const [publicKey, setPublicKey] = useState(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "");

    // PIX states
    const [pixLoading, setPixLoading] = useState(false);
    const [pixData, setPixData] = useState<{
        order_id: number;
        payment_id: string;
        qr_code: string;
        qr_code_base64: string;
        ticket_url?: string;
        total: number;
    } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);
    const [pixPolling, setPixPolling] = useState(false);
    const [pixApproved, setPixApproved] = useState(false);

    // Card Brick states
    const [brickMounted, setBrickMounted] = useState(false);
    const [brickLoading, setBrickLoading] = useState(false);
    const [cardBin, setCardBin] = useState("");
    const brickControllerRef = useRef<any>(null);

    // Error & info states
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showAllInstallments, setShowAllInstallments] = useState(false);

    // ── PARCELAS 100% REAIS VIA API MERCADO PAGO ──────────────────────────────
    const [realInstallments, setRealInstallments] = useState<RealInstallment[]>([]);
    const [loadingInstallments, setLoadingInstallments] = useState(false);
    const [detectedBrand, setDetectedBrand] = useState<string>("");

    useEffect(() => {
        let isCancelled = false;
        const fetchRealInstallments = async () => {
            const total = Number(orderData.total);
            if (!total || total <= 0) return;

            // Se o valor for menor que R$ 1,00 (ex: produto teste de centavos), exibe parcela unica sem erro
            if (total < 1.0) {
                setRealInstallments([{
                    installments: 1,
                    installment_amount: total,
                    total_amount: total,
                    installment_rate: 0,
                    recommended_message: `1x de R$ ${total.toFixed(2).replace(".", ",")} (sem juros)`,
                    has_interest: false
                }]);
                setLoadingInstallments(false);
                return;
            }

            setLoadingInstallments(true);
            try {
                const binParam = cardBin && cardBin.length >= 6 ? `&bin=${encodeURIComponent(cardBin)}` : "";
                const res = await fetch(`/api/payment/installments?amount=${total.toFixed(2)}${binParam}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!isCancelled && data.installments && data.installments.length > 0) {
                        setRealInstallments(data.installments);
                        if (data.issuer) {
                            setDetectedBrand(data.issuer);
                        } else if (data.payment_method_id) {
                            setDetectedBrand(data.payment_method_id.toUpperCase());
                        }
                    }
                }
            } catch (err) {
                console.debug("Erro ao consultar parcelas reais Mercado Pago:", err);
            } finally {
                if (!isCancelled) setLoadingInstallments(false);
            }
        };

        fetchRealInstallments();
        return () => {
            isCancelled = true;
        };
    }, [orderData.total, cardBin]);

    const displayedInstallments = useMemo(() => {
        if (realInstallments.length === 0) return [];
        if (showAllInstallments) return realInstallments;
        if (realInstallments.length <= 5) return realInstallments;
        // Priorizar opções comuns: 1x, 2x, 3x, 6x, 12x
        const targets = [1, 2, 3, 6, 12];
        const filtered = realInstallments.filter(i => targets.includes(i.installments));
        return filtered.length > 0 ? filtered : realInstallments.slice(0, 5);
    }, [realInstallments, showAllInstallments]);

    const maxInstallment = useMemo(() => {
        if (realInstallments.length === 0) return null;
        return realInstallments[realInstallments.length - 1];
    }, [realInstallments]);


    // Fetch config if public key not in env
    useEffect(() => {
        if (!publicKey) {
            fetch("/api/payment/config")
                .then(res => res.json())
                .then(data => {
                    if (data.mp_public_key) setPublicKey(data.mp_public_key);
                })
                .catch(() => {});
        }
    }, [publicKey]);

    // Check if MP SDK is loaded in window
    useEffect(() => {
        const checkMp = () => {
            if (typeof window !== "undefined" && (window as any).MercadoPago) {
                setMpLoaded(true);
            }
        };
        checkMp();
        const interval = setInterval(checkMp, 500);
        return () => clearInterval(interval);
    }, []);

    // ── MOUNT / REMOUNT CARD PAYMENT BRICK ─────────────────────────────────────
    useEffect(() => {
        if (selectedTab !== "card" || !mpLoaded || !publicKey) return;

        let isCancelled = false;

        const mountBrick = async () => {
            setBrickLoading(true);
            setErrorMessage(null);

            // Unmount previous controller if exists
            if (brickControllerRef.current) {
                try {
                    await brickControllerRef.current.unmount();
                } catch (e) {
                    console.debug("Previous Brick unmounted:", e);
                }
                brickControllerRef.current = null;
            }

            try {
                const mp = new (window as any).MercadoPago(publicKey, { locale: "pt-BR" });
                const bricksBuilder = mp.bricks();

                const cleanCpf = (orderData.customerCpf || "").replace(/\D/g, "");
                // Mercado Pago exige no minimo R$ 0,50 / R$ 1,00 para inicializar Card Brick
                const brickAmount = Math.max(1.0, Number((orderData.total || 0).toFixed(2)));

                const payerObj: any = {
                    email: userEmail && userEmail.includes("@") ? userEmail : "contato@ecosopis.com.br"
                };
                if (cleanCpf && cleanCpf.length === 11) {
                    payerObj.identification = {
                        type: "CPF",
                        number: cleanCpf
                    };
                }

                const settings = {
                    initialization: {
                        amount: brickAmount,
                        payer: payerObj
                    },
                    customization: {
                        visual: {
                            style: {
                                theme: "default",
                                customVariables: {
                                    baseColor: "#2d5a27",
                                }
                            }
                        },
                        paymentMethods: {
                            minInstallments: 1,
                            maxInstallments: 12
                        }
                    },
                    callbacks: {
                        onReady: () => {
                            if (!isCancelled) {
                                setBrickLoading(false);
                                setBrickMounted(true);
                            }
                        },
                        onBinChange: (bin: string) => {
                            if (!isCancelled) {
                                setCardBin(bin || "");
                            }
                        },
                        onSubmit: (cardFormData: any) => {
                            return new Promise(async (resolve, reject) => {
                                setErrorMessage(null);

                                if (!validateCustomerData()) {
                                    setErrorMessage("Preencha todos os dados de entrega e CPF antes de pagar.");
                                    reject();
                                    return;
                                }

                                try {
                                    const deviceId = (typeof window !== "undefined" && ((window as any).MP_DEVICE_SESSION_ID || (window as any).meuDeviceId)) || null;

                                    const response = await fetch("/api/payment/process-transparent-card", {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                            Authorization: `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                            order_data: {
                                                items: orderData.items,
                                                total: orderData.total,
                                                shipping_price: orderData.shippingPrice,
                                                shipping_method: orderData.shippingMethod,
                                                address: orderData.address,
                                                customer_name: orderData.customerName,
                                                customer_phone: orderData.customerPhone,
                                                customer_cpf: orderData.customerCpf,
                                                coupon_code: orderData.couponCode,
                                                discount_amount: orderData.discountAmount,
                                                cashback_amount: orderData.cashbackAmount,
                                            },
                                            token: cardFormData.token,
                                            installments: cardFormData.installments,
                                            payment_method_id: cardFormData.payment_method_id,
                                            issuer_id: cardFormData.issuer_id ? String(cardFormData.issuer_id) : null,
                                            device_id: deviceId
                                        })
                                    });

                                    const data = await response.json();

                                    if (response.ok && (data.status === "approved" || data.status === "authorized")) {
                                        resolve(data);
                                        onPaymentSuccess(data.order_id);
                                    } else if (response.ok && data.status === "in_process") {
                                        resolve(data);
                                        window.location.href = `/pagamento?status=pending&order_id=${data.order_id}`;
                                    } else {
                                        const msg = data.detail || data.message || "Cartão não autorizado pelo emissor. Verifique os dados ou utilize outro cartão.";
                                        setErrorMessage(msg);
                                        reject(msg);
                                    }
                                } catch (err: any) {
                                    const networkMsg = "Falha na conexão ao processar o pagamento. Tente novamente.";
                                    setErrorMessage(networkMsg);
                                    reject(networkMsg);
                                }
                            });
                        },
                        onError: (error: any) => {
                            console.error("Card Brick error:", error);
                            setBrickLoading(false);
                            setErrorMessage("Não foi possível inicializar o formulário de cartão do Mercado Pago. Você pode pagar via PIX imediatamente ou utilizar o Checkout Pro.");
                        }
                    }
                };

                const container = document.getElementById("cardPaymentBrick_container");
                if (container && !isCancelled) {
                    container.innerHTML = "";
                    brickControllerRef.current = await bricksBuilder.create(
                        "cardPayment",
                        "cardPaymentBrick_container",
                        settings
                    );
                }
            } catch (err) {
                console.error("Erro ao inicializar Card Brick:", err);
                if (!isCancelled) {
                    setBrickLoading(false);
                    setErrorMessage("Não foi possível carregar o formulário de cartão. Tente usar o PIX ou o Checkout Pro.");
                }
            }
        };

        mountBrick();

        return () => {
            isCancelled = true;
            if (brickControllerRef.current) {
                try {
                    brickControllerRef.current.unmount();
                } catch (e) {}
                brickControllerRef.current = null;
            }
        };
    }, [selectedTab, mpLoaded, publicKey, orderData.total]);

    // ── PIX CREATION ──────────────────────────────────────────────────────────
    const handleGeneratePix = async () => {
        setErrorMessage(null);
        if (!validateCustomerData()) return;

        setPixLoading(true);
        try {
            const response = await fetch("/api/payment/process-transparent-pix", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: orderData.items,
                    total: orderData.total,
                    shipping_price: orderData.shippingPrice,
                    shipping_method: orderData.shippingMethod,
                    address: orderData.address,
                    customer_name: orderData.customerName,
                    customer_phone: orderData.customerPhone,
                    customer_cpf: orderData.customerCpf,
                    coupon_code: orderData.couponCode,
                    discount_amount: orderData.discountAmount,
                    cashback_amount: orderData.cashbackAmount,
                })
            });

            const data = await response.json();
            if (response.ok && data.qr_code) {
                setPixData({
                    order_id: data.order_id,
                    payment_id: data.payment_id,
                    qr_code: data.qr_code,
                    qr_code_base64: data.qr_code_base64,
                    ticket_url: data.ticket_url,
                    total: data.total
                });
                setPixPolling(true);
            } else {
                setErrorMessage(data.detail || "Erro ao gerar PIX. Verifique os dados informados.");
            }
        } catch (err: any) {
            console.error("PIX error:", err);
            setErrorMessage("Erro de conexão ao gerar o PIX. Tente novamente.");
        } finally {
            setPixLoading(false);
        }
    };

    // ── PIX STATUS POLLING ───────────────────────────────────────────────────
    useEffect(() => {
        if (!pixPolling || !pixData || pixApproved) return;

        let attempts = 0;
        const maxAttempts = 60; // 3 min total (3s * 60)

        const interval = setInterval(async () => {
            attempts += 1;
            if (attempts > maxAttempts) {
                setPixPolling(false);
                return;
            }

            try {
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(`/api/payment/status/${pixData.order_id}?payment_id=${pixData.payment_id}`, { headers });
                if (res.ok) {
                    const statusRes = await res.json();
                    if (statusRes.status === "paid") {
                        setPixApproved(true);
                        setPixPolling(false);
                        clearInterval(interval);
                        setTimeout(() => {
                            onPaymentSuccess(pixData.order_id);
                        }, 1200);
                    }
                }
            } catch (err) {
                console.debug("Erro na consulta de status PIX:", err);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [pixPolling, pixData, pixApproved, token, onPaymentSuccess]);

    // Copy to clipboard
    const handleCopyPix = () => {
        if (!pixData?.qr_code) return;
        navigator.clipboard.writeText(pixData.qr_code);
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 3000);
    };

    return (
        <div className={styles.wrapper}>
            {/* Mercado Pago JS SDKs */}
            <Script
                src="https://sdk.mercadopago.com/js/v2"
                strategy="afterInteractive"
                onLoad={() => setMpLoaded(true)}
            />
            <Script
                src="https://www.mercadopago.com/v2/security.js"
                strategy="afterInteractive"
            />

            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.titleRow}>
                        <Lock size={18} className={styles.lockIcon} />
                        <h3>PAGAMENTO SEGURO</h3>
                    </div>
                    <span className={styles.subTitle}>Ambiente criptografado no próprio site Ecosopis</span>
                </div>

                {/* TAB SELECTOR: PIX vs CARTÃO */}
                <div className={styles.tabsHeader}>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${selectedTab === "pix" ? styles.tabBtnActive : ""}`}
                        onClick={() => {
                            setSelectedTab("pix");
                            setErrorMessage(null);
                        }}
                    >
                        <QrCode size={18} />
                        <span>PIX</span>
                        <span className={styles.pixBadge}>Aprovação Imediata</span>
                    </button>

                    <button
                        type="button"
                        className={`${styles.tabBtn} ${selectedTab === "card" ? styles.tabBtnActive : ""}`}
                        onClick={() => {
                            setSelectedTab("card");
                            setErrorMessage(null);
                        }}
                    >
                        <CreditCard size={18} />
                        <span>Cartão de Crédito</span>
                        <span className={styles.cardBadge}>Até 12x</span>
                    </button>
                </div>

                {/* ERROR ALERT */}
                {errorMessage && (
                    <div className={styles.errorBox}>
                        <AlertCircle size={18} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    TAB 1: PIX TRANSPARENTE
                    ══════════════════════════════════════════════════════════════ */}
                {selectedTab === "pix" && (
                    <div className={styles.tabContent}>
                        {!pixData ? (
                            <div className={styles.pixInitialBox}>
                                <div className={styles.pixFeatureList}>
                                    <div className={styles.featureItem}>
                                        <Check size={16} color="#15803d" />
                                        <span>Confirmação em tempo real</span>
                                    </div>
                                    <div className={styles.featureItem}>
                                        <Check size={16} color="#15803d" />
                                        <span>Sem redirecionamentos externos</span>
                                    </div>
                                    <div className={styles.featureItem}>
                                        <Check size={16} color="#15803d" />
                                        <span>QR Code e Copia e Cola na tela</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn-primary"
                                    style={{
                                        width: "100%",
                                        height: "54px",
                                        fontSize: "1.05rem",
                                        fontWeight: 800,
                                        marginTop: "16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "10px"
                                    }}
                                    onClick={handleGeneratePix}
                                    disabled={pixLoading}
                                >
                                    {pixLoading ? (
                                        <>
                                            <Loader2 size={20} className="spin" />
                                            <span>GERANDO PIX...</span>
                                        </>
                                    ) : (
                                        <>
                                            <QrCode size={20} />
                                            <span>PAGAR COM PIX • R$ {orderData.total.toFixed(2)}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.pixGeneratedBox}>
                                {pixApproved ? (
                                    <div className={styles.pixSuccessBox}>
                                        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>🎉</div>
                                        <h4 style={{ color: "#15803d", margin: "0 0 6px 0", fontSize: "1.3rem" }}>
                                            Pagamento Confirmado!
                                        </h4>
                                        <p style={{ color: "#475569", margin: 0, fontSize: "0.9rem" }}>
                                            Finalizando seu pedido #{pixData.order_id}...
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.pixOrderHeader}>
                                            <div>
                                                <strong>Pedido #{pixData.order_id}</strong>
                                                <p>Total a pagar: <span>R$ {pixData.total.toFixed(2)}</span></p>
                                            </div>
                                            <div className={styles.statusPill}>
                                                <span className={styles.pulsingDot}></span>
                                                <span>Aguardando pagamento...</span>
                                            </div>
                                        </div>

                                        {/* QR CODE IMAGE */}
                                        {pixData.qr_code_base64 && (
                                            <div className={styles.qrImageContainer}>
                                                <img
                                                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                                                    alt="QR Code PIX"
                                                    className={styles.qrImg}
                                                />
                                            </div>
                                        )}

                                        <p className={styles.pixInstruction}>
                                            Abra o aplicativo do seu banco, escolha <strong>Pagar com PIX</strong> e aponte a câmera para o QR Code ou copie o código abaixo:
                                        </p>

                                        {/* COPIA E COLA */}
                                        <div className={styles.codeBox}>
                                            {pixData.qr_code}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleCopyPix}
                                            className={`${styles.copyBtn} ${pixCopied ? styles.copyBtnDone : ""}`}
                                        >
                                            {pixCopied ? (
                                                <>
                                                    <Check size={18} />
                                                    <span>CÓDIGO PIX COPIADO!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={18} />
                                                    <span>COPIAR CÓDIGO PIX</span>
                                                </>
                                            )}
                                        </button>

                                        <div className={styles.pollingNotice}>
                                            <Loader2 size={16} className="spin" color="#16a34a" />
                                            <span>Esta tela atualiza automaticamente assim que o pagamento for realizado no banco.</span>
                                        </div>

                                        <button
                                            type="button"
                                            className={styles.changeMethodBtn}
                                            onClick={() => {
                                                setPixData(null);
                                                setPixPolling(false);
                                            }}
                                        >
                                            ← Alterar forma de pagamento
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    TAB 2: CARTÃO DE CRÉDITO TRANSPARENTE (BRICK OFICIAL MP)
                    ══════════════════════════════════════════════════════════════ */}
                {selectedTab === "card" && (
                    <div className={styles.tabContent}>
                        {/* Header Banner com Bandeiras Aceitas com Logos Reais */}
                        <div className={styles.cardHeaderBanner}>
                            <div className={styles.cardHeaderLeft}>
                                <div className={styles.cardHeaderIcon}>
                                    <CreditCard size={22} color="#2d5a27" />
                                </div>
                                <div>
                                    <h4 className={styles.cardHeaderTitle}>Cartão de Crédito</h4>
                                    <p className={styles.cardHeaderSubtitle}>Parcele em até 12x com aprovação imediata e proteção Mercado Pago</p>
                                </div>
                            </div>
                            <div className={styles.cardBrandBadges}>
                                {CARD_BRANDS.map((brand) => (
                                    <span key={brand.id} className={styles.brandLogoItem} title={brand.name}>
                                        <img src={brand.icon} alt={brand.name} className={styles.brandImg} />
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Formulário Oficial do Brick do Mercado Pago */}
                        <div className={styles.brickWrapper}>
                            <div className={styles.brickWrapperHeader}>
                                <Lock size={15} color="#166534" />
                                <span>Preencha os dados do seu cartão de crédito</span>
                            </div>

                            {brickLoading && (
                                <div className={styles.brickLoadingBox}>
                                    <Loader2 size={24} className="spin" color="#2d5a27" />
                                    <span>Carregando formulário seguro do Mercado Pago...</span>
                                </div>
                            )}

                            <div id="cardPaymentBrick_container" className={styles.brickContainer} />

                            <div className={styles.brickSecurityFooter}>
                                <ShieldCheck size={16} color="#16a34a" />
                                <span>Seus dados são transmitidos com criptografia SSL de 256 bits. O Ecosopis não armazena os dados do seu cartão.</span>
                            </div>
                        </div>


                        {errorMessage && (
                            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    style={{ width: "100%", height: "48px", fontWeight: 700 }}
                                    onClick={() => {
                                        setSelectedTab("pix");
                                        setErrorMessage(null);
                                    }}
                                >
                                    Pagar com PIX (Aprovação Instantânea)
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        background: "transparent",
                                        border: "1px solid #cbd5e1",
                                        borderRadius: "8px",
                                        padding: "10px",
                                        fontSize: "0.85rem",
                                        color: "#475569",
                                        cursor: "pointer"
                                    }}
                                    onClick={onFallbackToCheckoutPro}
                                >
                                    Ou pagar via Checkout Tradicional Mercado Pago →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* FOOTER: SECURITY & CHECKOUT PRO FALLBACK */}
                <div className={styles.footer}>
                    <div className={styles.securityTag}>
                        <ShieldCheck size={16} color="#15803d" />
                        <span>Dados protegidos pelo Mercado Pago • Criptografia SSL 256 bits</span>
                    </div>

                    <div className={styles.fallbackBox}>
                        <button
                            type="button"
                            className={styles.fallbackLink}
                            onClick={onFallbackToCheckoutPro}
                        >
                            Prefere pagar pela página externa do Mercado Pago? Clique aqui (Checkout Pro)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
