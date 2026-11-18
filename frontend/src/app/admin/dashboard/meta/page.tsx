"use client";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AdminLayout from "@/components/AdminLayout/AdminLayout";
import MetaAdsDashboard from "@/components/MetaAdsDashboard/MetaAdsDashboard";
import styles from "../dashboard.module.css";
import biStyles from "../metrics/metrics.module.css";

export default function AdminMetaAdsPage() {
    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/dashboard/meta" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: "auto", background: "#f8fafc" }}>
                <div className={biStyles.metricsContainer}>
                    <MetaAdsDashboard />
                </div>
            </main>
        </AdminLayout>
    );
}
