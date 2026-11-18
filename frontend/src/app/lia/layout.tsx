import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Lia: Assistente de Cuidados Naturais",
    description: "Converse com a Lia, assistente virtual da ECOSOPIS, e receba recomendações de cosméticos naturais para a sua pele e cabelo.",
    alternates: { canonical: "/lia" },
    openGraph: { title: "Lia: Assistente de Cuidados Naturais | ECOSOPIS", description: "Converse com a Lia, assistente virtual da ECOSOPIS, e receba recomendações de cosméticos naturais para a sua pele e cabelo.", url: "/lia" },
};

export default function LiaLayout({ children }: { children: React.ReactNode }) {
    return children;
}
