"use client";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";
import { Trash2, ShoppingBag, ShieldCheck, Truck, CreditCard, ChevronRight, Loader2, Info, ShoppingCart, Coins } from "lucide-react";
import { useCart } from "@/context/CartContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { useAuth } from "@/context/AuthContext";

export default function CarrinhoPage() {
    const { cart, updateQuantity, removeFromCart, cartTotal: subtotal } = useCart();
    const { user, token, refreshProfile } = useAuth();
    const [step, setStep] = useState<"cart" | "checkout">("cart");
    const [loading, setLoading] = useState(false);

    // Shipping states
    const [shippingOptions, setShippingOptions] = useState<any[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<any>(null);
    const [loadingShipping, setLoadingShipping] = useState(false);

    // Form states
    const [cep, setCep] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerCpf, setCustomerCpf] = useState("");

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
        if (user && step === "checkout") {
            if (!customerName) setCustomerName(user.full_name || "");
            
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
                setShowAddressForm(false);
            } else if (!user.addresses || user.addresses.length === 0) {
                setShowAddressForm(true);
            }
        }
    }, [user, step]);

    // Payment/Coupon states
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [couponCode, setCouponCode] = useState("");
    const [couponError, setCouponError] = useState("");

    // Cashback states
    const [availableCashback, setAvailableCashback] = useState(0);
    const [useCashback, setUseCashback] = useState(false);
    const [cashbackToApply, setCashbackToApply] = useState(0);
    const [cashbackConfig, setCashbackConfig] = useState<any>(null);

    // Initialize/Check for coupons
    useEffect(() => {
        const rouletteDiscount = localStorage.getItem("active_roulette_discount");
        if (rouletteDiscount) {
            try {
                const data = JSON.parse(rouletteDiscount);
                setAppliedCoupon({
                    code: "ROLETA",
                    type: data.type,
                    value: data.value,
                    name: data.name
                });
            } catch (e) {
                localStorage.removeItem("active_roulette_discount");
            }
        }
    }, []);

    // Fetch Cashback balance and config
    useEffect(() => {
        if (token && step === "checkout") {
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
    }, [token, step]);

    // Calculate shipping whenever valid CEP and cart changes
    const [shippingError, setShippingError] = useState<string | null>(null);

    useEffect(() => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length === 8 && cart.length > 0 && step === "checkout") {
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
                        setShippingError(errData.detail || "Erro ao calcular frete. Verifique o CEP e tente novamente.");
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
    }, [cep, cart, step]);

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
        try {
            const res = await fetch(`/api/coupons/validate/${couponCode}`);
            if (res.ok) {
                const data = await res.json();
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

    const shippingPrice = selectedShipping ? selectedShipping.price : 0;
    const discount = appliedCoupon ? (appliedCoupon.type === "fixed" ? appliedCoupon.value : (subtotal * appliedCoupon.value / 100)) : 0;
    
    // Total Cashback to Apply
    const cashbackDiscount = useCashback ? Math.min(availableCashback, subtotal - discount) : 0;
    
    const finalTotal = Math.max(0, subtotal + shippingPrice - discount - cashbackDiscount);
    
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
        
        if (!selectedShipping) {
            alert("⚠️ Selecione uma opção de frete para continuar.");
            return;
        }

        setLoading(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/payment/checkout`, {
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
                                                <input type="text" placeholder="Cidade" className={styles.inputField} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
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
                                                        R$ {opt.price.toFixed(2)}
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

                                <div className={styles.detailSection}>
                                    <h3>💳 PAGAMENTO</h3>
                                    <div style={{
                                        padding: "20px", background: "#f8fafc", borderRadius: "12px",
                                        border: "2px solid #635bff", display: "flex", alignItems: "center", gap: "16px"
                                    }}>
                                        <CreditCard size={32} color="#635bff" />
                                        <div>
                                            <strong style={{ color: "#1e293b" }}>Stripe Checkout</strong>
                                            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                                                Cartão de Crédito · Débito · Pix
                                            </p>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "8px", textAlign: "center" }}>
                                        Você será redirecionado para o checkout seguro da Stripe
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.rightColumn}>
                        <div className={styles.summaryCard}>
                            <h3>RESUMO DO PEDIDO</h3>
                            
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
                                <span>{shippingPrice > 0 ? `R$ ${shippingPrice.toFixed(2)}` : (step === "cart" ? "Calculado a seguir" : "A calcular")}</span>
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

                            {step === "cart" ? (
                                <button className="btn-primary" style={{ width: "100%", marginTop: "24px", height: "56px" }} onClick={() => {
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
                                    className="btn-primary"
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
                                    <p>Stripe — Criptografia SSL</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
