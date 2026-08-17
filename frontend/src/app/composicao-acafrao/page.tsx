import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
    title: "Composição – Sabonete de Açafrão e Dolomita | ECOSOPIS",
    description: "Lista de ingredientes conforme RDC nº 752/2022 e RDC nº 907/2024 (ANVISA).",
    robots: { index: false, follow: false },
};

// ──────────────────────────────────────────────────────────────────────────
// Ingredientes em ordem decrescente de concentração (conforme ANVISA).
// Ingredientes com concentração <1% podem aparecer em qualquer ordem no final.
// ──────────────────────────────────────────────────────────────────────────
const INGREDIENTES = [
    // ── Concentração ≥ 1% (ordem decrescente) ──────────────────────────
    {
        inci: "Sodium Palmate",
        pt: "Palmato de Sódio",
        funcao: "Base saponificada / Tensoativo",
        abaixo1: false,
    },
    {
        inci: "Zea mays Starch",
        pt: "Amido de Milho",
        funcao: "Agente de textura / Suavizante",
        abaixo1: false,
    },
    {
        inci: "Sodium Stearate",
        pt: "Estearato de Sódio",
        funcao: "Tensoativo / Emulsificante",
        abaixo1: false,
    },
    {
        inci: "Calcium Carbonate",
        pt: "Carbonato de Cálcio",
        funcao: "Agente abrasivo / Carga mineral",
        abaixo1: false,
    },
    {
        inci: "Aqua",
        pt: "Água",
        funcao: "Solvente / Veículo",
        abaixo1: false,
    },
    {
        inci: "Sodium Palm Kernelate",
        pt: "Palmistato de Sódio",
        funcao: "Base saponificada / Tensoativo",
        abaixo1: false,
    },
    {
        inci: "Curcuma longa Root Powder",
        pt: "Pó da Raiz de Cúrcuma",
        funcao: "Ativo botânico / Clareador natural",
        abaixo1: false,
    },
    {
        inci: "Stryphnodendron adstringens Bark Extract",
        pt: "Extrato da Casca de Barbatimão",
        funcao: "Ativo botânico / Adstringente e cicatrizante",
        abaixo1: false,
    },
    {
        inci: "Dolomite",
        pt: "Dolomita",
        funcao: "Mineral esfoliante / Renovador celular",
        abaixo1: false,
    },
    {
        inci: "Glycerin",
        pt: "Glicerol",
        funcao: "Umectante / Hidratante",
        abaixo1: false,
    },
    {
        inci: "Sodium Chloride",
        pt: "Cloreto de Sódio",
        funcao: "Agente de consistência / Regulador de viscosidade",
        abaixo1: false,
    },
    {
        inci: "Sodium Cocoyl Isethionate",
        pt: "Cocoil Isetionato de Sódio",
        funcao: "Tensoativo suave / Condicionante",
        abaixo1: false,
    },
    // ── Concentração < 1% (podem aparecer em qualquer ordem) ────────────
    {
        inci: "Parfum",
        pt: "Perfume",
        funcao: "Fragância",
        abaixo1: true,
    },
    {
        inci: "Sodium Hydroxide",
        pt: "Hidróxido de Sódio",
        funcao: "Agente alcalinizante / Saponificador",
        abaixo1: true,
    },
    {
        inci: "Etidronic Acid",
        pt: "Ácido Etidrônico",
        funcao: "Quelante / Estabilizante",
        abaixo1: true,
    },
    {
        inci: "Sodium Gluconate",
        pt: "Gluconato de Sódio",
        funcao: "Quelante / Estabilizante",
        abaixo1: true,
    },
    {
        inci: "Tetrasodium EDTA",
        pt: "Edetato Tetrassódico",
        funcao: "Quelante / Conservante auxiliar",
        abaixo1: true,
    },
    {
        inci: "Linalool",
        pt: "Linalol",
        funcao: "Componente de fragância (alérgeno declarado)",
        abaixo1: true,
        alergeno: true,
    },
    {
        inci: "Citronellol",
        pt: "Citronelol",
        funcao: "Componente de fragância (alérgeno declarado)",
        abaixo1: true,
        alergeno: true,
    },
    {
        inci: "Coumarin",
        pt: "Cumarina",
        funcao: "Componente de fragância (alérgeno declarado)",
        abaixo1: true,
        alergeno: true,
    },
    {
        inci: "Hexyl Cinnamal",
        pt: "Hexil Cinamal",
        funcao: "Componente de fragância (alérgeno declarado)",
        abaixo1: true,
        alergeno: true,
    },
    {
        inci: "Amyl Cinnamal",
        pt: "Amil Cinamal",
        funcao: "Componente de fragância (alérgeno declarado)",
        abaixo1: true,
        alergeno: true,
    },
];

