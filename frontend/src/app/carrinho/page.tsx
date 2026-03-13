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
    const [cart, setCart] = useState<any[]>([]);
    const [step, setStep] = useState<"cart" | "checkout">("cart");
    const [loading, setLoading] = useState(false);
    const [shippingLoading, setShippingLoading] = useState(false);
    const [shippingOptions, setShippingOptions] = useState<any[]>([]);

    // Form states
    const [cep, setCep] = useState("");
    const [address, setAddress] = useState<any>({
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: ""
    });
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [selectedShipping, setSelectedShipping] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

    useEffect(() => {
        const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
        setCart(savedCart);
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
                        width: 15, // Default dimensions
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
                // Pré-selecionar a opção mais barata ou rápida
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
                alert("CEP não encontrado.");
            }
        } catch (error) {
            console.error("CEP lookup error", error);
        }
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const shippingPrice = selectedShipping ? selectedShipping.price : 0;
    const discount = appliedCoupon ? (appliedCoupon.type === "fixed" ? appliedCoupon.value : (subtotal * appliedCoupon.value / 100)) : 0;
    const total = subtotal + shippingPrice - discount;

    const handleCheckout = async () => {
        console.log("🛒 Iniciando checkout...", { paymentMethod, total, API_URL });

        if (!selectedShipping) {
            alert("⚠️ Selecione uma opção de frete antes de continuar.");
            setLoading(false);
            return;
        }
        if (!customerName || !cep) {
            alert("⚠️ Preencha seu nome e CEP.");
            setLoading(false);
            return;
        }

        setLoading(true);
        const token = localStorage.getItem("token");
        console.log("🔑 Token encontrado:", token ? "Sim" : "Não");
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

                // Check if we have a preference_id for Checkout Pro (Official Flow)
                if (orderData.mp_preference_id) {
                    console.log("💳 Abrindo Checkout Pro...", orderData.mp_preference_id);

                    if (window.MercadoPago) {
                        try {
                            const mp = new window.MercadoPago(MP_PUBLIC_KEY);

                            // Using the newer v2 way to open the brick/modal
                            // For simplicity and "official" feel, we can use the modal or redirect
                            const checkout = mp.checkout({
                                preference: {
                                    id: orderData.mp_preference_id
                                },
                                autoOpen: true, // This opens the modal automatically
                            });
                        } catch (err) {
                            console.error("MP SDK Error, falling back to redirect:", err);
                            window.location.href = orderData.mp_init_point;
                        }
                    } else {
                        console.warn("MercadoPago SDK not loaded, redirecting...");
                        window.location.href = orderData.mp_init_point;
                    }
                } else if (orderData.payment_method === "pix" && orderData.pix_qr_code) {
                    // Fallback for direct PIX if preference creation failed but PIX stayed
                    window.location.href = `/pedido/${orderData.id}`;
                } else {
                    // Generic fallback
                    window.location.href = `/pedido/${orderData.id}`;
                }
            } else {
                const err = await res.json();
                alert(err.detail || "Erro ao processar pedido. Verifique os dados.");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            alert("Falha na conexão com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0 && step === "cart") {
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
                onLoad={() => console.log("MP SDK Loaded")}
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
                                        <div style={{ textAlign: "center", padding: "30px" }}>
                                            <Loader2 className="spin" style={{ margin: "0 auto", color: "#2d5a27" }} />
                                            <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "#666" }}>Consultando Jadlog, Correios e mais...</p>
                                        </div>
                                    ) : shippingOptions.length === 0 ? (
                                        <div style={{ padding: "20px", background: "#fff5f5", borderRadius: "12px", border: "1px dashed #feb2b2", textAlign: "center" }}>
                                            <Info size={20} style={{ color: "#f56565", marginBottom: "8px" }} />
                                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#c53030" }}>
                                                {cep.length === 8 ? "Não foi possível calcular o frete. Verifique o CEP ou as configurações da loja." : "Informe o CEP para calcular o frete real."}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className={styles.shippingOptionsList}>
                                            {shippingOptions.map(opt => (
                                                <div
                                                    key={opt.id}
                                                    className={`${styles.shippingOption} ${selectedShipping?.id === opt.id ? styles.selectedOption : ""}`}
                                                    onClick={() => setSelectedShipping(opt)}
                                                >
                                                    <div>
                                                        <span className={styles.carrierBadge}>{opt.company}</span>
                                                        <strong style={{ display: "block" }}>{opt.name}</strong>
                                                        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7 }}>Prazo estimado: {opt.delivery_time} dias úteis</p>
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: "#2d5a27" }}>R$ {opt.price.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.detailSection}>
                                    <h3>💳 PAGAMENTO VIA MERCADO PAGO</h3>
                                    <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "20px" }}>
                                        Escolha sua forma de pagamento preferida. Segurança garantida.
                                    </p>
                                    <div className={styles.paymentMethods}>
                                        <div className={`${styles.paymentCard} ${paymentMethod === "pix" ? styles.selectedPayment : ""}`} onClick={() => setPaymentMethod("pix")}>
                                            <img src="https://logopng.com.br/logos/pix-106.png" alt="PIX" width={32} style={{ marginBottom: "8px" }} />
                                            <strong style={{ display: "block" }}>PIX</strong>
                                            <span style={{ fontSize: "0.7rem", color: "var(--primary-green)" }}>Aprovação Instântanea</span>
                                        </div>
                                        <div className={`${styles.paymentCard} ${paymentMethod === "credit_card" ? styles.selectedPayment : ""}`} onClick={() => setPaymentMethod("credit_card")}>
                                            <CreditCard size={32} color="#009EE3" style={{ marginBottom: "8px" }} />
                                            <strong style={{ display: "block" }}>Cartão / Outros</strong>
                                            <span style={{ fontSize: "0.7rem", color: "#666" }}>Até 12x no cartão</span>
                                        </div>
                                    </div>

                                    <div className={styles.mpBadge}>
                                        <img src="https://imgmp.mlstatic.com/org-img/banners/br/med/468X60.jpg" alt="Mercado Pago" style={{ maxWidth: "100%", height: "auto" }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.rightColumn}>
                        <div className={styles.summaryCard}>
                            <h3>RESUMO DO PEDIDO</h3>
                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Frete</span>
                                <span>{selectedShipping ? `R$ ${shippingPrice.toFixed(2)}` : "Calcule o frete"}</span>
                            </div>
                            {discount > 0 && (
                                <div className={styles.summaryRow} style={{ color: "var(--primary-green)" }}>
                                    <span>Desconto Aplicado</span>
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
                                    <strong>Pagamento Criptografado</strong>
                                    <p>Seus dados estão protegidos</p>
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
