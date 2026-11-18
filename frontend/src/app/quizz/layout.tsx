import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Quiz de Pele: Descubra sua Rotina Natural",
    description: "Responda o quiz de pele da ECOSOPIS e descubra os cosméticos naturais ideais para o seu tipo de pele e a sua rotina de autocuidado.",
    alternates: { canonical: "/quizz" },
    openGraph: { title: "Quiz de Pele: Descubra sua Rotina Natural | ECOSOPIS", description: "Responda o quiz de pele da ECOSOPIS e descubra os cosméticos naturais ideais para o seu tipo de pele e a sua rotina de autocuidado.", url: "/quizz" },
};

export default function QuizzLayout({ children }: { children: React.ReactNode }) {
    return children;
}
