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
import OutubroRosaAnimation from "@/components/OutubroRosaAnimation/OutubroRosaAnimation";
import BlackFridayAnimation from "@/components/BlackFridayAnimation/BlackFridayAnimation";

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
    viewportFit: "cover" as const,
};

import CartDrawer from "@/components/CartDrawer/CartDrawer";
import WhatsAppPromptModal from "@/components/WhatsAppPromptModal/WhatsAppPromptModal";
import { LoadingProvider } from "@/context/LoadingContext";
import BrandLoader from "@/components/BrandLoader/BrandLoader";
import { Suspense } from "react";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <head>
                {/* Runs before first paint: skip the entry splash after the first page of the session,
                    and apply the last known seasonal theme so the splash shows in the right colors. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `try{var d=document.documentElement;if(sessionStorage.getItem("ecosopis_splash_seen")==="1")d.setAttribute("data-splash-seen","");var t=localStorage.getItem("ecosopis_active_theme");if(t&&t!=="default")d.setAttribute("data-theme",t);}catch(e){}`,
                    }}
                />
            </head>
            <body className={`${raleway.variable} ${karla.variable} ${cinzel.variable}`} suppressHydrationWarning={true}>
                <AuthProvider>
                    <ToastProvider>
                        <CartProvider>
                            <ThemeProvider>
                                <Suspense fallback={<BrandLoader />}>
                                    <LoadingProvider>
                                        <DynamicBranding />
                                        <HeartAnimation />
                                        <WorldCupAnimation />
                                        <AnniversaryAnimation />
                                        <OutubroRosaAnimation />
                                        <BlackFridayAnimation />
                                        {children}
                                        <CartDrawer />
                                        <WhatsAppPromptModal />
                                        <DeferredComponents />
                                        <MobileBottomNav />
                                    </LoadingProvider>
                                </Suspense>
                            </ThemeProvider>
                        </CartProvider>
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
