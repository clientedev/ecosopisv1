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
                                    <svg viewBox="0 0 24 24" className={styles.shopeeLogo}>
                                        <path d="M19.103 8.35c.18 0 .343.102.423.264l1.625 3.25c.08.162.062.355-.046.498L12.5 21.82 3.895 12.362a.625.625 0 0 1-.046-.498l1.625-3.25a.473.473 0 0 1 .423-.264h13.206zm.897-1.25H4a1.75 1.75 0 0 0-1.564.975l-1.625 3.25A1.75 1.75 0 0 0 .973 13.5l10.22 11.15a1.75 1.75 0 0 0 2.614 0l10.22-11.15a1.75 1.75 0 0 0 .162-2.175l-1.625-3.25A1.75 1.75 0 0 0 21 7.1zm-9-5.85a4.755 4.755 0 0 0-4.75 4.75v1.1h1.5v-1.1a3.25 3.25 0 0 1 6.5 0v1.1h1.5v-1.1a4.755 4.755 0 0 0-4.75-4.75z"/>
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
