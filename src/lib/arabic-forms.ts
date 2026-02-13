import { ArabicRegister, LanguageCode } from "@prisma/client";

export type ArabicForm = "msa" | "syrian";

export const DEFAULT_ARABIC_FORM: ArabicForm = "msa";

export const ARABIC_FORM_TO_REGISTER: Record<ArabicForm, ArabicRegister> = {
  msa: ArabicRegister.MSA,
  syrian: ArabicRegister.SYRIAN,
};

export function parseArabicForm(raw: string | null | undefined): ArabicForm {
  return raw === "syrian" ? "syrian" : DEFAULT_ARABIC_FORM;
}

type LexicalVariantShape = {
  register: ArabicRegister;
  scriptText: string;
  transliteration: string | null;
};

type PrimaryForm = {
  scriptText: string;
  transliteration: string | null;
};

export type ArabicFormsPayload = {
  primary: PrimaryForm;
  secondary: PrimaryForm | null;
};

export function buildArabicForms(args: {
  language: LanguageCode;
  scriptText: string;
  transliteration: string | null;
  lexicalVariants: LexicalVariantShape[];
}): ArabicFormsPayload | null {
  if (args.language !== LanguageCode.AR_MSA) {
    return null;
  }

  const variantByRegister = new Map(
    args.lexicalVariants.map((variant) => [variant.register, variant] as const),
  );

  const msa = variantByRegister.get(ArabicRegister.MSA) ?? {
    register: ArabicRegister.MSA,
    scriptText: args.scriptText,
    transliteration: args.transliteration,
  };

  const syrian = variantByRegister.get(ArabicRegister.SYRIAN) ?? null;

  return {
    primary: {
      scriptText: msa.scriptText,
      transliteration: msa.transliteration,
    },
    secondary: syrian
      ? {
          scriptText: syrian.scriptText,
          transliteration: syrian.transliteration,
        }
      : null,
  };
}

export function resolveArabicTarget(args: {
  language: LanguageCode;
  requestedForm: ArabicForm;
  scriptText: string;
  transliteration: string | null;
  lexicalVariants: LexicalVariantShape[];
}) {
  if (args.language !== LanguageCode.AR_MSA) {
    return {
      form: "msa" as const,
      scriptText: args.scriptText,
      transliteration: args.transliteration,
    };
  }

  const register = ARABIC_FORM_TO_REGISTER[args.requestedForm];
  const requested = args.lexicalVariants.find((variant) => variant.register === register);

  if (requested) {
    return {
      form: args.requestedForm,
      scriptText: requested.scriptText,
      transliteration: requested.transliteration,
    };
  }

  const fallback = args.lexicalVariants.find((variant) => variant.register === ArabicRegister.MSA);

  return {
    form: "msa" as const,
    scriptText: fallback?.scriptText ?? args.scriptText,
    transliteration: fallback?.transliteration ?? args.transliteration,
  };
}
