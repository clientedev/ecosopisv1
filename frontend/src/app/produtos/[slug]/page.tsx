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

    useEffect(() => {
        // Mock product data - will connect to API later
        setProduct({
            name: "Sérum Facial Antioxidante",
            slug: params.slug,
            description: "Sérum leve e potente com vitamina C e ativos naturais para uma pele radiante e protegida.",
            ingredients: "Extrato de semente de uva, Vitamina C estabilizada, Ácido Hialurônico vegetal, Niacinamida.",
            benefits: "Antioxidação profunda, hidratação intensa, uniformização do tom da pele, proteção contra radicais livres.",
            price: 89.90,
            image_url: "https://acdn-us.mitiendanube.com/stores/003/178/794/products/serum-placeholder.webp",
            tags: ["antioxidante", "vitamina-c", "todos-os-tipos"],
            buy_on_site: true,
            mercadolivre_url: "https://mercadolivre.com.br",
            shopee_url: "https://shopee.com.br"
        });
    }, [params.slug]);

    if (!product) return <div>Carregando...</div>;

    return (
        <main>
            <Header />
            <div className={`container ${styles.productContainer}`}>
                <div className={styles.productLayout}>
                    <div className={styles.imageSection}>
                        <Image
                            src={product.image_url}
                            alt={product.name}
                            width={500}
                            height={500}
                            className={styles.productImage}
                        />
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
