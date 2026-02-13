"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LanguageCode = "ar_msa" | "zh_hans";
type Grade = "again" | "hard" | "good" | "easy";

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
};

type GalleryDomain = {
  domain: string;
  count: number;
  items: GalleryItem[];
};

type GalleryResponse = {
  language: LanguageCode;
  total: number;
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
};

type FlashcardsResponse = {
  language: LanguageCode;
  dueCount: number;
  cards: Flashcard[];
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

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
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
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [gallerySearch, setGallerySearch] = useState("");

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardDueCount, setFlashcardDueCount] = useState(0);
  const [activeLexicalItemId, setActiveLexicalItemId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
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

  const totalGalleryItems = useMemo(
    () => galleryDomains.reduce((total, domain) => total + domain.items.length, 0),
    [galleryDomains],
  );

  const filteredGalleryDomains = useMemo(() => {
    const normalizedSearch = gallerySearch.trim().toLowerCase();
    const activeDomain = selectedDomain;

    return galleryDomains
      .filter((group) => activeDomain === "all" || group.domain === activeDomain)
      .map((group) => {
        const items = normalizedSearch
          ? group.items.filter((item) => {
              const haystack = `${item.scriptText} ${item.transliteration ?? ""} ${item.gloss}`.toLowerCase();
              return haystack.includes(normalizedSearch);
            })
          : group.items;

        return {
          domain: group.domain,
          count: items.length,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [galleryDomains, selectedDomain, gallerySearch]);

  const loadGallery = useCallback(async () => {
    const result = await fetch(`/api/vocabulary/gallery?language=${languageCode}&limit=1000`).then(
      readJson<GalleryResponse>,
    );

    setGalleryDomains(result.domains);
  }, [languageCode]);

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

      const [speechHealth] = await Promise.all([
        fetch("/api/pronunciation/health").then(readJson<LocalSpeechHealth>),
        loadGallery(),
        loadFlashcards(),
      ]);

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
  }, [languageCode, loadFlashcards, loadGallery]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVoiceReady(supportsAudioRecording());
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (currentCard) {
      setActiveLexicalItemId(currentCard.lexicalItemId);
    }
  }, [currentCard]);

  useEffect(() => {
    setRevealed(false);
  }, [activeLexicalItemId]);

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

  function playTargetAudioFallback(card: Flashcard): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.scriptText);
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

  async function playTargetAudio(card: Flashcard): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const response = await fetch(`/api/pronunciation/target-audio?lexicalItemId=${card.lexicalItemId}`);
      if (!response.ok) {
        await playTargetAudioFallback(card);
        return;
      }

      const blob = await response.blob();
      if (!blob.size) {
        await playTargetAudioFallback(card);
        return;
      }

      prefetchedAudioIdsRef.current.add(card.lexicalItemId);
      prefetchNextCardAudio(card.lexicalItemId);

      await new Promise<void>((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.onended = () => {
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        audio.onerror = async () => {
          URL.revokeObjectURL(objectUrl);
          await playTargetAudioFallback(card);
          resolve();
        };
        void audio.play().catch(async () => {
          URL.revokeObjectURL(objectUrl);
          await playTargetAudioFallback(card);
          resolve();
        });
      });
    } catch {
      await playTargetAudioFallback(card);
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

  async function runVoiceDrill(card: Flashcard) {
    setBusy(true);
    setError(null);
    setInfo(null);
    setActiveVoiceCardId(card.lexicalItemId);

    try {
      if (!voiceReady) {
        throw new Error("Voice recording not supported.");
      }

      await playTargetAudio(card);
      const audioBlob = await recordAudioSample();
      const formData = new FormData();
      formData.set("lexicalItemId", card.lexicalItemId);
      formData.set("audio", audioBlob, "attempt.webm");

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
        <a href="#gallery" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
          Gallery
        </a>
        <a href="#flashcards" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
          Flashcards
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
                <p className={`text-lg font-medium ${languageClassName}`}>{item.scriptText}</p>
                <p className="text-slate-600">{item.transliteration ?? "-"}</p>
                <p className="text-slate-700">{item.gloss}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="gallery" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Vocabulary Gallery ({totalGalleryItems})</h2>
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
            {galleryDomains.map((group) => (
              <button
                key={group.domain}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selectedDomain === group.domain
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => setSelectedDomain(group.domain)}
                type="button"
              >
                {group.domain}
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

        {filteredGalleryDomains.length === 0 ? (
          <p className="text-sm text-slate-600">No gallery matches this filter.</p>
        ) : (
          <div className="space-y-5">
            {filteredGalleryDomains.map((group) => (
              <div key={group.domain}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {group.domain} ({group.count})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <article key={item.lexicalItemId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wider text-slate-500">{item.itemType}</p>
                      <p className={`text-2xl font-medium text-slate-900 ${languageClassName}`}>{item.scriptText}</p>
                      <p className="text-sm text-slate-600">{item.transliteration ?? "-"}</p>
                      <p className="text-sm text-slate-800">{item.gloss}</p>
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
      </section>

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
                {currentCard.scriptText}
              </p>

              {revealed ? (
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-slate-600">{currentCard.transliteration ?? "-"}</p>
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
                <button
                  className={accentPlayClass}
                  disabled={busy}
                  onClick={() => void playTargetAudio(currentCard)}
                  type="button"
                >
                  Play
                </button>
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                  disabled={busy || !voiceReady || !localSpeech?.available}
                  onClick={() => void runVoiceDrill(currentCard)}
                  type="button"
                >
                  {activeVoiceCardId === currentCard.lexicalItemId ? "Recording..." : "Speak"}
                </button>
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
