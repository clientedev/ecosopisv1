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
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (product: any) => void;
    addWholesaleBundleToCart: (items: any[]) => void;
    removeFromCart: (id: number) => void;
    updateQuantity: (id: number, delta: number) => void;
    clearCart: () => void;
    cartCount: number;
    cartTotal: number;
    wholesaleTotalRaw: number; // Sum of original prices before wholesale discount
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const { showToast } = useToast();
    const { token } = useAuth();

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to parse cart from localStorage", e);
            }
        }
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Sync with backend if logged in
        if (token && cart.length > 0) {
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
            syncCart();
        }
    }, [cart, token]);

    const addToCart = useCallback((product: any) => {
        setCart((prev) => {
            const existingItem = prev.find((item) => item.id === product.id && !item.isWholesale);
            if (existingItem) {
                showToast(`${product.name}: quantidade atualizada!`, 'success');
                return prev.map((item) =>
                    (item.id === product.id && !item.isWholesale) ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            showToast(`${product.name} adicionado ao carrinho!`, 'success');
            return [...prev, { ...product, quantity: 1, isWholesale: false }];
        });
    }, [showToast]);

    const addWholesaleBundleToCart = useCallback((items: any[]) => {
        setCart((prev) => {
            // Filter out any existing wholesale items to "replace" the bundle or just append?
            // User requested "add to cart", usually we append.
            const wholesaleItems = items.map(item => ({
                ...item,
                quantity: item.quantity || 1,
                isWholesale: true
            }));
            
            showToast(`Kit Atacado de ${items.length} itens adicionado!`, 'success');
            return [...prev, ...wholesaleItems];
        });
    }, [showToast]);

    const removeFromCart = useCallback((id: number) => {
        setCart((prev) => {
            // Find index of item to remove (first match)
            const index = prev.findIndex(item => item.id === id);
            if (index === -1) return prev;
            const newCart = [...prev];
            newCart.splice(index, 1);
            return newCart;
        });
    }, []);

    const updateQuantity = useCallback((id: number, delta: number) => {
        setCart((prev) =>
            prev.map((item, idx) => {
                // If it's wholesale, we might want to prevent quantity changes or handle them.
                // For now, allow simple quantity update.
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
    }, []);

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    // Calculate total: 30% discount for isWholesale items
    const cartTotal = cart.reduce((acc, item) => {
        const itemPrice = item.isWholesale ? item.price * 0.7 : item.price;
        return acc + (itemPrice * item.quantity);
    }, 0);

    const wholesaleTotalRaw = cart.reduce((acc, item) => {
        return acc + (item.price * item.quantity);
    }, 0);

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
            wholesaleTotalRaw
        }}>
            {children}
        </CartContext.Provider>
    );
};
