import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Envio e Entrega para Todo o Brasil",
    description: "Saiba como funciona o envio da ECOSOPIS: opções de frete, prazos de entrega para todo o Brasil e acompanhamento do pedido.",
    alternates: { canonical: "/envio" },
    openGraph: { title: "Envio e Entrega para Todo o Brasil | ECOSOPIS", description: "Saiba como funciona o envio da ECOSOPIS: opções de frete, prazos de entrega para todo o Brasil e acompanhamento do pedido.", url: "/envio" },
};

export default function EnvioLayout({ children }: { children: React.ReactNode }) {
    return children;
}
