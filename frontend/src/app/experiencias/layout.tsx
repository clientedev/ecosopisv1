import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Experiências | ECOSOPIS",
    description:
        "Oficinas de cosméticos naturais no local do seu evento e kits personalizados para empresas e eventos. Solicite o seu orçamento com a Ecosopis.",
};

export default function ExperienciasLayout({ children }: { children: React.ReactNode }) {
    return children;
}
