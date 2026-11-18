import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: DEFAULT_TITLE },
    description: DEFAULT_DESCRIPTION,
    alternates: { canonical: "/" },
};

export default function Page() {
    return <HomeClient />;
}
