import type { Metadata } from "next";
import "@/styles/globals.css";
import { Raleway, Karla, Cinzel } from "next/font/google";
import dynamic from "next/dynamic";

const ChatIA = dynamic(() => import("@/components/ChatIA/ChatIA"), { ssr: false });
const RouletteModal = dynamic(() => import("@/components/RouletteModal/RouletteModal"), { ssr: false });
import DynamicBranding from "@/components/DynamicBranding/DynamicBranding";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/Toast/Toast";
import { CartProvider } from "@/context/CartContext";
import MobileBottomNav from "@/components/MobileBottomNav/MobileBottomNav";

const raleway = Raleway({
    subsets: ["latin"],
    variable: "--font-header",
});

const karla = Karla({
    subsets: ["latin"],
    variable: "--font-body",
});

const cinzel = Cinzel({
    subsets: ["latin"],
    variable: "--font-logo",
    weight: ["400", "500", "600", "700", "800", "900"],
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
                            <DynamicBranding />
                            {children}
                            <ChatIA />
                            <RouletteModal />
                            <MobileBottomNav />
                        </CartProvider>
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
