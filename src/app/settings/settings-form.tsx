"use client";

import type { CurrencyCode } from "@prisma/client";
import { Save } from "lucide-react";
import { useState, useTransition } from "react";

import { updateBusinessSettings } from "@/domains/settings/actions/update-business-settings";

type SettingsFormProps = {
  settings: {
    businessName: string;
    defaultCurrency: CurrencyCode;
    timezone: string;
    invoicePrefix: string;
  };
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await updateBusinessSettings({
        businessName: String(formData.get("businessName") ?? ""),
        defaultCurrency: String(formData.get("defaultCurrency") ?? ""),
        timezone: String(formData.get("timezone") ?? ""),
        invoicePrefix: String(formData.get("invoicePrefix") ?? ""),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to update settings.");
        return;
      }

      setMessage("Settings saved.");
    });
  }

  return (
    <form action={handleSubmit} className="max-w-3xl space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Business name</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
            defaultValue={settings.businessName}
            name="businessName"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Default currency</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
            defaultValue={settings.defaultCurrency}
            name="defaultCurrency"
          >
            <option value="KWD">KWD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Timezone</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
            defaultValue={settings.timezone}
            name="timezone"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Invoice prefix</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none transition focus:border-primary"
            defaultValue={settings.invoicePrefix}
            name="invoicePrefix"
            required
          />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Save className="size-4" />
          {isPending ? "Saving" : "Save"}
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
