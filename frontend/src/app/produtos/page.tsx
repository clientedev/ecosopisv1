import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";
import { absUrl, getProducts, jsonLd, SITE_URL } from "@/lib/seo";

export const revalidate = 600;

const TITLE = "Produtos Naturais e Veganos: Sabonetes, Óleos Essenciais e Cremes";
const DESCRIPTION =
    "Loja ECOSOPIS: sabonetes naturais artesanais, óleos essenciais 100% puros, óleos vegetais, manteigas, cremes e tônico capilar antiqueda. Cosméticos veganos com entrega para todo o Brasil.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/produtos" },
    openGraph: { title: `${TITLE} | ECOSOPIS`, description: DESCRIPTION, url: `${SITE_URL}/produtos`, type: "website" },
};

export default async function ProdutosPage() {
    const products = (await getProducts()).filter((p) => p && p.is_active !== false && p.slug);

    const itemList = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Produtos ECOSOPIS",
        itemListElement: products.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absUrl(`/produtos/${p.slug}`),
            name: p.name,
        })),
    };
    const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Produtos", item: absUrl("/produtos") },
        ],
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([itemList, breadcrumb]) }} />
            <ProductsClient initialProducts={products} />
        </>
    );
}
