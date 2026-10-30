"use client";

import React, { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { QrCode, CreditCard, Copy, Check, Loader2, AlertCircle, Lock, Layers, RefreshCw } from "lucide-react";
import styles from "./CheckoutTransparente.module.css";

interface CheckoutTransparenteProps {
    orderData: {
        orderId?: number | null;
        items: any[];
        total: number;
        shippingPrice: number;
        shippingMethod: string;
        shippingServiceId?: number | null;
        address: any;
        customerName: string;
        customerEmail?: string;
        customerPhone: string;
        customerCpf: string;
        couponCode?: string | null;
        discountAmount?: number;
        cashbackAmount?: number;
    };
    userEmail: string;
    token: string | null;
    splitPaymentEnabled?: boolean;
    onPaymentSuccess: (orderId: number, guestAccessToken?: string | null) => void;
    onFallbackToCheckoutPro: () => void;
    validateCustomerData: () => boolean;
}

export default function CheckoutTransparente({
    orderData,
    userEmail,
    token,
    splitPaymentEnabled: splitPaymentEnabledProp,
    onPaymentSuccess,
    onFallbackToCheckoutPro,
    validateCustomerData,
}: CheckoutTransparenteProps) {
    const [selectedTab, setSelectedTab] = useState<"pix" | "card" | "split">("pix");
    const [mpLoaded, setMpLoaded] = useState(false);
    const [splitEnabled, setSplitEnabled] = useState<boolean>(splitPaymentEnabledProp ?? true);
    const [publicKey, setPublicKey] = useState(() => {
        return (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "").trim();
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
        guest_access_token?: string | null;
    } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);
    const [pixPolling, setPixPolling] = useState(false);
    const [pixApproved, setPixApproved] = useState(false);

    // Card Brick states
    const [brickMounted, setBrickMounted] = useState(false);
    const [brickLoading, setBrickLoading] = useState(false);
    const brickControllerRef = useRef<any>(null);

    // Split Payment states (PIX + Cartão)
    const [splitPixAmount, setSplitPixAmount] = useState<string>(() => {
        const half = Math.max(1, Number(((orderData.total || 2) / 2).toFixed(2)));
        return half.toFixed(2);
    });
    const [splitLoading, setSplitLoading] = useState(false);
    const [splitData, setSplitData] = useState<{
        order_id: number;
        status: string;
        total: number;
        paid_amount: number;
        remaining_amount: number;
        guest_access_token?: string | null;
        pix_slice: {
            id: number;
            amount: number;
            payment_id: string;
            status: string;
            qr_code: string;
            qr_code_base64: string;
            ticket_url?: string;
        };
        card_slice: {
            id: number;
            amount: number;
            payment_id?: string | null;
            status: string;
            status_detail?: string | null;
        };
    } | null>(null);
    const [splitPixCopied, setSplitPixCopied] = useState(false);
    const [splitBrickLoading, setSplitBrickLoading] = useState(false);
    const [splitCardError, setSplitCardError] = useState<string | null>(null);
    const [splitBrickRetryCount, setSplitBrickRetryCount] = useState(0);
    const splitBrickControllerRef = useRef<any>(null);

    // Error state
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const persistGuestToken = (orderId: number, guestToken?: string | null) => {
        if (typeof window !== "undefined" && orderId && guestToken) {
            try {
                localStorage.setItem(`guest_order_token_${orderId}`, guestToken);
                sessionStorage.setItem(`guest_order_token_${orderId}`, guestToken);
            } catch (e) {}
        }
    };

    // Update default 50/50 split when total changes before split init
    useEffect(() => {
        if (!splitData && orderData.total > 0) {
            const half = Math.max(1, Number((orderData.total / 2).toFixed(2)));
            setSplitPixAmount(half.toFixed(2));
        }
    }, [orderData.total, splitData]);

    // Always sync public key & feature flags with backend config if available
    useEffect(() => {
        fetch("/api/payment/config")
            .then(res => res.json())
            .then(data => {
                if (data.mp_public_key) {
                    setPublicKey(data.mp_public_key);
                }
                if (typeof data.split_payment_enabled === "boolean" && splitPaymentEnabledProp === undefined) {
                    setSplitEnabled(data.split_payment_enabled);
                }
            })
            .catch(() => {});
    }, [splitPaymentEnabledProp]);

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

                                    const headers: Record<string, string> = {
                                        "Content-Type": "application/json",
                                    };
                                    if (token) {
                                        headers["Authorization"] = `Bearer ${token}`;
                                    }

                                    const response = await fetch("/api/payment/process-transparent-card", {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify({
                                            order_data: {
                                                items: orderData.items,
                                                total: orderData.total,
                                                shipping_price: orderData.shippingPrice,
                                                shipping_method: orderData.shippingMethod,
                                                shipping_service_id: orderData.shippingServiceId,
                                                address: orderData.address,
                                                customer_name: orderData.customerName,
                                                customer_email: userEmail || (orderData.address as any)?.email || "",
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
                                        persistGuestToken(data.order_id, data.guest_access_token);
                                        resolve(data);
                                        onPaymentSuccess(data.order_id, data.guest_access_token);
                                    } else if (response.ok && data.status === "in_process") {
                                        persistGuestToken(data.order_id, data.guest_access_token);
                                        resolve(data);
                                        const gt = data.guest_access_token ? `&guest_token=${encodeURIComponent(data.guest_access_token)}` : "";
                                        window.location.href = `/pagamento?status=pending&order_id=${data.order_id}${gt}`;
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
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch("/api/payment/process-transparent-pix", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    items: orderData.items,
                    total: orderData.total,
                    shipping_price: orderData.shippingPrice,
                    shipping_method: orderData.shippingMethod,
                    shipping_service_id: orderData.shippingServiceId,
                    address: orderData.address,
                    customer_name: orderData.customerName,
                    customer_email: userEmail || (orderData.address as any)?.email || "",
                    customer_phone: orderData.customerPhone,
                    customer_cpf: orderData.customerCpf,
                    coupon_code: orderData.couponCode,
                    discount_amount: orderData.discountAmount,
                    cashback_amount: orderData.cashbackAmount,
                })
            });

            const data = await response.json();
            if (response.ok && data.qr_code) {
                persistGuestToken(data.order_id, data.guest_access_token);
                setPixData({
                    order_id: data.order_id,
                    payment_id: data.payment_id,
                    qr_code: data.qr_code,
                    qr_code_base64: data.qr_code_base64,
                    ticket_url: data.ticket_url,
                    total: data.total,
                    guest_access_token: data.guest_access_token
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
                const gtParam = pixData.guest_access_token ? `&guest_token=${encodeURIComponent(pixData.guest_access_token)}` : "";

                const res = await fetch(`/api/payment/status/${pixData.order_id}?payment_id=${pixData.payment_id}${gtParam}`, { headers });
                if (res.ok) {
                    const statusRes = await res.json();
                    if (statusRes.status === "paid") {
                        setPixApproved(true);
                        setPixPolling(false);
                        clearInterval(interval);
                        setTimeout(() => {
                            onPaymentSuccess(pixData.order_id, pixData.guest_access_token);
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

    // ── SPLIT PAYMENT (PIX + CARTÃO) LOGIC ────────────────────────────────────
    const parsedPixSplit = Math.max(0, Number(parseFloat(splitPixAmount.replace(",", ".")) || 0));
    const computedCardSplit = Math.max(0, Number(((orderData.total || 0) - parsedPixSplit).toFixed(2)));
    const isSplitValid =
        parsedPixSplit >= 1.0 &&
        computedCardSplit >= 1.0 &&
        Math.abs(parsedPixSplit + computedCardSplit - (orderData.total || 0)) <= 0.05;

    const handleInitSplitPayment = async () => {
        setErrorMessage(null);
        setSplitCardError(null);
        if (!validateCustomerData()) return;
        if (!isSplitValid) {
            setErrorMessage("A divisão deve destinar pelo menos R$ 1,00 para o PIX e R$ 1,00 para o Cartão, somando o total da compra.");
            return;
        }

        setSplitLoading(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/payment/split/init", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    order_data: {
                        order_id: orderData.orderId || splitData?.order_id || undefined,
                        items: orderData.items,
                        total: orderData.total,
                        shipping_price: orderData.shippingPrice,
                        shipping_method: orderData.shippingMethod,
                        shipping_service_id: orderData.shippingServiceId,
                        address: orderData.address,
                        customer_name: orderData.customerName,
                        customer_email: userEmail || orderData.customerEmail || (orderData.address as any)?.email || "",
                        customer_phone: orderData.customerPhone,
                        customer_cpf: orderData.customerCpf,
                        coupon_code: orderData.couponCode,
                        discount_amount: orderData.discountAmount,
                        cashback_amount: orderData.cashbackAmount,
                    },
                    pix_amount: Number(parsedPixSplit.toFixed(2)),
                    card_amount: Number(computedCardSplit.toFixed(2)),
                }),
            });
            const data = await res.json();
            if (res.ok && data.order_id) {
                persistGuestToken(data.order_id, data.guest_access_token);
                setSplitData(data);
            } else {
                setErrorMessage(data.detail || "Não foi possível iniciar o pagamento combinado.");
            }
        } catch (err) {
            setErrorMessage("Erro de conexão ao iniciar o pagamento combinado. Tente novamente.");
        } finally {
            setSplitLoading(false);
        }
    };

    const handleRegenerateSplitPix = async () => {
        if (!splitData) return;
        setSplitLoading(true);
        setErrorMessage(null);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch("/api/payment/split/regenerate-pix", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    order_id: splitData.order_id,
                    guest_access_token: splitData.guest_access_token,
                }),
            });
            const data = await res.json();
            if (res.ok && data.pix_slice) {
                setSplitData(prev => prev ? { ...prev, pix_slice: data.pix_slice } : prev);
            } else {
                setErrorMessage(data.detail || "Não foi possível regenerar o QR Code PIX.");
            }
        } catch (e) {
            setErrorMessage("Erro ao regenerar PIX.");
        } finally {
            setSplitLoading(false);
        }
    };

    // Mount Card Brick for Split Payment (Part 2)
    useEffect(() => {
        if (
            selectedTab !== "split" ||
            !splitData ||
            splitData.card_slice.status === "approved" ||
            !mpLoaded ||
            !publicKey
        ) {
            return;
        }

        let isCancelled = false;

        const mountSplitBrick = async () => {
            setSplitBrickLoading(true);

            if (splitBrickControllerRef.current) {
                try {
                    await splitBrickControllerRef.current.unmount();
                } catch (e) {}
                splitBrickControllerRef.current = null;
            }

            try {
                const mp = new (window as any).MercadoPago(publicKey, { locale: "pt-BR" });
                const bricksBuilder = mp.bricks();
                const cleanCpf = (orderData.customerCpf || "").replace(/\D/g, "");
                const sliceAmt = Math.max(1.0, Number((splitData.card_slice.amount || 1).toFixed(2)));

                const payerObj: any = {
                    email: userEmail && userEmail.includes("@") ? userEmail : (orderData.customerEmail || "contato@ecosopis.com.br"),
                };
                if (cleanCpf && cleanCpf.length === 11) {
                    payerObj.identification = { type: "CPF", number: cleanCpf };
                }

                const settings = {
                    initialization: {
                        amount: sliceAmt,
                        payer: payerObj,
                    },
                    customization: {
                        visual: {
                            style: {
                                theme: "default",
                                customVariables: { baseColor: "#2d5a27" },
                            },
                        },
                        paymentMethods: {
                            minInstallments: 1,
                            maxInstallments: 12,
                        },
                    },
                    callbacks: {
                        onReady: () => {
                            if (!isCancelled) setSplitBrickLoading(false);
                        },
                        onBinChange: () => {},
                        onSubmit: (cardFormData: any) => {
                            return new Promise(async (resolve, reject) => {
                                setSplitCardError(null);
                                try {
                                    const deviceId =
                                        (typeof window !== "undefined" &&
                                            ((window as any).MP_DEVICE_SESSION_ID || (window as any).meuDeviceId)) ||
                                        null;
                                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                                    if (token) headers["Authorization"] = `Bearer ${token}`;

                                    const response = await fetch("/api/payment/split/process-card", {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify({
                                            order_id: splitData.order_id,
                                            token: cardFormData.token,
                                            installments: cardFormData.installments,
                                            payment_method_id: cardFormData.payment_method_id,
                                            issuer_id: cardFormData.issuer_id ? String(cardFormData.issuer_id) : null,
                                            device_id: deviceId,
                                            guest_access_token: splitData.guest_access_token,
                                        }),
                                    });
                                    const data = await response.json();
                                    if (response.ok && (data.slice_status === "approved" || data.slice_status === "in_process")) {
                                        resolve(data);
                                        setSplitData(prev =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      status: data.order_status || prev.status,
                                                      paid_amount: typeof data.paid_amount === "number" ? data.paid_amount : prev.paid_amount,
                                                      remaining_amount:
                                                          typeof data.remaining_amount === "number" ? data.remaining_amount : prev.remaining_amount,
                                                      card_slice: {
                                                          ...prev.card_slice,
                                                          status: data.slice_status,
                                                          payment_id: data.payment_id,
                                                          status_detail: data.status_detail,
                                                      },
                                                  }
                                                : prev
                                        );
                                        if (data.all_approved || data.order_status === "paid") {
                                            setTimeout(() => {
                                                onPaymentSuccess(splitData.order_id, splitData.guest_access_token);
                                            }, 1000);
                                        }
                                    } else {
                                        const msg =
                                            data.detail ||
                                            "Cartão recusado pelo emissor. A parte do PIX permanece preservada — você pode tentar outro cartão.";
                                        setSplitCardError(msg);
                                        setSplitData(prev =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      card_slice: {
                                                          ...prev.card_slice,
                                                          status: "rejected",
                                                          status_detail: data.status_detail,
                                                      },
                                                  }
                                                : prev
                                        );
                                        reject(msg);
                                    }
                                } catch (err) {
                                    const netMsg = "Falha de conexão ao processar a parte do cartão. Tente novamente.";
                                    setSplitCardError(netMsg);
                                    reject(netMsg);
                                }
                            });
                        },
                        onError: () => {
                            if (!isCancelled) setSplitBrickLoading(false);
                        },
                    },
                };

                const container = document.getElementById("splitCardPaymentBrick_container");
                if (container && !isCancelled) {
                    container.innerHTML = "";
                    splitBrickControllerRef.current = await bricksBuilder.create(
                        "cardPayment",
                        "splitCardPaymentBrick_container",
                        settings
                    );
                }
            } catch (e) {
                if (!isCancelled) setSplitBrickLoading(false);
            }
        };

        mountSplitBrick();

        return () => {
            isCancelled = true;
            if (splitBrickControllerRef.current) {
                try {
                    splitBrickControllerRef.current.unmount();
                } catch (e) {}
                splitBrickControllerRef.current = null;
            }
        };
    }, [selectedTab, splitData?.order_id, splitData?.card_slice.amount, splitData?.card_slice.status, splitBrickRetryCount, mpLoaded, publicKey]);

    // Poll Split Order Status until BOTH parts are approved
    useEffect(() => {
        if (!splitData || splitData.status === "paid") return;

        const interval = setInterval(async () => {
            try {
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;
                const gtParam = splitData.guest_access_token
                    ? `?guest_token=${encodeURIComponent(splitData.guest_access_token)}`
                    : "";
                const res = await fetch(`/api/payment/status/${splitData.order_id}${gtParam}`, { headers });
                if (!res.ok) return;
                const st = await res.json();
                const txs: any[] = st.payment_transactions || [];
                const pixTx = txs.find(t => t.modality === "pix" || t.part_number === 1);
                const cardTx = txs.find(t => t.modality === "credit_card" || t.part_number === 2);

                setSplitData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        status: st.status || prev.status,
                        paid_amount: typeof st.paid_amount === "number" ? st.paid_amount : prev.paid_amount,
                        remaining_amount: typeof st.remaining_amount === "number" ? st.remaining_amount : prev.remaining_amount,
                        pix_slice: pixTx
                            ? {
                                  ...prev.pix_slice,
                                  status: pixTx.status,
                                  payment_id: pixTx.external_payment_id || prev.pix_slice.payment_id,
                                  qr_code: pixTx.qr_code || prev.pix_slice.qr_code,
                                  qr_code_base64: pixTx.qr_code_base64 || prev.pix_slice.qr_code_base64,
                              }
                            : prev.pix_slice,
                        card_slice: cardTx
                            ? {
                                  ...prev.card_slice,
                                  status: cardTx.status,
                                  payment_id: cardTx.external_payment_id || prev.card_slice.payment_id,
                                  status_detail: cardTx.status_detail,
                              }
                            : prev.card_slice,
                    };
                });

                if (st.status === "paid") {
                    clearInterval(interval);
                    setTimeout(() => {
                        onPaymentSuccess(splitData.order_id, splitData.guest_access_token);
                    }, 1000);
                }
            } catch (e) {}
        }, 3500);

        return () => clearInterval(interval);
    }, [splitData?.order_id, splitData?.status, splitData?.guest_access_token, token, onPaymentSuccess]);

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

                {/* TAB SELECTOR: PIX vs CARTÃO vs COMBINADO */}
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

                    {splitEnabled && orderData.total >= 2.0 && (
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${selectedTab === "split" ? styles.tabBtnActive : ""}`}
                            onClick={() => {
                                setSelectedTab("split");
                                setErrorMessage(null);
                            }}
                        >
                            <Layers size={18} />
                            <span>PIX + Cartão</span>
                        </button>
                    )}
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

                {/* ══════════════════════════════════════════════════════════════
                    TAB 3: PAGAMENTO COMBINADO (PIX + CARTÃO DE CRÉDITO)
                    ══════════════════════════════════════════════════════════════ */}
                {selectedTab === "split" && (
                    <div className={styles.tabContent}>
                        {!splitData ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "14px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <span style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>Valor Total da Compra:</span>
                                        <strong style={{ fontSize: "1.1rem", color: "#15803d" }}>R$ {orderData.total.toFixed(2)}</strong>
                                    </div>
                                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                                        Divida o pagamento da sua compra entre <strong>PIX</strong> e <strong>Cartão de Crédito</strong>. O pedido será confirmado assim que ambas as partes forem aprovadas.
                                    </p>
                                </div>

                                {/* Presets rápidos */}
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {[
                                        { label: "50% PIX / 50% Cartão", ratio: 0.5 },
                                        { label: "30% PIX / 70% Cartão", ratio: 0.3 },
                                        { label: "70% PIX / 30% Cartão", ratio: 0.7 },
                                    ].map(preset => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => {
                                                const v = Math.max(1, Math.min(orderData.total - 1, Number((orderData.total * preset.ratio).toFixed(2))));
                                                setSplitPixAmount(v.toFixed(2));
                                            }}
                                            style={{
                                                flex: 1,
                                                minWidth: "120px",
                                                padding: "8px 10px",
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                borderRadius: "8px",
                                                border: "1px solid #cbd5e1",
                                                background: "#f8fafc",
                                                color: "#334155",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Campos de divisão */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div style={{ background: "#ffffff", border: "1.5px solid #2d5a27", borderRadius: "10px", padding: "12px" }}>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#2d5a27", marginBottom: "6px" }}>
                                            PARTE 1 • VALOR NO PIX (R$)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={Math.max(1, Number((orderData.total - 1).toFixed(2)))}
                                            step="0.01"
                                            value={splitPixAmount}
                                            onChange={e => setSplitPixAmount(e.target.value)}
                                            style={{
                                                width: "100%",
                                                padding: "8px 10px",
                                                fontSize: "1.05rem",
                                                fontWeight: 800,
                                                borderRadius: "6px",
                                                border: "1px solid #cbd5e1",
                                                color: "#0f172a",
                                            }}
                                        />
                                    </div>

                                    <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "10px", padding: "12px" }}>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                                            PARTE 2 • VALOR NO CARTÃO (R$)
                                        </label>
                                        <div
                                            style={{
                                                padding: "8px 10px",
                                                fontSize: "1.05rem",
                                                fontWeight: 800,
                                                borderRadius: "6px",
                                                background: "#e2e8f0",
                                                color: "#0f172a",
                                            }}
                                        >
                                            R$ {computedCardSplit.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo da conferência antes de confirmar */}
                                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", fontSize: "0.84rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                        <span style={{ color: "#64748b" }}>Modalidade 1 (PIX à vista):</span>
                                        <strong style={{ color: "#0f172a" }}>R$ {parsedPixSplit.toFixed(2)}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                        <span style={{ color: "#64748b" }}>Modalidade 2 (Cartão de Crédito):</span>
                                        <strong style={{ color: "#0f172a" }}>R$ {computedCardSplit.toFixed(2)}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: "6px", marginTop: "6px" }}>
                                        <span style={{ color: "#166534", fontWeight: 700 }}>Soma Planejada / Restante a Distribuir:</span>
                                        <strong style={{ color: isSplitValid ? "#15803d" : "#dc2626" }}>
                                            R$ {(parsedPixSplit + computedCardSplit).toFixed(2)} (Restante: R$ 0,00)
                                        </strong>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={splitLoading || !isSplitValid}
                                    onClick={handleInitSplitPayment}
                                    style={{
                                        width: "100%",
                                        height: "52px",
                                        fontSize: "0.98rem",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                    }}
                                >
                                    {splitLoading ? (
                                        <>
                                            <Loader2 size={20} className="spin" />
                                            <span>PREPARANDO PAGAMENTO COMBINADO...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Layers size={20} />
                                            <span>CONFIRMAR DIVISÃO • PIX (R$ {parsedPixSplit.toFixed(2)}) + CARTÃO (R$ {computedCardSplit.toFixed(2)})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                {/* Barra de Progresso do Pagamento Combinado */}
                                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "14px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                        <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>Pedido #{splitData.order_id} • Pagamento Combinado</strong>
                                        <span
                                            style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                padding: "4px 10px",
                                                borderRadius: "999px",
                                                background: splitData.status === "paid" ? "#dcfce7" : splitData.paid_amount > 0 ? "#fef9c3" : "#e0f2fe",
                                                color: splitData.status === "paid" ? "#166534" : splitData.paid_amount > 0 ? "#854d0e" : "#0369a1",
                                            }}
                                        >
                                            {splitData.status === "paid"
                                                ? "✅ 100% Pago"
                                                : splitData.paid_amount > 0
                                                ? "⏳ Parcialmente Pago"
                                                : "⏳ Aguardando Pagamentos"}
                                        </span>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "0.8rem" }}>
                                        <div style={{ background: "#fff", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                            <div style={{ color: "#64748b" }}>Total</div>
                                            <strong style={{ color: "#0f172a" }}>R$ {splitData.total.toFixed(2)}</strong>
                                        </div>
                                        <div style={{ background: "#f0fdf4", padding: "8px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                                            <div style={{ color: "#166534" }}>Já Confirmado</div>
                                            <strong style={{ color: "#15803d" }}>R$ {splitData.paid_amount.toFixed(2)}</strong>
                                        </div>
                                        <div style={{ background: "#fff7ed", padding: "8px", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                                            <div style={{ color: "#9a3412" }}>Falta Pagar</div>
                                            <strong style={{ color: "#c2410c" }}>R$ {splitData.remaining_amount.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* PARTE 1: PIX */}
                                <div style={{ border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "14px", background: "#ffffff" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <QrCode size={18} color="#2d5a27" />
                                            <strong style={{ fontSize: "0.95rem" }}>Parte 1: PIX • R$ {splitData.pix_slice.amount.toFixed(2)}</strong>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                padding: "3px 10px",
                                                borderRadius: "999px",
                                                background: splitData.pix_slice.status === "approved" ? "#dcfce7" : "#fef3c7",
                                                color: splitData.pix_slice.status === "approved" ? "#166534" : "#92400e",
                                            }}
                                        >
                                            {splitData.pix_slice.status === "approved" ? "✅ PIX Aprovado" : "⏳ Aguardando PIX"}
                                        </span>
                                    </div>

                                    {splitData.pix_slice.status === "approved" ? (
                                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#15803d", fontWeight: 600 }}>
                                            Recebemos o pagamento de R$ {splitData.pix_slice.amount.toFixed(2)} via PIX!
                                        </p>
                                    ) : (
                                        <div style={{ textAlign: "center" }}>
                                            {splitData.pix_slice.qr_code_base64 && (
                                                <div className={styles.qrImageContainer} style={{ margin: "8px auto" }}>
                                                    <img
                                                        src={`data:image/png;base64,${splitData.pix_slice.qr_code_base64}`}
                                                        alt="QR Code PIX Parte 1"
                                                        className={styles.qrImg}
                                                        style={{ maxWidth: "170px" }}
                                                    />
                                                </div>
                                            )}
                                            <div className={styles.codeBox} style={{ marginBottom: "8px" }}>
                                                {splitData.pix_slice.qr_code}
                                            </div>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(splitData.pix_slice.qr_code || "");
                                                        setSplitPixCopied(true);
                                                        setTimeout(() => setSplitPixCopied(false), 3000);
                                                    }}
                                                    className={`${styles.copyBtn} ${splitPixCopied ? styles.copyBtnDone : ""}`}
                                                    style={{ flex: 1 }}
                                                >
                                                    {splitPixCopied ? (
                                                        <>
                                                            <Check size={16} />
                                                            <span>PIX COPIADO!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={16} />
                                                            <span>COPIAR PIX (R$ {splitData.pix_slice.amount.toFixed(2)})</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRegenerateSplitPix}
                                                    disabled={splitLoading}
                                                    title="Gerar novo QR Code PIX caso tenha expirado"
                                                    style={{
                                                        padding: "0 12px",
                                                        borderRadius: "8px",
                                                        border: "1px solid #cbd5e1",
                                                        background: "#f8fafc",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px",
                                                        fontSize: "0.78rem",
                                                        color: "#475569",
                                                    }}
                                                >
                                                    <RefreshCw size={14} />
                                                    <span>Novo QR</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* PARTE 2: CARTÃO DE CRÉDITO */}
                                <div style={{ border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "14px", background: "#ffffff" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <CreditCard size={18} color="#2d5a27" />
                                            <strong style={{ fontSize: "0.95rem" }}>Parte 2: Cartão • R$ {splitData.card_slice.amount.toFixed(2)}</strong>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                padding: "3px 10px",
                                                borderRadius: "999px",
                                                background:
                                                    splitData.card_slice.status === "approved"
                                                        ? "#dcfce7"
                                                        : splitData.card_slice.status === "rejected"
                                                        ? "#fee2e2"
                                                        : "#e0f2fe",
                                                color:
                                                    splitData.card_slice.status === "approved"
                                                        ? "#166534"
                                                        : splitData.card_slice.status === "rejected"
                                                        ? "#991b1b"
                                                        : "#0369a1",
                                            }}
                                        >
                                            {splitData.card_slice.status === "approved"
                                                ? "✅ Cartão Aprovado"
                                                : splitData.card_slice.status === "in_process"
                                                ? "⏳ Em Análise"
                                                : splitData.card_slice.status === "rejected"
                                                ? "❌ Recusado — Tente novamente"
                                                : "💳 Preencha o Cartão"}
                                        </span>
                                    </div>

                                    {splitCardError && (
                                        <div className={styles.errorBox} style={{ marginBottom: "12px" }}>
                                            <AlertCircle size={18} />
                                            <div style={{ flex: 1 }}>
                                                <div>{splitCardError}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSplitCardError(null);
                                                        setSplitBrickRetryCount(c => c + 1);
                                                    }}
                                                    style={{
                                                        marginTop: "6px",
                                                        padding: "4px 10px",
                                                        fontSize: "0.78rem",
                                                        fontWeight: 700,
                                                        borderRadius: "6px",
                                                        border: "1px solid #991b1b",
                                                        background: "#fff",
                                                        color: "#991b1b",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Tentar com outro cartão
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {splitData.card_slice.status === "approved" ? (
                                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#15803d", fontWeight: 600 }}>
                                            Pagamento de R$ {splitData.card_slice.amount.toFixed(2)} no cartão aprovado!
                                        </p>
                                    ) : (
                                        <div className={styles.brickWrapper}>
                                            {splitBrickLoading && (
                                                <div className={styles.brickLoadingBox}>
                                                    <Loader2 size={22} className="spin" color="#2d5a27" />
                                                    <span>Carregando cartão para R$ {splitData.card_slice.amount.toFixed(2)}...</span>
                                                </div>
                                            )}
                                            <div id="splitCardPaymentBrick_container" className={styles.brickContainer} />
                                        </div>
                                    )}
                                </div>

                                {splitData.pix_slice.status !== "approved" && splitData.card_slice.status !== "approved" && (
                                    <button
                                        type="button"
                                        className={styles.changeMethodBtn}
                                        onClick={() => {
                                            setSplitData(null);
                                            setSplitCardError(null);
                                        }}
                                    >
                                        ← Alterar valores da divisão
                                    </button>
                                )}
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
