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
import MetaPixel from "@/components/MetaPixel/MetaPixel";
import { SITE_URL, SITE_NAME, SITE_ALTERNATE_NAMES, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, INSTAGRAM_URL, jsonLd } from "@/lib/seo";

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
    metadataBase: new URL(SITE_URL),
    title: { default: DEFAULT_TITLE, template: "%s | Ecosopis" },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
        "cosméticos naturais", "cosméticos veganos", "sabonete natural", "sabonete artesanal",
        "óleo essencial", "óleos essenciais 100% puros", "óleo vegetal", "manteiga de ojon",
        "tônico capilar antiqueda", "skincare natural", "Ecosopis",
    ],
    openGraph: {
        type: "website",
        locale: "pt_BR",
        url: SITE_URL,
        siteName: SITE_NAME,
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        images: [{ url: DEFAULT_OG_IMAGE, alt: "ECOSOPIS - Cosméticos Naturais" }],
    },
    twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: [DEFAULT_OG_IMAGE] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
    category: "beauty",
};

const ORG_JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            alternateName: SITE_ALTERNATE_NAMES,
            description: DEFAULT_DESCRIPTION,
            url: SITE_URL,
            logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png`, width: 512, height: 512 },
            image: `${SITE_URL}/logo_final.png`,
            email: "contato@ecosopis.com.br",
            sameAs: [INSTAGRAM_URL],
            contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", email: "contato@ecosopis.com.br", areaServed: "BR", availableLanguage: "Portuguese" }],
        },
        {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: SITE_URL,
            name: SITE_NAME,
            alternateName: SITE_ALTERNATE_NAMES,
            description: DEFAULT_DESCRIPTION,
            inLanguage: "pt-BR",
            publisher: { "@id": `${SITE_URL}/#organization` },
            potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/produtos?busca={search_term_string}` },
                "query-input": "required name=search_term_string",
            },
        },
    ],
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
                <link rel="preconnect" href="https://connect.facebook.net" />
                <meta name="facebook-domain-verification" content="0k30xcqp2xgy2uoa4c33xri66t49cv" />
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ORG_JSON_LD) }} />
                {/* Runs before first paint: apply the last known seasonal theme so the
                    entry splash already shows in the right colors. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `try{var d=document.documentElement;var t=localStorage.getItem("ecosopis_active_theme");if(t&&t!=="default")d.setAttribute("data-theme",t);}catch(e){}`,
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
                                        {/* Suspense próprio: useSearchParams aqui não pode derrubar o SSR do site inteiro */}
                                        <Suspense fallback={null}>
                                            <MetaPixel />
                                        </Suspense>
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
