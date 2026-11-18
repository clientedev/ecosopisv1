import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contato",
    description: "Fale com a ECOSOPIS: dúvidas sobre produtos, pedidos e parcerias. Atendimento de segunda a sexta, das 9h às 18h, pelo e-mail contato@ecosopis.com.br.",
    alternates: { canonical: "/contato" },
    openGraph: { title: "Contato | ECOSOPIS", description: "Fale com a ECOSOPIS: dúvidas sobre produtos, pedidos e parcerias. Atendimento de segunda a sexta, das 9h às 18h, pelo e-mail contato@ecosopis.com.br.", url: "/contato" },
};

export default function ContatoLayout({ children }: { children: React.ReactNode }) {
    return children;
}
