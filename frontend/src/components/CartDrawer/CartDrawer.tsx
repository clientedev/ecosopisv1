"use client";
import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import styles from "./CartDrawer.module.css";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Truck, CheckCircle2, Tag, RotateCcw } from "lucide-react";

export default function CartDrawer() {
    const { cart, isCartOpen, closeCart, removeFromCart, updateQuantity, cartCount, cartTotal, clientDayCoupon, clientDayCouponDismissed, dismissClientDayCoupon, restoreClientDayCoupon, isClientDay } = useCart();

    const freeShippingThreshold = 150;
    const remainingForFreeShipping = freeShippingThreshold - cartTotal;
    const shippingProgress = Math.min(100, (cartTotal / freeShippingThreshold) * 100);

    // Track first time coupon appears to show a toast-like notification
    const prevCouponRef = useRef<boolean>(false);
    useEffect(() => {
        const hasCoupon = !!clientDayCoupon;
        if (hasCoupon && !prevCouponRef.current && isCartOpen) {
            // coupon just became active
        }
        prevCouponRef.current = hasCoupon;
    }, [clientDayCoupon, isCartOpen]);

    // Coupon discount value
    const couponDiscount = clientDayCoupon ? cartTotal * 0.15 : 0;
    const totalWithCoupon = clientDayCoupon ? cartTotal - couponDiscount : cartTotal;

    const getImageUrl = (url?: string) => {
        if (!url) return "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        if (url.startsWith("attached_assets/")) return `/static/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    if (!isCartOpen) return null;

    return (
        <div className={styles.overlay} onClick={closeCart}>
            <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <ShoppingBag size={20} className={styles.cartHeaderIcon} />
                        <h3>SEU CARRINHO ({cartCount})</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={closeCart} aria-label="Fechar carrinho">
                        <X size={22} />
                    </button>
                </div>

                {/* Free Shipping Progress */}
                <div className={styles.shippingBarContainer}>
                    {remainingForFreeShipping <= 0 ? (
                        <div className={styles.freeShippingUnlocked}>
                            <CheckCircle2 size={16} /> <span>Parabéns! Você ganhou <strong>FRETE GRÁTIS</strong>!</span>
                        </div>
                    ) : (
                        <div className={styles.freeShippingText}>
                            <Truck size={16} /> <span>Faltam <strong>R$ {remainingForFreeShipping.toFixed(2).replace(".", ",")}</strong> para Frete Grátis</span>
                        </div>
                    )}
                    <div className={styles.progressBarBg}>
                        <div className={styles.progressBarFill} style={{ width: `${shippingProgress}%` }} />
                    </div>
                </div>

                {/* Dia do Cliente Coupon Banner */}
                {isClientDay && cart.length > 0 && (
                    <div className={clientDayCoupon ? styles.couponBannerActive : styles.couponBannerDismissed}>
                        {clientDayCoupon ? (
                            <>
                                <div className={styles.couponBannerLeft}>
                                    <Tag size={16} className={styles.couponBannerIcon} />
                                    <div>
                                        <div className={styles.couponBannerTitle}>🎉 Cupom Dia do Cliente aplicado!</div>
                                        <div className={styles.couponBannerCode}>
                                            <strong>DIADOCLIENTE</strong> — 15% OFF
                                            {cartTotal >= 50 && (
                                                <span className={styles.couponBannerSaving}>
                                                    &nbsp;(−R$ {couponDiscount.toFixed(2).replace(".", ",")})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className={styles.couponBannerRemove}
                                    onClick={dismissClientDayCoupon}
                                    title="Remover cupom para usar outro"
                                >
                                    <X size={15} />
                                    <span>Remover</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <div className={styles.couponBannerLeft}>
                                    <Tag size={16} className={styles.couponBannerIconDim} />
                                    <div className={styles.couponBannerDismissedText}>
                                        Cupom <strong>DIADOCLIENTE</strong> removido. Use outro ou
                                    </div>
                                </div>
                                <button
                                    className={styles.couponBannerRestore}
                                    onClick={restoreClientDayCoupon}
                                >
                                    <RotateCcw size={13} />
                                    <span>Restaurar 15%</span>
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Body / Item List */}
                <div className={styles.body}>
                    {cart.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIconCircle}>
                                <ShoppingBag size={42} />
                            </div>
                            <h4>Seu carrinho está vazio</h4>
                            <p>Explore nossos sabonetes, óleos e elixires botânicos para começar a cuidar da sua pele.</p>
                            <button className={styles.exploreBtn} onClick={closeCart}>
                                EXPLORAR PRODUTOS
                            </button>
                        </div>
                    ) : (
                        <div className={styles.itemList}>
                            {cart.map((item, idx) => {
                                const itemPrice = item.price || 0;
                                return (
                                    <div key={`${item.id}-${idx}`} className={styles.cartItem}>
                                        <div className={styles.itemImageWrapper}>
                                            <Image
                                                src={getImageUrl(item.image_url)}
                                                alt={item.name}
                                                fill
                                                className={styles.itemImage}
                                                sizes="70px"
                                            />
                                        </div>

                                        <div className={styles.itemInfo}>
                                            <div className={styles.itemTopRow}>
                                                <h5 className={styles.itemName}>{item.name}</h5>
                                                <button
                                                    className={styles.removeBtn}
                                                    onClick={() => removeFromCart(item.id)}
                                                    title="Remover item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {item.isWholesale && (
                                                <span className={styles.wholesaleItemBadge}>Item em Atacado</span>
                                            )}

                                            <div className={styles.itemBottomRow}>
                                                {/* Quantity Selector */}
                                                <div className={styles.quantityControl}>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        className={styles.qtyBtn}
                                                        aria-label="Diminuir quantidade"
                                                    >
                                                        <Minus size={13} />
                                                    </button>
                                                    <span className={styles.qtyValue}>{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        className={styles.qtyBtn}
                                                        aria-label="Aumentar quantidade"
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                </div>

                                                {/* Price */}
                                                <div className={styles.itemPrice}>
                                                    R$ {(itemPrice * item.quantity).toFixed(2).replace(".", ",")}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className={styles.footer}>
                        <div className={styles.subtotalRow}>
                            <span className={styles.subtotalLabel}>Subtotal:</span>
                            <span className={styles.subtotalValue}>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                        </div>
                        {clientDayCoupon && (
                            <div className={styles.couponDiscountRow}>
                                <span className={styles.couponDiscountLabel}>Desconto (DIADOCLIENTE 15%):</span>
                                <span className={styles.couponDiscountValue}>−R$ {couponDiscount.toFixed(2).replace(".", ",")}</span>
                            </div>
                        )}
                        {clientDayCoupon && (
                            <div className={styles.totalWithCouponRow}>
                                <span className={styles.totalWithCouponLabel}>Total estimado:</span>
                                <span className={styles.totalWithCouponValue}>R$ {totalWithCoupon.toFixed(2).replace(".", ",")}</span>
                            </div>
                        )}
                        <p className={styles.taxNote}>{clientDayCoupon ? 'Cupom aplicado! Frete calculado no checkout.' : 'Frete e cupons calculados no checkout'}</p>

                        <Link href="/carrinho" className={styles.checkoutBtn} onClick={closeCart}>
                            <span>FINALIZAR COMPRA</span>
                            <ArrowRight size={18} />
                        </Link>

                        <button className={styles.continueBtn} onClick={closeCart}>
                            CONTINUAR COMPRANDO
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
