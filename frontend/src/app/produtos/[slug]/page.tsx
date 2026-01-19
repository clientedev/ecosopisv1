"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Image from "next/image";

export default function ProductDetailPage() {
    const params = useParams();
    const [product, setProduct] = useState<any>(null);

    const [activeImage, setActiveImage] = useState("");

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/products/${params.slug}`);
                if (res.ok) {
                    const data = await res.json();
                    setProduct(data);
                    setActiveImage(data.image_url || (data.images && data.images[0]) || "");
                }
            } catch (error) {
                console.error("Error fetching product:", error);
            }
        };
        fetchProduct();
    }, [params.slug]);

    if (!product) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'var(--font-karla)' }}>
            <p>Carregando produto...</p>
        </div>
    );

    const allImages = product.images && product.images.length > 0 ? product.images : [product.image_url];

    const getImageUrl = (url: string) => {
        if (!url) return "/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
        if (url.startsWith("http")) return url;
        return url; // Rewrites will handle the /static prefix
    };

    return (
        <main>
            <Header />
            <div className={`container ${styles.productContainer}`}>
                <div className={styles.productLayout}>
                    <div className={styles.imageSection}>
                        <div className={styles.mainImageContainer}>
                            { (activeImage || product.image_url) && (
                                <div className={styles.imageWrapper}>
                                    <Image
                                        src={getImageUrl(activeImage || product.image_url)}
                                        alt={product.name}
                                        fill
                                        className={styles.productImage}
                                        unoptimized={true}
                                    />
                                </div>
                            )}
                        </div>
                        {allImages.length > 1 && (
                            <div className={styles.thumbnailGrid}>
                                {allImages.map((img: string, idx: number) => (
                                    <div 
                                        key={idx} 
                                        className={`${styles.thumbnailItem} ${activeImage === img ? styles.activeThumbnail : ''}`}
                                        onClick={() => setActiveImage(img)}
                                    >
                                        <Image 
                                            src={getImageUrl(img)} 
                                            alt={`Thumb ${idx}`} 
                                            width={80} 
                                            height={80} 
                                            unoptimized={true}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={styles.infoSection}>
                        <div className={styles.tags}>
                            {product.tags.map((tag: string) => (
                                <span key={tag} className="scientific-badge">{tag}</span>
                            ))}
                        </div>

                        <h1 className={styles.productName}>{product.name}</h1>
                        <p className={styles.description}>{product.description}</p>

                        {product.price && (
                            <p className={styles.price}>R$ {product.price.toFixed(2).replace(".", ",")}</p>
                        )}

                        <div className={styles.buyActions}>
                            {product.buy_on_site && (
                                <button className="btn-primary" style={{ flex: 1 }}>ADICIONAR AO CARRINHO</button>
                            )}
                            {product.mercadolivre_url && (
                                <a href={product.mercadolivre_url} target="_blank" className="btn-outline">
                                    COMPRAR NO ML
                                </a>
                            )}
                            {product.shopee_url && (
                                <a href={product.shopee_url} target="_blank" className="btn-outline">
                                    COMPRAR NA SHOPEE
                                </a>
                            )}
                        </div>

                        <div className={styles.detailSection}>
                            <h3>INGREDIENTES</h3>
                            <p>{product.ingredients}</p>
                        </div>

                        <div className={styles.detailSection}>
                            <h3>BENEFÍCIOS</h3>
                            <p>{product.benefits}</p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
