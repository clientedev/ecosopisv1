import type { MetadataRoute } from "next";
import { absUrl, getNews, getProducts, productImagePath } from "@/lib/seo";

export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/produtos", priority: 0.9, changeFrequency: "daily" },
    { path: "/sobre", priority: 0.6, changeFrequency: "monthly" },
    { path: "/sobre/materia-prima", priority: 0.5, changeFrequency: "monthly" },
    { path: "/novidades", priority: 0.6, changeFrequency: "weekly" },
    { path: "/experiencias", priority: 0.5, changeFrequency: "weekly" },
    { path: "/quizz", priority: 0.5, changeFrequency: "monthly" },
    { path: "/lia", priority: 0.4, changeFrequency: "monthly" },
    { path: "/atacado", priority: 0.5, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
    { path: "/envio", priority: 0.4, changeFrequency: "monthly" },
    { path: "/contato", priority: 0.4, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const [products, news] = await Promise.all([getProducts(), getNews()]);

    const pages: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
        url: absUrl(p.path),
        lastModified: now,
        changeFrequency: p.changeFrequency,
        priority: p.priority,
    }));

    const productPages: MetadataRoute.Sitemap = products
        .filter((p) => p?.slug && p.is_active !== false)
        .map((p) => ({
            url: absUrl(`/produtos/${p.slug}`),
            lastModified: p.updated_at ? new Date(p.updated_at) : now,
            changeFrequency: "weekly" as const,
            priority: 0.8,
            images: [p.image_url, ...(Array.isArray(p.images) ? p.images : [])]
                .filter((u: any) => typeof u === "string" && u.trim())
                .slice(0, 5)
                .map((u: string) => absUrl(productImagePath(u))),
        }));

    const newsPages: MetadataRoute.Sitemap = news
        .filter((n) => n?.id)
        .map((n) => ({
            url: absUrl(`/novidades/${n.id}`),
            lastModified: n.created_at ? new Date(n.created_at) : now,
            changeFrequency: "monthly" as const,
            priority: 0.4,
        }));

    return [...pages, ...productPages, ...newsPages];
}
