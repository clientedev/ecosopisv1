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
                                        <path d="M19 7h-2c0-2.76-2.24-5-5-5S7 4.24 7 7H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 15H5V9h2v2h2V9h6v2h2V9h2v10z" fill="white"/>
                                        <path d="M11.64 12.56c-.53-.18-.94-.32-1.25-.44-.31-.11-.53-.2-.67-.28-.14-.08-.25-.17-.32-.27-.07-.1-.11-.22-.11-.36 0-.17.06-.32.17-.45s.28-.23.51-.31c.22-.07.51-.11.85-.11.38 0 .68.05.9.15.22.1.37.23.47.4l.76-.66c-.19-.3-.49-.52-.89-.66-.41-.14-.9-.21-1.46-.21-.49 0-.91.06-1.26.18s-.64.3-.85.52c-.22.23-.33.51-.33.85 0 .28.06.51.19.69s.3.33.53.46c.23.13.52.25.87.36.43.14.79.27 1.08.38.29.11.51.21.65.29.14.08.24.18.3.29.06.11.09.24.09.39 0 .22-.08.41-.24.57-.16.16-.42.24-.76.24-.48 0-.85-.12-1.1-.37-.25-.25-.4-.6-.44-1.04l-.94.09c.07.61.3 1.07.69 1.39s.95.48 1.67.48c.55 0 .99-.07 1.34-.2s.63-.32.84-.56c.21-.24.31-.54.31-.91 0-.32-.07-.58-.2-.79s-.35-.38-.63-.51z" fill="white"/>
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
