import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Personalize seu Produto | ECOSOPIS",
    description: "Visualize os produtos Ecosopis com a sua própria identidade visual antes de solicitar a produção.",
    robots: { index: false, follow: false },
};

export default function PersonalizeLayout({ children }: { children: React.ReactNode }) {
    return children;
}
