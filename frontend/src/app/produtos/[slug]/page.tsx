import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";
import {
    absUrl,
    currentPrice,
    getApprovedReviews,
    getProduct,
    jsonLd,
    plainText,
    productImagePath,
    SITE_NAME,
    SITE_URL,
} from "@/lib/seo";

export const revalidate = 300;

type Props = { params: { slug: string } };

function productDescription(p: any): string {
    const base = plainText(p.description, 400) || plainText(p.benefits, 400);
    const ben = p.benefits && !base.includes(plainText(p.benefits, 60)) ? ` ${plainText(p.benefits, 200)}` : "";
    return plainText(`${base}${ben}`, 155) || `${p.name}: cosmético natural e vegano ECOSOPIS. Compre online com entrega para todo o Brasil.`;
}

function productImages(p: any): string[] {
    const list = [p.image_url, ...(Array.isArray(p.images) ? p.images : [])]
        .filter((u) => typeof u === "string" && u.trim())
        .map((u) => absUrl(productImagePath(u)));
    return Array.from(new Set(list)).slice(0, 8);
}

function normalizeReviews(list: any[]): any[] {
    return (list || []).map((rev) => {
        let imgs: any = rev.images;
        if (typeof imgs === "string") {
            try {
                const parsed = JSON.parse(imgs);
                imgs = Array.isArray(parsed) ? parsed : parsed ? [String(parsed)] : [];
            } catch {
                imgs = imgs.trim() ? [imgs.trim()] : [];
            }
        }
        return { ...rev, images: (Array.isArray(imgs) ? imgs : []).filter((i: any) => typeof i === "string" && i.trim()) };
    });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const p = await getProduct(params.slug);
    if (p === null) return { alternates: { canonical: `/produtos/${params.slug}` } }; // backend fora: mantém padrão
    if (!p) return { title: "Produto não encontrado", robots: { index: false, follow: true } };
    if (p.is_active === false) return { title: p.name, robots: { index: false, follow: true } };
    const description = productDescription(p);
    const images = productImages(p);
    const price = currentPrice(p);
    return {
        title: p.name,
        description,
        alternates: { canonical: `/produtos/${p.slug}` },
        openGraph: {
            type: "website",
            url: `${SITE_URL}/produtos/${p.slug}`,
            title: `${p.name} | ${SITE_NAME}`,
            description,
            images: images.map((url) => ({ url, alt: p.name })),
        },
        twitter: { card: "summary_large_image", title: `${p.name} | ${SITE_NAME}`, description, images: images.slice(0, 1) },
        other: price > 0
            ? { "product:price:amount": price.toFixed(2), "product:price:currency": "BRL", "product:availability": (p.stock ?? 1) > 0 ? "in stock" : "out of stock" }
            : {},
    };
}

export default async function ProdutoPage({ params }: Props) {
    const p = await getProduct(params.slug);
    if (p === null) return <ProductDetailClient />; // backend indisponível: página carrega no navegador
    if (!p) notFound();
    if (p.is_active === false) return <ProductDetailClient initialProduct={p} />;

    const reviews = normalizeReviews(await getApprovedReviews(p.id)).filter((r) => r.product_id === p.id);
    const url = absUrl(`/produtos/${p.slug}`);
    const price = currentPrice(p);
    const inStock = p.buy_on_site !== false && (p.stock == null || Number(p.stock) > 0);
    const validUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

    const product: any = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${url}#product`,
        name: p.name,
        description: plainText(p.description || p.benefits || p.name, 4900),
        image: productImages(p),
        sku: String(p.id),
        productID: String(p.id),
        url,
        brand: { "@type": "Brand", name: SITE_NAME },
        ...(p.category ? { category: p.category } : {}),
    };
    if (price > 0) {
        product.offers = {
            "@type": "Offer",
            url,
            priceCurrency: "BRL",
            price: price.toFixed(2),
            priceValidUntil: validUntil,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": `${SITE_URL}/#organization` },
            shippingDetails: {
                "@type": "OfferShippingDetails",
                shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
            },
        };
    }
    const rated = reviews.filter((r) => Number(r.rating) >= 1 && Number(r.rating) <= 5);
    if (rated.length > 0) {
        const avg = rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length;
        product.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: avg.toFixed(1),
            reviewCount: rated.length,
            bestRating: "5",
            worstRating: "1",
        };
        product.review = rated.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.user_name || "Cliente ECOSOPIS" },
            reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5", worstRating: "1" },
            ...(r.comment ? { reviewBody: plainText(r.comment, 500) } : {}),
            ...(r.created_at ? { datePublished: String(r.created_at).slice(0, 10) } : {}),
        }));
    }

    const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Produtos", item: absUrl("/produtos") },
            { "@type": "ListItem", position: 3, name: p.name, item: url },
        ],
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([product, breadcrumb]) }} />
            <ProductDetailClient initialProduct={p} initialReviews={reviews} />
        </>
    );
}
