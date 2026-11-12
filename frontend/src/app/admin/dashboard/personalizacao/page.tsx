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
    auto?: boolean;
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
interface Product { id: number; name: string; category: string | null; photos: string[]; areas: Area[]; customizable: boolean; configured: boolean; simulator_only: boolean }

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
    const [adding, setAdding] = useState(false);
    const [drawing, setDrawing] = useState(false);
    const [testArt, setTestArt] = useState<HTMLCanvasElement | null>(null);

    const boxRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const previewRef = useRef<HTMLCanvasElement | null>(null);
    const drag = useRef<{ kind: "corner"; i: number } | { kind: "move"; start: [number, number]; quad: number[][] } | { kind: "draw"; start: [number, number] } | null>(null);

    const token = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/personalization/products?include_inactive_areas=true");
            if (!r.ok) throw new Error();
            const list: Product[] = await r.json();
            setProducts(list);
            return list;
        } catch {
            setMsg({ type: "err", text: "Não foi possível carregar os produtos." });
            return null;
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const product = useMemo(() => products.find((p) => p.id === selId) || null, [products, selId]);
    const areasOnPhoto = useMemo(() => (product ? product.areas.filter((a) => a.image_url === photo && !a.auto) : []), [product, photo]);
    const autoOnPhoto = useMemo(() => (product ? product.areas.find((a) => a.image_url === photo && a.auto) || null : null), [product, photo]);

    const newArea = (p: Product, url: string): Area => {
        const saved = p.areas.filter((a) => a.image_url === url && !a.auto).length;
        const sug = p.areas.find((a) => a.image_url === url && a.auto);
        return {
            product_id: p.id, image_url: url, name: saved ? `Área ${saved + 1}` : "Área principal",
            is_active: true, quad: (sug ? sug.quad : DEFAULT_QUAD).map((q) => [...q]), curvature: sug ? sug.curvature : 0,
            aspect_ratio: null, cover_label: false, base_color: null,
        };
    };

    const presetArea = (p: Product, url: string, kind: "flat" | "round"): Area => {
        const n = p.areas.filter((a) => a.image_url === url && !a.auto).length;
        const w = kind === "round" ? 0.2 : 0.26, h = kind === "round" ? 0.3 : 0.26;
        const x = Math.min(0.95 - w, 0.08 + (n % 3) * 0.3), y = Math.min(0.95 - h, 0.3 + Math.floor(n / 3) * 0.32);
        return {
            product_id: p.id, image_url: url, name: `${kind === "round" ? "Frasco" : "Caixa / sacola"} ${n + 1}`, is_active: true,
            quad: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], curvature: kind === "round" ? 0.55 : 0, aspect_ratio: null, cover_label: false, base_color: null,
        };
    };

    const selectProduct = (p: Product) => {
        setSelId(p.id);
        const url = p.photos.find((u) => p.areas.some((a) => a.image_url === u && !a.auto)) || p.photos[0];
        setPhoto(url);
        const existing = p.areas.find((a) => a.image_url === url && !a.auto);
        setForm(existing ? { ...existing, quad: existing.quad.map((q) => [...q]) } : newArea(p, url));
        setMsg(null);
    };
    const selectPhoto = (url: string) => {
        if (!product) return;
        setPhoto(url);
        const existing = product.areas.find((a) => a.image_url === url && !a.auto);
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
        if (d.kind === "draw") {
            const x0 = Math.min(d.start[0], p[0]), x1 = Math.max(d.start[0], p[0]), y0 = Math.min(d.start[1], p[1]), y1 = Math.max(d.start[1], p[1]);
            if (x1 - x0 > 0.01 && y1 - y0 > 0.01) setForm({ ...form, quad: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
        } else if (d.kind === "corner") {
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
    const endDrag = () => { if (drag.current?.kind === "draw") setDrawing(false); drag.current = null; };
    const startDraw = (e: React.PointerEvent) => {
        if (!drawing || !form) return;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        drag.current = { kind: "draw", start: norm(e) };
    };

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
    const save = async (next?: "flat" | "round") => {
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
            const list = await load();
            const prod = list?.find((p) => p.id === form.product_id);
            if (next && prod) {
                setForm(presetArea(prod, form.image_url, next));
                setMsg({ type: "ok", text: `"${saved.name}" salva! Marque agora o próximo produto desta foto.` });
            } else {
                setForm({ ...saved, quad: saved.quad.map((q) => [...q]) });
                setMsg({ type: "ok", text: "Área salva! Ela já está disponível para os clientes." });
            }
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

    const addItem = async (f?: File | null) => {
        if (!f) return;
        const name = (window.prompt("Nome do item (ex.: Sacola kraft Ecosopis):", f.name.replace(/\.[^.]+$/, "")) || "").trim();
        if (!name) return;
        setAdding(true);
        setMsg(null);
        try {
            const fd = new FormData();
            fd.append("file", f);
            const up = await fetch("/api/images/upload", { method: "POST", headers: { Authorization: `Bearer ${token()}` }, body: fd });
            if (!up.ok) throw new Error(up.status === 401 || up.status === 403 ? "Sua sessão expirou. Entre novamente no admin." : "Não foi possível enviar a foto.");
            const { url } = await up.json();
            const r = await fetch("/api/personalization/items", { method: "POST", headers: headers(), body: JSON.stringify({ name, image_url: url }) });
            if (!r.ok) throw new Error("Não foi possível cadastrar o item.");
            const item = await r.json();
            const r2 = await fetch("/api/personalization/products?include_inactive_areas=true");
            const list: Product[] = await r2.json();
            setProducts(list);
            const created = list.find((p) => p.id === item.id);
            if (created) selectProduct(created);
            setMsg({ type: "ok", text: `"${name}" adicionado! Já está disponível no simulador; ajuste a posição abaixo se quiser.` });
        } catch (e: any) {
            setMsg({ type: "err", text: e.message || "Erro ao adicionar." });
        } finally {
            setAdding(false);
        }
    };

    const uploadPhoto = async (f: File): Promise<string> => {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch("/api/images/upload", { method: "POST", headers: { Authorization: `Bearer ${token()}` }, body: fd });
        if (!up.ok) throw new Error(up.status === 401 || up.status === 403 ? "Sua sessão expirou. Entre novamente no admin." : "Não foi possível enviar a foto.");
        return (await up.json()).url;
    };
    const patchItem = async (body: object, okText: string, selectPhotoUrl?: string) => {
        if (!product) return;
        setAdding(true);
        setMsg(null);
        try {
            const r = await fetch(`/api/personalization/items/${product.id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                throw new Error(typeof e.detail === "string" ? e.detail : "Não foi possível salvar a alteração.");
            }
            const info = await r.json();
            const list = await load();
            const p = list?.find((x) => x.id === product.id);
            if (p) {
                setSelId(p.id);
                const url = selectPhotoUrl && p.photos.includes(selectPhotoUrl) ? selectPhotoUrl : p.photos[0];
                setPhoto(url);
                const existing = p.areas.find((a) => a.image_url === url && !a.auto);
                setForm(existing ? { ...existing, quad: existing.quad.map((q) => [...q]) } : newArea(p, url));
            }
            setMsg({ type: "ok", text: okText });
            return info;
        } catch (e: any) {
            setMsg({ type: "err", text: e.message || "Erro ao salvar." });
        } finally {
            setAdding(false);
        }
    };
    const renameItem = () => {
        const n = (window.prompt("Novo nome do item:", product?.name || "") || "").trim();
        if (n && n !== product?.name) patchItem({ name: n }, "Nome atualizado.");
    };
    const addPhotoToItem = async (f?: File | null) => {
        if (!f) return;
        try { const url = await uploadPhoto(f); await patchItem({ add_photo: url }, "Foto adicionada.", url); } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    };
    const replacePhotoOfItem = async (f?: File | null) => {
        if (!f) return;
        try { const url = await uploadPhoto(f); await patchItem({ replace_photo: { old_url: photo, new_url: url } }, "Foto trocada (as áreas marcadas foram mantidas).", url); } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    };
    const removePhotoOfItem = () => {
        if (!confirm("Remover esta foto do item? As áreas marcadas nela serão apagadas.")) return;
        patchItem({ remove_photo: photo }, "Foto removida.");
    };

    const removeItem = async () => {
        if (!product?.simulator_only) return;
        if (!confirm(`Remover "${product.name}" do simulador? Isso apaga as áreas dele.`)) return;
        const r = await fetch(`/api/personalization/items/${product.id}`, { method: "DELETE", headers: headers() });
        if (!r.ok) { setMsg({ type: "err", text: "Não foi possível remover." }); return; }
        setSelId(null); setForm(null);
        await load();
        setMsg({ type: "ok", text: "Item removido." });
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
                    <strong>Todos os produtos já funcionam no simulador</strong>, com uma posição sugerida automaticamente. Use esta tela só para deixar a posição mais precisa (opcional) ou para adicionar itens que não estão na loja, como a sacola.
                </p>
                {msg && <div className={msg.type === "ok" ? styles.ok : styles.err} role="status">{msg.text}</div>}

                <div className={styles.addItem}>
                    <label className={styles.addBtn}>
                        <Plus size={16} /> {adding ? "Enviando…" : "Adicionar sacola / embalagem"}
                        <input type="file" accept="image/*" hidden disabled={adding} onChange={(e) => { addItem(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    <small>Envie a foto de um item que não está na loja (ex.: sacola kraft). Ele aparece só no simulador e já fica pronto para uso.</small>
                </div>

                <div className={styles.layout}>
                    <aside className={styles.list}>
                        <label className={styles.search}><Search size={16} /><input placeholder="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                        {loading && <p>Carregando…</p>}
                        {filtered.map((p) => (
                            <button key={p.id} type="button" className={`${styles.item} ${p.id === selId ? styles.itemOn : ""}`} onClick={() => selectProduct(p)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.photos[0]} alt="" />
                                <span><strong>{p.name}</strong><small>{p.simulator_only ? "Item do simulador · " : ""}{p.configured ? `${p.areas.filter((a) => !a.auto).length} área(s) ajustada(s)` : "Já funciona · posição automática"}</small></span>
                            </button>
                        ))}
                    </aside>

                    <section className={styles.editor}>
                        {!product || !form ? (
                            <div className={styles.placeholder}><ImagePlus size={36} /><p>Escolha um produto na lista para marcar a área personalizável.</p></div>
                        ) : (
                            <>
                                <h2>{product.name} {product.simulator_only && <button type="button" className={styles.danger} onClick={removeItem} style={{ marginLeft: 12, fontSize: 13 }}><Trash2 size={14} /> Remover item</button>}</h2>
                                {product.simulator_only && (
                                    <div className={styles.itemTools}>
                                        <button type="button" onClick={renameItem} disabled={adding}>Renomear</button>
                                        <label>Adicionar foto<input type="file" accept="image/*" hidden disabled={adding} onChange={(e) => { addPhotoToItem(e.target.files?.[0]); e.target.value = ""; }} /></label>
                                        <label>Trocar esta foto<input type="file" accept="image/*" hidden disabled={adding} onChange={(e) => { replacePhotoOfItem(e.target.files?.[0]); e.target.value = ""; }} /></label>
                                        {product.photos.length > 1 && <button type="button" onClick={removePhotoOfItem} disabled={adding}>Remover esta foto</button>}
                                    </div>
                                )}
                                {product.photos.length > 1 && (
                                    <div className={styles.photos}>
                                        {product.photos.map((u) => (
                                            <button key={u} type="button" className={u === photo ? styles.photoOn : ""} onClick={() => selectPhoto(u)}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={u} alt="" />
                                                {product.areas.some((a) => a.image_url === u && !a.auto) && <i>✓</i>}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.areaTabs}>
                                    {areasOnPhoto.map((a) => (
                                        <button key={a.id} type="button" className={a.id === form.id ? styles.tabOn : ""} onClick={() => selectArea(a)}>{a.name}{!a.is_active && " (inativa)"}</button>
                                    ))}
                                    <button type="button" className={styles.tabAdd} onClick={() => setForm(presetArea(product, photo, "round"))}><Plus size={14} /> Frasco (curvo)</button>
                                    <button type="button" className={styles.tabAdd} onClick={() => setForm(presetArea(product, photo, "flat"))}><Plus size={14} /> Caixa / sacola (plano)</button>
                                    <button type="button" className={`${styles.tabAdd} ${drawing ? styles.tabOn : ""}`} onClick={() => setDrawing(!drawing)}>✏ {drawing ? "Arraste sobre a foto…" : "Desenhar na foto"}</button>
                                </div>

                                <div
                                    ref={boxRef}
                                    className={`${styles.photoBox} ${picking ? styles.picking : ""}`}
                                    style={drawing ? { cursor: "crosshair", touchAction: "none" } : undefined}
                                    onPointerDown={startDraw}
                                    onPointerMove={onMove}
                                    onPointerUp={endDrag}
                                    onPointerCancel={endDrag}
                                    onClick={pickColor}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img ref={imgRef} src={photo} alt={product.name} crossOrigin="anonymous" draggable={false} onLoad={() => setForm((f) => (f ? { ...f } : f))} />
                                    {areasOnPhoto.filter((a) => a.id !== form.id).map((a) => (
                                        <button key={a.id} type="button" className={styles.otherArea} onClick={(e) => { e.stopPropagation(); selectArea(a); }}
                                            style={{ left: `${Math.min(...a.quad.map((q) => q[0])) * 100}%`, top: `${Math.min(...a.quad.map((q) => q[1])) * 100}%`, width: `${(Math.max(...a.quad.map((q) => q[0])) - Math.min(...a.quad.map((q) => q[0]))) * 100}%`, height: `${(Math.max(...a.quad.map((q) => q[1])) - Math.min(...a.quad.map((q) => q[1]))) * 100}%` }}>
                                            <span>{a.name}</span>
                                        </button>
                                    ))}
                                    <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={drawing ? { pointerEvents: "none" } : undefined}>
                                        <polygon points={form.quad.map((q) => q.join(",")).join(" ")} onPointerDown={startMove} vectorEffect="non-scaling-stroke" />
                                    </svg>
                                    {form.quad.map((q, i) => (
                                        <div key={i} className={styles.handle} style={{ left: `${q[0] * 100}%`, top: `${q[1] * 100}%`, ...(drawing ? { pointerEvents: "none" as const } : {}) }} onPointerDown={startCorner(i)}>
                                            <span>{["↖", "↗", "↘", "↙"][i]}</span>
                                        </div>
                                    ))}
                                </div>
                                {!form.id && autoOnPhoto && !areasOnPhoto.length && <p className={styles.hint} style={{ fontWeight: 600 }}>✔ Este produto já está liberado para os clientes com esta posição sugerida. Só ajuste e salve se quiser deixar mais precisa.</p>}
                                <p className={styles.hint}>Várias coisas na mesma foto (ex.: frasco + sacola + caixa)? Use os botões acima ou "Desenhar na foto", arraste sobre o produto e salve. Cantos = perspectiva; arrastar o interior move a área.</p>

                                <div className={styles.form}>
                                    <label>Nome da área (qual produto é este?)
                                        <input list="nomes-area" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
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

                                <datalist id="nomes-area"><option value="Frasco" /><option value="Sacola" /><option value="Caixa" /><option value="Sabonete" /><option value="Óleo essencial" /><option value="Cartinha" /></datalist>
                                <div className={styles.buttons}>
                                    <button type="button" className="btn-primary" onClick={() => save()} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Save size={16} /> {saving ? "Salvando…" : form.id ? "Salvar alterações" : autoOnPhoto && !areasOnPhoto.length ? "Salvar esta posição" : "Salvar área"}</button>
                                    <button type="button" className={styles.secondary} onClick={() => save("round")} disabled={saving}><Plus size={16} /> Salvar e marcar outro produto</button>
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
