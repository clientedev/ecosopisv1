"use client";
import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";

export default function AdminSubscriptionsPage() {
    const [subs, setSubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubs = async () => {
            const token = localStorage.getItem("token");
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            try {
                const res = await fetch(`${apiUrl}/orders/admin/subscriptions`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) setSubs(await res.json());
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubs();
    }, []);

    return (
        <main>
            <Header />
            <div className="container" style={{ padding: '50px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h1>GERENCIAMENTO DE ASSINATURAS</h1>
                    <Link href="/admin/dashboard" className="btn-outline">VOLTAR</Link>
                </div>
                {loading ? <p>Carregando...</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px' }}>
                        <thead style={{ backgroundColor: '#f4f4f4' }}>
                            <tr>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Cliente</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Plano</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Valor</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '15px', textAlign: 'left' }}>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subs.map((s) => (
                                <tr key={s.id}>
                                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{s.user_email}</td>
                                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{s.plan_name}</td>
                                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>R$ {s.price?.toFixed(2)}</td>
                                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                                        <span style={{ padding: '5px 10px', borderRadius: '20px', backgroundColor: '#d4edda', color: '#155724' }}>
                                            {s.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <Footer />
        </main>
    );
}
