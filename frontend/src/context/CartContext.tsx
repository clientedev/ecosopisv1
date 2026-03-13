"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from '@/components/Toast/Toast';

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (product: any) => void;
    removeFromCart: (id: number) => void;
    updateQuantity: (id: number, delta: number) => void;
    clearCart: () => void;
    cartCount: number;
    cartTotal: number;
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
    }, [cart]);

    const addToCart = useCallback((product: any) => {
        setCart((prev) => {
            const existingItem = prev.find((item) => item.id === product.id);
            if (existingItem) {
                showToast(`${product.name}: quantidade atualizada!`, 'success');
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            showToast(`${product.name} adicionado ao carrinho!`, 'success');
            return [...prev, { ...product, quantity: 1 }];
        });
    }, [showToast]);

    const removeFromCart = useCallback((id: number) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
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
    }, []);

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{ 
            cart, 
            addToCart, 
            removeFromCart, 
            updateQuantity, 
            clearCart,
            cartCount,
            cartTotal
        }}>
            {children}
        </CartContext.Provider>
    );
};
