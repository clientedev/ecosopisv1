import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diário ECOSOPIS – Novidades e Dicas",
  description:
    "Histórias, bastidores e novidades da nossa jornada com você. Dicas de cuidados naturais, lançamentos e atualizações da ECOSOPIS.",
  openGraph: {
    title: "Diário ECOSOPIS – Novidades e Dicas",
    description:
      "Histórias, bastidores e novidades da nossa jornada com você. Dicas de cuidados naturais, lançamentos e atualizações.",
    type: "website",
    siteName: "ECOSOPIS",
    locale: "pt_BR",
    images: [
      {
        url: "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
        width: 1200,
        height: 630,
        alt: "ECOSOPIS – Cosméticos Naturais e Veganos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Diário ECOSOPIS – Novidades e Dicas",
    description:
      "Histórias, bastidores e novidades da nossa jornada com você.",
    images: [
      "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
    ],
  },
};

export default function NovidadesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
