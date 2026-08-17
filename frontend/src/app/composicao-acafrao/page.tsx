import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
    title: "Composição – Sabonete de Açafrão e Dolomita",
    robots: { index: false, follow: false },
};

const COMPOSICAO_ITEMS = [
    { inci: "Sodium Palmate",                           pt: "Palmato de Sódio" },
    { inci: "Zea mays Starch",                          pt: "Amido de Milho" },
    { inci: "Sodium Stearate",                          pt: "Estearato de Sódio" },
    { inci: "Calcium Carbonate",                        pt: "Carbonato de Cálcio" },
    { inci: "Aqua",                                     pt: "Água" },
    { inci: "Sodium Palm Kernelate",                    pt: "Palmistato de Sódio" },
    { inci: "Curcuma longa Root Powder",                pt: "Pó da Raiz de Cúrcuma" },
    { inci: "Stryphnodendron adstringens Bark Extract", pt: "Extrato da Casca de Barbatimão" },
    { inci: "Parfum",                                   pt: "Perfume" },
    { inci: "Dolomite",                                 pt: "Dolomita" },
    { inci: "Glycerin",                                 pt: "Glicerol" },
    { inci: "Sodium Chloride",                          pt: "Cloreto de Sódio" },
    { inci: "Sodium Cocoyl Isethionate",                pt: "Cocoil Isetionato de Sódio" },
    { inci: "Sodium Hydroxide",                         pt: "Hidróxido de Sódio" },
    { inci: "Etidronic Acid",                           pt: "Ácido Etidrônico" },
    { inci: "Sodium Gluconate",                         pt: "Gluconato de Sódio" },
    { inci: "Tetrasodium EDTA",                         pt: "Edetato Tetrassódico" },
    { inci: "Linalool",                                 pt: "Linalol" },
    { inci: "Citronellol",                              pt: "Citronelol" },
    { inci: "Coumarin",                                 pt: "Cumarina" },
    { inci: "Hexyl Cinnamal",                           pt: "Hexil Cinamal" },
    { inci: "Amyl Cinnamal",                            pt: "Amil Cinamal" },
];

export default function ComposicaoAcafraoPage() {
    return (
        <div className={styles.page}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.thIndex}>#</th>
                        <th className={styles.thInci}>Nome INCI</th>
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
    );
}
