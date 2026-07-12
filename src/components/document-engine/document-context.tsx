"use client";

import { createContext, useContext } from "react";

import type { LanguageMode } from "./document-translations";

export type BrandingData = {
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
  documentLanguage: string;
};

type DocumentContextValue = {
  branding: BrandingData;
  language: LanguageMode;
  documentTitle: string;
  documentNumber: string;
};

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({
  branding,
  documentTitle,
  documentNumber,
  children,
}: {
  branding: BrandingData;
  documentTitle: string;
  documentNumber: string;
  children: React.ReactNode;
}) {
  const language = (branding.documentLanguage ?? "bilingual") as LanguageMode;

  return (
    <DocumentContext value={{ branding, language, documentTitle, documentNumber }}>
      {children}
    </DocumentContext>
  );
}

export function useDocument() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error("useDocument must be used within DocumentProvider");
  return ctx;
}
