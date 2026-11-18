import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sobre Nós: Cosméticos Naturais e Artesanais",
    description: "Conheça a ECOSOPIS: cosméticos naturais, veganos e artesanais feitos com matérias-primas selecionadas, ciência e respeito à natureza.",
    alternates: { canonical: "/sobre" },
    openGraph: { title: "Sobre a ECOSOPIS: Cosméticos Naturais e Artesanais | ECOSOPIS", description: "Conheça a ECOSOPIS: cosméticos naturais, veganos e artesanais feitos com matérias-primas selecionadas, ciência e respeito à natureza.", url: "/sobre" },
};

export default function SobreLayout({ children }: { children: React.ReactNode }) {
    return children;
}
