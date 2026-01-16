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

    const calculateTotal = () => {
        return Math.max(0, calculateSubtotal() - calculateDiscountAmount());
    };

    const removeItem = (id: number) => {
        const newCart = cartItems.filter(item => item.id !== id);
        setCartItems(newCart);
        localStorage.setItem("cart", JSON.stringify(newCart));
    };

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

                            <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
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
