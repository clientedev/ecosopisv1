"use client";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";
import { Trash2, ShoppingBag, ShieldCheck, Truck, CreditCard, ChevronRight, Loader2, Info, ShoppingCart } from "lucide-react";
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

    // Calculate shipping whenever valid CEP and cart changes
    useEffect(() => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length === 8 && cart.length > 0 && step === "checkout") {
            const calculateShipping = async () => {
                setLoadingShipping(true);
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
                        setShippingOptions([]);
                        setSelectedShipping(null);
                    }
                } catch (error) {
                    console.error("Shipping calc error:", error);
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
    const finalTotal = Math.max(0, subtotal + shippingPrice - discount);

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
                    items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, price: i.price })),
                    shipping_price: shippingPrice,
                    shipping_method_id: selectedShipping.id.toString(),
                    address_info: { 
                        ...address, 
                        postal_code: cep.replace(/\D/g, ""),
                        customer_name: customerName,
                        customer_phone: customerPhone
                    },
                    return_url: window.location.origin,
                    coupon_code: appliedCoupon?.code
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
                                            <div className={styles.itemInfo}>
                                                <h4>{item.name}</h4>
                                                <p>R$ {item.price.toFixed(2)}</p>
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
                            <div className={styles.totalRow}>
                                <span>Total</span>
                                <span>R$ {finalTotal.toFixed(2)}</span>
                            </div>

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
