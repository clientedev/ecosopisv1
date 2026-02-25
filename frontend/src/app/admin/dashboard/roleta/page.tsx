"use client";
import React, { useState, useEffect } from "react";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "./roleta.module.css";
import { useRouter } from "next/navigation";

export default function AdminRoulettePage() {
    const [config, setConfig] = useState<any>(null);
    const [prizes, setPrizes] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [isAddingPrize, setIsAddingPrize] = useState(false);
    const [editingPrize, setEditingPrize] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchAll = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }

        try {
            const [configRes, prizesRes, historyRes] = await Promise.all([
                fetch("/api/roleta/config"),
                fetch("/api/admin/roleta/prizes", { headers: { "Authorization": `Bearer ${token}` } }),
                fetch("/api/admin/roleta/history", { headers: { "Authorization": `Bearer ${token}` } })
            ]);

            if (configRes.ok) setConfig(await configRes.json());
            if (prizesRes.ok) setPrizes(await prizesRes.json());
            if (historyRes.ok) setHistory(await historyRes.json());
        } catch (error) {
            console.error("Error fetching roulette data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleConfigUpdate = async (updates: any) => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch("/api/admin/roleta/config", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                setConfig(await res.json());
            }
        } catch (error) {
            alert("Erro ao atualizar configuração");
        }
    };

    const handleSavePrize = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("token");
        const formData = new FormData(e.target as HTMLFormElement);
        const data = {
            nome: formData.get("nome"),
            descricao: formData.get("descricao"),
            ativo: formData.get("ativo") === "on",
            selecionado_para_sair: formData.get("selecionado_para_sair") === "on",
            quantidade_disponivel: formData.get("quantidade_disponivel") ? parseInt(formData.get("quantidade_disponivel") as string) : null,
            discount_type: formData.get("discount_type"),
            discount_value: formData.get("discount_value") ? parseFloat(formData.get("discount_value") as string) : null
        };

        try {
            const url = editingPrize ? `/api/admin/roleta/prizes/${editingPrize.id}` : "/api/admin/roleta/prizes";
            const method = editingPrize ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                setIsAddingPrize(false);
                setEditingPrize(null);
                fetchAll();
            } else {
                const errorData = await res.json();
                alert(`Erro ao salvar prêmio: ${errorData.detail || "Erro desconhecido"}`);
            }
        } catch (error) {
            console.error("Save prize error:", error);
            alert("Erro de conexão ao salvar prêmio");
        }
    };

    const handleDeletePrize = async (id: number) => {
        if (!confirm("Tem certeza que deseja remover este prêmio?")) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/admin/roleta/prizes/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) fetchAll();
        } catch (error) {
            alert("Erro ao deletar prêmio");
        }
    };

    if (loading) return <div>Carregando...</div>;

    return (
        <div style={{ display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/roleta" />
            <main className={styles.container}>
                <header className={styles.header}>
                    <h1>⚙️ Gerenciar Roleta Promocional</h1>
                    <button className="btn-primary" onClick={() => setIsAddingPrize(true)}>
                        + Novo Prêmio
                    </button>
                </header>

                {/* System Config */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Configurações do Sistema</h2>
                    <div className={styles.configGrid}>
                        <div className={styles.toggleCard}>
                            <div className={styles.toggleLabel}>
                                <strong>Roleta Ativa</strong>
                                <small>Habilita/Desabilita o sistema de roleta</small>
                            </div>
                            <input
                                type="checkbox"
                                checked={config?.ativa}
                                onChange={(e) => handleConfigUpdate({ ativa: e.target.checked })}
                            />
                        </div>
                        <div className={styles.toggleCard}>
                            <div className={styles.toggleLabel}>
                                <strong>Exibir Pop-up</strong>
                                <small>Mostra a roleta automaticamente para elegíveis</small>
                            </div>
                            <input
                                type="checkbox"
                                checked={config?.popup_ativo}
                                onChange={(e) => handleConfigUpdate({ popup_ativo: e.target.checked })}
                            />
                        </div>
                        <div className={styles.toggleCard}>
                            <div className={styles.toggleLabel}>
                                <strong>Regra: Novo Usuário</strong>
                                <small>Ganha giro ao se cadastrar</small>
                            </div>
                            <input
                                type="checkbox"
                                checked={config?.regra_novo_usuario}
                                onChange={(e) => handleConfigUpdate({ regra_novo_usuario: e.target.checked })}
                            />
                        </div>
                        <div className={styles.toggleCard}>
                            <div className={styles.toggleLabel}>
                                <strong>Regra: 5 Compras</strong>
                                <small>Ganha giro ao atingir 5 pedidos</small>
                            </div>
                            <input
                                type="checkbox"
                                checked={config?.regra_5_compras}
                                onChange={(e) => handleConfigUpdate({ regra_5_compras: e.target.checked })}
                            />
                        </div>
                    </div>
                </section>

                {/* Prize Management */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Prêmios Configuráveis</h2>
                    <table className={styles.prizeTable}>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Status</th>
                                <th>Drop</th>
                                <th>Desconto</th>
                                <th>Estoque</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prizes.map((prize) => (
                                <tr key={prize.id}>
                                    <td>
                                        <strong>{prize.nome}</strong><br />
                                        <small>{prize.descricao}</small>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${prize.ativo ? styles.badgeActive : styles.badgeInactive}`}>
                                            {prize.ativo ? "ATIVO" : "INATIVO"}
                                        </span>
                                    </td>
                                    <td>
                                        {prize.selecionado_para_sair && (
                                            <span className={`${styles.badge}`} style={{ background: '#3b82f6', color: 'white' }}>DROP ATIVO</span>
                                        )}
                                    </td>
                                    <td>
                                        {prize.discount_type ? (
                                            <span style={{ fontSize: '0.85rem' }}>
                                                {prize.discount_type === 'percentage' ? `${prize.discount_value}% OFF` : `R$ ${prize.discount_value} OFF`}
                                            </span>
                                        ) : "-"}
                                    </td>
                                    <td>{prize.quantidade_disponivel ?? "∞"}</td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button className={styles.editBtn} onClick={() => {
                                                setEditingPrize(prize);
                                                setIsAddingPrize(true);
                                            }}>Editar</button>
                                            <button className={styles.deleteBtn} onClick={() => handleDeletePrize(prize.id)}>Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {/* Recent History */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Histórico Recente</h2>
                    <div className={styles.historyList}>
                        {history.slice(0, 10).map((h) => (
                            <div key={h.id} className={styles.historyItem}>
                                <span>Usuário #{h.usuario_id}</span>
                                <strong>{h.prize.nome}</strong>
                                <small>{new Date(h.data_giro).toLocaleString('pt-BR')}</small>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Prize Modal */}
                {isAddingPrize && (
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                            <h2>{editingPrize ? "Editar Prêmio" : "Novo Prêmio"}</h2>
                            <form onSubmit={handleSavePrize}>
                                <div className={styles.formGroup}>
                                    <label>Nome do Prêmio</label>
                                    <input name="nome" defaultValue={editingPrize?.nome} required placeholder="Ex: Cupom 10% OFF" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Descrição</label>
                                    <textarea name="descricao" defaultValue={editingPrize?.descricao} placeholder="Detalhes do prêmio" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Estoque (Opcional)</label>
                                    <input type="number" name="quantidade_disponivel" defaultValue={editingPrize?.quantidade_disponivel} placeholder="Deixe vazio para infinito" />
                                </div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div className={styles.formGroup} style={{ flex: 1 }}>
                                        <label>Tipo de Desconto</label>
                                        <select name="discount_type" defaultValue={editingPrize?.discount_type || ""}>
                                            <option value="">Nenhum (Produto Físico)</option>
                                            <option value="percentage">Porcentagem (%)</option>
                                            <option value="fixed">Valor Fixo (R$)</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup} style={{ flex: 1 }}>
                                        <label>Valor do Desconto</label>
                                        <input type="number" step="0.01" name="discount_value" defaultValue={editingPrize?.discount_value} placeholder="Ex: 10.00" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input type="checkbox" name="ativo" defaultChecked={editingPrize ? editingPrize.ativo : true} />
                                        Ativo
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input type="checkbox" name="selecionado_para_sair" defaultChecked={editingPrize?.selecionado_para_sair} />
                                        Selecionado para Sair
                                    </label>
                                </div>
                                <div className={styles.actions}>
                                    <button type="submit" className="btn-primary">SALVAR</button>
                                    <button type="button" className="btn-outline" onClick={() => {
                                        setIsAddingPrize(false);
                                        setEditingPrize(null);
                                    }}>CANCELAR</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
