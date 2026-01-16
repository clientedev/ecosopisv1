"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css";

export default function CouponManagement() {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        code: "",
        discount_type: "percentage",
        discount_value: 0,
        min_purchase_value: 0,
        usage_limit: null,
        valid_until: ""
    });
    const router = useRouter();

    const fetchCoupons = async () => {
        try {
            const token = localStorage.getItem("token");
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/coupons/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCoupons(data);
            }
        } catch (error) {
            console.error("Error fetching coupons:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }
        fetchCoupons();
    }, [router]);

    const handleCreateCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/coupons/`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setIsAdding(false);
                fetchCoupons();
                setFormData({
                    code: "",
                    discount_type: "percentage",
                    discount_value: 0,
                    min_purchase_value: 0,
                    usage_limit: null,
                    valid_until: ""
                });
            }
        } catch (error) {
            console.error("Error creating coupon:", error);
        }
    };

    const handleDeleteCoupon = async (id: number) => {
        if (!confirm("Remover este cupom?")) return;
        try {
            const token = localStorage.getItem("token");
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/coupons/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setCoupons(coupons.filter((c: any) => c.id !== id));
            }
        } catch (error) {
            console.error("Error deleting coupon:", error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/admin");
    };

    return (
        <div className={styles.dashboard}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>ECOSOPIS ADMIN</div>
                <nav>
                    <Link href="/admin/dashboard">Produtos</Link>
                    <Link href="/admin/dashboard/usuarios">Usuários</Link>
                    <Link href="/admin/dashboard/cupons" className={styles.active}>Cupons</Link>
                    <Link href="/">Ver Site</Link>
                    <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
                </nav>
            </aside>
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Cupons</h1>
                    <button className="btn-primary" onClick={() => setIsAdding(true)}>+ Novo Cupom</button>
                </header>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Desconto</th>
                                <th>Min. Compra</th>
                                <th>Uso</th>
                                <th>Expiração</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map((c: any) => (
                                <tr key={c.id}>
                                    <td><strong>{c.code}</strong></td>
                                    <td>{c.discount_type === 'percentage' ? `${c.discount_value}%` : `R$ ${c.discount_value}`}</td>
                                    <td>R$ {c.min_purchase_value}</td>
                                    <td>{c.usage_count} / {c.usage_limit || '∞'}</td>
                                    <td>{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'N/A'}</td>
                                    <td>
                                        <button className={styles.deleteBtn} onClick={() => handleDeleteCoupon(c.id)}>Remover</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {isAdding && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <h2>Novo Cupom</h2>
                            <form onSubmit={handleCreateCoupon}>
                                <div className={styles.formGroup}>
                                    <label>Código do Cupom</label>
                                    <input 
                                        type="text" 
                                        value={formData.code} 
                                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                                        required 
                                    />
                                </div>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Tipo</label>
                                        <select 
                                            value={formData.discount_type} 
                                            onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                                            style={{width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1'}}
                                        >
                                            <option value="percentage">Porcentagem (%)</option>
                                            <option value="fixed">Valor Fixo (R$)</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Valor</label>
                                        <input 
                                            type="number" 
                                            value={formData.discount_value} 
                                            onChange={(e) => setFormData({...formData, discount_value: parseFloat(e.target.value)})} 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Compra Mínima (R$)</label>
                                        <input 
                                            type="number" 
                                            value={formData.min_purchase_value} 
                                            onChange={(e) => setFormData({...formData, min_purchase_value: parseFloat(e.target.value)})} 
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Limite de Uso</label>
                                        <input 
                                            type="number" 
                                            placeholder="Deixe vazio para ilimitado"
                                            onChange={(e) => setFormData({...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null})} 
                                        />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Válido até</label>
                                    <input 
                                        type="datetime-local" 
                                        onChange={(e) => setFormData({...formData, valid_until: e.target.value})} 
                                    />
                                </div>
                                <div className={styles.formActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setIsAdding(false)}>Cancelar</button>
                                    <button type="submit" className="btn-primary">CRIAR CUPOM</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
