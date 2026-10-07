"use client";

import React, { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { QrCode, CreditCard, Copy, Check, Loader2, AlertCircle, Lock } from "lucide-react";
import styles from "./CheckoutTransparente.module.css";

interface CheckoutTransparenteProps {
    orderData: {
        items: any[];
        total: number;
        shippingPrice: number;
        shippingMethod: string;
        shippingServiceId?: number | null;
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

const PROD_MP_PUBLIC_KEY = "APP_USR-97552469-004a-4797-bb6a-6c25fa57dbbe";

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
    const [publicKey, setPublicKey] = useState(() => {
        const envKey = (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "").trim();
        if (envKey && !envKey.includes("APP_USR-99b73990") && !envKey.startsWith("TEST-")) {
            return envKey;
        }
        return PROD_MP_PUBLIC_KEY;
    });

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
    const brickControllerRef = useRef<any>(null);

    // Error state
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Always sync public key with backend config if available
    useEffect(() => {
        fetch("/api/payment/config")
            .then(res => res.json())
            .then(data => {
                if (data.mp_public_key && !data.mp_public_key.includes("APP_USR-99b73990") && !data.mp_public_key.startsWith("TEST-")) {
                    setPublicKey(data.mp_public_key);
                } else {
                    setPublicKey(PROD_MP_PUBLIC_KEY);
                }
            })
            .catch(() => {});
    }, []);

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
                        onBinChange: () => {},
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
                                                shipping_service_id: orderData.shippingServiceId,
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
                    shipping_service_id: orderData.shippingServiceId,
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
                                <button
                                    type="button"
                                    className="btn-primary"
                                    style={{
                                        width: "100%",
                                        height: "52px",
                                        fontSize: "1.05rem",
                                        fontWeight: 800,
                                        marginTop: "8px",
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
                        <div className={styles.brickWrapper}>
                            {brickLoading && (
                                <div className={styles.brickLoadingBox}>
                                    <Loader2 size={24} className="spin" color="#2d5a27" />
                                    <span>Carregando formulário de cartão...</span>
                                </div>
                            )}

                            <div id="cardPaymentBrick_container" className={styles.brickContainer} />
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
                                    Pagar com PIX
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
                                    Pagar via Checkout Externo Mercado Pago →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* FOOTER: CHECKOUT PRO FALLBACK */}
                <div className={styles.footer}>
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
