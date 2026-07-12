"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BarcodeScanInput } from "@/components/barcode-scan-input";
import { lookupProductByBarcode } from "@/domains/products/actions/lookup-product-by-barcode";

export function BarcodeLookup() {
  const [product, setProduct] = useState<{ id: string; sku: string; name: string } | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleScan(barcode: string) {
    setSearched(true);
    const result = await lookupProductByBarcode({ barcode });
    if (result.ok && result.data) {
      setProduct({ id: result.data.id, sku: result.data.sku, name: result.data.name });
    } else {
      setProduct(null);
    }
    return result;
  }

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Barcode Lookup</h2>
      <p className="mt-1 text-xs text-muted-foreground">Scan or type a barcode to find a product instantly.</p>
      <div className="mt-3">
        <BarcodeScanInput placeholder="Scan or type barcode..." onScan={handleScan} autoFocus={false} />
      </div>
      {searched && product ? (
        <div className="mt-3 flex items-center justify-between rounded-md border bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
          <div>
            <span className="font-medium">{product.name}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">{product.sku}</span>
          </div>
          <Link
            href={`/products#product-${product.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View <ExternalLink className="size-3" />
          </Link>
        </div>
      ) : searched && !product ? (
        <p className="mt-3 text-xs text-red-500">Product not found. Check the barcode and try again.</p>
      ) : null}
    </section>
  );
}
