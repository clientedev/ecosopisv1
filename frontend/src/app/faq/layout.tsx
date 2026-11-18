import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Perguntas Frequentes",
    description: "Tire suas dúvidas sobre os cosméticos naturais ECOSOPIS: uso dos produtos, ingredientes, pagamento, prazos de entrega e trocas.",
    alternates: { canonical: "/faq" },
    openGraph: { title: "Perguntas Frequentes | ECOSOPIS", description: "Tire suas dúvidas sobre os cosméticos naturais ECOSOPIS: uso dos produtos, ingredientes, pagamento, prazos de entrega e trocas.", url: "/faq" },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
    return children;
}
