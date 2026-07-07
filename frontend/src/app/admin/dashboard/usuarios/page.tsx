"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css";
import { Mail, Upload, X, Send, Loader2 } from "lucide-react";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Email & Selection States
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [sendToAll, setSendToAll] = useState(true);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    
    const router = useRouter();

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else if (res.status === 401 || res.status === 403) {
                router.push("/admin");
            }
        } catch (error) {
            console.error("Error fetching users:", error);
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
        fetchUsers();
    }, [router]);

    const handlePromoteUser = async (userId: number) => {
        if (!confirm("Tem certeza que deseja promover este usuário a administrador?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users/${userId}/promote`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                alert("Usuário promovido com sucesso!");
                fetchUsers();
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao promover usuário");
            }
        } catch (error) {
            console.error("Error promoting user:", error);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm("Tem certeza que deseja remover este usuário?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users/${userId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                setUsers(users.filter((u: any) => u.id !== userId));
                setSelectedUserIds(prev => prev.filter(id => id !== userId));
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao deletar usuário");
            }
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    const handleToggleRoulette = async (userId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users/${userId}/toggle-roulette`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                fetchUsers();
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao alterar permissão da roleta");
            }
        } catch (error) {
            console.error("Error toggling roulette:", error);
        }
    };

    const filteredUsers = users.filter((u: any) => 
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.phone?.includes(searchTerm)
    );

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = filteredUsers.map((u: any) => u.id);
            setSelectedUserIds(allIds);
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleSelectUser = (userId: number) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim()) {
            alert("Por favor, preencha o assunto do e-mail.");
            return;
        }
        if (!body.trim()) {
            alert("Por favor, preencha o corpo da mensagem.");
            return;
        }
        if (!sendToAll && selectedUserIds.length === 0) {
            alert("Por favor, selecione ao menos um usuário na tabela ou marque a opção 'Todos os usuários'.");
            return;
        }

        const confirmation = sendToAll 
            ? `Tem certeza que deseja enviar este e-mail para TODOS os ${users.length} usuários cadastrados?`
            : `Tem certeza que deseja enviar este e-mail para os ${selectedUserIds.length} usuários selecionados?`;

        if (!confirm(confirmation)) return;

        setSending(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("subject", subject);
            formData.append("body", body);
            formData.append("user_ids", sendToAll ? "all" : JSON.stringify(selectedUserIds));

            attachedFiles.forEach(file => {
                formData.append("files", file);
            });

            const res = await fetch("/api/auth/users/send-email", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || "E-mails colocados na fila de envio com sucesso!");
                setSubject("");
                setBody("");
                setAttachedFiles([]);
                setSelectedUserIds([]);
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao disparar e-mails.");
            }
        } catch (error) {
            console.error("Error sending emails:", error);
            alert("Erro de conexão ao enviar e-mails.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/usuarios" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
                <header className={styles.header}>
                    <h1>Gerenciar Usuários</h1>
                </header>

                {/* ✉️ Painel de Envio de E-mails */}
                <div className={styles.emailCard}>
                    <h2 className={styles.emailTitle}>
                        <Mail size={20} /> Enviar E-mail para Clientes
                    </h2>
                    <form onSubmit={handleSendEmail} className={styles.emailForm}>
                        <div className={styles.recipientToggle}>
                            <label className={styles.radioLabel}>
                                <input 
                                    type="radio" 
                                    name="recipientMode" 
                                    checked={sendToAll} 
                                    onChange={() => setSendToAll(true)} 
                                />
                                Enviar para TODOS os usuários ({users.length})
                            </label>
                            <label className={styles.radioLabel}>
                                <input 
                                    type="radio" 
                                    name="recipientMode" 
                                    checked={!sendToAll} 
                                    onChange={() => setSendToAll(false)} 
                                />
                                Enviar apenas para selecionados ({selectedUserIds.length} selecionados)
                            </label>
                        </div>

                        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <label htmlFor="emailSubject">Assunto do E-mail</label>
                            <input 
                                id="emailSubject"
                                type="text" 
                                placeholder="Digite o assunto do e-mail..." 
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <label htmlFor="emailBody">Mensagem</label>
                            <textarea 
                                id="emailBody"
                                placeholder="Escreva a sua mensagem aqui. Quebras de linha serão preservadas no e-mail..." 
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={6}
                                style={{ width: '100%', fontFamily: 'inherit' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                                Fotos / Imagens Anexas
                            </label>
                            <label className={styles.fileUploadArea}>
                                <Upload size={24} style={{ color: '#2d5a27' }} />
                                <span className={styles.fileUploadText}>
                                    Clique para <strong>anexar fotos</strong> ou arraste-as para cá
                                </span>
                                <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*" 
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>

                            {attachedFiles.length > 0 && (
                                <div className={styles.attachmentList}>
                                    {attachedFiles.map((file, index) => (
                                        <div key={index} className={styles.attachmentBadge}>
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                                {file.name}
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveFile(index)} 
                                                className={styles.removeAttachmentBtn}
                                                title="Remover anexo"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            type="submit" 
                            className={styles.sendBtn}
                            disabled={sending}
                        >
                            {sending ? (
                                <>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    Disparando E-mails...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Disparar E-mails {sendToAll ? `para todos (${users.length})` : `para selecionados (${selectedUserIds.length})`}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3>Total de Clientes</h3>
                        <p>{users.length}</p>
                    </div>
                </div>

                <div style={{ padding: '0 2rem', marginBottom: '1.5rem' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: '#fff', 
                        padding: '10px 20px', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        <span style={{ marginRight: '10px', color: '#64748b' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou WhatsApp..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                border: 'none', 
                                outline: 'none', 
                                width: '100%', 
                                fontSize: '0.95rem',
                                color: '#1e293b'
                            }}
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm("")}
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    color: '#94a3b8',
                                    fontSize: '1.2rem'
                                }}
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th className={styles.checkboxCol}>
                                    <input 
                                        type="checkbox" 
                                        className={styles.checkboxInput}
                                        checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th>ID</th>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>WhatsApp</th>
                                <th>Cargo</th>
                                <th>Roleta</th>
                                <th>Data Cadastro</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user: any) => (
                                <tr key={user.id}>
                                    <td className={styles.checkboxCol} data-label="Selecionar">
                                        <input 
                                            type="checkbox" 
                                            className={styles.checkboxInput}
                                            checked={selectedUserIds.includes(user.id)}
                                            onChange={() => handleSelectUser(user.id)}
                                        />
                                    </td>
                                    <td data-label="ID">{user.id}</td>
                                    <td data-label="Nome"><strong>{user.full_name}</strong></td>
                                    <td data-label="Email">{user.email}</td>
                                    <td data-label="WhatsApp">
                                        {user.phone ? (
                                            <a 
                                                href={`https://wa.me/${user.phone.replace(/\D/g, '')}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '5px', 
                                                    color: '#25D366', 
                                                    fontWeight: 'bold',
                                                    textDecoration: 'none'
                                                }}
                                            >
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.123.544 4.197 1.582 6.033L0 24l6.105-1.602a11.83 11.83 0 005.937 1.598h.005c6.637 0 12.032-5.395 12.034-12.03a11.83 11.83 0 00-3.489-8.452z"/>
                                                </svg>
                                                {user.phone}
                                            </a>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                                        )}
                                    </td>
                                    <td data-label="Cargo">
                                        <span className={`${styles.stockBadge} ${user.role === 'admin' ? styles.stockOk : styles.editBtn}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td data-label="Roleta">
                                        <span className={`${styles.stockBadge} ${user.pode_girar_roleta ? styles.stockOk : styles.deleteBtn}`} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                            {user.pode_girar_roleta ? "DISPONÍVEL" : "BLOQUEADO"}
                                        </span>
                                    </td>
                                    <td data-label="Data Cadastro">{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td data-label="Ações">
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => handleToggleRoulette(user.id)}
                                                style={{ backgroundColor: user.pode_girar_roleta ? '#ef4444' : '#b8860b', color: 'white' }}
                                            >
                                                {user.pode_girar_roleta ? "Remover Giro" : "Liberar Giro"}
                                            </button>
                                            {user.role !== 'admin' && (
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => handlePromoteUser(user.id)}
                                                    style={{ backgroundColor: '#2d5a27', color: 'white' }}
                                                >
                                                    Promover
                                                </button>
                                            )}
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDeleteUser(user.id)}
                                            >
                                                Remover User
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
