"use client";
import { useState, useEffect } from "react";
import styles from "./Admin.module.css";
import Header from "@/components/Header/Header";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("produtos");

  return (
    <main>
      <Header />
      <div className={styles.adminContainer}>
        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>ADMIN</h2>
          <button 
            className={`${styles.navBtn} ${activeTab === 'dashboard' ? styles.active : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`${styles.navBtn} ${activeTab === 'produtos' ? styles.active : ''}`}
            onClick={() => setActiveTab('produtos')}
          >
            Produtos
          </button>
          <button 
            className={`${styles.navBtn} ${activeTab === 'pedidos' ? styles.active : ''}`}
            onClick={() => setActiveTab('pedidos')}
          >
            Pedidos
          </button>
          <button 
            className={`${styles.navBtn} ${activeTab === 'clientes' ? styles.active : ''}`}
            onClick={() => setActiveTab('clientes')}
          >
            Clientes
          </button>
        </aside>

        <section className={styles.content}>
          <header className={styles.contentHeader}>
            <h1 className={styles.title}>{activeTab.toUpperCase()}</h1>
            {activeTab === 'produtos' && (
              <button className="btn-primary">+ NOVO PRODUTO</button>
            )}
          </header>

          <div className={styles.tableWrapper}>
            {/* Simple Dynamic Table Placeholder */}
            {activeTab === 'produtos' ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>PREÇO</th>
                    <th>ESTOQUE</th>
                    <th>CANAIS</th>
                    <th>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Sérum Facial Antioxidante</td>
                    <td>R$ 89,90</td>
                    <td>50</td>
                    <td>Site, ML, SH</td>
                    <td>
                      <button className={styles.editBtn}>Editar</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                Dados de {activeTab} carregando...
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
