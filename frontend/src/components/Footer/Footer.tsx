import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.footerContent}`}>
                <div className={styles.column}>
                    <h3>ECOSOPIS</h3>
                    <p>Cosméticos naturais, veganos e conscientes.</p>
                </div>
                <div className={styles.column}>
                    <h4>LINKS</h4>
                    <Link href="/produtos">Produtos</Link>
                    <Link href="/sobre">Sobre Nós</Link>
                    <Link href="/quizz">Quizz de Pele</Link>
                    <Link href="/box">Box Surpresa</Link>
                </div>
                <div className={styles.column}>
                    <h4>AJUDA</h4>
                    <Link href="/faq">FAQ</Link>
                    <Link href="/contato">Contato</Link>
                    <Link href="/envio">Envio & Entrega</Link>
                </div>
                <div className={styles.column}>
                    <h4>NEWSLETTER</h4>
                    <p>Receba dicas de beleza natural.</p>
                    <div className={styles.newsletter}>
                        <input type="email" placeholder="Seu e-mail" />
                        <button className="btn-primary">OK</button>
                    </div>
                </div>
            </div>
            <div className={styles.bottom}>
                <p>&copy; 2026 ECOSOPIS. Todos os direitos reservados. Feito com amor e ciência.</p>
            </div>
        </footer>
    );
}
