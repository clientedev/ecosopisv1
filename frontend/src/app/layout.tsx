import type { Metadata } from "next";
import "@/styles/globals.css";
import { Raleway, Karla, Cinzel } from "next/font/google";
import DeferredComponents from "@/components/DeferredComponents/DeferredComponents";
import DynamicBranding from "@/components/DynamicBranding/DynamicBranding";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/Toast/Toast";
import { CartProvider } from "@/context/CartContext";
import MobileBottomNav from "@/components/MobileBottomNav/MobileBottomNav";
import { ThemeProvider } from "@/context/ThemeContext";
import HeartAnimation from "@/components/HeartAnimation/HeartAnimation";
import WorldCupAnimation from "@/components/WorldCupAnimation/WorldCupAnimation";
import AnniversaryAnimation from "@/components/AnniversaryAnimation/AnniversaryAnimation";

const raleway = Raleway({
    subsets: ["latin"],
    variable: "--font-header",
    display: "swap",
});

const karla = Karla({
    subsets: ["latin"],
    variable: "--font-body",
    display: "swap",
});

const cinzel = Cinzel({
    subsets: ["latin"],
    variable: "--font-logo",
    weight: ["600", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "ECOSOPIS | Cosméticos Naturais e Veganos",
    description: "Descubra o poder da natureza com ciência. Cosméticos naturais, veganos e de alta performance.",
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

import CartDrawer from "@/components/CartDrawer/CartDrawer";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR">
            <body className={`${raleway.variable} ${karla.variable} ${cinzel.variable}`} suppressHydrationWarning={true}>
                <AuthProvider>
                    <ToastProvider>
                        <CartProvider>
                            <ThemeProvider>
                                <DynamicBranding />
                                <HeartAnimation />
                                <WorldCupAnimation />
                                <AnniversaryAnimation />
                                {children}
                                <CartDrawer />
                                <DeferredComponents />
                                <MobileBottomNav />
                            </ThemeProvider>
                        </CartProvider>
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
