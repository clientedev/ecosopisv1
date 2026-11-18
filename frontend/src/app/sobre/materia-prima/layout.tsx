import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Nossa Matéria-Prima: Ativos Naturais",
    description: "As matérias-primas naturais da ECOSOPIS: argilas, óleos vegetais, óleos essenciais 100% puros e extratos botânicos usados nos nossos cosméticos.",
    alternates: { canonical: "/sobre/materia-prima" },
    openGraph: { title: "Nossa Matéria-Prima: Ativos Naturais | ECOSOPIS", description: "As matérias-primas naturais da ECOSOPIS: argilas, óleos vegetais, óleos essenciais 100% puros e extratos botânicos usados nos nossos cosméticos.", url: "/sobre/materia-prima" },
};

export default function SobreMateriaPrimaLayout({ children }: { children: React.ReactNode }) {
    return children;
}
