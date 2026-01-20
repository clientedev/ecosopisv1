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

    const handleAddToCart = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = `/conta?redirect=/produtos/${params.slug}`;
            return;
        }
        
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const existingItem = cart.find((i: any) => i.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }
        
        localStorage.setItem("cart", JSON.stringify(cart));
        window.location.href = "/carrinho";
    };

    const handleBuyNow = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = `/conta?redirect=/produtos/${params.slug}`;
            return;
        }
        
        const cart = [{
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        }];
        
        localStorage.setItem("cart", JSON.stringify(cart));
        window.location.href = "/carrinho";
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
                                <>
                                    <button className="btn-primary" style={{ flex: 1 }} onClick={handleBuyNow}>COMPRAR AGORA</button>
                                    <button className="btn-outline" style={{ flex: 1 }} onClick={handleAddToCart}>ADICIONAR AO CARRINHO</button>
                                </>
                            )}
                            {product.mercadolivre_url && (
                                <a href={product.mercadolivre_url} target="_blank" className="btn-outline">
                                    COMPRAR NO ML
                                </a>
                            )}
                            {product.shopee_url && (
                                <a href={product.shopee_url} target="_blank" className={styles.shopeeBtn}>
                                    <svg viewBox="0 0 100 100" className={styles.shopeeLogo}>
                                        <path d="M78.6 27.6c-4.4-4.4-9.9-7-15.6-7.6-5.7-.6-11.4.6-16.1 3.5l-6.2 3.8-6.2-3.8c-4.7-2.9-10.4-4.1-16.1-3.5-5.7.6-11.2 3.3-15.6 7.6C18.4 32 15.8 37.6 15.1 43.3c-.6 5.7.6 11.4 3.5 16.1l30.7 50.6 30.7-50.6c2.9-4.7 4.1-10.4 3.5-16.1-.7-5.7-3.4-11.3-7.9-15.7z" fill="white"/>
                                        <path d="M50 8c-6.1 0-11 4.9-11 11v4h4v-4c0-3.9 3.1-7 7-7s7 3.1 7 7v4h4v-4c0-6.1-4.9-11-11-11z" fill="white"/>
                                        <path d="M46.7 48.7c-2.1-1.1-3.3-2.3-3.3-4.2 0-2.3 2.1-3.9 5.2-3.9 2.5 0 4.6.9 6.2 2.6l2.3-2.6c-2.1-2.1-5-3.3-8.5-3.3-5.2 0-9.2 3-9.2 7.7 0 4.1 2.3 6.6 6.3 8.5 2.5 1.2 3.6 2.3 3.6 4.3 0 2.4-2.2 4.1-5.6 4.1-3.2 0-5.6-1.3-7.7-3.8l-2.4 2.8c2.6 3.1 6.2 4.7 10.1 4.7 5.6 0 9.7-3.1 9.7-8.1.1-4.5-2.2-7.2-6.7-8.9z" fill="#ee4d2d"/>
                                    </svg>
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
