"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from '@/components/Toast/Toast';
import { useAuth } from './AuthContext';

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
    isWholesale?: boolean;
    is_on_sale?: boolean;
    sale_price?: number | null;
    original_price?: number; // preço cheio (antes da promoção)
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (product: any, quantity?: number) => void;
    addWholesaleBundleToCart: (items: any[]) => void;
    removeFromCart: (id: number) => void;
    updateQuantity: (id: number, delta: number) => void;
    clearCart: () => void;
    cartCount: number;
    cartTotal: number;
    wholesaleTotalRaw: number; // Sum of original prices before wholesale discount
    isWholesaleUnlocked: boolean;
    isCartOpen: boolean;
    setIsCartOpen: (open: boolean) => void;
    openCart: () => void;
    closeCart: () => void;
    // Dia do Cliente coupon
    clientDayCoupon: { code: string; discount: number } | null;
    clientDayCouponDismissed: boolean;
    dismissClientDayCoupon: () => void;
    restoreClientDayCoupon: () => void;
    isClientDay: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};

// Check if Dia do Cliente is still active (until midnight 15/09/2026 Brasília time)
const checkIsClientDay = () => {
    const now = new Date();
    const clientDayEnd = new Date('2026-09-16T00:00:00-03:00');
    return now < clientDayEnd;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const { showToast } = useToast();
    const { user, token } = useAuth();
    const [isInitialized, setIsInitialized] = useState(false);

    // Dia do Cliente coupon state
    const [isClientDay] = useState(checkIsClientDay);
    const [clientDayCouponDismissed, setClientDayCouponDismissed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('clientDayCouponDismissed') === 'true';
    });

    const openCart = useCallback(() => setIsCartOpen(true), []);
    const closeCart = useCallback(() => setIsCartOpen(false), []);

    // 1. Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to parse cart from localStorage", e);
            }
        }
        setIsInitialized(true);
    }, []);

    // 2. Load cart from server when user logs in
    useEffect(() => {
        if (isInitialized && user && user.cart_json) {
            try {
                const serverCart = JSON.parse(user.cart_json);
                // Only load from server if local cart is empty to avoid overwriting current session
                if (cart.length === 0 && serverCart.length > 0) {
                    setCart(serverCart);
                    showToast("Seu carrinho foi recuperado!", "success");
                }
            } catch (e) {
                console.error("Failed to parse cart from server", e);
            }
        }
    }, [user, isInitialized]);

    // 3. Save cart to localStorage AND sync with backend
    useEffect(() => {
        if (!isInitialized) return;
        
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Sync with backend if logged in
        if (token) {
            const syncCart = async () => {
                try {
                    await fetch('/api/cart/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(cart)
                    });
                } catch (e) {
                    console.error("Failed to sync cart with server", e);
                }
            };
            // Debounce or just sync
            const timeoutId = setTimeout(syncCart, 1000);
            return () => clearTimeout(timeoutId);
        }
    }, [cart, token, isInitialized]);

    const addToCart = useCallback((product: any, quantityToAdd: number = 1) => {
        const qty = Math.max(1, quantityToAdd);
        setCart((prev) => {
            const existingItem = prev.find((item) => item.id === product.id && !item.isWholesale);
            if (existingItem) {
                showToast(`${product.name}: +${qty} no carrinho!`, 'success');
                return prev.map((item) =>
                    (item.id === product.id && !item.isWholesale) ? { ...item, quantity: item.quantity + qty } : item
                );
            }
            showToast(`${product.name} (${qty}x) adicionado ao carrinho!`, 'success');
            return [...prev, { ...product, quantity: qty, isWholesale: false }];
        });
        setIsCartOpen(true);
    }, [showToast]);

    const addWholesaleBundleToCart = useCallback((items: any[]) => {
        setCart((prev) => {
            const wholesaleItems = items.map(item => ({
                ...item,
                quantity: item.quantity || 1,
                isWholesale: true,
                price: item.is_on_sale && item.sale_price && item.sale_price > 0
                    ? (item.original_price ?? item.price)
                    : item.price,
            }));
            
            showToast(`Kit Atacado de ${items.length} itens adicionado!`, 'success');
            return [...prev, ...wholesaleItems];
        });
        setIsCartOpen(true);
    }, [showToast]);

    const removeFromCart = useCallback((id: number) => {
        setCart((prev) => {
            const index = prev.findIndex(item => item.id === id);
            if (index === -1) return prev;
            const newCart = [...prev];
            newCart.splice(index, 1);
            return newCart;
        });
    }, []);

    const updateQuantity = useCallback((id: number, delta: number) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    const newQty = Math.max(1, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            })
        );
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        localStorage.removeItem('cart');
        if (token) {
            fetch('/api/cart/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify([])
            }).catch(e => console.error("Failed to clear cart on server", e));
        }
    }, [token]);

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    const wholesaleItemsCount = cart.filter(item => item.isWholesale).reduce((acc, item) => acc + item.quantity, 0);
    const isWholesaleUnlocked = wholesaleItemsCount >= 10;
    
    const cartTotal = cart.reduce((acc, item) => {
        const isItemDiscounted = item.isWholesale && isWholesaleUnlocked;
        const itemPrice = isItemDiscounted ? item.price * 0.7 : item.price;
        return acc + (itemPrice * item.quantity);
    }, 0);

    const wholesaleTotalRaw = cart.reduce((acc, item) => {
        return acc + (item.price * item.quantity);
    }, 0);

    // Dia do Cliente: auto-apply coupon when total >= R$50 and not dismissed
    const clientDayCouponEligible = isClientDay && cartTotal >= 50 && !isWholesaleUnlocked;
    const clientDayCoupon = clientDayCouponEligible && !clientDayCouponDismissed
        ? { code: 'DIADOCLIENTE', discount: 15 }
        : null;

    const dismissClientDayCoupon = useCallback(() => {
        setClientDayCouponDismissed(true);
        localStorage.setItem('clientDayCouponDismissed', 'true');
    }, []);

    const restoreClientDayCoupon = useCallback(() => {
        setClientDayCouponDismissed(false);
        localStorage.removeItem('clientDayCouponDismissed');
    }, []);

    return (
        <CartContext.Provider value={{ 
            cart, 
            addToCart, 
            addWholesaleBundleToCart,
            removeFromCart, 
            updateQuantity, 
            clearCart,
            cartCount,
            cartTotal,
            wholesaleTotalRaw,
            isWholesaleUnlocked,
            isCartOpen,
            setIsCartOpen,
            openCart,
            closeCart,
            clientDayCoupon,
            clientDayCouponDismissed,
            dismissClientDayCoupon,
            restoreClientDayCoupon,
            isClientDay,
        }}>
            {children}
        </CartContext.Provider>
    );
};
