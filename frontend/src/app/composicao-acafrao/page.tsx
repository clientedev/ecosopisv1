import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
    title: "Composição – Sabonete de Açafrão e Dolomita | ECOSOPIS",
    robots: { index: false, follow: false },
};

const COMPOSICAO_ITEMS = [
    { inci: "Sodium Palmate",                          pt: "Palmato de Sódio" },
    { inci: "Zea mays Starch",                         pt: "Amido de Milho" },
    { inci: "Sodium Stearate",                         pt: "Estearato de Sódio" },
    { inci: "Calcium Carbonate",                       pt: "Carbonato de Cálcio" },
    { inci: "Aqua",                                    pt: "Água" },
    { inci: "Sodium Palm Kernelate",                   pt: "Palmistato de Sódio" },
    { inci: "Curcuma longa Root Powder",               pt: "Pó da Raiz de Cúrcuma" },
    { inci: "Stryphnodendron adstringens Bark Extract",pt: "Extrato da Casca de Barbatimão" },
    { inci: "Parfum",                                  pt: "Perfume" },
    { inci: "Dolomite",                                pt: "Dolomita" },
    { inci: "Glycerin",                                pt: "Glicerol" },
    { inci: "Sodium Chloride",                         pt: "Cloreto de Sódio" },
    { inci: "Sodium Cocoyl Isethionate",               pt: "Cocoil Isetionato de Sódio" },
    { inci: "Sodium Hydroxide",                        pt: "Hidróxido de Sódio" },
    { inci: "Etidronic Acid",                          pt: "Ácido Etidrônico" },
    { inci: "Sodium Gluconate",                        pt: "Gluconato de Sódio" },
    { inci: "Tetrasodium EDTA",                        pt: "Edetato Tetrassódico" },
    { inci: "Linalool",                                pt: "Linalol" },
    { inci: "Citronellol",                             pt: "Citronelol" },
    { inci: "Coumarin",                                pt: "Cumarina" },
    { inci: "Hexyl Cinnamal",                          pt: "Hexil Cinamal" },
    { inci: "Amyl Cinnamal",                           pt: "Amil Cinamal" },
];

const DESTAQUES = [
    { emoji: "🌱", label: "Curcuma longa (Açafrão/Cúrcuma)", desc: "Ativo clareador e anti-inflamatório natural" },
    { emoji: "🌳", label: "Stryphnodendron adstringens (Barbatimão)", desc: "Extrato cicatrizante e adstringente da casca" },
    { emoji: "💎", label: "Dolomite (Dolomita)", desc: "Mineral esfoliante e renovador celular" },
    { emoji: "🌽", label: "Zea mays Starch (Amido de Milho)", desc: "Suavizante e agente de textura natural" },
    { emoji: "💧", label: "Glycerin (Glicerol)", desc: "Agente hidratante e umectante" },
];

export default function ComposicaoAcafraoPage() {
    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <span className={styles.headerBrand}>ECOSOPIS</span>
                    <div className={styles.headerMeta}>
                        <span className={styles.headerBadge}>🧪 Fórmula INCI Completa</span>
                        <span className={styles.headerTag}>Uso Interno</span>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                {/* Title block */}
                <div className={styles.titleBlock}>
                    <p className={styles.titleLabel}>FICHA TÉCNICA DE COMPOSIÇÃO</p>
                    <h1 className={styles.title}>Sabonete de Açafrão e Dolomita</h1>
                    <p className={styles.subtitle}>
                        Composição completa conforme Resolução RDC ANVISA. Ordem decrescente de concentração.
                    </p>
                </div>

                {/* Main composition table */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Composição (Ingredientes INCI)</h2>
                        <span className={styles.count}>{COMPOSICAO_ITEMS.length} ingredientes</span>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.thIndex}>#</th>
                                    <th className={styles.thInci}>Nome INCI (Internacional)</th>
                                    <th className={styles.thPt}>Nome em Português</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMPOSICAO_ITEMS.map((item, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        <td className={styles.tdIndex}>{idx + 1}</td>
                                        <td className={styles.tdInci}>{item.inci}</td>
                                        <td className={styles.tdPt}>{item.pt}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Destaques */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Ativos Principais em Destaque</h2>
                    </div>
                    <div className={styles.destaqueGrid}>
                        {DESTAQUES.map((d, idx) => (
                            <div key={idx} className={styles.destaqueCard}>
                                <span className={styles.destaqueEmoji}>{d.emoji}</span>
                                <div>
                                    <p className={styles.destaqueLabel}>{d.label}</p>
                                    <p className={styles.destaqueDesc}>{d.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Full INCI string */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>String INCI Completa (para rótulo)</h2>
                    </div>
                    <div className={styles.inciBlock}>
                        <p className={styles.inciString}>
                            {COMPOSICAO_ITEMS.map(i => i.inci).join(", ")}.
                        </p>
                    </div>
                </section>

                {/* Footer note */}
                <footer className={styles.footerNote}>
                    <p>📋 Página de uso interno — não indexada publicamente.</p>
                    <p>ECOSOPIS Cosméticos Naturais · {new Date().getFullYear()}</p>
                </footer>
            </main>
        </div>
    );
}
