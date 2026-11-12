"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout/AdminLayout";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import dash from "../dashboard.module.css";
import styles from "./personalizacao.module.css";
import { Save, Trash2, Plus, Pipette, Search, ImagePlus } from "lucide-react";
import { loadArtFile } from "@/lib/personalization/artLoader";
import { areaAspect, defaultTransform, renderComposite } from "@/lib/personalization/renderer";

interface Area {
    id?: number;
    product_id: number;
    image_url: string;
    name: string;
    is_active: boolean;
    quad: number[][];
    curvature: number;
    aspect_ratio: number | null;
    cover_label: boolean;
    base_color: string | null;
}
interface Product { id: number; name: string; category: string | null; photos: string[]; areas: Area[]; customizable: boolean }

const DEFAULT_QUAD = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function AdminPersonalizacaoPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [selId, setSelId] = useState<number | null>(null);
    const [photo, setPhoto] = useState("");
    const [form, setForm] = useState<Area | null>(null);
    const [picking, setPicking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testArt, setTestArt] = useState<HTMLCanvasElement | null>(null);

    const boxRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const previewRef = useRef<HTMLCanvasElement | null>(null);
    const drag = useRef<{ kind: "corner"; i: number } | { kind: "move"; start: [number, number]; quad: number[][] } | null>(null);

    const token = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/personalization/products?include_inactive_areas=true");
            if (!r.ok) throw new Error();
            setProducts(await r.json());
        } catch {
            setMsg({ type: "err", text: "Não foi possível carregar os produtos." });
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const product = useMemo(() => products.find((p) => p.id === selId) || null, [products, selId]);
    const areasOnPhoto = useMemo(() => (product ? product.areas.filter((a) => a.image_url === photo) : []), [product, photo]);

    const newArea = (p: Product, url: string): Area => ({
        product_id: p.id, image_url: url, name: `Área ${p.areas.filter((a) => a.image_url === url).length + 1}`,
        is_active: true, quad: DEFAULT_QUAD.map((q) => [...q]), curvature: 0, aspect_ratio: null, cover_label: false, base_color: null,
    });

    const selectProduct = (p: Product) => {
        setSelId(p.id);
        const url = p.photos.find((u) => p.areas.some((a) => a.image_url === u)) || p.photos[0];
        setPhoto(url);
        const existing = p.areas.find((a) => a.image_url === url);
        setForm(existing ? { ...existing, quad: existing.quad.map((q) => [...q]) } : newArea(p, url));
        setMsg(null);
    };
    const selectPhoto = (url: string) => {
        if (!product) return;
        setPhoto(url);
        const existing = product.areas.find((a) => a.image_url === url);
        setForm(existing ? { ...existing, quad: existing.quad.map((q) => [...q]) } : newArea(product, url));
    };
    const selectArea = (a: Area) => setForm({ ...a, quad: a.quad.map((q) => [...q]) });

    // ── marcação visual ─────────────────────────────────────────────────────
    const norm = (e: { clientX: number; clientY: number }): [number, number] => {
        const r = boxRef.current!.getBoundingClientRect();
        return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
    };
    const startCorner = (i: number) => (e: React.PointerEvent) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { kind: "corner", i };
    };
    const startMove = (e: React.PointerEvent) => {
        if (!form) return;
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { kind: "move", start: norm(e), quad: form.quad.map((q) => [...q]) };
    };
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d || !form) return;
        const p = norm(e);
        if (d.kind === "corner") {
            const q = form.quad.map((x) => [...x]);
            q[d.i] = p;
            setForm({ ...form, quad: q });
        } else {
            let dx = p[0] - d.start[0], dy = p[1] - d.start[1];
            const xs = d.quad.map((q) => q[0]), ys = d.quad.map((q) => q[1]);
            dx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), dx));
            dy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), dy));
            setForm({ ...form, quad: d.quad.map(([x, y]) => [x + dx, y + dy]) });
        }
    };
    const endDrag = () => { drag.current = null; };

    const pickColor = (e: React.MouseEvent) => {
        if (!picking || !imgRef.current || !form) return;
        const img = imgRef.current;
        const [nx, ny] = norm(e);
        try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            const px = ctx.getImageData(Math.floor(nx * (c.width - 1)), Math.floor(ny * (c.height - 1)), 1, 1).data;
            const hex = "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
            setForm({ ...form, base_color: hex });
        } catch {
            setMsg({ type: "err", text: "Não foi possível ler a cor desta foto." });
        }
        setPicking(false);
    };

    // ── salvar / excluir ────────────────────────────────────────────────────
    const save = async () => {
        if (!form) return;
        if (!token()) { setMsg({ type: "err", text: "Sua sessão expirou. Saia e entre novamente no admin." }); return; }
        setSaving(true);
        setMsg(null);
        try {
            const payload = {
                product_id: form.product_id, image_url: form.image_url, name: form.name.trim() || "Área principal", is_active: form.is_active,
                quad: form.quad, curvature: form.curvature, aspect_ratio: form.aspect_ratio || null, cover_label: form.cover_label,
                base_color: form.cover_label ? form.base_color || null : null,
            };
            const r = await fetch(form.id ? `/api/personalization/areas/${form.id}` : "/api/personalization/areas", {
                method: form.id ? "PUT" : "POST", headers: headers(), body: JSON.stringify(payload),
            });
            if (r.status === 401 || r.status === 403) throw new Error("Sua sessão expirou ou você não é administrador. Entre novamente.");
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                throw new Error(typeof e.detail === "string" ? e.detail : "Dados inválidos para a área.");
            }
            const saved: Area = await r.json();
            await load();
            setForm({ ...saved, quad: saved.quad.map((q) => [...q]) });
            setMsg({ type: "ok", text: "Área salva! Ela já está disponível para os clientes." });
        } catch (e: any) {
            setMsg({ type: "err", text: e.message || "Erro ao salvar." });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!form?.id) return;
        if (!confirm(`Excluir a área "${form.name}"?`)) return;
        const r = await fetch(`/api/personalization/areas/${form.id}`, { method: "DELETE", headers: headers() });
        if (!r.ok) { setMsg({ type: "err", text: "Não foi possível excluir." }); return; }
        await load();
        if (product) setForm(newArea({ ...product, areas: product.areas.filter((a) => a.id !== form.id) }, photo));
        setMsg({ type: "ok", text: "Área excluída." });
    };

    // ── teste com uma arte ──────────────────────────────────────────────────
    const onTestFile = async (f?: File | null) => {
        if (!f) return;
        try { setTestArt((await loadArtFile(f)).canvas); } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    };
    useEffect(() => {
        const cv = previewRef.current, img = imgRef.current;
        if (!cv || !img || !form || !testArt || !img.naturalWidth) return;
        const t = defaultTransform(form, img.naturalWidth, img.naturalHeight, testArt);
        t.curvature = form.curvature;
        const out = renderComposite({ photo: img, photoW: img.naturalWidth, photoH: img.naturalHeight, area: form, art: testArt, t, outWidth: 700 });
        cv.width = out.width; cv.height = out.height;
        cv.getContext("2d")!.drawImage(out, 0, 0);
    }, [form, testArt, photo]);

    const filtered = products.filter((p) => `${p.name} ${p.category || ""}`.toLowerCase().includes(query.toLowerCase()));
    const auto = form && imgRef.current?.naturalWidth ? areaAspect({ ...form, aspect_ratio: null }, imgRef.current.naturalWidth, imgRef.current.naturalHeight) : null;

    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard/personalizacao" />
            <main className={dash.mainContent} style={{ flex: 1, overflowY: "auto" }}>
                <header className={dash.header}>
                    <h1>Personalização de Produtos</h1>
                </header>
                <p className={styles.intro}>
                    Marque, sobre a fotografia original, a área onde o cliente poderá aplicar a arte (rótulo, caixa, sacola…). A configuração fica salva e é reutilizada no simulador <strong>Personalize seu Produto</strong>.
                </p>
                {msg && <div className={msg.type === "ok" ? styles.ok : styles.err} role="status">{msg.text}</div>}

                <div className={styles.layout}>
                    <aside className={styles.list}>
                        <label className={styles.search}><Search size={16} /><input placeholder="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                        {loading && <p>Carregando…</p>}
                        {filtered.map((p) => (
                            <button key={p.id} type="button" className={`${styles.item} ${p.id === selId ? styles.itemOn : ""}`} onClick={() => selectProduct(p)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.photos[0]} alt="" />
                                <span><strong>{p.name}</strong><small>{p.customizable ? `${p.areas.length} área(s) · ${p.areas.some((a) => a.is_active) ? "ativo" : "inativo"}` : "Sem área configurada"}</small></span>
                            </button>
                        ))}
                    </aside>

                    <section className={styles.editor}>
                        {!product || !form ? (
                            <div className={styles.placeholder}><ImagePlus size={36} /><p>Escolha um produto na lista para marcar a área personalizável.</p></div>
                        ) : (
                            <>
                                <h2>{product.name}</h2>
                                {product.photos.length > 1 && (
                                    <div className={styles.photos}>
                                        {product.photos.map((u) => (
                                            <button key={u} type="button" className={u === photo ? styles.photoOn : ""} onClick={() => selectPhoto(u)}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={u} alt="" />
                                                {product.areas.some((a) => a.image_url === u) && <i>✓</i>}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.areaTabs}>
                                    {areasOnPhoto.map((a) => (
                                        <button key={a.id} type="button" className={a.id === form.id ? styles.tabOn : ""} onClick={() => selectArea(a)}>{a.name}{!a.is_active && " (inativa)"}</button>
                                    ))}
                                    <button type="button" className={styles.tabAdd} onClick={() => setForm(newArea(product, photo))}><Plus size={14} /> Nova área</button>
                                </div>

                                <div
                                    ref={boxRef}
                                    className={`${styles.photoBox} ${picking ? styles.picking : ""}`}
                                    onPointerMove={onMove}
                                    onPointerUp={endDrag}
                                    onPointerCancel={endDrag}
                                    onClick={pickColor}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img ref={imgRef} src={photo} alt={product.name} crossOrigin="anonymous" draggable={false} onLoad={() => setForm((f) => (f ? { ...f } : f))} />
                                    <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                                        <polygon points={form.quad.map((q) => q.join(",")).join(" ")} onPointerDown={startMove} vectorEffect="non-scaling-stroke" />
                                    </svg>
                                    {form.quad.map((q, i) => (
                                        <div key={i} className={styles.handle} style={{ left: `${q[0] * 100}%`, top: `${q[1] * 100}%` }} onPointerDown={startCorner(i)}>
                                            <span>{["↖", "↗", "↘", "↙"][i]}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className={styles.hint}>Arraste os 4 cantos para acompanhar a superfície (perspectiva) ou arraste a área inteira para movê-la.</p>

                                <div className={styles.form}>
                                    <label>Nome da área
                                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
                                    </label>
                                    <label>Curvatura da superfície: {Math.round(form.curvature * 100)}%
                                        <input type="range" min={0} max={1} step={0.01} value={form.curvature} onChange={(e) => setForm({ ...form, curvature: +e.target.value })} />
                                        <small>0% = plano (caixas, sacolas) · 100% = cilindro (frascos).</small>
                                    </label>
                                    <label>Proporção real da área (largura ÷ altura)
                                        <input type="number" step="0.05" min="0.1" max="20" placeholder={auto ? `Automática (${auto.toFixed(2)})` : "Automática"} value={form.aspect_ratio ?? ""} onChange={(e) => setForm({ ...form, aspect_ratio: e.target.value ? +e.target.value : null })} />
                                        <small>Deixe vazio para calcular pela marcação. Informe se a arte parecer esticada.</small>
                                    </label>
                                    <div className={styles.row}>
                                        <label className={styles.check}><input type="checkbox" checked={form.cover_label} onChange={(e) => setForm({ ...form, cover_label: e.target.checked })} /> Cobrir o rótulo original</label>
                                        {form.cover_label && (
                                            <div className={styles.colorRow}>
                                                <input type="color" value={form.base_color || "#e8e8e8"} onChange={(e) => setForm({ ...form, base_color: e.target.value })} aria-label="Cor da superfície" />
                                                <button type="button" onClick={() => setPicking(!picking)} className={picking ? styles.pickOn : ""}><Pipette size={14} /> {picking ? "Clique na foto" : "Pegar cor da foto"}</button>
                                                {form.base_color && <button type="button" onClick={() => setForm({ ...form, base_color: null })}>Automática</button>}
                                            </div>
                                        )}
                                    </div>
                                    <label className={styles.check}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Personalização ativa para os clientes</label>
                                </div>

                                <div className={styles.buttons}>
                                    <button type="button" className="btn-primary" onClick={save} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Save size={16} /> {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Salvar área"}</button>
                                    {form.id && <button type="button" className={styles.danger} onClick={remove}><Trash2 size={16} /> Excluir área</button>}
                                </div>

                                <div className={styles.test}>
                                    <h3>Testar com uma arte</h3>
                                    <p>Envie um logotipo para ver como a área marcada se comporta (não é salvo).</p>
                                    <input type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" onChange={(e) => onTestFile(e.target.files?.[0])} />
                                    {testArt && <canvas ref={previewRef} className={styles.testCanvas} />}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </main>
        </AdminLayout>
    );
}
