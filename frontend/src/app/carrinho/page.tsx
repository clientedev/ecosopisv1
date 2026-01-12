"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default function CarrinhoPage() {
    return (
        <main>
            <Header />
            <div className={`container ${styles.carrinhoContainer}`}>
                <h1 className={styles.title}>CARRINHO DE COMPRAS</h1>

                <div className={styles.emptyCart}>
                    <div className={styles.emptyIcon}>🛒</div>
                    <h2>Seu carrinho está vazio</h2>
                    <p>Adicione produtos incríveis da ECOSOPIS ao seu carrinho!</p>
                    <a href="/produtos" className="btn-primary">
                        VER PRODUTOS
                    </a>
                </div>
            </div>
            <Footer />
        </main>
    );
}
