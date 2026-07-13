"use client";

import type { ApprovalMode, CurrencyCode } from "@prisma/client";
import { ImagePlus, Redo2, Save, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { updateBusinessSettings } from "@/domains/settings/actions/update-business-settings";
import { uploadLogoAction } from "@/domains/settings/actions/upload-logo";

type SettingsFormProps = {
  settings: {
    businessName: string;
    arabicBusinessName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    vatNumber: string | null;
    commercialRegistration: string | null;
    logoPath: string | null;
    footer: string | null;
    termsAndConditions: string | null;
    defaultCurrency: CurrencyCode;
    timezone: string;
    invoicePrefix: string;
    approvalMode: ApprovalMode;
    documentLanguage: string;
  };
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoPath ? `/api/${settings.logoPath}` : null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await updateBusinessSettings({
        businessName: String(formData.get("businessName") ?? ""),
        arabicBusinessName: String(formData.get("arabicBusinessName") ?? ""),
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        website: String(formData.get("website") ?? ""),
        vatNumber: String(formData.get("vatNumber") ?? ""),
        commercialRegistration: String(formData.get("commercialRegistration") ?? ""),
        footer: String(formData.get("footer") ?? ""),
        termsAndConditions: String(formData.get("termsAndConditions") ?? ""),
        defaultCurrency: String(formData.get("defaultCurrency") ?? ""),
        timezone: String(formData.get("timezone") ?? ""),
        invoicePrefix: String(formData.get("invoicePrefix") ?? ""),
        approvalMode: String(formData.get("approvalMode") ?? "SELF"),
        documentLanguage: String(formData.get("documentLanguage") ?? "bilingual"),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to update settings.");
        return;
      }

      setMessage("Settings saved.");
    });
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.set("logo", file);

    setMessage(null);
    const result = await uploadLogoAction(fd);

    if (!result.ok) {
      setMessage(result.message ?? "Failed to upload logo.");
      return;
    }

    if (result.logoPath) {
      setLogoPreview(`/api/${result.logoPath}`);
    }

    setMessage("Logo uploaded.");
  }

  function handleRemoveLogo() {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={handleSubmit} className="max-w-3xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Company Branding</h2>
        <div className="rounded-lg border p-5">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Company Logo</span>
            <p className="text-xs text-muted-foreground">PNG or JPEG, max 2MB. Recommended size: 300x100px.</p>
          </label>
          <div className="mt-3 flex items-center gap-4">
            {logoPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL not supported by next/image */}
                <img src={logoPreview} alt="Logo" className="max-h-16 max-w-48 rounded border object-contain" />
                <button type="button" onClick={handleRemoveLogo} className="absolute -right-2 -top-2 rounded-full bg-red-100 p-0.5 text-red-600 hover:bg-red-200">
                  <Trash2 className="size-3" />
                </button>
              </div>
            ) : (
              <div className="flex h-16 w-48 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-muted">
              <ImagePlus className="size-4" />
              Upload
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Company Name (English)</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.businessName} name="businessName" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Company Name (Arabic)</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.arabicBusinessName ?? ""} name="arabicBusinessName" dir="rtl" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Address</span>
            <textarea className="h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" defaultValue={settings.address ?? ""} name="address" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Phone</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.phone ?? ""} name="phone" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Email</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.email ?? ""} name="email" type="email" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Website</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.website ?? ""} name="website" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">VAT / Tax Number</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.vatNumber ?? ""} name="vatNumber" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Commercial Registration</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.commercialRegistration ?? ""} name="commercialRegistration" />
          </label>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Footer Text</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.footer ?? ""} name="footer" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Terms &amp; Conditions</span>
          <textarea className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" defaultValue={settings.termsAndConditions ?? ""} name="termsAndConditions" />
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Document Settings</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Default currency</span>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.defaultCurrency} name="defaultCurrency">
              <option value="KWD">KWD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Invoice prefix</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none transition focus:border-primary" defaultValue={settings.invoicePrefix} name="invoicePrefix" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Timezone</span>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.timezone} name="timezone" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Document Language</span>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary" defaultValue={settings.documentLanguage} name="documentLanguage">
              <option value="bilingual">Bilingual (Arabic + English)</option>
              <option value="english">English Only</option>
              <option value="arabic">Arabic Only</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Approval Workflow</h2>
        <p className="text-sm text-muted-foreground">Controls whether the same user can approve their own Purchase Orders and Sales Orders.</p>
        <label className="flex items-center gap-3 rounded-lg border p-4 has-[:checked]:border-primary">
          <input className="size-4 accent-primary" defaultChecked={settings.approvalMode === "SELF"} name="approvalMode" type="radio" value="SELF" />
          <div>
            <span className="text-sm font-medium">Self Approval</span>
            <p className="text-xs text-muted-foreground">The creator may approve their own documents.</p>
          </div>
        </label>
        <label className="flex items-center gap-3 rounded-lg border p-4 has-[:checked]:border-primary">
          <input className="size-4 accent-primary" defaultChecked={settings.approvalMode === "DUAL"} name="approvalMode" type="radio" value="DUAL" />
          <div>
            <span className="text-sm font-medium">Dual Approval</span>
            <p className="text-xs text-muted-foreground">A different user must approve documents (recommended for separation of duties).</p>
          </div>
        </label>
      </section>

      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("wbos-onboarding-dismissed");
            window.location.href = "/";
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <Redo2 className="size-3.5" />
          Reopen setup wizard
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          Show the getting-started checklist on the dashboard.
        </p>
      </div>

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
