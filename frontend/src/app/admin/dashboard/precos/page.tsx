"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AdminLayout from "@/components/AdminLayout/AdminLayout";
import {
    Percent,
    ArrowUpRight,
    ArrowDownRight,
    RotateCcw,
    DollarSign,
    CheckCircle2,
    AlertCircle,
    Eye,
    Sparkles,
    Tag,
    HelpCircle,
    ShieldCheck
} from "lucide-react";

type OperationType = "decrease_percent" | "increase_percent" | "decrease_fixed" | "increase_fixed";

interface PreviewItem {
    id: number;
    name: string;
    slug?: string;
    category?: string;
    image_url?: string;
    original_price: number;
    current_price: number;
    new_price: number;
    difference?: number;
    percent_change?: number;
    is_lower?: boolean;
    discount_percent?: number;
    is_discounted_vs_original?: boolean;
}

interface ActiveAdjustment {
    operation: string;
    value: number;
    category?: string | null;
    applied_at?: string;
    affected_count?: number;
}

export default function GlobalPriceAdjustmentPage() {
    const router = useRouter();
    const [operation, setOperation] = useState<OperationType>("decrease_percent");
    const [value, setValue] = useState<number>(10);
    const [category, setCategory] = useState<string>("all");
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    
    // Status & Preview
    const [activeRule, setActiveRule] = useState<ActiveAdjustment | null>(null);
    const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
    const [previewTotal, setPreviewTotal] = useState<number>(0);
    
    // Loading states
    const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
    const [applying, setApplying] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const getImageUrl = (url?: string) => {
        if (!url) return "/logo_final.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        if (url.startsWith("attached_assets/")) return `/static/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    // Load available categories and active adjustment status
    const loadStatusAndCategories = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                router.push("/admin");
                return;
            }

            // 1. Fetch active status
            const statusRes = await fetch("/api/products/price-adjustment/status", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.is_active) {
                    setActiveRule({
                        operation: statusData.adjustment_type,
                        value: statusData.value,
                        category: statusData.category,
                        applied_at: statusData.applied_at,
                        affected_count: statusData.affected_count
                    });
                } else {
                    setActiveRule(null);
                }
            }

            // 2. Fetch categories from products
            const productsRes = await fetch("/api/products/?include_inactive=true");
            if (productsRes.ok) {
                const productsData = await productsRes.json();
                if (Array.isArray(productsData)) {
                    const cats = Array.from(new Set(productsData.map((p: any) => p.category).filter(Boolean))) as string[];
                    setAvailableCategories(cats);
                }
            }
        } catch (err) {
            console.error("Error loading status/categories:", err);
        }
    }, [router]);

    useEffect(() => {
        loadStatusAndCategories();
    }, [loadStatusAndCategories]);

    // Fetch simulation preview
    const fetchPreview = useCallback(async () => {
        if (!value || value <= 0) {
            setPreviewItems([]);
            setPreviewTotal(0);
            return;
        }

        setLoadingPreview(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/products/price-adjustment/preview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    operation,
                    value: Number(value),
                    category: category === "all" ? null : category
                })
            });

            if (res.ok) {
                const data = await res.json();
                const rawItems = data.preview || data.affected_products || [];
                const formatted: PreviewItem[] = rawItems.map((item: any) => ({
                    ...item,
                    is_lower: item.is_lower ?? (item.new_price < item.original_price),
                    discount_percent: item.discount_percent ?? (item.new_price < item.original_price ? Math.round((1 - item.new_price / item.original_price) * 100) : 0),
                    difference: item.difference ?? (item.new_price - item.original_price),
                }));
                setPreviewItems(formatted);
                setPreviewTotal(data.total_products || formatted.length);
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Erro ao gerar prévia de preços", "error");
            }
        } catch (err) {
            console.error("Preview error:", err);
            showToast("Erro ao conectar com o servidor para simulação", "error");
        } finally {
            setLoadingPreview(false);
        }
    }, [operation, value, category]);

    // Automatically trigger preview when operation, value, or category change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPreview();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchPreview]);

    // Apply adjustment
    const handleApply = async () => {
        if (!value || value <= 0) {
            showToast("Informe um valor válido maior que zero.", "error");
            return;
        }

        const opLabels: Record<OperationType, string> = {
            decrease_percent: `desconto de ${value}%`,
            increase_percent: `aumento de ${value}%`,
            decrease_fixed: `desconto de R$ ${Number(value).toFixed(2)}`,
            increase_fixed: `aumento de R$ ${Number(value).toFixed(2)}`
        };

        const targetScope = category === "all" ? "TODOS os produtos" : `produtos da categoria "${category}"`;
        const confirmMsg = `Tem certeza que deseja aplicar ${opLabels[operation]} em ${targetScope}?\n\nProdutos que ficarem com preço menor que o original terão o valor antigo riscado automaticamente. Você poderá restaurar os preços originais a qualquer momento.`;

        if (!window.confirm(confirmMsg)) return;

        setApplying(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/products/price-adjustment/apply", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    operation,
                    value: Number(value),
                    category: category === "all" ? null : category
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(data.message || "Ajuste de preços aplicado com sucesso!", "success");
                loadStatusAndCategories();
                fetchPreview();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Falha ao aplicar ajuste de preços.", "error");
            }
        } catch (err) {
            console.error("Apply error:", err);
            showToast("Erro de comunicação ao aplicar preços.", "error");
        } finally {
            setApplying(false);
        }
    };

    // Reset prices to original registered prices
    const handleReset = async () => {
        const targetScope = category === "all" ? "TODOS os produtos da loja" : `os produtos da categoria "${category}"`;
        const confirmMsg = `Deseja restaurar os preços originais de cadastro para ${targetScope}?\n\nEssa ação removerá o ajuste ativo e os preços voltarão ao normal.`;

        if (!window.confirm(confirmMsg)) return;

        setResetting(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/products/price-adjustment/reset", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    category: category === "all" ? null : category
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(data.message || "Preços originais restaurados com sucesso!", "success");
                loadStatusAndCategories();
                fetchPreview();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Falha ao restaurar preços.", "error");
            }
        } catch (err) {
            console.error("Reset error:", err);
            showToast("Erro de comunicação ao restaurar preços.", "error");
        } finally {
            setResetting(false);
        }
    };

    const isPercentage = operation === "decrease_percent" || operation === "increase_percent";
    const percentPresets = [5, 10, 15, 20, 25, 30, 50];
    const fixedPresets = [2, 5, 10, 15, 20, 50];

    const getOperationLabel = (op: string, val: number) => {
        switch (op) {
            case "decrease_percent":
                return `Desconto de ${val}%`;
            case "increase_percent":
                return `Aumento de ${val}%`;
            case "decrease_fixed":
                return `Desconto de R$ ${val.toFixed(2)}`;
            case "increase_fixed":
                return `Aumento de R$ ${val.toFixed(2)}`;
            default:
                return "Ajuste personalizado";
        }
    };

    return (
        <AdminLayout>
            <div className={styles.container}>
                <AdminSidebar activePath="/admin/dashboard/precos" />

                <main className={styles.main}>
                    {/* Toast Notification */}
                    {toast && (
                        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
                            {toast.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                            <span>{toast.msg}</span>
                        </div>
                    )}

                    {/* Header */}
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.headerTitle}>
                                <Sparkles color="#15803d" size={28} />
                                Ferramenta de Ajuste Global de Preços
                            </h1>
                            <p className={styles.headerSubtitle}>
                                Altere diretamente todos os valores do site (aumentar/diminuir em R$ ou %). Valores menores que o original são automaticamente riscados em formato de promoção.
                            </p>
                        </div>
                        <div className={styles.headerActions}>
                            <Link
                                href="/admin/dashboard"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "0.75rem 1.25rem",
                                    background: "#ffffff",
                                    border: "1.5px solid #cbd5e1",
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    color: "#334155",
                                    textDecoration: "none",
                                    fontSize: "0.9rem"
                                }}
                            >
                                ← Voltar ao Catálogo
                            </Link>
                            <button
                                className={styles.btnReset}
                                onClick={handleReset}
                                disabled={resetting}
                                title="Voltar todos os produtos para o valor cadastrado original"
                            >
                                <RotateCcw size={16} />
                                {resetting ? "Restaurando..." : "Restaurar Preços Originais"}
                            </button>
                        </div>
                    </div>

                    {/* Status Banner */}
                    <div className={`${styles.statusBanner} ${activeRule ? styles.statusActive : styles.statusInactive}`}>
                        <div className={styles.statusLeft}>
                            <div className={`${styles.statusDot} ${activeRule ? styles.dotActive : styles.dotInactive}`} />
                            <div>
                                <h3 className={styles.statusTitle}>
                                    {activeRule ? (
                                        <>Ajuste Ativo no Site: <strong>{getOperationLabel(activeRule.operation, activeRule.value)}</strong></>
                                    ) : (
                                        "Preços Originais Ativos (Nenhum ajuste global ativo no momento)"
                                    )}
                                </h3>
                                <p className={styles.statusDesc}>
                                    {activeRule ? (
                                        <>
                                            Escopo: <strong>{activeRule.category ? `Categoria ${activeRule.category}` : "Todos os produtos"}</strong> • 
                                            Produtos afetados: <strong>{activeRule.affected_count ?? 0}</strong> • 
                                            {activeRule.applied_at && ` Aplicado em: ${new Date(activeRule.applied_at).toLocaleString("pt-BR")}`}
                                        </>
                                    ) : (
                                        "Todos os produtos estão sendo exibidos com seus valores de cadastro originais."
                                    )}
                                </p>
                            </div>
                        </div>
                        {activeRule && (
                            <button
                                className={styles.btnReset}
                                onClick={handleReset}
                                disabled={resetting}
                                style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}
                            >
                                <RotateCcw size={15} />
                                Desativar e Voltar Originais
                            </button>
                        )}
                    </div>

                    {/* Notice Card */}
                    <div className={styles.infoNotice}>
                        <ShieldCheck size={24} style={{ flexShrink: 0, marginTop: "2px", color: "#15803d" }} />
                        <div>
                            <strong>Como funciona a regra visual de desconto:</strong>
                            <p style={{ margin: "4px 0 0 0", fontSize: "0.84rem", color: "#065f46" }}>
                                Sempre que o novo valor for <strong>menor</strong> do que o preço cadastrado original do produto, o valor antigo aparecerá <strong>riscado visualmente</strong> no card e na página de detalhes, exibindo o selo de desconto. Se o ajuste for um aumento, o valor é atualizado normalmente sem rasura.
                            </p>
                        </div>
                    </div>

                    {/* Configuration Form Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>
                                <Tag size={20} color="#15803d" />
                                1. Selecione o Tipo de Ajuste
                            </h2>
                        </div>

                        {/* Operation Selector Grid */}
                        <div className={styles.operationGrid}>
                            <div
                                className={`${styles.operationCard} ${operation === "decrease_percent" ? styles.operationSelected : ""}`}
                                onClick={() => setOperation("decrease_percent")}
                            >
                                <div className={styles.operationIcon} style={{ color: "#16a34a" }}>
                                    <ArrowDownRight size={26} />
                                </div>
                                <div className={styles.operationName}>Diminuir em % (Desconto)</div>
                                <div className={styles.operationDesc}>Ex: -10%, -20% em todos os produtos</div>
                            </div>

                            <div
                                className={`${styles.operationCard} ${operation === "decrease_fixed" ? styles.operationSelected : ""}`}
                                onClick={() => setOperation("decrease_fixed")}
                            >
                                <div className={styles.operationIcon} style={{ color: "#16a34a" }}>
                                    <ArrowDownRight size={26} />
                                </div>
                                <div className={styles.operationName}>Diminuir em R$ (Desconto)</div>
                                <div className={styles.operationDesc}>Ex: -R$ 5,00, -R$ 10,00 no valor final</div>
                            </div>

                            <div
                                className={`${styles.operationCard} ${operation === "increase_percent" ? styles.operationSelected : ""}`}
                                onClick={() => setOperation("increase_percent")}
                            >
                                <div className={styles.operationIcon} style={{ color: "#2563eb" }}>
                                    <ArrowUpRight size={26} />
                                </div>
                                <div className={styles.operationName}>Aumentar em %</div>
                                <div className={styles.operationDesc}>Ex: +5%, +10% em todos os produtos</div>
                            </div>

                            <div
                                className={`${styles.operationCard} ${operation === "increase_fixed" ? styles.operationSelected : ""}`}
                                onClick={() => setOperation("increase_fixed")}
                            >
                                <div className={styles.operationIcon} style={{ color: "#2563eb" }}>
                                    <ArrowUpRight size={26} />
                                </div>
                                <div className={styles.operationName}>Aumentar em R$</div>
                                <div className={styles.operationDesc}>Ex: +R$ 3,00, +R$ 5,00 no valor final</div>
                            </div>
                        </div>

                        {/* Value and Scope Row */}
                        <div className={styles.controlsRow}>
                            {/* Value Input */}
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    {isPercentage ? "Percentual do Ajuste (%):" : "Valor do Ajuste em Reais (R$):"}
                                </label>
                                <div className={styles.inputGroup}>
                                    <div className={styles.inputPrefix}>
                                        {isPercentage ? <Percent size={18} /> : <DollarSign size={18} />}
                                    </div>
                                    <input
                                        type="number"
                                        step={isPercentage ? "1" : "0.50"}
                                        min="0.01"
                                        max={isPercentage ? "99" : "10000"}
                                        value={value}
                                        onChange={(e) => setValue(Number(e.target.value))}
                                        className={styles.input}
                                        placeholder={isPercentage ? "Ex: 15" : "Ex: 10.00"}
                                    />
                                </div>

                                {/* Quick Presets */}
                                <div className={styles.presetsRow}>
                                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Atalhos:</span>
                                    {(isPercentage ? percentPresets : fixedPresets).map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            className={styles.presetBtn}
                                            onClick={() => setValue(p)}
                                        >
                                            {isPercentage ? `${p}%` : `R$ ${p}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category Scope */}
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Aplicar em quais produtos?</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className={styles.select}
                                >
                                    <option value="all">🌟 Todos os produtos da loja</option>
                                    {availableCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            Categoria: {cat}
                                        </option>
                                    ))}
                                </select>
                                <p style={{ margin: "6px 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                                    {category === "all"
                                        ? "O ajuste incidirá sobre o catálogo completo."
                                        : `O ajuste incidirá apenas nos produtos cadastrados em "${category}".`}
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", paddingTop: "0.5rem" }}>
                            <button
                                className={styles.btnPrimary}
                                onClick={handleApply}
                                disabled={applying || loadingPreview || value <= 0}
                            >
                                <Sparkles size={18} />
                                {applying ? "Aplicando em toda a loja..." : "🚀 Aplicar Ajuste Agora no Site"}
                            </button>

                            <button
                                type="button"
                                onClick={fetchPreview}
                                disabled={loadingPreview}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "0.75rem 1.25rem",
                                    background: "#f8fafc",
                                    border: "1.5px solid #cbd5e1",
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    color: "#334155",
                                    cursor: "pointer"
                                }}
                            >
                                <Eye size={16} />
                                {loadingPreview ? "Atualizando..." : "Recarregar Simulação"}
                            </button>
                        </div>
                    </div>

                    {/* Simulation / Preview Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>
                                <Eye size={20} color="#15803d" />
                                2. Simulação em Tempo Real ({previewTotal} produtos)
                            </h2>
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                Veja como os cartões e páginas de produto ficarão antes de aplicar
                            </span>
                        </div>

                        {loadingPreview ? (
                            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                                Carregando simulação de valores...
                            </div>
                        ) : previewItems.length === 0 ? (
                            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                                Nenhum produto encontrado para a categoria selecionada.
                            </div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Categoria</th>
                                            <th>Valor Original de Cadastro</th>
                                            <th>Valor Atual no Site</th>
                                            <th>Novo Valor Simulado</th>
                                            <th>Efeito Visual no Card</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewItems.map((item) => {
                                            const isDiscounted = item.is_lower ?? (item.new_price < item.original_price);
                                            const diff = item.difference ?? (item.new_price - item.original_price);
                                            const discountPct = item.discount_percent ?? Math.round(Math.abs(diff / (item.original_price || 1)) * 100);

                                            return (
                                                <tr key={item.id}>
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <img
                                                                src={getImageUrl(item.image_url)}
                                                                alt={item.name}
                                                                style={{
                                                                    width: "40px",
                                                                    height: "40px",
                                                                    borderRadius: "8px",
                                                                    objectFit: "cover",
                                                                    border: "1px solid #e2e8f0"
                                                                }}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = "/logo_final.png";
                                                                }}
                                                            />
                                                            <div>
                                                                <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>
                                                                    {item.name}
                                                                </strong>
                                                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                                                    ID: {item.id}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            display: "inline-block",
                                                            background: "#f1f5f9",
                                                            padding: "2px 8px",
                                                            borderRadius: "4px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: 600,
                                                            color: "#475569"
                                                        }}>
                                                            {item.category || "Sem categoria"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "#334155" }}>
                                                            R$ {item.original_price.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: "#64748b" }}>
                                                            R$ {item.current_price.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {isDiscounted ? (
                                                            <div>
                                                                <span className={styles.struckPrice}>
                                                                    R$ {item.original_price.toFixed(2)}
                                                                </span>
                                                                <span className={styles.newPriceDiscount}>
                                                                    R$ {item.new_price.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className={styles.newPriceNormal}>
                                                                R$ {item.new_price.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {isDiscounted ? (
                                                            <span className={styles.discountBadge}>
                                                                ✂️ Riscado ({discountPct}% OFF)
                                                            </span>
                                                        ) : diff > 0 ? (
                                                            <span style={{
                                                                display: "inline-block",
                                                                padding: "2px 8px",
                                                                background: "#eff6ff",
                                                                color: "#2563eb",
                                                                borderRadius: "6px",
                                                                fontSize: "0.75rem",
                                                                fontWeight: 700
                                                            }}>
                                                                ▲ Aumento (+R$ {diff.toFixed(2)})
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                display: "inline-block",
                                                                padding: "2px 8px",
                                                                background: "#f1f5f9",
                                                                color: "#64748b",
                                                                borderRadius: "6px",
                                                                fontSize: "0.75rem",
                                                                fontWeight: 600
                                                            }}>
                                                                = Inalterado
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AdminLayout>
    );
}
