"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ENABLE_AR_IMMERSION_TRACKER,
  ENABLE_AR_MORPHOLOGY_TRAINER,
  ENABLE_AR_SNIPPET_MINING,
} from "@/lib/constants";

type LanguageCode = "ar_msa" | "zh_hans";
type Grade = "again" | "hard" | "good" | "easy";
type ArabicForm = "msa" | "syrian";

type TodayData = {
  date: string;
  language: LanguageCode;
  languageLabel: string;
  session: {
    id: string;
    plannedMinutes: number;
    completedMinutes: number;
    streakCount: number;
  };
  reviewQueueDue: number;
  allowNewContent: boolean;
  dailyAllocation: {
    review: number;
    newContent: number;
    pronunciation: number;
  };
  nextLesson: {
    id: string;
    domain: string;
    sequenceNo: number;
    estimatedMinutes: number;
    completedCount: number;
    lessonItemCount: number;
  } | null;
};

type ProgressData = {
  languageStats: Record<
    LanguageCode,
    {
      attempts: number;
      averageScore: number;
      mastered: number;
      due: number;
    }
  >;
};

type LessonPreview = {
  lesson: {
    id: string;
    language: string;
    domain: string;
    sequenceNo: number;
    estimatedMinutes: number;
  };
  items: Array<{
    lexicalItemId: string;
    scriptText: string;
    transliteration: string | null;
    gloss: string;
    itemType: string;
    forms?: {
      primary: {
        scriptText: string;
        transliteration: string | null;
      };
      secondary: {
        scriptText: string;
        transliteration: string | null;
      } | null;
    } | null;
  }>;
};

type LocalSpeechHealth = {
  available: boolean;
  endpoint: string;
  whisperModel?: string | null;
  ttsBackend?: string | null;
  ttsMode?: string | null;
};

type GalleryItem = {
  lexicalItemId: string;
  itemType: "vocab" | "chunk";
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  forms?: {
    primary: {
      scriptText: string;
      transliteration: string | null;
    };
    secondary: {
      scriptText: string;
      transliteration: string | null;
    } | null;
  } | null;
};

type GalleryDomain = {
  domain: string;
  count: number;
  items: GalleryItem[];
};

type GalleryResponse = {
  language: LanguageCode;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  availableDomains: string[];
  domains: GalleryDomain[];
};

type Flashcard = {
  lexicalItemId: string;
  reviewCardId: string | null;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  domain: string;
  itemType: "vocab" | "chunk";
  dueAt: string | null;
  state: "new" | "learning" | "review" | "mastered";
  isDue: boolean;
  schedulerVersion: "legacy" | "fsrs" | null;
  transliterationStage: number;
  forms?: {
    primary: {
      scriptText: string;
      transliteration: string | null;
    };
    secondary: {
      scriptText: string;
      transliteration: string | null;
    } | null;
  } | null;
};

type FlashcardsResponse = {
  language: LanguageCode;
  dueCount: number;
  cards: Flashcard[];
};

type PronunciationTarget = {
  lexicalItemId: string;
  scriptText: string;
  transliteration: string | null;
  forms?: {
    primary: {
      scriptText: string;
      transliteration: string | null;
    };
    secondary: {
      scriptText: string;
      transliteration: string | null;
    } | null;
  } | null;
};

type NoHarakatQueueItem = {
  lexicalItemId: string;
  scriptText: string;
  displayText: string;
  vowelledText: string;
  transliteration: string;
  gloss: string;
  domain: string;
  itemType: "vocab" | "chunk";
  avgScore: number | null;
  lastAttemptAt: string | null;
};

type NoHarakatQueueResponse = {
  language: "ar_msa";
  totalEligible: number;
  queue: NoHarakatQueueItem[];
};

type NoHarakatAttemptResult = {
  attemptId: string;
  lexicalItemId: string;
  score: number;
  confidence: string;
  feedback: string;
  transcript: string;
  predictedTransliteration: string;
  expectedTransliteration: string;
  displayText: string;
  vowelledText: string;
  tipCodes: string[];
  tips: Array<{
    code: string;
    title: string;
    body: string;
  }>;
  remainingDaily: number;
};

type NoHarakatSummary = {
  range: "7d" | "30d";
  attempts: number;
  averageScore: number;
  topTips: Array<{
    code: string;
    count: number;
  }>;
};

type ImmersionMode = "input" | "output" | "study" | "tutor";

type ImmersionPlanResponse = {
  language: "ar_msa";
  supported: boolean;
  phase: {
    code: string;
    label: string;
    dayNumber: number;
  };
  target: {
    dailyMinutes: number;
    weeklyMinutes: number;
    ratio: Record<ImmersionMode, number>;
  };
  thisWeek: {
    totalMinutes: number;
    byMode: Record<ImmersionMode, number>;
  };
  generatedAt: string;
};

type ImmersionSummaryResponse = {
  language: "ar_msa";
  range: "7d" | "30d";
  totalMinutes: number;
  averageDailyMinutes: number;
  activeDays: number;
  activeStreak: number;
  ratio: {
    target: Record<ImmersionMode, number>;
    actual: Record<ImmersionMode, number>;
    adherenceScore: number;
  };
  byMode: Record<ImmersionMode, number>;
  byDay: Array<{
    date: string;
    minutes: number;
  }>;
  generatedAt: string;
};

type SnippetLinkedTerm = {
  lexicalItemId: string;
  tokenText: string | null;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  forms?: {
    primary: {
      scriptText: string;
      transliteration: string | null;
    };
    secondary: {
      scriptText: string;
      transliteration: string | null;
    } | null;
  } | null;
  inReview: boolean;
};

type SnippetFeedItem = {
  snippetId: string;
  domain: string;
  kind: string;
  register: string;
  phaseMin: number;
  phaseMax: number;
  difficulty: number;
  scriptText: string;
  vowelledText: string | null;
  transliteration: string | null;
  gloss: string;
  sourceLabel: string;
  stats: {
    averageComprehension: number | null;
    consumedMinutes: number;
    minedCount: number;
    lastSeenAt: string | null;
  } | null;
  linkedTerms: SnippetLinkedTerm[];
};

type SnippetFeedResponse = {
  language: "ar_msa";
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  availableDomains: string[];
  snippets: SnippetFeedItem[];
};

type SnippetMineResult = {
  snippetId: string;
  selected: number;
  addedToDeck: number;
  alreadyInDeck: number;
};

type MorphologyQueueItem = {
  lexicalItemId: string;
  root: string;
  wazn: string;
  lemma: string | null;
  confidence: number;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  domain: string;
  itemType: "vocab" | "chunk";
  avgScore: number | null;
  lastAttemptAt: string | null;
};

type MorphologyQueueResponse = {
  language: "ar_msa";
  totalEligible: number;
  queue: MorphologyQueueItem[];
};

type MorphologyAttemptResult = {
  attemptId: string;
  lexicalItemId: string;
  promptType: "root" | "wazn";
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  domain: string;
  root: string;
  wazn: string;
  expectedAnswer: string;
  userAnswer: string;
  score: number;
  isCorrect: boolean;
  feedback: string;
};

type MorphologySummaryResponse = {
  language: "ar_msa";
  range: "7d" | "30d";
  attempts: number;
  averageScore: number;
  accuracy: number;
  byPromptType: {
    root: {
      attempts: number;
      correct: number;
      accuracy: number;
    };
    wazn: {
      attempts: number;
      correct: number;
      accuracy: number;
    };
  };
  topConfusions: Array<{
    pair: string;
    count: number;
  }>;
  weakWazn: Array<{
    wazn: string;
    attempts: number;
    averageScore: number;
  }>;
  weakRoots: Array<{
    root: string;
    attempts: number;
    averageScore: number;
  }>;
};

