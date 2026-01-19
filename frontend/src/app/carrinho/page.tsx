"use client";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";

export default function CarrinhoPage() {
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [coupon, setCoupon] = useState("");
    const [discount, setDiscount] = useState<any>(null);
    const [couponError, setCouponError] = useState("");

    useEffect(() => {
        const savedCart = localStorage.getItem("cart");
        if (savedCart) {
            setCartItems(JSON.parse(savedCart));
        }
    }, []);

    const handleApplyCoupon = async () => {
        if (!coupon) return;
        setCouponError("");
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/coupons/validate/${coupon}`);
            if (res.ok) {
                const data = await res.json();
                const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                if (data.min_purchase_value > subtotal) {
                    setCouponError(`Compra mínima de R$ ${data.min_purchase_value} necessária`);
                    setDiscount(null);
                    return;
                }
                setDiscount(data);
            } else {
                const err = await res.json();
                setCouponError(err.detail || "Cupom inválido");
                setDiscount(null);
            }
        } catch (error) {
            setCouponError("Erro ao validar cupom");
            setDiscount(null);
        }
    };

    const calculateSubtotal = () => {
        return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    };

    const calculateDiscountAmount = () => {
        if (!discount) return 0;
        const subtotal = calculateSubtotal();
        if (discount.discount_type === 'percentage') {
            return subtotal * (discount.discount_value / 100);
        } else {
            return Math.min(subtotal, discount.discount_value);
        }
    };

    const handleFinalizePurchase = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/conta?redirect=/carrinho";
            return;
        }
        setStep("checkout");
    };

    const [step, setStep] = useState("cart"); // cart, checkout, success
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [address, setAddress] = useState({
        street: "",
        city: "",
        zip: "",
        neighborhood: "",
        state: ""
    });
    const [shippingOptions, setShippingOptions] = useState<any[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<any>(null);
    const [loadingCep, setLoadingCep] = useState(false);

    const handleCepChange = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, "");
        setAddress({ ...address, zip: cleanCep });
        
        if (cleanCep.length === 8) {
            setLoadingCep(true);
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setAddress({
                        ...address,
                        zip: cleanCep,
                        street: data.logradouro,
                        neighborhood: data.bairro,
                        city: data.localidade,
                        state: data.uf
                    });
                    
                    // Simular opções de frete baseadas no CEP
                    const isSp = data.uf === "SP";
                    setShippingOptions([
                        { id: "pac", name: "PAC", price: isSp ? 15.90 : 25.90, days: isSp ? 5 : 10 },
                        { id: "sedex", name: "SEDEX", price: isSp ? 22.90 : 45.90, days: isSp ? 2 : 4 }
                    ]);
                }
            } catch (error) {
                console.error("Erro ao buscar CEP", error);
            } finally {
                setLoadingCep(false);
            }
        }
    };

    const calculateTotal = () => {
        const shippingPrice = selectedShipping ? selectedShipping.price : 0;
        return Math.max(0, calculateSubtotal() - calculateDiscountAmount() + shippingPrice);
    };

    const submitOrder = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: cartItems.map(i => ({
                        product_id: i.id,
                        product_name: i.name,
                        quantity: i.quantity,
                        price: i.price
                    })),
                    total: calculateTotal(),
                    address: address,
                    payment_method: paymentMethod
                })
            });
            if (res.ok) {
                const data = await res.json();
                setOrderResult(data);
                setStep("success");
                localStorage.removeItem("cart");
                setCartItems([]);
            }
        } catch (error) {
            console.error("Erro ao processar pedido", error);
        }
    };

    if (step === "success") {
        return (
            <main>
                <Header />
                <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <h1 style={{ color: '#2d5a27' }}>PEDIDO REALIZADO COM SUCESSO!</h1>
                    <p style={{ margin: '20px 0' }}>Seu pedido #{orderResult?.id} foi recebido.</p>
                    
                    {orderResult?.pix_code ? (
                        <div style={{ background: '#f9f9f9', padding: '30px', borderRadius: '12px', maxWidth: '500px', margin: '0 auto' }}>
                            <h3>Pague via PIX</h3>
                            <p style={{ fontSize: '0.8rem', wordBreak: 'break-all', margin: '15px 0', padding: '10px', background: '#eee' }}>
                                {orderResult.pix_code}
                            </p>
                            <button className="btn-primary" onClick={() => navigator.clipboard.writeText(orderResult.pix_code)}>
                                COPIAR CÓDIGO PIX
                            </button>
                        </div>
                    ) : (
                        <a href={orderResult?.payment_url} target="_blank" className="btn-primary">
                            IR PARA PAGAMENTO (STRIPE)
                        </a>
                    )}
                    
                    <div style={{ marginTop: '30px' }}>
                        <Link href="/produtos" className="btn-outline">VOLTAR ÀS COMPRAS</Link>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    if (step === "checkout") {
        return (
            <main>
                <Header />
                <div className="container" style={{ padding: '50px 0' }}>
                    <h1>CHECKOUT</h1>
                    <div className={styles.cartGrid}>
                        <div className={styles.itemsList}>
                            <div className={styles.detailSection} style={{ borderTop: 'none' }}>
                                <h3>ENDEREÇO DE ENTREGA</h3>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <input 
                                        className={styles.input} 
                                        placeholder="CEP" 
                                        value={address.zip}
                                        style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                        onChange={(e) => handleCepChange(e.target.value)}
                                        maxLength={8}
                                    />
                                    {loadingCep && <span style={{ fontSize: '0.8rem', alignSelf: 'center' }}>Buscando...</span>}
                                </div>
                                <input 
                                    className={styles.input} 
                                    placeholder="Rua e Número" 
                                    value={address.street}
                                    style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                    onChange={(e) => setAddress({...address, street: e.target.value})}
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input 
                                        className={styles.input} 
                                        placeholder="Cidade" 
                                        value={address.city}
                                        style={{ flex: 2, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                        readOnly
                                    />
                                    <input 
                                        className={styles.input} 
                                        placeholder="UF" 
                                        value={address.state}
                                        style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                        readOnly
                                    />
                                </div>
                            </div>

                            {shippingOptions.length > 0 && (
                                <div className={styles.detailSection}>
                                    <h3>OPÇÕES DE FRETE</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                                        {shippingOptions.map(opt => (
                                            <label key={opt.id} style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                padding: '12px', 
                                                borderRadius: '8px', 
                                                border: selectedShipping?.id === opt.id ? '2px solid #2d5a27' : '1px solid #ddd',
                                                cursor: 'pointer',
                                                backgroundColor: selectedShipping?.id === opt.id ? '#f0fdf4' : 'transparent'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="shipping" 
                                                        checked={selectedShipping?.id === opt.id} 
                                                        onChange={() => setSelectedShipping(opt)} 
                                                    />
                                                    <div>
                                                        <p style={{ fontWeight: 'bold' }}>{opt.name}</p>
                                                        <p style={{ fontSize: '0.8rem', color: '#666' }}>Entrega em até {opt.days} dias úteis</p>
                                                    </div>
                                                </div>
                                                <span style={{ fontWeight: 'bold' }}>R$ {opt.price.toFixed(2)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={styles.detailSection}>
                                <h3>MÉTODO DE PAGAMENTO</h3>
                                <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input type="radio" name="pay" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} />
                                        PIX (Confirmação Instantânea)
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input type="radio" name="pay" checked={paymentMethod === 'credit_card'} onChange={() => setPaymentMethod('credit_card')} />
                                        Cartão de Crédito
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className={styles.summaryCard}>
                            <h3>Total: R$ {calculateTotal().toFixed(2)}</h3>
                            <button className="btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={submitOrder}>
                                PAGAR AGORA
                            </button>
                            <button className="btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={() => setStep('cart')}>
                                VOLTAR
                            </button>
                        </div>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main>
            <Header />
            <div className={`container ${styles.carrinhoContainer}`}>
                <h1 className={styles.title}>CARRINHO DE COMPRAS</h1>

                {cartItems.length === 0 ? (
                    <div className={styles.emptyCart}>
                        <div className={styles.emptyIcon}>🛒</div>
                        <h2>Seu carrinho está vazio</h2>
                        <p>Adicione produtos incríveis da ECOSOPIS ao seu carrinho!</p>
                        <Link href="/produtos" className="btn-primary">
                            VER PRODUTOS
                        </Link>
                    </div>
                ) : (
                    <div className={styles.cartGrid}>
                        <div className={styles.itemsList}>
                            {cartItems.map((item) => (
                                <div key={item.id} className={styles.cartItem}>
                                    <div className={styles.itemInfo}>
                                        <h3>{item.name}</h3>
                                        <p>R$ {item.price.toFixed(2)} x {item.quantity}</p>
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className={styles.removeBtn}>Remover</button>
                                </div>
                            ))}
                        </div>

                        <div className={styles.summaryCard}>
                            <h3>Resumo do Pedido</h3>
                            <div className={styles.summaryRow}>
                                <span>Subtotal:</span>
                                <span>R$ {calculateSubtotal().toFixed(2)}</span>
                            </div>
                            
                            <div className={styles.couponWrapper}>
                                <div className={styles.couponInput}>
                                    <input 
                                        type="text" 
                                        placeholder="CUPOM" 
                                        value={coupon}
                                        onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                                    />
                                    <button onClick={handleApplyCoupon}>APLICAR</button>
                                </div>
                                {couponError && <p className={styles.error}>{couponError}</p>}
                                {discount && (
                                    <div className={styles.appliedCoupon}>
                                        <span>Cupom {discount.code} aplicado!</span>
                                        <button onClick={() => setDiscount(null)}>X</button>
                                    </div>
                                )}
                            </div>

                            {discount && (
                                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                                    <span>Desconto:</span>
                                    <span>- R$ {calculateDiscountAmount().toFixed(2)}</span>
                                </div>
                            )}

                            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                <span>Total:</span>
                                <span>R$ {calculateTotal().toFixed(2)}</span>
                            </div>

                            <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleFinalizePurchase}>
                                FINALIZAR COMPRA
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
        </main>
    );
}
