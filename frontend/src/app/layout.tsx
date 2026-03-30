import type { Metadata } from "next";
import "@/styles/globals.css";
import { Raleway, Karla, Cinzel } from "next/font/google";
import ChatIA from "@/components/ChatIA/ChatIA";
import RouletteModal from "@/components/RouletteModal/RouletteModal";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/Toast/Toast";
import { CartProvider } from "@/context/CartContext";

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
                            {children}
                            <ChatIA />
                            <RouletteModal />
                        </CartProvider>
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
