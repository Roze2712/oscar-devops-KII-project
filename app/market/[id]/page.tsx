import { Suspense } from "react";
import ProductPageClient from "./product-page-client";

function ProductPageFallback() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-14">
        <div className="mb-8 h-4 w-48 animate-pulse rounded bg-muted/60" />
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="aspect-[3/4] w-full animate-pulse bg-muted/60" />
          <div className="flex flex-col gap-6 pt-2">
            <div className="h-9 w-3/4 animate-pulse rounded bg-muted/60" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-muted/60" />
            <div className="h-12 w-full animate-pulse rounded bg-muted/60" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<ProductPageFallback />}>
      <ProductPageClient />
    </Suspense>
  );
}
