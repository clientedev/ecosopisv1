"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import ProductCard from "@/components/ProductCard/ProductCard";
import styles from "./page.module.css";

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
                const res = await fetch(`${apiUrl}/products/`);
                const data = await res.json();
                setProducts(data);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    return (
        <main>
            <Header />
            <div className="container" style={{ padding: '50px 0' }}>
                <h1 className={styles.pageTitle}>NOSSOS PRODUTOS</h1>
                {loading ? (
                    <p style={{ textAlign: 'center' }}>Carregando produtos...</p>
                ) : (
                    <div className={styles.productGrid}>
                        {products.map((product: any) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </div>
            <Footer />
        </main>
    );
}
