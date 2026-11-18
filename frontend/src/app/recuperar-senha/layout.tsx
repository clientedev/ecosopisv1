import type { Metadata } from "next";

// Página privada/transacional: fora dos resultados de busca.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function RecuperarSenhaLayout({ children }: { children: React.ReactNode }) {
    return children;
}
