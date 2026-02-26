import Link from "next/link";
import styles from "./ProductCard.module.css";
import Image from "next/image";

interface ProductCardProps {
    product: {
        name: string;
        slug: string;
        description: string;
        price?: number;
        image_url?: string;
        tags: string[];
        buy_on_site: boolean;
        mercadolivre_url?: string;
        shopee_url?: string;
    };
}

export default function ProductCard({ product }: ProductCardProps) {
    const getImageUrl = (url?: string) => {
        if (!url) return "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        if (url.startsWith("attached_assets/")) return `/static/${url}`;
        return url;
    };

    const logClick = async (type: string) => {
        try {
            await fetch('/api/metrics/log/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: (product as any).id,
                    click_type: type
                })
            });
        } catch (err) {
            console.error("Error logging click", err);
        }
    };

    const handleBuyClick = (e: React.MouseEvent) => {
        e.preventDefault();
        logClick("site");
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = `/conta?redirect=/produtos/${product.slug}`;
            return;
        }

        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const existingItem = cart.find((i: any) => i.id === (product as any).id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: (product as any).id,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }

        localStorage.setItem("cart", JSON.stringify(cart));
        window.location.href = "/carrinho";
    };

    return (
        <div className={styles.card}>
            <Link href={`/produtos/${product.slug}`}>
                <div className={styles.imageWrapper}>
                    <Image
                        src={getImageUrl(product.image_url)}
                        alt={product.name}
                        fill
                        className={styles.image}
                        unoptimized={true}
                    />
                </div>
            </Link>

            <div className={styles.content}>
                <div className={styles.tags}>
                    {product.tags.map(tag => (
                        <span key={tag} className="scientific-badge">{tag}</span>
                    ))}
                </div>

                <Link href={`/produtos/${product.slug}`}>
                    <h3 className={styles.name}>{product.name}</h3>
                </Link>
                <p className={styles.description}>{product.description}</p>

                {product.price && (
                    <p className={styles.price}>R$ {product.price.toFixed(2).replace(".", ",")}</p>
                )}

                <div className={styles.actions}>
                    {product.buy_on_site && (
                        <button className="btn-primary" onClick={handleBuyClick}>COMPRAR</button>
                    )}
                    {product.mercadolivre_url && (
                        <a href={product.mercadolivre_url} target="_blank" className={styles.externalLink} onClick={() => logClick("mercadolivre")}>ML</a>
                    )}
                    {product.shopee_url && (
                        <a href={product.shopee_url} target="_blank" className={styles.shopeeLink} title="Comprar na Shopee" onClick={() => logClick("shopee")}>
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.349 7.153H17.43A5.433 5.433 0 0012 2.15a5.433 5.433 0 00-5.43 5.003h-1.92a2.153 2.153 0 00-2.15 2.155L2.5 19.308a2.153 2.153 0 002.15 2.155h14.7a2.153 2.153 0 002.15-2.155l-0.001-10a2.153 2.153 0 00-2.15-2.155zM12 4.15a3.433 3.433 0 013.43 3.003H8.57A3.433 3.433 0 0112 4.15zM15.42 15.655c-0.21 0.49-0.56 0.885-1.07 1.18s-1.13 0.44-1.87 0.44c-0.65 0-1.21-0.105-1.68-0.315s-0.845-0.515-1.135-0.915l1.01-0.9c0.2 0.28 0.44 0.49 0.72 0.63s0.59 0.21 0.93 0.21c0.39 0 0.69-0.085 0.89-0.255s0.3-0.38 0.3-0.63c0-0.23-0.08-0.415-0.24-0.55s-0.455-0.27-0.88-0.4c-0.67-0.205-1.165-0.435-1.485-0.69s-0.48-0.635-0.48-1.14c0-0.53 0.21-0.965 0.63-1.3s0.975-0.5 1.665-0.5c0.59 0 1.095 0.125 1.515 0.375s0.725 0.585 0.915 1.005l-0.94 0.8c-0.165-0.33-0.4-0.57-0.705-0.72s-0.65-0.225-1.035-0.225c-0.32 0-0.57 0.075-0.75 0.225s-0.27 0.355-0.27 0.615c0 0.2 0.075 0.365 0.225 0.5s0.41 0.245 0.78 0.335c0.665 0.19 1.155 0.4 1.47 0.63s0.56 0.54 0.735 0.935 0.265 0.84 0.265 1.335z" />
                            </svg>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
