import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AddProductForm } from "@/components/admin/add-product-form";
import { LogoutButton } from "@/components/logout-button";
import { isAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <p className="text-sm text-zinc-500">Loading…</p>
    </div>
  );
}

async function AdminContent() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isAdminEmail(user.email)) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="flex justify-end border-b border-zinc-800 px-4 py-3">
        <LogoutButton />
      </header>
      <AddProductForm />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminContent />
    </Suspense>
  );
}
