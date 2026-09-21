"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "./page.module.css";
import {
    Megaphone,
    Save,
    Mail,
    Upload,
    Trash2,
    Ticket,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Eye,
    Clock,
    X,
    ExternalLink,
    Send,
    Users
} from "lucide-react";

interface PopupData {
    id?: number | null;
    is_active: boolean;
    title: string;
    description: string;
    image_url: string | null;
    button_text: string;
    button_link: string;
    frequency: string;
    delay_seconds: number;
    has_coupon: boolean;
    coupon_code: string | null;
    coupon_discount_type: string;
    coupon_discount_value: number;
    coupon_min_purchase_value: number;
    coupon_valid_until: string | null;
    coupon_usage_limit: number | null;
    coupon_is_active: boolean;
}

interface DispatchLog {
    id: number;
    promotion_title: string;
    coupon_code: string | null;
    recipient_count: number;
    admin_email: string | null;
    status: string;
    created_at: string;
}

export default function AdminPopupPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const [form, setForm] = useState<PopupData>({
        is_active: false,
        title: "Oferta Especial Ecosopis 🌿",
        description: "Aproveite um desconto exclusivo para cuidar da sua pele com o melhor da natureza.",
        image_url: null,
        button_text: "Aproveitar Desconto",
        button_link: "/produtos",
        frequency: "once_per_session",
        delay_seconds: 3,
        has_coupon: true,
        coupon_code: "BEMVINDO10",
        coupon_discount_type: "percentage",
        coupon_discount_value: 10,
        coupon_min_purchase_value: 0,
        coupon_valid_until: "",
        coupon_usage_limit: null,
        coupon_is_active: true
    });

    // Email Campaign Modal State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [recipientCount, setRecipientCount] = useState<number>(0);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailTitle, setEmailTitle] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [emailButtonText, setEmailButtonText] = useState("Aproveitar Desconto na Loja");
    const [emailButtonLink, setEmailButtonLink] = useState("/produtos");
    const [confirmSend, setConfirmSend] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);

    // Dispatch Logs State
    const [logs, setLogs] = useState<DispatchLog[]>([]);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Load initial data
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        const fetchPopupData = async () => {
            try {
                const res = await fetch("/api/popup/admin", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setForm({
                        ...data,
                        coupon_valid_until: data.coupon_valid_until ? data.coupon_valid_until.slice(0, 10) : ""
                    });
                }
            } catch (err) {
                console.error("Erro ao carregar pop-up:", err);
                showToast("Erro ao carregar configurações do pop-up.", "error");
            } finally {
                setLoading(false);
            }
        };

        const fetchLogs = async () => {
            try {
                const res = await fetch("/api/popup/dispatch-logs", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data);
                }
            } catch (err) {
                console.error("Erro ao carregar logs:", err);
            }
        };

        fetchPopupData();
        fetchLogs();
    }, [router]);

    // Handle Image Upload via existing /api/images/upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        const token = localStorage.getItem("token");
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/images/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setForm(prev => ({ ...prev, image_url: data.url }));
                showToast("Imagem enviada com sucesso!", "success");
            } else {
                showToast("Erro ao fazer upload da imagem.", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Falha de conexão no envio da imagem.", "error");
        } finally {
            setUploadingImage(false);
        }
    };

    // Save Popup Settings
    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem("token");

        try {
            const payload = {
                ...form,
                coupon_code: form.has_coupon ? form.coupon_code?.trim().toUpperCase() || null : null,
                coupon_valid_until: form.has_coupon && form.coupon_valid_until ? `${form.coupon_valid_until}T23:59:59Z` : null,
                coupon_usage_limit: form.has_coupon && form.coupon_usage_limit ? Number(form.coupon_usage_limit) : null,
                coupon_discount_value: form.has_coupon ? Number(form.coupon_discount_value) || 0 : 0,
                coupon_min_purchase_value: form.has_coupon ? Number(form.coupon_min_purchase_value) || 0 : 0,
            };

            const res = await fetch("/api/popup/admin", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const updated = await res.json();
                setForm(prev => ({
                    ...prev,
                    ...updated,
                    coupon_valid_until: updated.coupon_valid_until ? updated.coupon_valid_until.slice(0, 10) : ""
                }));
                showToast("✅ Pop-up e cupom salvos com sucesso!", "success");
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.detail || "Erro ao salvar configurações.", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Erro de conexão ao salvar.", "error");
        } finally {
            setSaving(false);
        }
    };

    // Open Email Campaign Modal
    const handleOpenEmailModal = async () => {
        const token = localStorage.getItem("token");
        // Pre-fill fields from current form
        setEmailSubject(`🌿 ${form.title}`);
        setEmailTitle(form.title);
        setEmailBody(form.description || "Preparamos uma condição especial exclusiva para você renovar seus cosméticos naturais favoritos!");
        setEmailButtonText(form.button_text || "Acessar Loja Ecosopis");
        setEmailButtonLink(form.button_link || "/produtos");
        setConfirmSend(false);

        // Fetch recipients count
        try {
            const res = await fetch("/api/popup/recipients-count", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRecipientCount(data.recipient_count || 0);
            }
        } catch (err) {
            console.error(err);
        }

        setIsEmailModalOpen(true);
    };

    // Dispatch Campaign Email
    const handleSendCampaignEmail = async () => {
        if (!confirmSend) {
            alert("Por favor, marque a confirmação para autorizar o disparo.");
            return;
        }

        setSendingEmail(true);
        const token = localStorage.getItem("token");

        let discountInfo = "";
        if (form.has_coupon && form.coupon_code) {
            discountInfo = form.coupon_discount_type === "percentage"
                ? `${form.coupon_discount_value}% de Desconto`
                : `R$ ${form.coupon_discount_value.toFixed(2)} de Desconto`;
            if (form.coupon_min_purchase_value > 0) {
                discountInfo += ` em compras acima de R$ ${form.coupon_min_purchase_value.toFixed(2)}`;
            }
        }

        try {
            const res = await fetch("/api/popup/dispatch-email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    email_subject: emailSubject,
                    email_title: emailTitle,
                    email_body: emailBody,
                    email_image_url: form.image_url,
                    coupon_code: form.has_coupon ? form.coupon_code : null,
                    discount_info: discountInfo || null,
                    button_text: emailButtonText,
                    button_link: emailButtonLink
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`🚀 ${data.message}`, "success");
                setIsEmailModalOpen(false);

                // Reload logs
                const logsRes = await fetch("/api/popup/dispatch-logs", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (logsRes.ok) {
                    setLogs(await logsRes.json());
                }
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Erro ao disparar e-mails.", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Erro ao conectar com o servidor.", "error");
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <div className={styles.container}>
            <AdminSidebar activePath="/admin/dashboard/popup" />

            <main className={styles.main}>
                {/* Header */}
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.headerTitle}>
                            <Megaphone size={26} color="#15803d" /> Pop-up Promocional &amp; Marketing
                        </h1>
                        <p className={styles.headerSubtitle}>
                            Configure o pop-up interativo do site, sincronize cupons oficiais e dispare campanhas para clientes cadastrados.
                        </p>
                    </div>

                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.btnEmail}
                            onClick={handleOpenEmailModal}
                        >
                            <Mail size={18} /> Enviar Promoção por E-mail
                        </button>
                        <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            <Save size={18} /> {saving ? "Salvando..." : "Salvar Alterações"}
                        </button>
                    </div>
                </header>

                {/* Toast Notification */}
                {toast && (
                    <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
                        {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {toast.msg}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>
                        Carregando configurações...
                    </div>
                ) : (
                    <>
                        {/* Status Banner */}
                        <div className={`${styles.statusBanner} ${form.is_active ? styles.statusActive : styles.statusInactive}`}>
                            <div className={styles.statusInfo}>
                                <div className={`${styles.statusDot} ${form.is_active ? styles.dotActive : styles.dotInactive}`} />
                                <div>
                                    <h4 className={styles.statusTitle}>
                                        {form.is_active ? "Pop-up Ativo no Site" : "Pop-up Desativado"}
                                    </h4>
                                    <p className={styles.statusDesc}>
                                        {form.is_active
                                            ? "O pop-up está sendo exibido para os visitantes da loja de acordo com a frequência configurada."
                                            : "Nenhum visitante verá o pop-up no site enquanto esta opção estiver desligada."}
                                    </p>
                                </div>
                            </div>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                />
                                <span className={styles.slider} />
                            </label>
                        </div>

                        {/* Main Grid: Settings & Live Preview */}
                        <div className={styles.grid}>
                            {/* Left Column: Form Settings */}
                            <div>
                                {/* Basic Info Card */}
                                <div className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>
                                            <Sparkles size={20} color="#15803d" /> Conteúdo do Pop-up
                                        </h3>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Título da Promoção</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            placeholder="Ex: Oferta Especial de Boas-Vindas! 🌿"
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Descrição / Mensagem</label>
                                        <textarea
                                            className={styles.textarea}
                                            value={form.description}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            placeholder="Explique o benefício, produtos participantes ou regras da promoção..."
                                        />
                                    </div>

                                    <div className={styles.row}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Texto do Botão</label>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                value={form.button_text}
                                                onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                                                placeholder="Ex: Quero Aproveitar"
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Link do Botão</label>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                value={form.button_link}
                                                onChange={(e) => setForm({ ...form, button_link: e.target.value })}
                                                placeholder="Ex: /produtos ou /produtos?categoria=skincare"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Image Upload Card */}
                                <div className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>
                                            <Upload size={20} color="#15803d" /> Imagem Promocional
                                        </h3>
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: "none" }}
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />

                                    {form.image_url ? (
                                        <div className={styles.imagePreview}>
                                            <img src={form.image_url} alt="Promoção" />
                                            <button
                                                type="button"
                                                className={styles.removeImageBtn}
                                                onClick={() => setForm({ ...form, image_url: null })}
                                                title="Remover imagem"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ) : null}

                                    <div
                                        className={styles.uploadArea}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload size={28} color="#94a3b8" style={{ marginBottom: "0.5rem" }} />
                                        <p style={{ fontWeight: 600, color: "#334155", margin: 0 }}>
                                            {uploadingImage ? "Enviando imagem..." : "Clique para selecionar uma imagem promocional"}
                                        </p>
                                        <p className={styles.sublabel}>
                                            PNG, JPG ou WEBP (recomendado: 600x320px ou similar)
                                        </p>
                                    </div>
                                </div>

                                {/* Frequency & Timing Card */}
                                <div className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>
                                            <Clock size={20} color="#15803d" /> Frequência de Exibição
                                        </h3>
                                    </div>

                                    <div className={styles.row}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Frequência para o Visitante</label>
                                            <select
                                                className={styles.select}
                                                value={form.frequency}
                                                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                                            >
                                                <option value="once_per_session">Uma vez por sessão (recomendado)</option>
                                                <option value="once_per_day">Uma vez por dia (24 horas)</option>
                                                <option value="always">Sempre (a cada recarregamento)</option>
                                            </select>
                                            <p className={styles.sublabel}>
                                                Evita que o pop-up incomode o cliente repetidamente.
                                            </p>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Tempo de Atraso (segundos)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="60"
                                                className={styles.input}
                                                value={form.delay_seconds}
                                                onChange={(e) => setForm({ ...form, delay_seconds: parseInt(e.target.value) || 0 })}
                                            />
                                            <p className={styles.sublabel}>
                                                Segundos antes do pop-up surgir na tela (ex: 3s).
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Integrated Coupon Card */}
                                <div className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>
                                            <Ticket size={20} color="#15803d" /> Cupom de Desconto Vinculado
                                        </h3>
                                        <label className={styles.switch}>
                                            <input
                                                type="checkbox"
                                                checked={form.has_coupon}
                                                onChange={(e) => setForm({ ...form, has_coupon: e.target.checked })}
                                            />
                                            <span className={styles.slider} />
                                        </label>
                                    </div>

                                    <p style={{ color: "#64748b", fontSize: "0.88rem", margin: "0 0 1rem" }}>
                                        Crie ou sincronize um cupom diretamente pelo pop-up. Ao salvar, o cupom é cadastrado na tabela oficial de cupons e fica disponível no carrinho e checkout.
                                    </p>

                                    {form.has_coupon && (
                                        <div className={styles.couponBox}>
                                            <div className={styles.row}>
                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Código do Cupom</label>
                                                    <input
                                                        type="text"
                                                        className={styles.input}
                                                        value={form.coupon_code || ""}
                                                        onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                                                        placeholder="Ex: PRIMAVERA15"
                                                        style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "1px" }}
                                                    />
                                                </div>

                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Tipo de Desconto</label>
                                                    <select
                                                        className={styles.select}
                                                        value={form.coupon_discount_type}
                                                        onChange={(e) => setForm({ ...form, coupon_discount_type: e.target.value })}
                                                    >
                                                        <option value="percentage">Porcentagem (%)</option>
                                                        <option value="fixed">Valor Fixo (R$)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className={styles.row} style={{ marginTop: "0.75rem" }}>
                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>
                                                        Valor do Desconto {form.coupon_discount_type === "percentage" ? "(%)" : "(R$)"}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className={styles.input}
                                                        value={form.coupon_discount_value}
                                                        onChange={(e) => setForm({ ...form, coupon_discount_value: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>

                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Valor Mínimo de Compra (R$)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className={styles.input}
                                                        value={form.coupon_min_purchase_value}
                                                        onChange={(e) => setForm({ ...form, coupon_min_purchase_value: parseFloat(e.target.value) || 0 })}
                                                        placeholder="0 = sem valor mínimo"
                                                    />
                                                </div>
                                            </div>

                                            <div className={styles.row} style={{ marginTop: "0.75rem" }}>
                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Validade do Cupom (Opcional)</label>
                                                    <input
                                                        type="date"
                                                        className={styles.input}
                                                        value={form.coupon_valid_until || ""}
                                                        onChange={(e) => setForm({ ...form, coupon_valid_until: e.target.value })}
                                                    />
                                                </div>

                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Limite de Usos (Opcional)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className={styles.input}
                                                        value={form.coupon_usage_limit || ""}
                                                        onChange={(e) => setForm({ ...form, coupon_usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                                                        placeholder="Ex: 100 utilizações"
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
                                                <label className={styles.switch}>
                                                    <input
                                                        type="checkbox"
                                                        checked={form.coupon_is_active}
                                                        onChange={(e) => setForm({ ...form, coupon_is_active: e.target.checked })}
                                                    />
                                                    <span className={styles.slider} />
                                                </label>
                                                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>
                                                    Cupom Ativo para Utilização
                                                </span>
                                            </div>

                                            <div className={styles.couponNotice}>
                                                <Sparkles size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                                                <span>
                                                    <strong>Integração Direta:</strong> Se o código já existir, ele será atualizado e associado ao pop-up. Se não existir, será criado automaticamente no sistema oficial de cupons.
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Interactive Live Preview */}
                            <div>
                                <div className={`${styles.card} ${styles.previewSticky}`}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>
                                            <Eye size={20} color="#15803d" /> Pré-visualização em Tempo Real
                                        </h3>
                                        <span style={{ fontSize: "0.78rem", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px", color: "#64748b", fontWeight: 600 }}>
                                            Como o cliente vê
                                        </span>
                                    </div>

                                    <div className={styles.previewWrapper}>
                                        <div className={styles.mockupPopup}>
                                            <div className={styles.mockupClose}>
                                                <X size={16} />
                                            </div>

                                            {form.image_url ? (
                                                <img src={form.image_url} alt="Preview" className={styles.mockupImage} />
                                            ) : (
                                                <div style={{ height: "110px", background: "linear-gradient(135deg, #2d5a27 0%, #15803d 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                                                    <Sparkles size={32} opacity={0.8} />
                                                </div>
                                            )}

                                            <div className={styles.mockupBody}>
                                                <span className={styles.mockupBadge}>
                                                    Oferta Exclusiva
                                                </span>

                                                <h4 className={styles.mockupTitle}>
                                                    {form.title || "Título da Promoção"}
                                                </h4>

                                                <p className={styles.mockupDesc}>
                                                    {form.description || "Descrição da promoção aparecerá aqui de forma atrativa para o cliente."}
                                                </p>

                                                {form.has_coupon && form.coupon_code && (
                                                    <div className={styles.mockupCoupon}>
                                                        <div>
                                                            <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                                                                {form.coupon_discount_type === "percentage"
                                                                    ? `${form.coupon_discount_value}% OFF`
                                                                    : `R$ ${form.coupon_discount_value.toFixed(2)} OFF`}
                                                            </div>
                                                            <div className={styles.mockupCouponCode}>
                                                                {form.coupon_code}
                                                            </div>
                                                        </div>
                                                        <button type="button" className={styles.mockupCopyBtn}>
                                                            Copiar
                                                        </button>
                                                    </div>
                                                )}

                                                <button type="button" className={styles.mockupActionBtn}>
                                                    {form.button_text || "Aproveitar Desconto"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", margin: "1rem 0 0" }}>
                                        Atraso configurado: <strong>{form.delay_seconds}s</strong> · Exibição: <strong>{form.frequency}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Dispatch History Table */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>
                                    <Mail size={20} color="#0284c7" /> Histórico de Disparos de E-mail
                                </h3>
                            </div>

                            {logs.length === 0 ? (
                                <p style={{ color: "#94a3b8", padding: "1.5rem 0", textAlign: "center", margin: 0 }}>
                                    Nenhum disparo de campanha registrado ainda.
                                </p>
                            ) : (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Data &amp; Horário</th>
                                                <th>Título da Campanha</th>
                                                <th>Cupom</th>
                                                <th>Destinatários</th>
                                                <th>Disparado Por</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map((log) => (
                                                <tr key={log.id}>
                                                    <td>
                                                        {new Date(log.created_at).toLocaleString("pt-BR", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        })}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{log.promotion_title}</td>
                                                    <td>
                                                        {log.coupon_code ? (
                                                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#15803d", background: "#f0fdf4", padding: "2px 6px", borderRadius: "4px" }}>
                                                                {log.coupon_code}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td>{log.recipient_count} clientes</td>
                                                    <td style={{ color: "#64748b" }}>{log.admin_email || "Admin"}</td>
                                                    <td>
                                                        <span className={`${styles.statusTag} ${log.status.includes("completed") ? styles.statusTagCompleted : log.status === "in_progress" ? styles.statusTagPending : styles.statusTagFailed}`}>
                                                            {log.status === "completed" ? "Enviado" : log.status === "in_progress" ? "Disparando..." : log.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {/* Email Campaign Modal */}
            {isEmailModalOpen && (
                <div className={styles.modalOverlay} onClick={() => !sendingEmail && setIsEmailModalOpen(false)}>
                    <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                <Mail size={22} color="#0284c7" /> Enviar Campanha Promocional por E-mail
                            </h3>
                            <button
                                type="button"
                                className={styles.modalCloseBtn}
                                onClick={() => !sendingEmail && setIsEmailModalOpen(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {/* Recipient Count Badge */}
                            <div className={styles.recipientBadge}>
                                <Users size={18} />
                                <span>
                                    <strong>{recipientCount} clientes cadastrados</strong> com e-mail válido receberão esta promoção.
                                </span>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Assunto do E-mail</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Ex: 🌿 Oferta Especial de Cosméticos Naturais Ecosopis"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Título no Cabeçalho do E-mail</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={emailTitle}
                                    onChange={(e) => setEmailTitle(e.target.value)}
                                    placeholder="Ex: Desconto Exclusivo para Você!"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Mensagem do E-mail</label>
                                <textarea
                                    className={styles.textarea}
                                    rows={4}
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Escreva a mensagem personalizada que será entregue aos seus clientes..."
                                />
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Texto do Botão no E-mail</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={emailButtonText}
                                        onChange={(e) => setEmailButtonText(e.target.value)}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Link do Botão</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={emailButtonLink}
                                        onChange={(e) => setEmailButtonLink(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Email Live Preview Box */}
                            <div className={styles.emailPreviewFrame}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Eye size={14} /> Prévia da Mensagem que o Cliente Receberá
                                </div>
                                <div style={{ background: "white", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ textAlign: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: "15px" }}>
                                        <h3 style={{ color: "#2d5a27", margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>ECOSOPIS</h3>
                                        <span style={{ fontSize: "0.72rem", color: "#6b7280", letterSpacing: "1.5px" }}>COSMÉTICOS NATURAIS E VEGANOS</span>
                                    </div>

                                    <h4 style={{ color: "#111827", textAlign: "center", margin: "0 0 10px", fontSize: "1.1rem" }}>
                                        {emailTitle || "Título da Promoção"}
                                    </h4>

                                    <p style={{ color: "#4b5563", fontSize: "0.9rem", lineHeight: "1.6", whiteSpace: "pre-wrap", margin: "0 0 15px" }}>
                                        {emailBody}
                                    </p>

                                    {form.has_coupon && form.coupon_code && (
                                        <div style={{ background: "#f5f9f2", border: "2px dashed #4B8411", borderRadius: "8px", padding: "14px", textAlign: "center", margin: "15px 0" }}>
                                            <div style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>
                                                CUPOM PROMOCIONAL EXCLUSIVO
                                            </div>
                                            <div style={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 800, color: "#2d5a27", letterSpacing: "2px", margin: "4px 0" }}>
                                                {form.coupon_code}
                                            </div>
                                            <div style={{ fontSize: "0.82rem", color: "#15803d", fontWeight: 600 }}>
                                                {form.coupon_discount_type === "percentage"
                                                    ? `${form.coupon_discount_value}% de Desconto`
                                                    : `R$ ${form.coupon_discount_value.toFixed(2)} de Desconto`}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ textAlign: "center", marginTop: "15px" }}>
                                        <span style={{ background: "#2d5a27", color: "white", padding: "10px 24px", borderRadius: "6px", fontWeight: 700, fontSize: "0.9rem", display: "inline-block" }}>
                                            {emailButtonText} →
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Safety Confirmation Checkbox */}
                            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: "10px" }}>
                                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={confirmSend}
                                        onChange={(e) => setConfirmSend(e.target.checked)}
                                        style={{ marginTop: "3px", width: "18px", height: "18px" }}
                                    />
                                    <span style={{ fontSize: "0.88rem", color: "#991b1b", lineHeight: "1.4" }}>
                                        <strong>Confirmo o disparo definitivo:</strong> Compreendo que esta mensagem será disparada para todos os {recipientCount} clientes cadastrados na loja e que a ação não pode ser desfeita.
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => setIsEmailModalOpen(false)}
                                disabled={sendingEmail}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={styles.btnEmail}
                                onClick={handleSendCampaignEmail}
                                disabled={!confirmSend || sendingEmail || recipientCount === 0}
                            >
                                <Send size={16} /> {sendingEmail ? "Disparando em Segundo Plano..." : `Disparar para ${recipientCount} Clientes`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