const acima1 = INGREDIENTES.filter(i => !i.abaixo1);
const abaixo1 = INGREDIENTES.filter(i => i.abaixo1);

export default function ComposicaoAcafraoPage() {
    return (
        <div className={styles.page}>

            {/* Cabeçalho documental */}
            <div className={styles.docHeader}>
                <p className={styles.docBrand}>ECOSOPIS Cosméticos Naturais</p>
                <h1 className={styles.docTitle}>Sabonete em Barra de Açafrão e Dolomita</h1>
                <p className={styles.docSubtitle}>
                    Sabonete em barra com ação clareadora, anti-inflamatória e renovadora,
                    indicado para o tratamento de foliculite e uniformização do tom da pele.
                </p>
                <div className={styles.docMeta}>
                    <span>📋 Composição conforme <strong>RDC nº 752/2022</strong> e <strong>RDC nº 907/2024</strong> — ANVISA</span>
                    <span>·</span>
                    <span>Isento de registro — <strong>Lei nº 15.154/2025</strong> (artesanal)</span>
                </div>
            </div>

            {/* Bloco de composição */}
            <div className={styles.composicaoBlock}>
                <h2 className={styles.blockTitle}>Composição (Ingredientes INCI)</h2>
                <p className={styles.blockNote}>
                    Listagem em ordem decrescente de concentração. Ingredientes com concentração inferior a 1%
                    aparecem no final da lista e estão marcados com *.
                </p>

                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.thN}>#</th>
                            <th className={styles.thInci}>Nome INCI (Internacional)</th>
                            <th className={styles.thPt}>Nome em Português</th>
                            <th className={styles.thFuncao}>Função</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* ≥ 1% */}
                        {acima1.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                <td className={styles.tdN}>{idx + 1}</td>
                                <td className={styles.tdInci}>{item.inci}</td>
                                <td className={styles.tdPt}>{item.pt}</td>
                                <td className={styles.tdFuncao}>{item.funcao}</td>
                            </tr>
                        ))}

                        {/* Separador < 1% */}
                        <tr className={styles.separatorRow}>
                            <td colSpan={4} className={styles.separatorCell}>
                                * Ingredientes com concentração inferior a 1% — listados em qualquer ordem
                            </td>
                        </tr>

                        {/* < 1% */}
                        {abaixo1.map((item, idx) => (
                            <tr key={idx} className={(acima1.length + idx) % 2 === 0 ? styles.trEven : styles.trOdd}>
                                <td className={styles.tdN}>{acima1.length + idx + 1}</td>
                                <td className={styles.tdInci}>
                                    {item.inci}
                                    {item.alergeno && <span className={styles.tagAlergeno}>alérgeno</span>}
                                    {" *"}
                                </td>
                                <td className={styles.tdPt}>{item.pt}</td>
                                <td className={styles.tdFuncao}>{item.funcao}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Aviso sobre alérgenos */}
            <div className={styles.avisoBlock}>
                <p className={styles.avisoTitle}>⚠ Declaração de Alérgenos (Componentes de Fragância)</p>
                <p className={styles.avisoText}>
                    Em conformidade com a <strong>RDC nº 752/2022</strong>, os seguintes componentes de fragância com
                    potencial alergênico estão declarados individualmente na lista de ingredientes:{" "}
                    <em>Linalool (Linalol), Citronellol (Citronelol), Coumarin (Cumarina),
                    Hexyl Cinnamal (Hexil Cinamal), Amyl Cinnamal (Amil Cinamal)</em>.
                </p>
            </div>

        </div>
    );
}
