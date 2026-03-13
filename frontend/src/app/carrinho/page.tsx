"use client";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";
import Script from "next/script";
import { Trash2, ShoppingBag, ShieldCheck, Truck, CreditCard, ChevronRight, Loader2, Info } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "";

// Add MP to Window interface
declare global {
    interface Window {
        MercadoPago: any;
    }
}

export default function CarrinhoPage() {
    // Basic states
    const [cart, setCart] = useState<any[]>([]);
    const [step, setStep] = useState<"cart" | "checkout">("cart");
    const [loading, setLoading] = useState(false);
    const [shippingLoading, setShippingLoading] = useState(false);
    const [shippingOptions, setShippingOptions] = useState<any[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<any>(null);

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

    // Payment/Coupon states
    const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [couponCode, setCouponCode] = useState("");
    const [couponError, setCouponError] = useState("");

    // Initialize cart
    useEffect(() => {
        const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
        setCart(savedCart);

        // Check for roulette discount
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

    const updateQuantity = (id: number, delta: number) => {
        const newCart = cart.map(item => {
            if (item.id === id) {
                const q = Math.max(1, item.quantity + delta);
                return { ...item, quantity: q };
            }
            return item;
        });
        setCart(newCart);
        localStorage.setItem("cart", JSON.stringify(newCart));
    };

    const removeItem = (id: number) => {
        const newCart = cart.filter(item => item.id !== id);
        setCart(newCart);
        localStorage.setItem("cart", JSON.stringify(newCart));
    };

    const fetchShippingRates = useCallback(async (targetCep: string) => {
        if (targetCep.length !== 8) return;
        setShippingLoading(true);
        setShippingOptions([]);
        setSelectedShipping(null);

        try {
            const res = await fetch(`${API_URL}/shipping/calculate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dest_cep: targetCep,
                    items: cart.map(i => ({
                        id: String(i.id),
                        width: 15,
                        height: 15,
                        length: 15,
                        weight: 0.5,
                        price: i.price,
                        quantity: i.quantity
                    }))
                })
            });
            if (res.ok) {
                const data = await res.json();
                setShippingOptions(data);
                if (data.length > 0) {
                    setSelectedShipping(data[0]);
                }
            }
        } catch (error) {
            console.error("Shipping calculation error", error);
        } finally {
            setShippingLoading(false);
        }
    }, [cart]);

    const handleCepLookup = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        setShippingLoading(true); // Start loader early
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
                fetchShippingRates(cleanCep);
            } else {
                setShippingLoading(false);
                setShippingOptions([]);
                alert("CEP não encontrado.");
            }
        } catch (error) {
            console.error("CEP lookup error", error);
            setShippingLoading(false);
        }
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

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const shippingPrice = selectedShipping ? selectedShipping.price : 0;
    const discount = appliedCoupon ? (appliedCoupon.type === "fixed" ? appliedCoupon.value : (subtotal * appliedCoupon.value / 100)) : 0;
    const total = Math.max(0, subtotal + shippingPrice - discount);

    const handleCheckout = async () => {
        if (!selectedShipping) {
            alert("⚠️ Selecione uma opção de frete antes de continuar.");
            return;
        }
        if (!customerName || !cep) {
            alert("⚠️ Preencha seu nome e CEP.");
            return;
        }

        setLoading(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/orders/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, price: i.price, product_name: i.name })),
                    total: total,
                    address: { ...address, cep: cep.replace(/\D/g, "") },
                    payment_method: paymentMethod,
                    shipping_method: `${selectedShipping.company} (${selectedShipping.name})`,
                    shipping_price: shippingPrice,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    coupon_code: appliedCoupon?.code,
                    discount_amount: discount
                }),
            });

            if (res.ok) {
                const orderData = await res.json();
                localStorage.removeItem("cart");

                if (orderData.mp_preference_id) {
                    if (window.MercadoPago) {
                        try {
                            const mp = new window.MercadoPago(MP_PUBLIC_KEY);
                            mp.checkout({
                                preference: {
                                    id: orderData.mp_preference_id
                                },
                                autoOpen: true,
                            });
                        } catch (err) {
                            window.location.href = orderData.mp_init_point;
                        }
                    } else {
                        window.location.href = orderData.mp_init_point;
                    }
                } else {
                    window.location.href = `/pedido/${orderData.id}`;
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
            <Script
                src="https://sdk.mercadopago.com/js/v2"
                strategy="afterInteractive"
            />
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
                                            <button className={styles.removeBtn} onClick={() => removeItem(item.id)} title="Remover item">
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
                                    </div>
                                </div>

                                <div className={styles.detailSection}>
                                    <h3>🚚 OPÇÕES DE FRETE</h3>
                                    {shippingLoading ? (
                                        <div style={{ textAlign: "center", padding: "30px", background: "#fff", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                                            <Loader2 className="spin" style={{ margin: "0 auto", color: "#2d5a27" }} />
                                            <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "#64748b", fontWeight: 500 }}>Buscando as melhores ofertas de frete...</p>
                                        </div>
                                    ) : cep.replace(/\D/g, "").length === 8 && shippingOptions.length === 0 ? (
                                        <div style={{ padding: "30px", background: "#fff1f2", borderRadius: "16px", border: "1px solid #fecdd3", textAlign: "center" }}>
                                            <Info size={24} style={{ color: "#e11d48", marginBottom: "12px" }} />
                                            <p style={{ margin: 0, fontSize: "0.9rem", color: "#9f1239", fontWeight: 600 }}>
                                                Não foi possível calcular o frete para este CEP.
                                            </p>
                                            <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#be123c" }}>Verifique o endereço ou tente novamente.</p>
                                        </div>
                                    ) : shippingOptions.length === 0 ? (
                                        <div style={{ padding: "30px", background: "#f8fafc", borderRadius: "16px", border: "2px dashed #e2e8f0", textAlign: "center" }}>
                                            <Truck size={32} style={{ color: "#cbd5e1", marginBottom: "12px" }} />
                                            <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b", fontWeight: 500 }}>
                                                Informe seu CEP para ver as opções de entrega.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className={styles.shippingOptionsList}>
                                            {shippingOptions.map(opt => (
                                                <label
                                                    key={opt.id}
                                                    className={`${styles.shippingOption} ${selectedShipping?.id === opt.id ? styles.selectedOption : ""}`}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}>
                                                        <input 
                                                            type="radio" 
                                                            name="shipping" 
                                                            checked={selectedShipping?.id === opt.id}
                                                            onChange={() => setSelectedShipping(opt)}
                                                            className={styles.radioInput}
                                                        />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                                <div>
                                                                    <span className={styles.carrierBadge}>{opt.company}</span>
                                                                    <strong style={{ display: "block", fontSize: "1rem", color: "#1e293b" }}>{opt.name}</strong>
                                                                    <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                                                                        Entrega em até <strong>{opt.delivery_time} dias úteis</strong>
                                                                    </p>
                                                                </div>
                                                                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2d5a27" }}>
                                                                    R$ {opt.price.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.detailSection}>
                                    <h3>💳 PAGAMENTO</h3>
                                    <div className={styles.paymentMethods}>
                                        <div className={`${styles.paymentCard} ${paymentMethod === "pix" ? styles.selectedPayment : ""}`} onClick={() => setPaymentMethod("pix")}>
                                            <img src="https://logopng.com.br/logos/pix-106.png" alt="PIX" width={32} style={{ marginBottom: "8px" }} />
                                            <strong>PIX</strong>
                                            <span style={{ fontSize: "0.7rem", color: "#15803d" }}>Aprovação Instântanea</span>
                                        </div>
                                        <div className={`${styles.paymentCard} ${paymentMethod === "credit_card" ? styles.selectedPayment : ""}`} onClick={() => setPaymentMethod("credit_card")}>
                                            <CreditCard size={32} color="#009EE3" style={{ marginBottom: "8px" }} />
                                            <strong>Cartão</strong>
                                            <span style={{ fontSize: "0.7rem", color: "#666" }}>Até 12x no Mercado Pago</span>
                                        </div>
                                    </div>
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
                                <span>{selectedShipping ? `R$ ${shippingPrice.toFixed(2)}` : "—"}</span>
                            </div>
                            {discount > 0 && (
                                <div className={styles.summaryRow} style={{ color: "#15803d" }}>
                                    <span>Desconto</span>
                                    <span>- R$ {discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className={styles.totalRow}>
                                <span>Total</span>
                                <span>R$ {total.toFixed(2)}</span>
                            </div>

                            {step === "cart" ? (
                                <button className="btn-primary" style={{ width: "100%", marginTop: "24px", height: "56px" }} onClick={() => setStep("checkout")}>
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
                                    <p>Mercado Pago Criptografado</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
            <style jsx>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </main>
    );
}
