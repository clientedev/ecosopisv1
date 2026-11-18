import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Atacado de Cosméticos Naturais e Sabonetes Artesanais",
    description: "Compre cosméticos naturais e sabonetes artesanais ECOSOPIS no atacado para revenda, lojas e empresas. Preços especiais e catálogo completo.",
    alternates: { canonical: "/atacado" },
    openGraph: { title: "Atacado de Cosméticos Naturais e Sabonetes Artesanais | ECOSOPIS", description: "Compre cosméticos naturais e sabonetes artesanais ECOSOPIS no atacado para revenda, lojas e empresas. Preços especiais e catálogo completo.", url: "/atacado" },
};

export default function AtacadoLayout({ children }: { children: React.ReactNode }) {
    return children;
}
