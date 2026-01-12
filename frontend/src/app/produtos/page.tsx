"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";

export default function ProductsPage() {
    const [products, setProducts] = useState([]);

    useEffect(() => {
        // Mock data for now - will connect to API later
        setProducts([
            {
                id: 1,
                name: "Sérum Facial Antioxidante",
                slug: "serum-facial-antioxidante",
                description: "Sérum leve e potente com vitamina C e ativos naturais.",
                price: 89.90,
                image_url: "https://acdn-us.mitiendanube.com/stores/003/178/794/products/serum-1-placeholder.webp",
                tags: ["antioxidante", "vitamina-c"],
                buy_on_site: true,
                mercadolivre_url: "https://mercadolivre.com.br",
                shopee_url: "https://shopee.com.br"
            },
            {
                id: 2,
                name: "Creme Hidratante Revitalizante",
                slug: "creme-hidratante-revitalizante",
                description: "Hidratação intensa com textura não oleosa.",
                price: 65.00,
                image_url: "https://acdn-us.mitiendanube.com/stores/003/178/794/products/creme-placeholder.webp",
                tags: ["hidratante", "pele-seca"],
                buy_on_site: true,
                mercadolivre_url: "https://mercadolivre.com.br",
                shopee_url: undefined
            }
        ]);
    }, []);

    return (
        <main>
            <Header />
            <div className="container" style={{ padding: '50px 0' }}>
                <h1 className={styles.pageTitle}>NOSSOS PRODUTOS</h1>
                <div className={styles.productGrid}>
                    {products.map((product: any) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </div>
            <Footer />
        </main>
    );
}
