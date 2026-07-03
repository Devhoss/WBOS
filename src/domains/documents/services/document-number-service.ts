import type { DocumentType } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

type GenerateDocumentNumberInput = {
  organizationId: string;
  documentType: DocumentType;
  year: number;
  prefix: string;
  digits?: number;
  separator?: string;
};

export class DocumentNumberService {
  async generate(input: GenerateDocumentNumberInput) {
    const digits = input.digits ?? 6;
    const separator = input.separator ?? "-";

    const sequence = await prisma.documentSequence.upsert({
      where: {
        organizationId_documentType_year: {
          organizationId: input.organizationId,
          documentType: input.documentType,
          year: input.year,
        },
      },
      update: {
        currentSequence: { increment: 1 },
      },
      create: {
        organizationId: input.organizationId,
        documentType: input.documentType,
        year: input.year,
        prefix: input.prefix,
        digits,
        separator,
        currentSequence: 1,
      },
    });

    return {
      year: sequence.year,
      sequence: sequence.currentSequence,
      documentNumber: [
        sequence.prefix,
        sequence.year,
        String(sequence.currentSequence).padStart(sequence.digits, "0"),
      ].join(sequence.separator),
    };
  }
}
