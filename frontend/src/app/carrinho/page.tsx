"use client";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";
import { Trash2, ShoppingBag, ShieldCheck, Truck, CreditCard, ChevronRight, ChevronLeft, Loader2, Info, ShoppingCart, Coins, Lock, Plus, Minus, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/components/Toast/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { useAuth } from "@/context/AuthContext";

export default function CarrinhoPage() {
    const { cart, updateQuantity, removeFromCart, cartTotal: subtotal } = useCart();
    const { user, token, refreshProfile } = useAuth();
    const [step, setStep] = useState<"cart" | "checkout">("cart");
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    // Mobile States
    const [isMobile, setIsMobile] = useState(false);
    const [mobileStep, setMobileStep] = useState<"cart" | "profile" | "shipping" | "payment">("cart");

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const changeMobileStep = (nextStep: "cart" | "profile" | "shipping" | "payment") => {
        setMobileStep(nextStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, "").slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    // Shipping states
    const [shippingOptions, setShippingOptions] = useState<any[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<any>(null);
    const [loadingShipping, setLoadingShipping] = useState(false);

    // Form states
    const [cep, setCep] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerCpf, setCustomerCpf] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"stripe" | "mercadopago">("mercadopago");

    const formatCpf = (value: string) => {
        const digits = value.replace(/\D/g, "").slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
        if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
        return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
    };

    const [address, setAddress] = useState<any>({
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: ""
    });

    // Address selection state
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [savingAddress, setSavingAddress] = useState(false);

    // Initialize data from logged in user
    useEffect(() => {
        if (user) {
            if (!customerName && (step === "checkout" || mobileStep !== "cart")) setCustomerName(user.full_name || "");
            if (!customerPhone && (step === "checkout" || mobileStep !== "cart")) setCustomerPhone(user.phone || "");
            
            // Auto select default address if available
            if (user.addresses && user.addresses.length > 0 && !cep) {
                const defaultAddr = user.addresses.find((a: any) => a.is_default) || user.addresses[0];
                setCep(defaultAddr.postal_code);
                setAddress({
                    street: defaultAddr.street,
                    number: defaultAddr.number,
                    complement: defaultAddr.complement || "",
                    neighborhood: defaultAddr.neighborhood,
                    city: defaultAddr.city,
                    state: defaultAddr.state
                });
                if (step === "checkout" || mobileStep !== "cart") setShowAddressForm(false);
            } else if (!user.addresses || user.addresses.length === 0) {
                if (step === "checkout" || mobileStep !== "cart") setShowAddressForm(true);
            }
        }
    }, [user, step, mobileStep]);

    // Payment/Coupon states
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [couponCode, setCouponCode] = useState("");
    const [couponError, setCouponError] = useState("");
    const [firstPurchaseChecked, setFirstPurchaseChecked] = useState(false);
    const [availableRouletteCoupon, setAvailableRouletteCoupon] = useState<any>(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem("active_roulette_discount");
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.hasDiscount === undefined) {
                parsed.hasDiscount = !!(parsed.type && parsed.value);
                localStorage.setItem("active_roulette_discount", JSON.stringify(parsed));
            }
            return parsed;
        } catch { return null; }
    });

    // Cashback states
    const [availableCashback, setAvailableCashback] = useState(0);
    const [useCashback, setUseCashback] = useState(false);
    const [cashbackToApply, setCashbackToApply] = useState(0);
    const [cashbackConfig, setCashbackConfig] = useState<any>(null);

    const getFreeShippingThreshold = (cepValue: string) => {
        const clean = (cepValue || "").replace(/\D/g, "");
        if (clean.length !== 8) return null;
        const prefix = parseInt(clean.substring(0, 2), 10);
        // SP(01-19), RJ(20-28), ES(29), MG(30-39), PR(80-87), SC(88-89), RS(90-99)
        if ((prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99)) {
            return 148.90;
        }
        return 248.90;
    };

    const threshold = getFreeShippingThreshold(cep);
    const appliesFreeShipping = threshold !== null && subtotal >= threshold;
    const missingForFreeShipping = threshold !== null && subtotal < threshold ? threshold - subtotal : null;

    // Identify cheapest option to apply free shipping only to it
    const cheapestOption = shippingOptions.length > 0 
        ? [...shippingOptions].sort((a, b) => a.price - b.price)[0] 
        : null;

    const isSelectedShippingFree = (selectedShipping && cheapestOption && selectedShipping.id === cheapestOption.id && appliesFreeShipping) || (appliedCoupon?.type === "free_shipping");
    const shippingPrice = isSelectedShippingFree ? 0 : (selectedShipping ? selectedShipping.price : 0);
    const discount = appliedCoupon ? (
        appliedCoupon.type === "fixed" ? appliedCoupon.value : 
        appliedCoupon.type === "percentage" ? (subtotal * appliedCoupon.value / 100) : 0
    ) : 0;
    
    // Total Cashback to Apply
    const cashbackDiscount = useCashback ? Math.min(availableCashback, subtotal - discount) : 0;
    
    const finalTotal = Math.max(0, subtotal + shippingPrice - discount - cashbackDiscount);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    const isWholesaleEligible = totalItems >= 10 || cart.some(i => i.isWholesale);

    // ── Load roulette coupon from localStorage on mount + on event ──
    useEffect(() => {
        const loadRouletteCoupon = () => {
            const raw = localStorage.getItem("active_roulette_discount");
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.hasDiscount === undefined) {
                        parsed.hasDiscount = !!(parsed.type && parsed.value);
                        localStorage.setItem("active_roulette_discount", JSON.stringify(parsed));
                    }
                    setAvailableRouletteCoupon(parsed);
                } catch {
                    localStorage.removeItem("active_roulette_discount");
                    setAvailableRouletteCoupon(null);
                }
            } else {
                setAvailableRouletteCoupon(null);
            }
        };
        loadRouletteCoupon();
        window.addEventListener("roulette_discount_applied", loadRouletteCoupon);
        return () => window.removeEventListener("roulette_discount_applied", loadRouletteCoupon);
    }, []);

    // ── Wholesale restrictions & first-purchase coupon ──
    useEffect(() => {
        if (isWholesaleEligible) {
            if (appliedCoupon?.code === "PRIMEIRACOMPRA" || appliedCoupon?.code === "ROLETA") {
                setAppliedCoupon(null);
            }
        } else if (user && !firstPurchaseChecked) {
            const rouletteDiscount = localStorage.getItem("active_roulette_discount");
            if (!rouletteDiscount && user.total_compras === 0 && !appliedCoupon) {
                setAppliedCoupon({
                    code: "PRIMEIRACOMPRA",
                    type: "percentage",
                    value: 10,
                    name: "10% OFF na Primeira Compra"
                });
            }
            setFirstPurchaseChecked(true);
        }
    }, [user, appliedCoupon, firstPurchaseChecked, isWholesaleEligible]);

    // Fetch Cashback balance and config
    useEffect(() => {
        if (token && (step === "checkout" || (isMobile && mobileStep === "payment"))) {
            const fetchCashback = async () => {
                try {
                    const [balRes, cfgRes] = await Promise.all([
                        fetch("/api/cashback/me/balance", { headers: { "Authorization": `Bearer ${token}` } }),
                        // Admin config might be restricted, but we can try or use default if it fails
                        fetch("/api/cashback/admin/config", { headers: { "Authorization": `Bearer ${token}` } }).catch(() => null)
                    ]);
                    
                    if (balRes?.ok) {
                        const data = await balRes.json();
                        setAvailableCashback(data.available_balance);
                    }
                    if (cfgRes?.ok) {
                        const data = await cfgRes.json();
                        setCashbackConfig(data);
                    }
                } catch (e) {
                    console.error("Cashback fetch error", e);
                }
            };
            fetchCashback();
        }
    }, [token, step, isMobile, mobileStep]);

    // Auto-select cheapest option when free shipping is earned
    useEffect(() => {
        if (appliesFreeShipping && cheapestOption) {
            if (!selectedShipping || (selectedShipping.id !== cheapestOption.id && shippingPrice > 0)) {
                setSelectedShipping(cheapestOption);
            }
        }
    }, [appliesFreeShipping, cheapestOption, selectedShipping, shippingPrice]);

    // Calculate shipping whenever valid CEP and cart changes
    const [shippingError, setShippingError] = useState<string | null>(null);

    useEffect(() => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length === 8 && cart.length > 0 && (step === "checkout" || (isMobile && (mobileStep === "shipping" || mobileStep === "payment")))) {
            const calculateShipping = async () => {
                setLoadingShipping(true);
                setShippingError(null);
                try {
                    const reqBody = {
                        dest_cep: cleanCep,
                        items: cart.map(item => ({
                            id: item.id.toString(),
                            width: 16,
                            height: 12,
                            length: 20,
                            weight: 0.3,
                            price: item.price,
                            quantity: item.quantity
                        }))
                    };
                    const res = await fetch(`/api/shipping/calculate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(reqBody)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setShippingOptions(data);
                        if (data.length > 0) {
                            setSelectedShipping((prev: any) => {
                                if (prev && data.find((o: any) => o.id === prev.id)) {
                                    return data.find((o: any) => o.id === prev.id);
                                }
                                return data[0];
                            });
                        } else {
                            setSelectedShipping(null);
                        }
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        if (res.status === 503) {
                            setShippingError("__INDISPONIVEL__");
                        } else {
                            setShippingError(errData.detail || "Erro ao calcular frete. Verifique o CEP e tente novamente.");
                        }
                        setShippingOptions([]);
                        setSelectedShipping(null);
                    }
                } catch (error) {
                    console.error("Shipping calc error:", error);
                    setShippingError("Erro de conexão ao calcular frete.");
                    setShippingOptions([]);
                    setSelectedShipping(null);
                } finally {
                    setLoadingShipping(false);
                }
            };

            const timeoutId = setTimeout(() => {
                calculateShipping();
            }, 500);

            return () => clearTimeout(timeoutId);
        } else if (cleanCep.length !== 8) {
            setShippingOptions([]);
            setSelectedShipping(null);
            setShippingError(null);
        }
    }, [cep, cart, step, isMobile, mobileStep]);

    const handleCepLookup = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setAddress({
                    ...address,
                    street: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf
                });
            } else {
                alert("CEP não encontrado.");
            }
        } catch (error) {
            console.error("CEP lookup error", error);
        }
    };

    const handleSaveAddress = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8 || !address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
            alert("Preencha todos os campos obrigatórios do endereço.");
            return;
        }

        if (!token) {
            setShowAddressForm(false);
            return;
        }

        setSavingAddress(true);
        try {
            const res = await fetch(`/api/addresses/me`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    street: address.street,
                    number: address.number,
                    complement: address.complement,
                    neighborhood: address.neighborhood,
                    city: address.city,
                    state: address.state,
                    postal_code: cleanCep,
                    is_default: true
                })
            });

            if (res.ok) {
                await refreshProfile();
            }
        } catch (error) {
            console.error("Save address error:", error);
        } finally {
            setSavingAddress(false);
            setShowAddressForm(false);
        }
    };

    const selectAddress = (addr: any) => {
        setCep(addr.postal_code);
        setAddress({
            street: addr.street,
            number: addr.number,
            complement: addr.complement || "",
            neighborhood: addr.neighborhood,
            city: addr.city,
            state: addr.state
        });
        setShowAddressForm(false);
    };

    const handleApplyCoupon = async () => {
        if (!couponCode) return;
        setCouponError("");
        
        const isPalpiteCoupon = couponCode.toUpperCase().startsWith("PALPITE-BR-");
        if ((couponCode.toUpperCase() === "PRIMEIRACOMPRA" || isPalpiteCoupon) && isWholesaleEligible) {
            setCouponError(isPalpiteCoupon 
                ? "Os cupons do Bolão da Copa não são válidos para pedidos de atacado."
                : "O cupom de primeira compra não é válido para pedidos de atacado."
            );
            setAppliedCoupon(null);
            return;
        }
        
        try {
            const res = await fetch(`/api/coupons/validate/${couponCode}`);
            if (res.ok) {
                const data = await res.json();
                if (data.code.startsWith("PALPITE-BR-") && isWholesaleEligible) {
                    setCouponError("Os cupons do Bolão da Copa não são válidos para pedidos de atacado.");
                    setAppliedCoupon(null);
                    return;
                }
                const subtotal_calc = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                if (data.min_purchase_value > subtotal_calc) {
                    setCouponError(`Compra mínima de R$ ${data.min_purchase_value} necessária`);
                    setAppliedCoupon(null);
                    return;
                }
                setAppliedCoupon({
                    code: data.code,
                    type: data.discount_type,
                    value: data.discount_value
                });
            } else {
                const err = await res.json();
                setCouponError(err.detail || "Cupom inválido");
                setAppliedCoupon(null);
            }
        } catch (error) {
            setCouponError("Erro ao validar cupom");
            setAppliedCoupon(null);
        }
    };
    
    // Estimate cashback to be earned
    const earnedCashback = (() => {
        if (!cashbackConfig || !cashbackConfig.is_active) return 0;
        const totalCompras = user?.total_compras ?? 0;
        const pct = totalCompras > 0 
            ? cashbackConfig.repurchase_percentage 
            : cashbackConfig.first_purchase_percentage;
        return (subtotal * pct / 100);
    })();

    const handleCheckout = async () => {
        if (!customerName || !cep) {
            alert("⚠️ Preencha seu nome e CEP.");
            return;
        }

        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) {
            alert("⚠️ Digite um CEP válido com 8 dígitos.");
            return;
        }

        if (!address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
            alert("⚠️ Preencha todos os campos obrigatórios do endereço (Rua, Número, Bairro, Cidade e Estado/UF).");
            return;
        }

        if (address.state.trim().length !== 2) {
            alert("⚠️ O campo Estado/UF deve conter exatamente 2 letras (ex: SP, MG, RJ).");
            return;
        }
        
        if (!selectedShipping) {
            alert("⚠️ Selecione uma opção de frete para continuar.");
            return;
        }

        setLoading(true);
        const token = localStorage.getItem("token");
        try {
            const endpoint = paymentMethod === 'stripe' 
                ? '/api/payment/create-stripe-checkout' 
                : '/api/payment/create-mercadopago-checkout';

            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    items: cart.map(i => {
                        const finalPrice = i.isWholesale ? i.price * 0.7 : i.price;
                        return {
                            product_id: i.id,
                            product_name: i.isWholesale ? `${i.name} (Atacado)` : i.name,
                            quantity: i.quantity,
                            price: finalPrice
                        };
                    }),
                    total: finalTotal,
                    shipping_price: shippingPrice,
                    shipping_method: selectedShipping?.name || "Melhor Envio",
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    customer_cpf: customerCpf.replace(/\D/g, ""),
                    address: {
                        ...address,
                        postal_code: cep.replace(/\D/g, ""),
                        zip: cep.replace(/\D/g, ""),
                    },
                    coupon_code: appliedCoupon?.code,
                    discount_amount: discount,
                    cashback_amount: cashbackDiscount,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.removeItem("cart");

                // Redirect to Stripe Checkout
                if (data.checkout_url) {
                    window.location.href = data.checkout_url;
                } else {
                    alert("Erro: URL de checkout não retornada.");
                }
            } else {
                const err = await res.json();
                alert(err.detail || "Erro ao processar pedido.");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            alert("Falha na conexão com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSubmit = () => {
        if (!customerName.trim()) {
            showToast("Por favor, preencha seu nome completo.", "error");
            return;
        }
        if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 10) {
            showToast("Por favor, insira um WhatsApp válido com DDD.", "error");
            return;
        }
        if (!customerCpf.trim() || customerCpf.replace(/\D/g, "").length !== 11) {
            showToast("Por favor, insira um CPF válido.", "error");
            return;
        }
        changeMobileStep("shipping");
    };

    const handleShippingSubmit = () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) {
            showToast("Por favor, informe um CEP válido.", "error");
            return;
        }
        if (!address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
            showToast("Por favor, preencha todos os campos do endereço.", "error");
            return;
        }
        if (!selectedShipping) {
            showToast("Por favor, selecione uma opção de frete.", "error");
            return;
        }
        changeMobileStep("payment");
    };

    if (isMobile) {
        if (cart.length === 0) {
            return (
                <main className={styles.mobileCheckoutWrapper}>
                    <header className={styles.mobileHeader}>
                        <button className={styles.mobileBackBtn} onClick={() => window.location.href = "/produtos"}>
                            <ChevronLeft size={20} />
                            <span>Voltar</span>
                        </button>
                        <div className={styles.mobileHeaderTitle}>
                            <h3>Sacola Vazia</h3>
                        </div>
                    </header>
                    <div className={styles.mobileEmptyCartContainer}>
                        <div className={styles.mobileEmptyCart}>
                            <ShoppingBag size={64} style={{ color: "#2d5a27", opacity: 0.3, marginBottom: "1.5rem" }} />
                            <h2 style={{ fontSize: "1.3rem", color: "#1a3a16", marginBottom: "0.5rem" }}>Sua sacola está vazia</h2>
                            <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
                                Aproveite nossa seleção botânica e encontre o cuidado ideal para sua pele.
                            </p>
                            <Link href="/produtos" className="btn-primary" style={{ display: "inline-block", padding: "12px 24px" }}>
                                VER PRODUTOS
                            </Link>
                        </div>
                    </div>
                </main>
            );
        }

        const progressPercent = 
            mobileStep === "cart" ? 25 :
            mobileStep === "profile" ? 50 :
            mobileStep === "shipping" ? 75 : 100;

        const stepTitle = 
            mobileStep === "cart" ? "Revisar Sacola" :
            mobileStep === "profile" ? "Identificação" :
            mobileStep === "shipping" ? "Entrega e Frete" : "Pagamento Seguro";

        return (
            <main className={styles.mobileCheckoutWrapper}>
                {/* Mobile Navigation Header */}
                <header className={styles.mobileHeader}>
                    <button 
                        className={styles.mobileBackBtn} 
                        onClick={() => {
                            if (mobileStep === "cart") {
                                window.location.href = "/produtos";
                            } else if (mobileStep === "profile") {
                                changeMobileStep("cart");
                            } else if (mobileStep === "shipping") {
                                changeMobileStep("profile");
                            } else if (mobileStep === "payment") {
                                changeMobileStep("shipping");
                            }
                        }}
                    >
                        <ChevronLeft size={20} />
                        <span>Voltar</span>
                    </button>
                    <div className={styles.mobileHeaderTitle}>
                        <h3>{stepTitle}</h3>
                        <span className={styles.mobileHeaderSubtitle}>Passo {mobileStep === "cart" ? 1 : mobileStep === "profile" ? 2 : mobileStep === "shipping" ? 3 : 4} de 4</span>
                    </div>
                    <div className={styles.mobileHeaderSecure}>
                        <ShieldCheck size={20} color="#2d5a27" />
                    </div>
                </header>

                {/* Progress bar */}
                <div className={styles.mobileProgressContainer}>
                    <div className={styles.mobileProgressBar} style={{ width: `${progressPercent}%` }}></div>
                </div>

                {/* Step content */}
                <div className={styles.mobileStepContent}>
                    {mobileStep === "cart" && (
                        <div className={styles.mobileCartStep}>
                            {cart.map(item => (
                                <div key={item.id} className={styles.mobileProductCard}>
                                    <div className={styles.mobileProductImgContainer}>
                                        <img 
                                            src={item.image_url || "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png"} 
                                            alt={item.name} 
                                            className={styles.mobileProductImg}
                                        />
                                    </div>
                                    <div className={styles.mobileProductDetails}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <h4 className={styles.mobileProductName}>{item.name}</h4>
                                            <button className={styles.mobileProductRemove} onClick={() => removeFromCart(item.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        {item.isWholesale && <span className={styles.wholesaleBadgeSmall}>ATACADO</span>}
                                        
                                        <div className={styles.mobileProductBottom}>
                                            <div className={styles.mobilePrices}>
                                                {item.isWholesale ? (
                                                    <>
                                                        <span className={styles.oldPriceSmall}>R$ {item.price.toFixed(2)}</span>
                                                        <span className={styles.newPriceSmall}>R$ {(item.price * 0.7).toFixed(2)}</span>
                                                    </>
                                                ) : (
                                                    <p className={styles.mobileSinglePrice}>R$ {item.price.toFixed(2)}</p>
                                                )}
                                            </div>
                                            <div className={styles.mobileQtySelector}>
                                                <button onClick={() => updateQuantity(item.id, -1)} className={styles.qtyBtn}>−</button>
                                                <span className={styles.qtyVal}>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className={styles.qtyBtn}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Free Shipping Bar */}
                            <div className={styles.mobileFreeShippingCard}>
                                {missingForFreeShipping !== null && missingForFreeShipping > 0 ? (
                                    <>
                                        <p className={styles.freeShippingText}>
                                            Faltam <strong>R$ {missingForFreeShipping.toFixed(2)}</strong> para <strong>FRETE GRÁTIS</strong>!
                                        </p>
                                        <div className={styles.freeShippingBarContainer}>
                                            <div 
                                                className={styles.freeShippingBarFill} 
                                                style={{ width: `${Math.min(100, (subtotal / threshold!) * 100)}%` }}
                                            />
                                        </div>
                                        <span className={styles.freeShippingHint}>Adicione mais produtos para economizar no frete.</span>
                                    </>
                                ) : (
                                    <div className={styles.freeShippingEarned}>
                                        <Truck size={20} />
                                        <span>🎉 Parabéns! Você ganhou <strong>FRETE GRÁTIS</strong>!</span>
                                    </div>
                                )}
                            </div>

                            {/* Roulette coupon available banner */}
                            {availableRouletteCoupon && (
                                <div style={{ marginTop: '16px', padding: '14px', background: '#f0fdf4', border: '2px dashed #22c55e', borderRadius: '12px' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#166534', margin: '0 0 8px 0', fontWeight: 700 }}>
                                        🎁 Você tem um prêmio da Roleta!
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: '#15803d', margin: '0 0 10px 0' }}>
                                        <strong>{availableRouletteCoupon.name}</strong>
                                    </p>
                                    {availableRouletteCoupon.hasDiscount ? (
                                        appliedCoupon?.code === "ROLETA" ? (
                                            <div style={{ background: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
                                                ✅ Desconto aplicado no pedido!
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (isWholesaleEligible) {
                                                        alert("O cupom da roleta não pode ser usado em pedidos de atacado.");
                                                        return;
                                                    }
                                                    setAppliedCoupon({
                                                        code: "ROLETA",
                                                        type: availableRouletteCoupon.type,
                                                        value: availableRouletteCoupon.value,
                                                        name: availableRouletteCoupon.name
                                                    });
                                                }}
                                                style={{ width: '100%', background: '#22c55e', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 700 }}
                                            >
                                                USAR MEU CUPOM AGORA
                                            </button>
                                        )
                                    ) : (
                                        <p style={{ fontSize: '0.78rem', color: '#166534', margin: 0, fontStyle: 'italic' }}>
                                            Seu prêmio físico será entregue conforme informações enviadas por e-mail.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div style={{ marginTop: '20px', textAlign: 'center', marginBottom: '100px' }}>
                                <Link href="/produtos" className={styles.mobileContinueShopping}>
                                    + Adicionar mais produtos
                                </Link>
                            </div>

                            {/* Sticky footer for Cart */}
                            <div className={styles.mobileStickyFooter}>
                                <div className={styles.mobileStickyTotalInfo}>
                                    <span className={styles.mobileStickyTotalLabel}>Subtotal</span>
                                    <strong className={styles.mobileStickyTotalPrice}>R$ {subtotal.toFixed(2)}</strong>
                                </div>
                                <button 
                                    className="btn-primary" 
                                    style={{ flex: 1, height: '48px', fontSize: '0.95rem' }}
                                    onClick={() => {
                                        if (!token) {
                                            window.location.href = "/conta";
                                        } else {
                                            changeMobileStep("profile");
                                        }
                                    }}
                                >
                                    Identificar-se ➔
                                </button>
                            </div>
                        </div>
                    )}

                    {mobileStep === "profile" && (
                        <div className={styles.mobileProfileStep}>
                            <div className={styles.mobileFormSection}>
                                <h3 className={styles.mobileSectionTitle}>Quem está comprando?</h3>
                                <p className={styles.mobileSectionSubtitle}>Preencha seus dados para prosseguir com o pedido de forma segura.</p>
                                
                                <div className={styles.mobileInputGroup}>
                                    <label className={styles.mobileLabel}>Nome Completo</label>
                                    <input 
                                        type="text" 
                                        placeholder="Digite seu nome completo" 
                                        className={styles.mobileInputField} 
                                        value={customerName} 
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>
                                <div className={styles.mobileInputGroup}>
                                    <label className={styles.mobileLabel}>WhatsApp / Telefone</label>
                                    <input 
                                        type="tel" 
                                        placeholder="(00) 00000-0000" 
                                        className={styles.mobileInputField} 
                                        value={customerPhone} 
                                        onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                                    />
                                    <span className={styles.mobileInputHelper}>Para receber as notificações de envio do seu pedido.</span>
                                </div>
                                <div className={styles.mobileInputGroup}>
                                    <label className={styles.mobileLabel}>CPF</label>
                                    <input 
                                        type="text" 
                                        placeholder="000.000.000-00" 
                                        className={styles.mobileInputField} 
                                        value={customerCpf} 
                                        onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                                        maxLength={14}
                                        inputMode="numeric"
                                    />
                                    <span className={styles.mobileInputHelper}>Obrigatório para emissão da etiqueta de envio da transportadora.</span>
                                </div>
                            </div>

                            <div className={styles.mobileStickyFooter}>
                                <button 
                                    className="btn-primary" 
                                    style={{ width: '100%', height: '48px', fontSize: '0.95rem' }}
                                    onClick={handleProfileSubmit}
                                >
                                    Continuar para Entrega ➔
                                </button>
                            </div>
                        </div>
                    )}

                    {mobileStep === "shipping" && (
                        <div className={styles.mobileShippingStep}>
                            <div className={styles.mobileFormSection}>
                                <h3 className={styles.mobileSectionTitle}>Onde devemos entregar?</h3>
                                
                                {user && user.addresses && user.addresses.length > 0 && !showAddressForm ? (
                                    <div className={styles.mobileSavedAddresses}>
                                        <p className={styles.mobileSectionSubtitle}>Selecione um endereço salvo:</p>
                                        {user.addresses.map((addr: any) => {
                                            const isSelected = cep === addr.postal_code && address.number === addr.number;
                                            return (
                                                <div 
                                                    key={addr.id} 
                                                    className={`${styles.mobileAddressCard} ${isSelected ? styles.mobileAddressSelected : ""}`}
                                                    onClick={() => selectAddress(addr)}
                                                >
                                                    <div className={styles.mobileAddressInfo}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <strong style={{ fontSize: '0.9rem', color: '#1a3a16' }}>{addr.name || "Endereço"}</strong>
                                                            {addr.is_default && <span className={styles.defaultBadge}>Principal</span>}
                                                        </div>
                                                        <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 2px' }}>{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}</p>
                                                        <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>{addr.neighborhood}, {addr.city} - {addr.state}</p>
                                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>CEP: {addr.postal_code}</p>
                                                    </div>
                                                    <div className={styles.mobileAddressRadio}>
                                                        <div className={`${styles.mobileRadioCircle} ${isSelected ? styles.mobileRadioChecked : ""}`}>
                                                            {isSelected && <Check size={10} color="white" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <button 
                                            className={styles.mobileAddAddressBtn}
                                            onClick={() => {
                                                setShowAddressForm(true);
                                                setCep("");
                                                setAddress({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
                                            }}
                                        >
                                            + Cadastrar novo endereço
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.mobileInputGroupList}>
                                        <div className={styles.mobileInputGroup}>
                                            <label className={styles.mobileLabel}>CEP</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Digite o CEP" 
                                                    className={styles.mobileInputField} 
                                                    value={cep} 
                                                    onChange={(e) => setCep(e.target.value)}
                                                />
                                                <button 
                                                    type="button" 
                                                    className={styles.mobileCepSearchBtn}
                                                    onClick={handleCepLookup}
                                                >
                                                    Buscar
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles.mobileInputGroup}>
                                            <label className={styles.mobileLabel}>Endereço / Logradouro</label>
                                            <input 
                                                type="text" 
                                                placeholder="Nome da rua, avenida, etc." 
                                                className={styles.mobileInputField} 
                                                value={address.street} 
                                                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div className={styles.mobileInputGroup} style={{ flex: 1 }}>
                                                <label className={styles.mobileLabel}>Número</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Nº" 
                                                    className={styles.mobileInputField} 
                                                    value={address.number} 
                                                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                                                />
                                            </div>
                                            <div className={styles.mobileInputGroup} style={{ flex: 2 }}>
                                                <label className={styles.mobileLabel}>Complemento</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Apto, bloco, etc." 
                                                    className={styles.mobileInputField} 
                                                    value={address.complement} 
                                                    onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.mobileInputGroup}>
                                            <label className={styles.mobileLabel}>Bairro</label>
                                            <input 
                                                type="text" 
                                                placeholder="Bairro" 
                                                className={styles.mobileInputField} 
                                                value={address.neighborhood} 
                                                onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div className={styles.mobileInputGroup} style={{ flex: 2 }}>
                                                <label className={styles.mobileLabel}>Cidade</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Cidade" 
                                                    className={styles.mobileInputField} 
                                                    value={address.city} 
                                                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                                                />
                                            </div>
                                            <div className={styles.mobileInputGroup} style={{ flex: 1 }}>
                                                <label className={styles.mobileLabel}>Estado</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="UF" 
                                                    className={styles.mobileInputField} 
                                                    value={address.state} 
                                                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        {token && (
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <button 
                                                    className="btn-primary" 
                                                    style={{ flex: 1, height: '40px', fontSize: '0.85rem' }} 
                                                    onClick={handleSaveAddress} 
                                                    disabled={savingAddress}
                                                >
                                                    {savingAddress ? "SALVANDO..." : "SALVAR E USAR"}
                                                </button>
                                                {user && user.addresses && user.addresses.length > 0 && (
                                                    <button 
                                                        className={styles.mobileCancelAddressBtn} 
                                                        onClick={() => setShowAddressForm(false)}
                                                    >
                                                        CANCELAR
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Shipping Options */}
                            <div className={styles.mobileFormSection} style={{ marginTop: '20px', marginBottom: '100px' }}>
                                <h3 className={styles.mobileSectionTitle}>Opção de Envio</h3>
                                
                                {loadingShipping ? (
                                    <div className={styles.mobileShippingLoading}>
                                        <Loader2 size={24} className="spin" style={{ color: '#2d5a27' }} />
                                        <span>Calculando frete...</span>
                                    </div>
                                ) : shippingError === "__INDISPONIVEL__" ? (
                                    <div className={styles.mobileShippingNotice}>
                                        <div className={styles.mobileNoticeHeader}>
                                            <Truck size={18} />
                                            <span>Frete disponível em produção</span>
                                        </div>
                                        <p>As transportadoras (PAC, SEDEX e Jadlog) serão exibidas normalmente ao finalizar sua compra no site oficial publicado.</p>
                                    </div>
                                ) : shippingError ? (
                                    <div className={styles.mobileShippingError}>
                                        ⚠️ {shippingError}
                                    </div>
                                ) : shippingOptions.length > 0 ? (
                                    <div className={styles.mobileShippingList}>
                                        {shippingOptions.map((opt: any) => {
                                            const isSelected = selectedShipping?.id === opt.id;
                                            return (
                                                <div 
                                                    key={opt.id}
                                                    className={`${styles.mobileShippingCard} ${isSelected ? styles.mobileShippingSelected : ""}`}
                                                    onClick={() => setSelectedShipping(opt)}
                                                >
                                                    <div className={styles.mobileShippingIcon}>
                                                        <div className={`${styles.mobileRadioCircle} ${isSelected ? styles.mobileRadioChecked : ""}`}>
                                                            {isSelected && <Check size={10} color="white" />}
                                                        </div>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <strong style={{ fontSize: '0.9rem', color: '#1e293b', display: 'block' }}>{opt.company} - {opt.name}</strong>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Entrega em até {opt.delivery_time} dias úteis</span>
                                                    </div>
                                                    <span className={styles.mobileShippingPriceText}>
                                                        {appliesFreeShipping && cheapestOption && opt.id === cheapestOption.id ? "GRÁTIS" : `R$ ${opt.price.toFixed(2)}`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : cep.replace(/\D/g, "").length === 8 ? (
                                    <p style={{ fontSize: '0.85rem', color: '#ef4444', textAlign: 'center' }}>Nenhuma opção de frete disponível.</p>
                                ) : (
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>Digite seu CEP acima para ver as opções de frete.</p>
                                )}
                            </div>

                            <div className={styles.mobileStickyFooter}>
                                <button 
                                    className="btn-primary" 
                                    style={{ width: '100%', height: '48px', fontSize: '0.95rem' }}
                                    onClick={handleShippingSubmit}
                                >
                                    Ir para o Pagamento ➔
                                </button>
                            </div>
                        </div>
                    )}

                    {mobileStep === "payment" && (
                        <div className={styles.mobilePaymentStep} style={{ marginBottom: '100px' }}>
                            {/* Summary Card */}
                            <div className={styles.mobileFormSection}>
                                <h3 className={styles.mobileSectionTitle}>Revisão do Pedido</h3>
                                
                                <div className={styles.mobileOrderSummaryBox}>
                                    <div className={styles.mobileSummaryItemRow}>
                                        <span>Itens no carrinho:</span>
                                        <strong>{cart.reduce((acc, item) => acc + item.quantity, 0)} produtos</strong>
                                    </div>
                                    <div className={styles.mobileSummaryItemRow}>
                                        <span>Entregar em:</span>
                                        <span style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'right' }}>
                                            {address.street}, {address.number} - {address.city}
                                        </span>
                                    </div>
                                    <div className={styles.mobileSummaryItemRow}>
                                        <span>Transportadora:</span>
                                        <strong>{selectedShipping?.company} ({selectedShipping?.name})</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Promo Code & Coupons */}
                            <div className={styles.mobileFormSection} style={{ marginTop: '16px' }}>
                                <h3 className={styles.mobileSectionTitle}>Cupom de Desconto</h3>
                                <div className={styles.mobileCouponInputWrapper}>
                                    <input 
                                        type="text" 
                                        placeholder="Possui cupom?" 
                                        className={styles.mobileCouponInput}
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    />
                                    <button className={styles.mobileCouponBtn} onClick={handleApplyCoupon}>Aplicar</button>
                                </div>
                                {couponError && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px', margin: 0 }}>{couponError}</p>}
                                {appliedCoupon && (
                                    <div className={styles.mobileAppliedCouponBox}>
                                        <span>Cupom ativo: <strong>{appliedCoupon.code}</strong></span>
                                        <button onClick={() => setAppliedCoupon(null)}>Remover</button>
                                    </div>
                                )}
                                {availableRouletteCoupon && (!appliedCoupon || appliedCoupon.code !== "ROLETA") && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', border: '1px dashed #22c55e', borderRadius: '8px' }}>
                                        <p style={{ fontSize: '0.85rem', color: '#166534', margin: '0 0 8px 0' }}>
                                            <strong>🎁 Prêmio da Roleta Disponível:</strong><br/>{availableRouletteCoupon.name}
                                        </p>
                                        <button 
                                            onClick={() => {
                                                if (isWholesaleEligible) {
                                                    alert("O cupom da roleta não pode ser usado em pedidos de atacado.");
                                                    return;
                                                }
                                                setAppliedCoupon({
                                                    code: "ROLETA",
                                                    type: availableRouletteCoupon.type,
                                                    value: availableRouletteCoupon.value,
                                                    name: availableRouletteCoupon.name
                                                });
                                            }}
                                            style={{ width: '100%', background: '#22c55e', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            USAR MEU CUPOM AGORA
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Cashback Toggle */}
                            {availableCashback > 0 && (
                                <div className={styles.mobileFormSection} style={{ marginTop: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Coins size={20} color="#059669" />
                                            <div>
                                                <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block' }}>Usar R$ {availableCashback.toFixed(2)}</strong>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Saldo de Cashback acumulado</span>
                                            </div>
                                        </div>
                                        <label className={styles.switch}>
                                            <input 
                                                type="checkbox" 
                                                checked={useCashback} 
                                                onChange={(e) => {
                                                    if (appliedCoupon && cashbackConfig && !cashbackConfig.allow_with_coupons) {
                                                        showToast("Não é possível acumular cupom e cashback no mesmo pedido.", "error");
                                                        return;
                                                    }
                                                    setUseCashback(e.target.checked);
                                                }}
                                            />
                                            <span className={styles.slider}></span>
                                        </label>
                                    </div>
                                    {useCashback && cashbackConfig && subtotal < cashbackConfig.min_purchase_to_use && (
                                        <p style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '8px', margin: 0 }}>
                                            ⚠️ Mínimo de R$ {cashbackConfig.min_purchase_to_use.toFixed(2)} em produtos necessário.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Financial Summary */}
                            <div className={styles.mobileFormSection} style={{ marginTop: '16px', background: '#f8fafc' }}>
                                <div className={styles.mobilePriceSummaryRow}>
                                    <span>Subtotal</span>
                                    <span>R$ {subtotal.toFixed(2)}</span>
                                </div>
                                <div className={styles.mobilePriceSummaryRow}>
                                    <span>Frete ({selectedShipping?.company})</span>
                                    <span>{appliesFreeShipping ? "Grátis" : `R$ ${shippingPrice.toFixed(2)}`}</span>
                                </div>
                                {discount > 0 && (
                                    <div className={styles.mobilePriceSummaryRow} style={{ color: '#16a34a' }}>
                                        <span>Desconto</span>
                                        <span>- R$ {discount.toFixed(2)}</span>
                                    </div>
                                )}
                                {cashbackDiscount > 0 && (
                                    <div className={styles.mobilePriceSummaryRow} style={{ color: '#059669' }}>
                                        <span>Cashback Usado</span>
                                        <span>- R$ {cashbackDiscount.toFixed(2)}</span>
                                    </div>
                                )}
                                
                                <div className={styles.mobileSummaryDivider}></div>
                                
                                <div className={styles.mobilePriceSummaryTotalRow}>
                                    <span>Total Geral</span>
                                    <span>R$ {finalTotal.toFixed(2)}</span>
                                </div>
                                
                                {earnedCashback > 0 && (
                                    <div className={styles.mobileEarnedCashbackNotice}>
                                        <Coins size={14} />
                                        <span>Você ganhará <strong>R$ {earnedCashback.toFixed(2)}</strong> de cashback nesta compra!</span>
                                    </div>
                                )}
                            </div>

                            {/* Safety info */}
                            <div className={styles.mobileSecurityNoticeBox}>
                                <Lock size={16} color="#15803d" />
                                <div>
                                    <strong>Pagamento 100% Seguro</strong>
                                    <p>Processado via Mercado Pago com criptografia SSL.</p>
                                </div>
                            </div>

                            {/* Giant Pay Button */}
                            <div className={styles.mobileStickyFooter}>
                                <button
                                    className="btn-primary"
                                    style={{ width: '100%', height: '56px', fontSize: '1.05rem', fontWeight: 800 }}
                                    onClick={handleCheckout}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <Loader2 size={20} className="spin" style={{ color: 'white' }} />
                                            <span>PROCESSANDO...</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <Lock size={18} />
                                            <span>FINALIZAR E PAGAR AGORA</span>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        );
    }

    if (cart.length === 0) {
        return (
            <main>
                <Header />
                <div className={styles.carrinhoContainer}>
                    <div className={styles.emptyCart}>
                        <ShoppingBag size={64} style={{ color: "#ddd", marginBottom: "1rem" }} />
                        <h2>Seu carrinho está vazio</h2>
                        <p>Aproveite nossa seleção botânica e encontre o cuidado ideal para sua pele.</p>
                        <Link href="/produtos" className="btn-primary" style={{ marginTop: "20px", display: "inline-block" }}>
                            VER PRODUTOS
                        </Link>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main>
            <Header />
            <div className={styles.carrinhoContainer}>
                <div className={styles.stepsHeader}>
                    <div className={`${styles.stepIndicator} ${step === "cart" ? styles.stepActive : ""}`}>
                        <span className={styles.stepNum}>1</span> Carrinho
                    </div>
                    <ChevronRight size={16} />
                    <div className={`${styles.stepIndicator} ${step === "checkout" ? styles.stepActive : ""}`}>
                        <span className={styles.stepNum}>2</span> Finalização
                    </div>
                </div>

                <div className={styles.cartGrid}>
                    <div className={styles.leftColumn}>
                        {step === "cart" ? (
                            <div className={styles.itemsList}>
                                {cart.map(item => (
                                    <div key={item.id} className={styles.cartItem}>
                                        <div className={styles.itemMain}>
                                            <div className={styles.itemImageContainer}>
                                                <img 
                                                    src={item.image_url || "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png"} 
                                                    alt={item.name} 
                                                    className={styles.itemImage}
                                                />
                                            </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <h4>{item.name}</h4>
                                                    {item.isWholesale && <span className={styles.wholesaleBadgeSmall}>ATACADO</span>}
                                                </div>
                                                <div className={styles.itemPrices}>
                                                    {item.isWholesale ? (
                                                        <>
                                                            <span className={styles.oldPriceSmall}>R$ {item.price.toFixed(2)}</span>
                                                            <span className={styles.newPriceSmall}>R$ {(item.price * 0.7).toFixed(2)}</span>
                                                        </>
                                                    ) : (
                                                        <p>R$ {item.price.toFixed(2)}</p>
                                                    )}
                                                </div>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <div className={styles.quantityControl}>
                                                <button onClick={() => updateQuantity(item.id, -1)}>−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                                            </div>
                                            <button className={styles.removeBtn} onClick={() => removeFromCart(item.id)} title="Remover item">
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ marginTop: "30px", textAlign: "right" }}>
                                    <Link href="/produtos" style={{ color: "#2d5a27", fontSize: "0.95rem", fontWeight: 700, textDecoration: "underline" }}>
                                        ← Adicionar mais itens
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.checkoutForm}>
                                <div className={styles.detailSection}>
                                    <h3>👤 SEUS DADOS</h3>
                                    <div className={styles.inputGroup}>
                                        <input type="text" placeholder="Nome Completo" className={styles.inputField} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                                        <input type="text" placeholder="WhatsApp / Telefone" className={styles.inputField} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                                        <input type="text" placeholder="CPF (Ex: 000.000.000-00)" className={styles.inputField} value={customerCpf} onChange={(e) => setCustomerCpf(formatCpf(e.target.value))} maxLength={14} inputMode="numeric" />
                                        <small style={{ color: "#888", fontSize: "0.78rem", marginTop: "-4px" }}>Necessário para emissão da etiqueta de envio</small>
                                    </div>
                                </div>

                                <div className={styles.detailSection}>
                                    <h3>📍 ENDEREÇO DE ENTREGA</h3>
                                    
                                    {user && user.addresses && user.addresses.length > 0 && !showAddressForm ? (
                                        <div className={styles.savedAddressesList}>
                                            {user.addresses.map((addr: any) => (
                                                <div 
                                                    key={addr.id} 
                                                    className={`${styles.addressCard} ${cep === addr.postal_code && address.number === addr.number ? styles.selectedAddress : ""}`}
                                                    onClick={() => selectAddress(addr)}
                                                >
                                                    <div className={styles.addressInfo}>
                                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                            <strong>{addr.name || "Endereço"}</strong>
                                                            {addr.is_default && <span className={styles.defaultBadge}>Principal</span>}
                                                        </div>
                                                        <p>{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}</p>
                                                        <p>{addr.neighborhood}, {addr.city} - {addr.state}</p>
                                                        <p>CEP: {addr.postal_code}</p>
                                                    </div>
                                                    <div className={styles.selectIndicator}>
                                                        <div className={styles.radioOuter}>
                                                            <div className={styles.radioInner}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button 
                                                className={styles.addAddressBtn} 
                                                onClick={() => {
                                                    setShowAddressForm(true);
                                                    setCep("");
                                                    setAddress({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
                                                }}
                                            >
                                                + Adicionar novo endereço
                                            </button>
                                        </div>
                                    ) : (
                                        <div className={styles.inputGroup}>
                                            <div className={styles.inputRow}>
                                                <input type="text" placeholder="CEP (Ex: 01001000)" className={styles.inputField} value={cep} onChange={(e) => setCep(e.target.value)} onBlur={handleCepLookup} />
                                            </div>
                                            <input type="text" placeholder="Endereço / Logradouro" className={styles.inputField} value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                                            <div className={styles.inputRow}>
                                                <input type="text" placeholder="Número" className={styles.inputField} value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
                                                <input type="text" placeholder="Complemento" className={styles.inputField} value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
                                            </div>
                                            <div className={styles.inputRow}>
                                                <input type="text" placeholder="Bairro" className={styles.inputField} value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} />
                                                <input type="text" placeholder="Cidade" className={styles.inputField} style={{ flex: 2 }} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                                                <input type="text" placeholder="UF" className={styles.inputField} style={{ flex: 1 }} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} maxLength={2} />
                                            </div>
                                            {token && (
                                                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                                                    <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveAddress} disabled={savingAddress}>
                                                        {savingAddress ? "SALVANDO..." : "SALVAR E USAR"}
                                                    </button>
                                                    {user && user.addresses && user.addresses.length > 0 && (
                                                        <button className={styles.cancelBtn} onClick={() => setShowAddressForm(false)}>
                                                            CANCELAR
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.detailSection}>
                                    <h3>🚚 FRETE</h3>
                                    {loadingShipping ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                            <Loader2 size={18} className="spin" /> Calculando frete...
                                        </div>
                                    ) : shippingError === "__INDISPONIVEL__" ? (
                                        <div style={{ fontSize: "0.88rem", background: "#fffbeb", borderRadius: "10px", padding: "14px 16px", border: "1px solid #fcd34d" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#92400e", marginBottom: "4px" }}>
                                                <Truck size={16} /> Cálculo de frete disponível no site publicado
                                            </div>
                                            <p style={{ margin: 0, color: "#78350f", lineHeight: 1.5 }}>
                                                O cálculo de frete via Melhor Envio funciona normalmente no site em produção. As opções de PAC, SEDEX e outras transportadoras aparecerão ao finalizar sua compra pelo site oficial.
                                            </p>
                                        </div>
                                    ) : shippingError ? (
                                        <div style={{ color: "#ef4444", fontSize: "0.88rem", background: "#fef2f2", borderRadius: "10px", padding: "12px", border: "1px solid #fca5a5" }}>
                                            ⚠️ {shippingError}
                                        </div>
                                    ) : shippingOptions.length > 0 ? (
                                        <div className={styles.shippingOptions}>
                                            {shippingOptions.map((opt: any) => (
                                                <div 
                                                    key={opt.id}
                                                    style={{ 
                                                        padding: "16px", background: selectedShipping?.id === opt.id ? "#f0f7ee" : "#fff", 
                                                        borderRadius: "12px", border: selectedShipping?.id === opt.id ? "1px solid #d4edda" : "1px solid #e2e8f0", 
                                                        display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", cursor: "pointer",
                                                        transition: "all 0.2s"
                                                    }}
                                                    onClick={() => setSelectedShipping(opt)}
                                                >
                                                    <div style={{
                                                        width: "20px", height: "20px", borderRadius: "50%",
                                                        border: selectedShipping?.id === opt.id ? "6px solid #2d5a27" : "2px solid #cbd5e1",
                                                        background: "#fff"
                                                    }} />
                                                    <Truck size={24} style={{ color: selectedShipping?.id === opt.id ? "#2d5a27" : "#64748b" }} />
                                                    <div style={{ flex: 1 }}>
                                                        <strong style={{ color: "#1e293b", display: "block" }}>{opt.company} - {opt.name}</strong>
                                                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                                            Entrega em até {opt.delivery_time} dias úteis
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: selectedShipping?.id === opt.id ? "#2d5a27" : "#334155" }}>
                                                        {appliesFreeShipping && cheapestOption && opt.id === cheapestOption.id ? "FRETE GRÁTIS" : `R$ ${opt.price.toFixed(2)}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : cep.replace(/\D/g, "").length === 8 ? (
                                        <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>
                                            Nenhuma opção de frete disponível para este CEP.
                                        </div>
                                    ) : (
                                        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                                            Insira o CEP de entrega para calcular o frete.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.rightColumn}>
                        <div className={styles.summaryCard}>
                            <h3>RESUMO DO PEDIDO</h3>

                            {step === "cart" && (
                                <div style={{ marginBottom: "20px" }}>
                                    <label style={{ fontSize: "0.85rem", color: "#64748b", display: "block", marginBottom: "8px" }}>📦 Calcular Frete Grátis</label>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input 
                                            type="text" 
                                            placeholder="CEP (Ex: 01001000)" 
                                            className={styles.inputField}
                                            style={{ margin: 0, padding: "8px 12px", height: "auto" }}
                                            value={cep}
                                            onChange={(e) => setCep(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {threshold !== null && (
                                <div style={{ background: "#f8faf8", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px", fontSize: "0.8rem", textAlign: "center" }}>
                                    📍 <strong>Região:</strong> {threshold === 148.90 ? "Sul/Sudeste" : "Demais Regiões"}
                                </div>
                            )}

                            {missingForFreeShipping !== null && missingForFreeShipping > 0 && (
                                <div style={{ background: "#f0f7ee", color: "#2d5a27", padding: "12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "16px", border: "1px solid #d4edda", textAlign: "center", fontWeight: "600" }}>
                                    💰 Faltam R$ {missingForFreeShipping.toFixed(2)} para FRETE GRÁTIS!
                                </div>
                            )}
                            {appliesFreeShipping && (
                                <div style={{ background: "#f0f7ee", color: "#2d5a27", padding: "12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "16px", border: "1px solid #d4edda", textAlign: "center", fontWeight: "600" }}>
                                    🎉 Parabéns! Você ganhou FRETE GRÁTIS!
                                </div>
                            )}
                            
                            <div className={styles.promoCode}>
                                <input 
                                    type="text" 
                                    placeholder="Cupom de desconto" 
                                    className={styles.couponInput}
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                />
                                <button onClick={handleApplyCoupon}>Aplicar</button>
                            </div>
                            {couponError && <p style={{ color: "#e11d48", fontSize: "0.75rem", marginTop: "5px" }}>{couponError}</p>}
                            {appliedCoupon && (
                                <div className={styles.appliedCoupon}>
                                    <span>Cupom: {appliedCoupon.code}</span>
                                    <button onClick={() => setAppliedCoupon(null)}>Remover</button>
                                </div>
                            )}
                            
                            {availableRouletteCoupon && (!appliedCoupon || appliedCoupon.code !== "ROLETA") && (
                                <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', border: '1px dashed #22c55e', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '0.85rem', color: '#166534', margin: '0 0 8px 0' }}>
                                        <strong>🎁 Prêmio da Roleta Disponível:</strong><br/>{availableRouletteCoupon.name}
                                    </p>
                                    <button 
                                        onClick={() => {
                                            if (isWholesaleEligible) {
                                                alert("O cupom da roleta não pode ser usado em pedidos de atacado.");
                                                return;
                                            }
                                            setAppliedCoupon({
                                                code: "ROLETA",
                                                type: availableRouletteCoupon.type,
                                                value: availableRouletteCoupon.value,
                                                name: availableRouletteCoupon.name
                                            });
                                        }}
                                        style={{ width: '100%', background: '#22c55e', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#16a34a'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#22c55e'}
                                    >
                                        USAR MEU CUPOM AGORA
                                    </button>
                                </div>
                            )}

                            {availableCashback > 0 && (
                                <div className={styles.cashbackApplyBox}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <Coins size={18} color="#059669" />
                                            <div>
                                                <strong style={{ fontSize: "0.85rem" }}>Usar R$ {availableCashback.toFixed(2)}</strong>
                                                <p style={{ margin: 0, fontSize: "0.7rem", color: "#64748b" }}>Saldo de Cashback disponível</p>
                                            </div>
                                        </div>
                                        <label className={styles.switch}>
                                            <input 
                                                type="checkbox" 
                                                checked={useCashback} 
                                                onChange={(e) => {
                                                    if (appliedCoupon && cashbackConfig && !cashbackConfig.allow_with_coupons) {
                                                        alert("O sistema não permite usar cupom e cashback no mesmo pedido.");
                                                        return;
                                                    }
                                                    setUseCashback(e.target.checked);
                                                }}
                                            />
                                            <span className={styles.slider}></span>
                                        </label>
                                    </div>
                                    {useCashback && cashbackConfig && subtotal < cashbackConfig.min_purchase_to_use && (
                                        <p style={{ color: "#e11d48", fontSize: "0.7rem", marginTop: "8px" }}>
                                            ⚠️ Mínimo de R$ {cashbackConfig.min_purchase_to_use.toFixed(2)} em produtos necessário.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className={styles.summaryDivider}></div>

                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Frete</span>
                                <span>{appliesFreeShipping ? <strong style={{ color: "#2d5a27" }}>Grátis</strong> : (shippingPrice > 0 ? `R$ ${shippingPrice.toFixed(2)}` : (step === "cart" ? "Calculado a seguir" : "A calcular"))}</span>
                            </div>
                            {discount > 0 && (
                                <div className={styles.summaryRow} style={{ color: "#15803d" }}>
                                    <span>Desconto</span>
                                    <span>- R$ {discount.toFixed(2)}</span>
                                </div>
                            )}
                            {cashbackDiscount > 0 && (
                                <div className={styles.summaryRow} style={{ color: "#059669" }}>
                                    <span>Cashback usado</span>
                                    <span>- R$ {cashbackDiscount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className={styles.totalRow}>
                                <span>Total</span>
                                <span>R$ {finalTotal.toFixed(2)}</span>
                            </div>

                            {earnedCashback > 0 && (
                                <div className={styles.earnedCashbackHint}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                                        <Coins size={16} /> Você ganhará <strong>R$ {earnedCashback.toFixed(2)}</strong> em cashback
                                    </div>
                                </div>
                            )}

                            {step === "checkout" && (
                                <div className={styles.paymentSectionInSummary}>
                                    <h4 style={{ fontSize: "0.9rem", color: "#64748b", margin: "20px 0 12px", fontWeight: 700 }}>MÉTODO DE PAGAMENTO</h4>
                                    <div className={styles.compactPaymentSelector}>
                                        {/* Stripe option hidden per user request */}
                                        <div 
                                            className={`${styles.compactPaymentOption} ${paymentMethod === 'mercadopago' ? styles.compactSelected : ''}`}
                                            onClick={() => setPaymentMethod('mercadopago')}
                                        >
                                            <div style={{ width: 20, height: 20, background: '#009ee3', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 900 }}>MP</div>
                                            <span>Mercado Pago</span>
                                            <div className={styles.compactRadio}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === "cart" ? (
                                <button className={`btn-primary ${styles.desktopCheckoutBtn}`} style={{ width: "100%", marginTop: "24px", height: "56px" }} onClick={() => {
                                    if (!token) {
                                        window.location.href = "/conta";
                                    } else {
                                        setStep("checkout");
                                    }
                                }}>
                                    CONTINUAR <ChevronRight size={18} />
                                </button>
                            ) : (
                                <button
                                    className={`btn-primary ${styles.desktopCheckoutBtn}`}
                                    style={{ width: "100%", marginTop: "24px", height: "64px", fontSize: "1.1rem" }}
                                    onClick={handleCheckout}
                                    disabled={loading}
                                >
                                    {loading ? "PROCESSANDO..." : "FINALIZAR COMPRA"}
                                </button>
                            )}

                            <div className={styles.securityBadge}>
                                <ShieldCheck size={24} color="#2d5a27" />
                                <div>
                                    <strong>Pagamento Seguro</strong>
                                    <p>Mercado Pago — Proteção SSL</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Checkout Bar */}
            <div className={styles.mobileStickyCheckout}>
                <div className={styles.mobileStickyTotal}>
                    <span>Total</span>
                    <strong>R$ {finalTotal.toFixed(2)}</strong>
                </div>
                {step === "cart" ? (
                    <button className="btn-primary" onClick={() => {
                        if (!token) {
                            window.location.href = "/conta";
                        } else {
                            setStep("checkout");
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}>
                        CONTINUAR
                    </button>
                ) : (
                    <button
                        className="btn-primary"
                        onClick={handleCheckout}
                        disabled={loading}
                    >
                        {loading ? "PROCESSANDO..." : "FINALIZAR COMPRA"}
                    </button>
                )}
            </div>

            <Footer />
        </main>
    );
}
