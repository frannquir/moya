"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function EjecutadosSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  function update(next: string) {
    setValue(next);
    const url = new URLSearchParams(params.toString());
    if (next.trim()) url.set("q", next.trim());
    else url.delete("q");
    url.delete("page"); // reset to page 1 when filter changes
    startTransition(() => {
      router.push(`?${url.toString()}`);
    });
  }

  return (
    <div className="relative max-w-sm">
      <Input
        placeholder="Buscar por nombre…"
        value={value}
        onChange={(e) => update(e.target.value)}
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}