type ApiError = {
  status: number;
  message: string;
};

type LanguageWorkspaceProps = {
  languageCode: LanguageCode;
  languageLabel: string;
  languageClassName: "lang-ar" | "lang-zh";
  eyebrowLabel: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed.";
    throw { status: response.status, message } as ApiError;
  }
  return payload as T;
}

function supportsAudioRecording(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function",
  ) && typeof MediaRecorder !== "undefined";
}

function pickRecorderMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type));
}

function languageLocale(language: LanguageCode): string {
  return language === "ar_msa" ? "ar-SA" : "zh-CN";
}

function primaryFormOf<T extends { scriptText: string; transliteration: string | null; forms?: { primary: { scriptText: string; transliteration: string | null } } | null }>(
  item: T,
) {
  return item.forms?.primary ?? { scriptText: item.scriptText, transliteration: item.transliteration };
}

function secondaryFormOf<T extends { forms?: { secondary: { scriptText: string; transliteration: string | null } | null } | null }>(
  item: T,
) {
  return item.forms?.secondary ?? null;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function formatTipCode(code: string): string {
  return code.toLowerCase().replaceAll("_", " ");
}

function formatImmersionMode(mode: ImmersionMode): string {
  if (mode === "input") return "Input";
  if (mode === "output") return "Output";
  if (mode === "study") return "Study";
  return "Tutor";
}

const scoreByGrade = {
  again: 30,
  hard: 60,
  good: 80,
  easy: 95,
} as const;

export function LanguageWorkspace({
  languageCode,
  languageLabel,
  languageClassName,
  eyebrowLabel,
}: LanguageWorkspaceProps) {
  const isArabic = languageCode === "ar_msa";
  const immersionEnabled = isArabic && ENABLE_AR_IMMERSION_TRACKER;
  const snippetMiningEnabled = isArabic && ENABLE_AR_SNIPPET_MINING;
  const morphologyEnabled = isArabic && ENABLE_AR_MORPHOLOGY_TRAINER;
  const accentTextClass = isArabic ? "text-emerald-600" : "text-cyan-600";
  const accentPlayClass = isArabic
    ? "rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-500"
    : "rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs text-cyan-900 hover:border-cyan-500";

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [today, setToday] = useState<TodayData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [lessonPreview, setLessonPreview] = useState<LessonPreview | null>(null);
  const [localSpeech, setLocalSpeech] = useState<LocalSpeechHealth | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [activeVoiceCardId, setActiveVoiceCardId] = useState<string | null>(null);

  const [galleryDomains, setGalleryDomains] = useState<GalleryDomain[]>([]);
  const [galleryDomainOptions, setGalleryDomainOptions] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [gallerySearch, setGallerySearch] = useState("");
  const [debouncedGallerySearch, setDebouncedGallerySearch] = useState("");
  const [galleryPage, setGalleryPage] = useState(1);
  const [galleryTotalItems, setGalleryTotalItems] = useState(0);
  const [galleryTotalPages, setGalleryTotalPages] = useState(1);
  const [galleryHasNextPage, setGalleryHasNextPage] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [noHarakatQueue, setNoHarakatQueue] = useState<NoHarakatQueueItem[]>([]);
  const [activeNoHarakatLexicalItemId, setActiveNoHarakatLexicalItemId] = useState<string | null>(null);
  const [predictedTransliteration, setPredictedTransliteration] = useState("");
  const [noHarakatResult, setNoHarakatResult] = useState<NoHarakatAttemptResult | null>(null);
  const [noHarakatSummary, setNoHarakatSummary] = useState<NoHarakatSummary | null>(null);
  const [immersionPlan, setImmersionPlan] = useState<ImmersionPlanResponse | null>(null);
  const [immersionSummary, setImmersionSummary] = useState<ImmersionSummaryResponse | null>(null);
  const [snippetFeed, setSnippetFeed] = useState<SnippetFeedItem[]>([]);
  const [snippetDomainOptions, setSnippetDomainOptions] = useState<string[]>([]);
  const [snippetDomain, setSnippetDomain] = useState("all");
  const [snippetSearch, setSnippetSearch] = useState("");
  const [debouncedSnippetSearch, setDebouncedSnippetSearch] = useState("");
  const [snippetPage, setSnippetPage] = useState(1);
  const [snippetTotal, setSnippetTotal] = useState(0);
  const [snippetTotalPages, setSnippetTotalPages] = useState(1);
  const [snippetHasNextPage, setSnippetHasNextPage] = useState(false);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [selectedSnippetTerms, setSelectedSnippetTerms] = useState<Record<string, string[]>>({});
  const [morphologyQueue, setMorphologyQueue] = useState<MorphologyQueueItem[]>([]);
  const [activeMorphLexicalItemId, setActiveMorphLexicalItemId] = useState<string | null>(null);
  const [morphologyPromptType, setMorphologyPromptType] = useState<"root" | "wazn">("root");
  const [morphologyAnswer, setMorphologyAnswer] = useState("");
  const [morphologyResult, setMorphologyResult] = useState<MorphologyAttemptResult | null>(null);
  const [morphologySummary, setMorphologySummary] = useState<MorphologySummaryResponse | null>(null);

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardDueCount, setFlashcardDueCount] = useState(0);
  const [activeLexicalItemId, setActiveLexicalItemId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showSyrianCompanion, setShowSyrianCompanion] = useState(false);
  const [sessionSeen, setSessionSeen] = useState(0);
  const prefetchedAudioIdsRef = useRef<Set<string>>(new Set());

  const langStats = useMemo(() => {
    if (!progress) {
      return null;
    }
    return progress.languageStats[languageCode];
  }, [progress, languageCode]);

  const currentCard = useMemo(() => {
    if (flashcards.length === 0) {
      return null;
    }

    if (activeLexicalItemId) {
      const active = flashcards.find((card) => card.lexicalItemId === activeLexicalItemId);
      if (active) {
        return active;
      }
    }

    return flashcards[0];
  }, [flashcards, activeLexicalItemId]);

  const activeCardIndex = useMemo(() => {
    if (!currentCard) {
      return -1;
    }

    return flashcards.findIndex((card) => card.lexicalItemId === currentCard.lexicalItemId);
  }, [flashcards, currentCard]);

  const currentNoHarakatItem = useMemo(() => {
    if (!isArabic || noHarakatQueue.length === 0) {
      return null;
    }

    if (activeNoHarakatLexicalItemId) {
      const active = noHarakatQueue.find((item) => item.lexicalItemId === activeNoHarakatLexicalItemId);
      if (active) {
        return active;
      }
    }

    return noHarakatQueue[0];
  }, [activeNoHarakatLexicalItemId, isArabic, noHarakatQueue]);

  const currentMorphologyItem = useMemo(() => {
    if (!isArabic || morphologyQueue.length === 0) {
      return null;
    }

    if (activeMorphLexicalItemId) {
      const active = morphologyQueue.find((item) => item.lexicalItemId === activeMorphLexicalItemId);
      if (active) {
        return active;
      }
    }

    return morphologyQueue[0];
  }, [activeMorphLexicalItemId, isArabic, morphologyQueue]);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const params = new URLSearchParams({
        language: languageCode,
        page: String(galleryPage),
        pageSize: "90",
      });

      if (selectedDomain !== "all") {
        params.set("domain", selectedDomain);
      }

      if (debouncedGallerySearch.trim()) {
        params.set("search", debouncedGallerySearch.trim());
      }

      const result = await fetch(`/api/vocabulary/gallery?${params.toString()}`).then(
        readJson<GalleryResponse>,
      );

      setGalleryDomains(result.domains);
      setGalleryDomainOptions(result.availableDomains);
      setGalleryTotalItems(result.total);
      setGalleryTotalPages(result.totalPages);
      setGalleryHasNextPage(result.hasNextPage);
    } finally {
      setGalleryLoading(false);
    }
  }, [debouncedGallerySearch, galleryPage, languageCode, selectedDomain]);

  const loadNoHarakatQueue = useCallback(
    async (preferredLexicalItemId?: string) => {
      if (!isArabic) {
        setNoHarakatQueue([]);
        setActiveNoHarakatLexicalItemId(null);
        return;
      }

      const result = await fetch(`/api/pronunciation/no-harakat/queue?language=${languageCode}&limit=30`).then(
        readJson<NoHarakatQueueResponse>,
      );

      setNoHarakatQueue(result.queue);
      setActiveNoHarakatLexicalItemId((current) => {
        const preferred = preferredLexicalItemId ?? current;
        if (preferred && result.queue.some((item) => item.lexicalItemId === preferred)) {
          return preferred;
        }
        return result.queue[0]?.lexicalItemId ?? null;
      });
    },
    [isArabic, languageCode],
  );

  const loadNoHarakatSummary = useCallback(async () => {
    if (!isArabic) {
      setNoHarakatSummary(null);
      return;
    }

    const result = await fetch(`/api/pronunciation/no-harakat/summary?range=7d`).then(
      readJson<NoHarakatSummary>,
    );
    setNoHarakatSummary(result);
  }, [isArabic]);

  const loadImmersionPlan = useCallback(async () => {
    if (!immersionEnabled) {
      setImmersionPlan(null);
      return;
    }

    const result = await fetch(`/api/immersion/plan?language=${languageCode}`).then(
      readJson<ImmersionPlanResponse>,
    );
    setImmersionPlan(result);
  }, [immersionEnabled, languageCode]);

  const loadImmersionSummary = useCallback(async () => {
    if (!immersionEnabled) {
      setImmersionSummary(null);
      return;
    }

    const result = await fetch(`/api/immersion/summary?language=${languageCode}&range=7d`).then(
      readJson<ImmersionSummaryResponse>,
    );
    setImmersionSummary(result);
  }, [immersionEnabled, languageCode]);

  const loadSnippetFeed = useCallback(async () => {
    if (!snippetMiningEnabled) {
      setSnippetFeed([]);
      setSnippetDomainOptions([]);
      setSnippetTotal(0);
      setSnippetTotalPages(1);
      setSnippetHasNextPage(false);
      return;
    }

    setSnippetLoading(true);
    try {
      const params = new URLSearchParams({
        language: "ar_msa",
        page: String(snippetPage),
        pageSize: "6",
      });

      if (snippetDomain !== "all") {
        params.set("domain", snippetDomain);
      }

      if (debouncedSnippetSearch.trim()) {
        params.set("search", debouncedSnippetSearch.trim());
      }

      if (immersionPlan?.phase?.dayNumber) {
        const phaseNumber =
          immersionPlan.phase.code === "phase_1"
            ? 1
            : immersionPlan.phase.code === "phase_2"
              ? 2
              : immersionPlan.phase.code === "phase_3"
                ? 3
                : 4;
        params.set("phase", String(phaseNumber));
      }

      const result = await fetch(`/api/snippets/feed?${params.toString()}`).then(
        readJson<SnippetFeedResponse>,
      );

      setSnippetFeed(result.snippets);
      setSnippetDomainOptions(result.availableDomains);
      setSnippetTotal(result.total);
      setSnippetTotalPages(result.totalPages);
      setSnippetHasNextPage(result.hasNextPage);
    } finally {
      setSnippetLoading(false);
    }
  }, [
    debouncedSnippetSearch,
    immersionPlan?.phase?.code,
    immersionPlan?.phase?.dayNumber,
    snippetDomain,
    snippetMiningEnabled,
    snippetPage,
  ]);

  const loadMorphologyQueue = useCallback(
    async (preferredLexicalItemId?: string) => {
      if (!morphologyEnabled) {
        setMorphologyQueue([]);
        setActiveMorphLexicalItemId(null);
        return;
      }

      const result = await fetch(`/api/morphology/queue?language=${languageCode}&limit=30`).then(
        readJson<MorphologyQueueResponse>,
      );
      setMorphologyQueue(result.queue);
      setActiveMorphLexicalItemId((current) => {
        const preferred = preferredLexicalItemId ?? current;
        if (preferred && result.queue.some((item) => item.lexicalItemId === preferred)) {
          return preferred;
        }
        return result.queue[0]?.lexicalItemId ?? null;
      });
    },
    [languageCode, morphologyEnabled],
  );

  const loadMorphologySummary = useCallback(async () => {
    if (!morphologyEnabled) {
      setMorphologySummary(null);
      return;
    }

    const result = await fetch(`/api/morphology/summary?language=${languageCode}&range=7d`).then(
      readJson<MorphologySummaryResponse>,
    );
    setMorphologySummary(result);
  }, [languageCode, morphologyEnabled]);

  const loadFlashcards = useCallback(
    async (preferredLexicalItemId?: string) => {
      const result = await fetch(`/api/review/flashcards?language=${languageCode}&limit=1000`).then(
        readJson<FlashcardsResponse>,
      );

      setFlashcards(result.cards);
      setFlashcardDueCount(result.dueCount);
      setActiveLexicalItemId((current) => {
        const preferred = preferredLexicalItemId ?? current;
        if (preferred && result.cards.some((card) => card.lexicalItemId === preferred)) {
          return preferred;
        }

        return result.cards[0]?.lexicalItemId ?? null;
      });
    },
    [languageCode],
  );

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [todayRes, progressRes] = await Promise.all([
        fetch(`/api/session/today?language=${languageCode}`).then(readJson<TodayData>),
        fetch("/api/progress/summary?range=7d").then(readJson<ProgressData>),
      ]);

      setToday(todayRes);
      setProgress(progressRes);
      setAuthenticated(true);

      if (todayRes.nextLesson) {
        const preview = await fetch(`/api/lesson/${todayRes.nextLesson.id}`).then(
          readJson<LessonPreview>,
        );
        setLessonPreview(preview);
      } else {
        setLessonPreview(null);
      }

      const work: Array<Promise<unknown>> = [
        fetch("/api/pronunciation/health").then(readJson<LocalSpeechHealth>),
        loadFlashcards(),
      ];

      if (isArabic) {
        work.push(
          loadNoHarakatQueue(),
          loadNoHarakatSummary(),
        );
        if (immersionEnabled) {
          work.push(loadImmersionPlan(), loadImmersionSummary());
        }
        if (morphologyEnabled) {
          work.push(loadMorphologyQueue(), loadMorphologySummary());
        }
      }

      const [speechHealth] = await Promise.all(work) as [LocalSpeechHealth, ...unknown[]];

      setLocalSpeech(speechHealth);
    } catch (caught) {
      const apiError = caught as ApiError;
      if (apiError.status === 401) {
        setAuthenticated(false);
      } else {
        setError(apiError.message ?? "Could not load page.");
      }
    } finally {
      setLoading(false);
    }
  }, [
    isArabic,
    languageCode,
    loadFlashcards,
    immersionEnabled,
    loadImmersionPlan,
    loadImmersionSummary,
    loadMorphologyQueue,
    loadMorphologySummary,
    morphologyEnabled,
    loadNoHarakatQueue,
    loadNoHarakatSummary,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVoiceReady(supportsAudioRecording());
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedGallerySearch(gallerySearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [gallerySearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSnippetSearch(snippetSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [snippetSearch]);

  useEffect(() => {
    setGalleryPage(1);
  }, [selectedDomain, debouncedGallerySearch, languageCode]);

  useEffect(() => {
    setSnippetPage(1);
  }, [debouncedSnippetSearch, snippetDomain, languageCode]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (authenticated) {
      void loadGallery();
    }
  }, [authenticated, loadGallery]);

  useEffect(() => {
    if (authenticated) {
      void loadSnippetFeed();
    }
  }, [authenticated, loadSnippetFeed]);

  useEffect(() => {
    if (currentCard) {
      setActiveLexicalItemId(currentCard.lexicalItemId);
    }
  }, [currentCard]);

  useEffect(() => {
    if (currentNoHarakatItem) {
      setActiveNoHarakatLexicalItemId(currentNoHarakatItem.lexicalItemId);
    }
  }, [currentNoHarakatItem]);

  useEffect(() => {
    if (currentMorphologyItem) {
      setActiveMorphLexicalItemId(currentMorphologyItem.lexicalItemId);
    }
  }, [currentMorphologyItem]);

  useEffect(() => {
    if (!snippetMiningEnabled || snippetFeed.length === 0) {
      return;
    }

    setSelectedSnippetTerms((current) => {
      const next = { ...current };
      for (const snippet of snippetFeed) {
        if (next[snippet.snippetId]?.length) {
          continue;
        }

        const defaults = snippet.linkedTerms
          .filter((term) => !term.inReview)
          .slice(0, 3)
          .map((term) => term.lexicalItemId);
        next[snippet.snippetId] =
          defaults.length > 0
            ? defaults
            : snippet.linkedTerms.slice(0, 1).map((term) => term.lexicalItemId);
      }
      return next;
    });
  }, [snippetFeed, snippetMiningEnabled]);

  useEffect(() => {
    setRevealed(false);
    setShowSyrianCompanion(false);
  }, [activeLexicalItemId]);

  useEffect(() => {
    setPredictedTransliteration("");
    setNoHarakatResult(null);
  }, [activeNoHarakatLexicalItemId]);

  useEffect(() => {
    setMorphologyAnswer("");
    setMorphologyResult(null);
  }, [activeMorphLexicalItemId, morphologyPromptType]);

  async function startSession() {
    setBusy(true);
    setError(null);

    try {
      await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: languageCode }),
      }).then(readJson<{ session: { id: string } }>);

      await bootstrap();
      setInfo("Session started.");
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not start session.");
    } finally {
      setBusy(false);
    }
  }

  const gradeCurrentCard = useCallback(
    async (grade: Grade) => {
      if (!currentCard || !revealed) {
        return;
      }

      setBusy(true);
      setError(null);

      const nextCardId =
        flashcards[(activeCardIndex + 1 + flashcards.length) % flashcards.length]?.lexicalItemId;

      try {
        await fetch("/api/review/flashcards/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lexicalItemId: currentCard.lexicalItemId,
            reviewCardId: currentCard.reviewCardId,
            grade,
          }),
        }).then(readJson<{ reviewCard: { id: string } }>);

        setSessionSeen((count) => count + 1);
        setInfo(`Recorded ${grade.toUpperCase()} (${scoreByGrade[grade]}).`);
        await loadFlashcards(nextCardId);
      } catch (caught) {
        const apiError = caught as ApiError;
        setError(apiError.message ?? "Could not grade flashcard.");
      } finally {
        setBusy(false);
      }
    },
    [activeCardIndex, currentCard, flashcards, loadFlashcards, revealed],
  );

  function moveFlashcard(offset: -1 | 1) {
    if (flashcards.length === 0 || activeCardIndex < 0) {
      return;
    }

    const nextIndex = (activeCardIndex + offset + flashcards.length) % flashcards.length;
    setActiveLexicalItemId(flashcards[nextIndex].lexicalItemId);
  }

  function focusFlashcard(lexicalItemId: string) {
    setActiveLexicalItemId(lexicalItemId);
    setRevealed(false);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (busy || isTextInputTarget(event.target) || !currentCard) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      if (!revealed) {
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        void gradeCurrentCard("again");
      } else if (event.key === "2") {
        event.preventDefault();
        void gradeCurrentCard("hard");
      } else if (event.key === "3") {
        event.preventDefault();
        void gradeCurrentCard("good");
      } else if (event.key === "4") {
        event.preventDefault();
        void gradeCurrentCard("easy");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, currentCard, revealed, gradeCurrentCard]);

  function playTargetAudioFallback(item: PronunciationTarget, form: ArabicForm = "msa"): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }

      const primary = primaryFormOf(item);
      const secondary = secondaryFormOf(item);
      const text =
        form === "syrian" && languageCode === "ar_msa" && secondary
          ? secondary.scriptText
          : primary.scriptText;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageLocale(languageCode);
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  const warmTargetAudio = useCallback(
    async (lexicalItemId: string): Promise<void> => {
      if (languageCode !== "zh_hans") {
        return;
      }

      if (prefetchedAudioIdsRef.current.has(lexicalItemId)) {
        return;
      }

      try {
        const response = await fetch(`/api/pronunciation/target-audio?lexicalItemId=${lexicalItemId}`);
        if (response.ok) {
          await response.arrayBuffer();
          prefetchedAudioIdsRef.current.add(lexicalItemId);
        }
      } catch {
        // Ignore prefetch failures; user-triggered playback still retries.
      }
    },
    [languageCode],
  );

  const prefetchNextCardAudio = useCallback(
    (currentLexicalItemId: string): void => {
      if (languageCode !== "zh_hans" || flashcards.length < 2) {
        return;
      }

      const currentIndex = flashcards.findIndex((card) => card.lexicalItemId === currentLexicalItemId);
      if (currentIndex < 0) {
        return;
      }

      const nextCard = flashcards[(currentIndex + 1) % flashcards.length];
      if (!nextCard) {
        return;
      }

      void warmTargetAudio(nextCard.lexicalItemId);
    },
    [flashcards, languageCode, warmTargetAudio],
  );

  async function playTargetAudio(item: PronunciationTarget, form: ArabicForm = "msa"): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const params = new URLSearchParams({ lexicalItemId: item.lexicalItemId });
      if (languageCode === "ar_msa") {
        params.set("form", form);
      }
      const response = await fetch(`/api/pronunciation/target-audio?${params.toString()}`);
      if (!response.ok) {
        await playTargetAudioFallback(item, form);
        return;
      }

      const blob = await response.blob();
      if (!blob.size) {
        await playTargetAudioFallback(item, form);
        return;
      }

      prefetchedAudioIdsRef.current.add(item.lexicalItemId);
      prefetchNextCardAudio(item.lexicalItemId);

      await new Promise<void>((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.onended = () => {
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        audio.onerror = async () => {
          URL.revokeObjectURL(objectUrl);
          await playTargetAudioFallback(item, form);
          resolve();
        };
        void audio.play().catch(async () => {
          URL.revokeObjectURL(objectUrl);
          await playTargetAudioFallback(item, form);
          resolve();
        });
      });
    } catch {
      await playTargetAudioFallback(item, form);
    }
  }

  async function playNoHarakatTargetAudio(item: NoHarakatQueueItem): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const params = new URLSearchParams({ lexicalItemId: item.lexicalItemId });
      const response = await fetch(`/api/pronunciation/no-harakat/target-audio?${params.toString()}`);

      if (!response.ok) {
        await playTargetAudioFallback(item);
        return;
      }

      const blob = await response.blob();
      if (!blob.size) {
        await playTargetAudioFallback(item);
        return;
      }

      await new Promise<void>((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.onended = () => {
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        audio.onerror = async () => {
          URL.revokeObjectURL(objectUrl);
          await playTargetAudioFallback(item);
          resolve();
        };
        void audio.play().catch(async () => {
          URL.revokeObjectURL(objectUrl);
          await playTargetAudioFallback(item);
          resolve();
        });
      });
    } catch {
      await playTargetAudioFallback(item);
    }
  }

  function recordAudioSample(maxDurationMs = 3200): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!supportsAudioRecording()) {
        reject(new Error("Audio recording is not available."));
        return;
      }

      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const mimeType = pickRecorderMimeType();
          const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
          const chunks: BlobPart[] = [];
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);

          const waveform = new Uint8Array(analyser.fftSize);
          const startedAt = performance.now();
          let lastSpeechAt = startedAt;
          let rafId = 0;
          let stopped = false;

          const stopRecorder = () => {
            if (stopped) {
              return;
            }

            stopped = true;
            if (rafId) {
              window.cancelAnimationFrame(rafId);
            }
            if (recorder.state !== "inactive") {
              recorder.stop();
            }
          };

          recorder.ondataavailable = (event) => {
            if (event.data?.size) {
              chunks.push(event.data);
            }
          };

          recorder.onerror = () => reject(new Error("Recording failed."));

          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            void audioContext.close();
            if (chunks.length === 0) {
              reject(new Error("No audio captured."));
              return;
            }

            resolve(new Blob(chunks, { type: mimeType ?? "audio/webm" }));
          };

          recorder.start();

          const minDurationMs = 700;
          const silenceHoldMs = 520;
          const silenceThreshold = 0.018;

          const watchSilence = () => {
            if (stopped) {
              return;
            }

            analyser.getByteTimeDomainData(waveform);
            let sum = 0;
            for (const value of waveform) {
              const normalized = (value - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / waveform.length);
            const now = performance.now();

            if (rms > silenceThreshold) {
              lastSpeechAt = now;
            }

            const reachedMinDuration = now - startedAt >= minDurationMs;
            const silenceElapsed = now - lastSpeechAt;
            const timedOut = now - startedAt >= maxDurationMs;

            if (timedOut || (reachedMinDuration && silenceElapsed >= silenceHoldMs)) {
              stopRecorder();
              return;
            }

            rafId = window.requestAnimationFrame(watchSilence);
          };

          rafId = window.requestAnimationFrame(watchSilence);
          window.setTimeout(stopRecorder, maxDurationMs + 250);
        })
        .catch(() => reject(new Error("Microphone permission denied.")));
    });
  }

  async function runVoiceDrill(item: PronunciationTarget, form: ArabicForm = "msa") {
    setBusy(true);
    setError(null);
    setInfo(null);
    setActiveVoiceCardId(`${item.lexicalItemId}:${form}`);

    try {
      if (!voiceReady) {
        throw new Error("Voice recording not supported.");
      }

      await playTargetAudio(item, form);
      const audioBlob = await recordAudioSample();
      const formData = new FormData();
      formData.set("lexicalItemId", item.lexicalItemId);
      formData.set("audio", audioBlob, "attempt.webm");
      if (languageCode === "ar_msa") {
        formData.set("form", form);
      }

      const result = await fetch("/api/pronunciation/evaluate", {
        method: "POST",
        body: formData,
      }).then(
        readJson<{
          score: number;
          feedback: string;
          remainingDaily: number;
        }>,
      );

      setInfo(`Voice score ${result.score}. ${result.feedback} Remaining today: ${result.remainingDaily}.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Voice drill failed.";
      setError(message);
    } finally {
      setBusy(false);
      setActiveVoiceCardId(null);
    }
  }

  function moveNoHarakatItem(offset: -1 | 1) {
    if (noHarakatQueue.length === 0 || !currentNoHarakatItem) {
      return;
    }

    const currentIndex = noHarakatQueue.findIndex((item) => item.lexicalItemId === currentNoHarakatItem.lexicalItemId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = (currentIndex + offset + noHarakatQueue.length) % noHarakatQueue.length;
    setActiveNoHarakatLexicalItemId(noHarakatQueue[nextIndex].lexicalItemId);
  }

  async function runNoHarakatAttempt(item: NoHarakatQueueItem) {
    if (!predictedTransliteration.trim()) {
      setError("Type your transliteration guess before recording.");
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    setActiveVoiceCardId(`${item.lexicalItemId}:noharakat`);

    try {
      if (!voiceReady) {
        throw new Error("Voice recording not supported.");
      }

      const audioBlob = await recordAudioSample();
      const formData = new FormData();
      formData.set("lexicalItemId", item.lexicalItemId);
      formData.set("predictedTransliteration", predictedTransliteration.trim());
      formData.set("audio", audioBlob, "attempt.webm");

      const result = await fetch("/api/pronunciation/no-harakat/attempt", {
        method: "POST",
        body: formData,
      }).then(readJson<NoHarakatAttemptResult>);

      setNoHarakatResult(result);
      setInfo(`No-harakat score ${result.score}. Remaining today: ${result.remainingDaily}.`);
      await loadNoHarakatSummary();
      await loadNoHarakatQueue(item.lexicalItemId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No-harakat drill failed.";
      setError(message);
    } finally {
      setBusy(false);
      setActiveVoiceCardId(null);
    }
  }

  async function logImmersion(mode: ImmersionMode, minutes: number, source?: string) {
    if (!immersionEnabled) {
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      await fetch("/api/immersion/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "ar_msa",
          mode,
          minutes,
          source,
        }),
      }).then(readJson<{ log: { id: string } }>);

      await Promise.all([loadImmersionPlan(), loadImmersionSummary()]);
      setInfo(`Logged ${minutes}m ${formatImmersionMode(mode).toLowerCase()} block.`);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not log immersion block.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSnippetTerm(snippetId: string, lexicalItemId: string) {
    setSelectedSnippetTerms((current) => {
      const existing = new Set(current[snippetId] ?? []);
      if (existing.has(lexicalItemId)) {
        existing.delete(lexicalItemId);
      } else {
        existing.add(lexicalItemId);
      }

      return {
        ...current,
        [snippetId]: Array.from(existing),
      };
    });
  }

  async function markSnippetInteraction(
    snippetId: string,
    args: {
      comprehension?: number;
      consumedMinutes?: number;
      minedCount?: number;
    },
  ) {
    await fetch("/api/snippets/interaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snippetId,
        comprehension: args.comprehension,
        consumedMinutes: args.consumedMinutes ?? 0,
        minedCount: args.minedCount ?? 0,
      }),
    }).then(readJson<{ interaction: { id: string } }>);
  }

  async function logSnippetInteractionQuick(
    snippetId: string,
    args: {
      comprehension?: number;
      consumedMinutes?: number;
      minedCount?: number;
    },
  ) {
    if (!snippetMiningEnabled) {
      return;
    }

    try {
      await markSnippetInteraction(snippetId, args);
      await loadSnippetFeed();
      if (args.consumedMinutes && args.consumedMinutes > 0) {
        setInfo(`Logged ${args.consumedMinutes}m snippet input.`);
      } else if (typeof args.comprehension === "number") {
        setInfo(`Saved comprehension ${args.comprehension}/5.`);
      }
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not log snippet interaction.");
    }
  }

  async function mineSnippet(snippetId: string) {
    if (!snippetMiningEnabled) {
      return;
    }

    const selected = selectedSnippetTerms[snippetId] ?? [];
    if (selected.length === 0) {
      setError("Select at least one linked term to mine.");
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const result = await fetch("/api/snippets/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snippetId,
          lexicalItemIds: selected,
        }),
      }).then(readJson<SnippetMineResult>);

      await Promise.all([
        markSnippetInteraction(snippetId, { minedCount: selected.length }),
        loadSnippetFeed(),
        loadFlashcards(),
      ]);

      setInfo(
        `Mined ${result.selected} terms. Added ${result.addedToDeck}, already in deck ${result.alreadyInDeck}.`,
      );
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not mine snippet terms.");
    } finally {
      setBusy(false);
    }
  }

  function moveMorphologyItem(offset: -1 | 1) {
    if (morphologyQueue.length === 0 || !currentMorphologyItem) {
      return;
    }

    const currentIndex = morphologyQueue.findIndex(
      (item) => item.lexicalItemId === currentMorphologyItem.lexicalItemId,
    );
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = (currentIndex + offset + morphologyQueue.length) % morphologyQueue.length;
    setActiveMorphLexicalItemId(morphologyQueue[nextIndex].lexicalItemId);
  }

  async function runMorphologyAttempt(item: MorphologyQueueItem) {
    if (!morphologyEnabled) {
      return;
    }

    if (!morphologyAnswer.trim()) {
      setError("Type your morphology answer first.");
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await fetch("/api/morphology/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lexicalItemId: item.lexicalItemId,
          promptType: morphologyPromptType,
          userAnswer: morphologyAnswer.trim(),
        }),
      }).then(readJson<MorphologyAttemptResult>);

      setMorphologyResult(result);
      await Promise.all([loadMorphologySummary(), loadMorphologyQueue(item.lexicalItemId)]);
      setInfo(`Morphology score ${result.score}.`);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not submit morphology attempt.");
    } finally {
      setBusy(false);
    }
  }

  async function playSnippetAudio(snippet: SnippetFeedItem) {
    await playTargetAudioFallback(
      {
        lexicalItemId: "snippet",
        scriptText: snippet.scriptText,
        transliteration: snippet.transliteration,
      },
      "msa",
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse page-transition">
        <div className="mb-6 h-8 w-48 rounded bg-slate-200"></div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="h-24 rounded-2xl bg-slate-200"></div>
          <div className="h-24 rounded-2xl bg-slate-200"></div>
          <div className="h-24 rounded-2xl bg-slate-200"></div>
          <div className="h-24 rounded-2xl bg-slate-200"></div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="page-transition">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">Please log in from the dashboard first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {error && <div className="mb-4 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-800">{error}</div>}
      {info && <div className="mb-4 rounded-xl bg-emerald-100 px-4 py-2 text-sm text-emerald-900">{info}</div>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.2em] ${accentTextClass}`}>{eyebrowLabel}</p>
          <h1 className={`text-3xl font-semibold text-slate-900 ${languageClassName}`}>{languageLabel}</h1>
          <p className="text-sm text-slate-600">{today?.date.slice(0, 10)}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:border-slate-500"
            onClick={startSession}
            disabled={busy}
          >
            Start Session
          </button>
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:border-slate-500"
            onClick={() => void bootstrap()}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {immersionEnabled ? (
          <a href="#immersion" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
            Immersion
          </a>
        ) : null}
        {snippetMiningEnabled ? (
          <a href="#snippets" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
            Sentence Mining
          </a>
        ) : null}
        {morphologyEnabled ? (
          <a href="#morphology" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
            Morphology
          </a>
        ) : null}
        {isArabic ? (
          <a href="#no-harakat" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
            No-Harakat Drill
          </a>
        ) : null}
        <a href="#flashcards" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
          Flashcards
        </a>
        <a href="#gallery" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
          Gallery
        </a>
        <a href="#voice" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
          Voice
        </a>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mastered</p>
          <p className={`mt-1 text-2xl font-semibold ${accentTextClass}`}>{langStats?.mastered ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Due now</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">{flashcardDueCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg score</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{langStats?.averageScore ?? 0}%</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Streak</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{today?.session.streakCount ?? 0}</p>
        </article>
      </section>

      {lessonPreview && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Next Lesson: {lessonPreview.lesson.domain} #{lessonPreview.lesson.sequenceNo}
          </h2>
          <p className="text-sm text-slate-600">{lessonPreview.lesson.estimatedMinutes} min</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lessonPreview.items.slice(0, 6).map((item) => (
              <div key={item.lexicalItemId} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className={`text-lg font-medium ${languageClassName}`}>{primaryFormOf(item).scriptText}</p>
                <p className="text-slate-600">{primaryFormOf(item).transliteration ?? "-"}</p>
                {isArabic && secondaryFormOf(item) ? (
                  <p className="text-xs text-emerald-700">
                    Syrian: {secondaryFormOf(item)?.scriptText} ({secondaryFormOf(item)?.transliteration ?? "-"})
                  </p>
                ) : null}
                <p className="text-slate-700">{item.gloss}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {immersionEnabled ? (
        <section id="immersion" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Immersion Tracker</h2>
            <p className="text-sm text-slate-600">
              Phase: {immersionPlan?.phase.label ?? "-"} (Day {immersionPlan?.phase.dayNumber ?? 0})
            </p>
          </div>

          <p className="mb-4 text-sm text-slate-600">
            Track input/output/study blocks so weekly ratios match the one-year MSA acceleration protocol.
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(immersionPlan?.target.ratio ?? { input: 0, output: 0, study: 0, tutor: 0 }) as ImmersionMode[]).map(
              (mode) => (
                <article key={mode} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wider text-slate-500">{formatImmersionMode(mode)}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    Target {Math.round((immersionPlan?.target.ratio[mode] ?? 0) * 100)}%
                  </p>
                  <p className="text-sm text-slate-600">
                    Actual {Math.round((immersionSummary?.ratio.actual[mode] ?? 0) * 100)}%
                  </p>
                </article>
              ),
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-500"
              disabled={busy}
              onClick={() => void logImmersion("input", 30, "in-app reading/listening")}
              type="button"
            >
              +30m Input
            </button>
            <button
              className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs text-cyan-900 hover:border-cyan-500"
              disabled={busy}
              onClick={() => void logImmersion("output", 20, "speaking/writing drill")}
              type="button"
            >
              +20m Output
            </button>
            <button
              className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs text-violet-900 hover:border-violet-500"
              disabled={busy}
              onClick={() => void logImmersion("study", 25, "focused grammar/morphology")}
              type="button"
            >
              +25m Study
            </button>
            <button
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500"
              disabled={busy}
              onClick={() => void logImmersion("tutor", 45, "tutor conversation")}
              type="button"
            >
              +45m Tutor
            </button>
          </div>

          <p className="text-sm text-slate-700">
            This week: {immersionSummary?.totalMinutes ?? 0}m | Avg/day: {immersionSummary?.averageDailyMinutes ?? 0}m
            {" "} | Active streak: {immersionSummary?.activeStreak ?? 0} days | Ratio adherence:{" "}
            {immersionSummary?.ratio.adherenceScore ?? 0}%
          </p>
        </section>
      ) : null}

      {snippetMiningEnabled ? (
        <section id="snippets" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Sentence Mining ({snippetTotal})</h2>
            <p className="text-sm text-slate-600">Phase-aware curated internal snippets</p>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-1 text-xs ${
                snippetDomain === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
              onClick={() => setSnippetDomain("all")}
              type="button"
            >
              all
            </button>
            {snippetDomainOptions.map((domain) => (
              <button
                key={domain}
                className={`rounded-full border px-3 py-1 text-xs ${
                  snippetDomain === domain
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => setSnippetDomain(domain)}
                type="button"
              >
                {domain}
              </button>
            ))}
          </div>

          <input
            className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            value={snippetSearch}
            onChange={(event) => setSnippetSearch(event.target.value)}
            placeholder="Search snippets by Arabic text or gloss"
          />

          {snippetLoading ? (
            <p className="text-sm text-slate-600">Loading snippets...</p>
          ) : snippetFeed.length === 0 ? (
            <p className="text-sm text-slate-600">No snippets match this filter.</p>
          ) : (
            <div className="space-y-4">
              {snippetFeed.map((snippet) => (
                <article key={snippet.snippetId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {snippet.domain} | {snippet.kind} | phase {snippet.phaseMin}-{snippet.phaseMax}
                  </p>
                  <p className={`mt-2 text-2xl font-medium text-slate-900 ${languageClassName}`}>{snippet.scriptText}</p>
                  <p className="text-sm text-slate-600">{snippet.transliteration ?? "-"}</p>
                  <p className="text-sm text-slate-800">{snippet.gloss}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {snippet.linkedTerms.map((term) => {
                      const selected = (selectedSnippetTerms[snippet.snippetId] ?? []).includes(term.lexicalItemId);
                      return (
                        <button
                          key={`${snippet.snippetId}:${term.lexicalItemId}`}
                          className={`rounded-full border px-2 py-1 text-xs ${
                            selected
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-300 bg-white text-slate-700"
                          }`}
                          onClick={() => toggleSnippetTerm(snippet.snippetId, term.lexicalItemId)}
                          type="button"
                        >
                          {term.tokenText ?? primaryFormOf(term).scriptText} ({term.gloss})
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={accentPlayClass}
                      disabled={busy}
                      onClick={() => void playSnippetAudio(snippet)}
                      type="button"
                    >
                      Play Snippet
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                      disabled={busy}
                      onClick={() => void logSnippetInteractionQuick(snippet.snippetId, { consumedMinutes: 10 })}
                      type="button"
                    >
                      Log 10m Input
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                      disabled={busy}
                      onClick={() =>
                        void logSnippetInteractionQuick(snippet.snippetId, {
                          comprehension: 3,
                          consumedMinutes: 5,
                        })
                      }
                      type="button"
                    >
                      Mark Comprehension 3/5
                    </button>
                    <button
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-500 disabled:opacity-60"
                      disabled={busy || (selectedSnippetTerms[snippet.snippetId] ?? []).length === 0}
                      onClick={() => void mineSnippet(snippet.snippetId)}
                      type="button"
                    >
                      Mine Selected Terms
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Page {snippetPage} of {snippetTotalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600 disabled:opacity-60"
                disabled={snippetLoading || snippetPage <= 1}
                onClick={() => setSnippetPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous page
              </button>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600 disabled:opacity-60"
                disabled={snippetLoading || !snippetHasNextPage}
                onClick={() => setSnippetPage((current) => current + 1)}
                type="button"
              >
                Next page
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {morphologyEnabled ? (
        <section id="morphology" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Morphology Lab</h2>
            <p className="text-sm text-slate-600">
              Attempts (7d): {morphologySummary?.attempts ?? 0} | Accuracy: {morphologySummary?.accuracy ?? 0}%
            </p>
          </div>

          {!currentMorphologyItem ? (
            <p className="text-sm text-slate-600">No morphology queue available yet.</p>
          ) : (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {currentMorphologyItem.domain} | {currentMorphologyItem.itemType}
              </p>
              <p className={`mt-2 text-4xl font-medium text-slate-900 ${languageClassName}`}>
                {currentMorphologyItem.scriptText}
              </p>
              <p className="mt-1 text-sm text-slate-700">{currentMorphologyItem.gloss}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    morphologyPromptType === "root"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setMorphologyPromptType("root")}
                  type="button"
                >
                  Guess Root
                </button>
                <button
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    morphologyPromptType === "wazn"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setMorphologyPromptType("wazn")}
                  type="button"
                >
                  Guess Wazn
                </button>
              </div>

              <label className="mt-4 block text-xs uppercase tracking-wider text-slate-500" htmlFor="morphology-answer">
                {morphologyPromptType === "root" ? "Type the 3-letter root" : "Type the form/wazn"}
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                id="morphology-answer"
                value={morphologyAnswer}
                onChange={(event) => setMorphologyAnswer(event.target.value)}
                placeholder={morphologyPromptType === "root" ? "e.g. كتب" : "e.g. I (فعل)"}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                  disabled={busy || !morphologyAnswer.trim()}
                  onClick={() => void runMorphologyAttempt(currentMorphologyItem)}
                  type="button"
                >
                  Check
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                  disabled={busy || morphologyQueue.length < 2}
                  onClick={() => moveMorphologyItem(1)}
                  type="button"
                >
                  Next
                </button>
              </div>

              {morphologyResult && morphologyResult.lexicalItemId === currentMorphologyItem.lexicalItemId ? (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-700">
                    Score {morphologyResult.score} | {morphologyResult.isCorrect ? "Correct" : "Try again"}
                  </p>
                  <p className="text-sm text-slate-700">
                    Root: {morphologyResult.root} | Wazn: {morphologyResult.wazn}
                  </p>
                  <p className="text-sm text-slate-800">{morphologyResult.feedback}</p>
                </div>
              ) : null}
            </article>
          )}

          {morphologySummary?.topConfusions.length ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Top confusions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {morphologySummary.topConfusions.map((confusion) => (
                  <span
                    key={confusion.pair}
                    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    {confusion.pair} ({confusion.count})
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {isArabic ? (
        <section id="no-harakat" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">No-Harakat Drill</h2>
            <p className="text-sm text-slate-600">
              Attempts (7d): {noHarakatSummary?.attempts ?? 0} | Avg: {noHarakatSummary?.averageScore ?? 0}
            </p>
          </div>

          <p className="mb-4 text-sm text-slate-600">
            Read the unvowelled word, type your transliteration guess, then speak. Reveal shows harakat and coaching tips.
          </p>

          {!currentNoHarakatItem ? (
            <p className="text-sm text-slate-600">
              No eligible Arabic items found yet. Re-run seed after dataset enrichment.
            </p>
          ) : (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {currentNoHarakatItem.domain} | {currentNoHarakatItem.itemType}
              </p>
              <p className={`mt-2 text-4xl font-medium text-slate-900 ${languageClassName}`}>
                {currentNoHarakatItem.displayText}
              </p>
              <p className="mt-2 text-sm text-slate-700">{currentNoHarakatItem.gloss}</p>

              <label className="mt-4 block text-xs uppercase tracking-wider text-slate-500" htmlFor="prediction-input">
                Your transliteration guess
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                id="prediction-input"
                value={predictedTransliteration}
                onChange={(event) => setPredictedTransliteration(event.target.value)}
                placeholder="e.g. bayt / bēt"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={accentPlayClass}
                  disabled={busy}
                  onClick={() => void playNoHarakatTargetAudio(currentNoHarakatItem)}
                  type="button"
                >
                  Play Target
                </button>
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                  disabled={busy || !voiceReady || !localSpeech?.available || !predictedTransliteration.trim()}
                  onClick={() => void runNoHarakatAttempt(currentNoHarakatItem)}
                  type="button"
                >
                  {activeVoiceCardId === `${currentNoHarakatItem.lexicalItemId}:noharakat`
                    ? "Recording..."
                    : "Speak & Check"}
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                  disabled={busy}
                  onClick={() => setNoHarakatResult(null)}
                  type="button"
                >
                  Retry
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                  disabled={busy || noHarakatQueue.length < 2}
                  onClick={() => moveNoHarakatItem(1)}
                  type="button"
                >
                  Next
                </button>
              </div>

              {noHarakatResult && noHarakatResult.lexicalItemId === currentNoHarakatItem.lexicalItemId ? (
                <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">
                      Score {noHarakatResult.score}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      Confidence {noHarakatResult.confidence}
                    </span>
                  </div>
                  <p className={`text-2xl font-medium text-slate-900 ${languageClassName}`}>
                    {noHarakatResult.vowelledText}
                  </p>
                  <p className="text-sm text-slate-700">
                    Expected: {noHarakatResult.expectedTransliteration} | Yours:{" "}
                    {noHarakatResult.predictedTransliteration}
                  </p>
                  <p className="text-sm text-slate-700">Transcript: {noHarakatResult.transcript || "-"}</p>
                  <p className="text-sm text-slate-800">{noHarakatResult.feedback}</p>
                  <div className="space-y-2">
                    {noHarakatResult.tips.map((tip) => (
                      <div key={tip.code} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tip.title}</p>
                        <p className="text-sm text-slate-700">{tip.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          )}

          {noHarakatSummary?.topTips.length ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Recent confusion patterns</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {noHarakatSummary.topTips.map((tip) => (
                  <span
                    key={tip.code}
                    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    {formatTipCode(tip.code)} ({tip.count})
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section id="flashcards" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Flashcards</h2>
          <p className="text-sm text-slate-600">
            Due: {flashcardDueCount} | Session seen: {sessionSeen} | Cards: {flashcards.length}
          </p>
        </div>

        {!currentCard ? (
          <p className="text-sm text-slate-600">No cards available for this language yet.</p>
        ) : (
          <>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {currentCard.domain} | {currentCard.itemType} | {currentCard.state}
              </p>
              <p className={`mt-2 text-4xl font-medium text-slate-900 ${languageClassName}`}>
                {primaryFormOf(currentCard).scriptText}
              </p>
              {isArabic && showSyrianCompanion && secondaryFormOf(currentCard) ? (
                <p className={`mt-1 text-xl font-medium text-emerald-700 ${languageClassName}`}>
                  {secondaryFormOf(currentCard)?.scriptText}
                </p>
              ) : null}

              {revealed ? (
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-slate-600">{primaryFormOf(currentCard).transliteration ?? "-"}</p>
                  {isArabic && showSyrianCompanion && secondaryFormOf(currentCard) ? (
                    <p className="text-xs text-emerald-700">
                      Syrian: {secondaryFormOf(currentCard)?.transliteration ?? "-"}
                    </p>
                  ) : null}
                  <p className="text-lg text-slate-900">{currentCard.gloss}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Reveal to see transliteration and gloss.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                  onClick={() => setRevealed(true)}
                  disabled={busy || revealed}
                  type="button"
                >
                  Reveal (Space)
                </button>
                {isArabic ? (
                  <button
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-500 disabled:opacity-60"
                    disabled={!secondaryFormOf(currentCard)}
                    onClick={() => setShowSyrianCompanion((current) => !current)}
                    type="button"
                  >
                    {showSyrianCompanion ? "Hide Syrian" : "Show Syrian"}
                  </button>
                ) : null}
                <button
                  className={accentPlayClass}
                  disabled={busy}
                  onClick={() => void playTargetAudio(currentCard, "msa")}
                  type="button"
                >
                  {isArabic ? "Play MSA" : "Play"}
                </button>
                {isArabic ? (
                  <button
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-500 disabled:opacity-60"
                    disabled={busy || !secondaryFormOf(currentCard)}
                    onClick={() => void playTargetAudio(currentCard, "syrian")}
                    type="button"
                  >
                    Play Syrian
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                  disabled={busy || !voiceReady || !localSpeech?.available}
                  onClick={() => void runVoiceDrill(currentCard, "msa")}
                  type="button"
                >
                  {activeVoiceCardId === `${currentCard.lexicalItemId}:msa`
                    ? "Recording..."
                    : isArabic
                      ? "Speak MSA"
                      : "Speak"}
                </button>
                {isArabic ? (
                  <button
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                    disabled={busy || !voiceReady || !localSpeech?.available || !secondaryFormOf(currentCard)}
                    onClick={() => void runVoiceDrill(currentCard, "syrian")}
                    type="button"
                  >
                    {activeVoiceCardId === `${currentCard.lexicalItemId}:syrian` ? "Recording..." : "Speak Syrian"}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["again", "hard", "good", "easy"] as const).map((grade, index) => (
                  <button
                    key={grade}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600 disabled:opacity-60"
                    disabled={busy || !revealed}
                    onClick={() => void gradeCurrentCard(grade)}
                    type="button"
                  >
                    {grade} ({index + 1})
                  </button>
                ))}
              </div>
            </article>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                onClick={() => moveFlashcard(-1)}
                disabled={busy || flashcards.length < 2}
                type="button"
              >
                Previous
              </button>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600"
                onClick={() => moveFlashcard(1)}
                disabled={busy || flashcards.length < 2}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <section id="gallery" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Vocabulary Gallery ({galleryTotalItems})</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-1 text-xs ${
                selectedDomain === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
              onClick={() => setSelectedDomain("all")}
              type="button"
            >
              all
            </button>
            {galleryDomainOptions.map((domain) => (
              <button
                key={domain}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selectedDomain === domain
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => setSelectedDomain(domain)}
                type="button"
              >
                {domain}
              </button>
            ))}
          </div>
        </div>

        <input
          className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          value={gallerySearch}
          onChange={(event) => setGallerySearch(event.target.value)}
          placeholder="Search script, transliteration, or gloss"
        />

        {galleryLoading ? (
          <p className="text-sm text-slate-600">Loading gallery...</p>
        ) : galleryDomains.length === 0 ? (
          <p className="text-sm text-slate-600">No gallery matches this filter.</p>
        ) : (
          <div className="space-y-5">
            {galleryDomains.map((group) => (
              <div key={group.domain}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {group.domain} ({group.count})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <article key={item.lexicalItemId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wider text-slate-500">{item.itemType}</p>
                      <p className={`text-2xl font-medium text-slate-900 ${languageClassName}`}>{primaryFormOf(item).scriptText}</p>
                      <p className="text-sm text-slate-600">{primaryFormOf(item).transliteration ?? "-"}</p>
                      {isArabic && secondaryFormOf(item) ? (
                        <p className="text-xs text-emerald-700">
                          Syrian: {secondaryFormOf(item)?.scriptText} ({secondaryFormOf(item)?.transliteration ?? "-"})
                        </p>
                      ) : null}
                      <p className="text-sm text-slate-800">{item.gloss}</p>
                      {isArabic ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className={accentPlayClass}
                            disabled={busy}
                            onClick={() => void playTargetAudio(item, "msa")}
                            type="button"
                          >
                            Play MSA
                          </button>
                          <button
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-500 disabled:opacity-60"
                            disabled={busy || !secondaryFormOf(item)}
                            onClick={() => void playTargetAudio(item, "syrian")}
                            type="button"
                          >
                            Play Syrian
                          </button>
                          <button
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                            disabled={busy || !voiceReady || !localSpeech?.available}
                            onClick={() => void runVoiceDrill(item, "msa")}
                            type="button"
                          >
                            {activeVoiceCardId === `${item.lexicalItemId}:msa` ? "Recording..." : "Speak MSA"}
                          </button>
                          <button
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                            disabled={busy || !voiceReady || !localSpeech?.available || !secondaryFormOf(item)}
                            onClick={() => void runVoiceDrill(item, "syrian")}
                            type="button"
                          >
                            {activeVoiceCardId === `${item.lexicalItemId}:syrian` ? "Recording..." : "Speak Syrian"}
                          </button>
                        </div>
                      ) : null}
                      <button
                        className="mt-3 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:border-slate-600"
                        onClick={() => focusFlashcard(item.lexicalItemId)}
                        type="button"
                      >
                        Study this card
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Page {galleryPage} of {galleryTotalPages}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600 disabled:opacity-60"
              disabled={galleryLoading || galleryPage <= 1}
              onClick={() => setGalleryPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous page
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-600 disabled:opacity-60"
              disabled={galleryLoading || !galleryHasNextPage}
              onClick={() => setGalleryPage((current) => current + 1)}
              type="button"
            >
              Next page
            </button>
          </div>
        </div>
      </section>

      <section id="voice" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Voice Status</h2>
        <p className="mt-1 text-sm text-slate-600">
          Mic: {voiceReady ? "ready" : "unavailable"} | Service: {localSpeech?.available ? "online" : "offline"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Use flashcard reveal + Play/Speak for pronunciation drills while memorizing.
        </p>
      </section>
    </div>
  );
}
