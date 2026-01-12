import type { Metadata } from "next";
import "@/styles/globals.css";
import { Raleway, Karla } from "next/font/google";
import ChatIA from "@/components/ChatIA/ChatIA";

const raleway = Raleway({
    subsets: ["latin"],
    variable: "--font-header",
});

const karla = Karla({
    subsets: ["latin"],
    variable: "--font-body",
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
            <body className={`${raleway.variable} ${karla.variable}`}>
                {children}
                <ChatIA />
            </body>
        </html>
    );
}
