import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/api/images/", "/static/"],
                disallow: [
                    "/admin",
                    "/api/",
                    "/carrinho",
                    "/conta",
                    "/perfil",
                    "/pagamento",
                    "/pedido/",
                    "/finalizar-compra/",
                    "/recuperar-senha",
                    "/redefinir-senha",
                    "/verify-email",
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
