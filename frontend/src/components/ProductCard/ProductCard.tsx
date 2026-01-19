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
    const getImageUrl = (url: string) => {
        if (!url) return "/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
        if (url.startsWith("http")) return url;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : '');
        return `${apiUrl}${url}`;
    };

    const handleBuyClick = (e: React.MouseEvent) => {
        e.preventDefault();
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
                        <a href={product.mercadolivre_url} target="_blank" className={styles.externalLink}>ML</a>
                    )}
                    {product.shopee_url && (
                        <a href={product.shopee_url} target="_blank" className={styles.externalLink}>SH</a>
                    )}
                </div>
            </div>
        </div>
    );
}
