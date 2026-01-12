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
    return (
        <div className={styles.card}>
            <Link href={`/produtos/${product.slug}`}>
                <div className={styles.imageWrapper}>
                    <Image
                        src={product.image_url || "/placeholder-product.jpg"}
                        alt={product.name}
                        fill
                        className={styles.image}
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
                        <button className="btn-primary">COMPRAR</button>
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
