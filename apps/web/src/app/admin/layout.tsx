import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
