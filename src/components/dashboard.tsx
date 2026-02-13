"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type TodayData = {
  date: string;
  language: "ar_msa" | "zh_hans";
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
  unlockedPatternNotes: Array<{
    id: string;
    title: string;
    explanation: string;
    exposureCount: number;
  }>;
};

type ProgressData = {
  range: "7d" | "30d";
  streakCount: number;
  totalAttempts: number;
  attemptsBySkill: Record<string, number>;
  languageStats: Record<
    string,
    {
      attempts: number;
      averageScore: number;
      mastered: number;
      due: number;
    }
  >;
};

type QueueCard = {
  id: string;
  lexicalItemId: string;
  language: "ar_msa" | "zh_hans";
  domain: string;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  dueAt: string;
  state: string;
  transliterationStage: number;
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
    transliterationStage: number;
    transliterationRevealAvailable: boolean;
  }>;
};

type ReminderPref = {
  enabled: boolean;
  localTime: string;
  timezone: string;
};

type LocalSpeechHealth = {
  available: boolean;
  endpoint: string;
  whisperModel?: string | null;
  ttsBackend?: string | null;
};

type ApiError = {
  status: number;
  message: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed.";
    throw {
      status: response.status,
      message,
    } as ApiError;
  }

  return payload as T;
}

function asPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function languageClass(language: "ar_msa" | "zh_hans") {
  return language === "ar_msa" ? "lang-ar" : "lang-zh";
}

function languageLocale(language: "ar_msa" | "zh_hans"): string {
  return language === "ar_msa" ? "ar-SA" : "zh-CN";
}

function supportsAudioRecording(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hasMediaDevices = Boolean(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function",
  );

  return hasMediaDevices && typeof MediaRecorder !== "undefined";
}

function pickRecorderMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];

  return preferred.find((type) => MediaRecorder.isTypeSupported(type));
}

export function Dashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState("you@example.com");
  const [password, setPassword] = useState("");

  const [today, setToday] = useState<TodayData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [lessonPreview, setLessonPreview] = useState<LessonPreview | null>(null);

  const [reminder, setReminder] = useState<ReminderPref>({
    enabled: false,
    localTime: "20:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  const [pronItemId, setPronItemId] = useState("");
  const [pronTranscript, setPronTranscript] = useState("");
  const [activeVoiceCardId, setActiveVoiceCardId] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [localSpeech, setLocalSpeech] = useState<LocalSpeechHealth | null>(null);

  const progressRows = useMemo(() => {
    if (!progress) {
      return [];
    }

    return [
      { code: "ar_msa", label: "Arabic", ...progress.languageStats.ar_msa },
      { code: "zh_hans", label: "Chinese", ...progress.languageStats.zh_hans },
    ];
  }, [progress]);

  const loadQueue = useCallback(async (language?: string) => {
    try {
      const query = language ? `?language=${language}&limit=24` : "?limit=24";
      const result = await fetch(`/api/review/queue${query}`).then(
        readJson<{ dueCount: number; cards: QueueCard[] }>,
      );

      setQueue(result.cards);
      setPronItemId((current) => current || result.cards[0]?.lexicalItemId || "");
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Unable to load review queue.");
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [todayRes, progressRes, reminderRes] = await Promise.all([
        fetch("/api/session/today").then(readJson<TodayData>),
        fetch("/api/progress/summary?range=7d").then(readJson<ProgressData>),
        fetch("/api/reminders/preferences").then(readJson<ReminderPref>),
      ]);

      setToday(todayRes);
      setProgress(progressRes);
      setReminder(reminderRes);
      setAuthenticated(true);

      if (todayRes.nextLesson) {
        const preview = await fetch(`/api/lesson/${todayRes.nextLesson.id}`).then(readJson<LessonPreview>);
        setLessonPreview(preview);
      } else {
        setLessonPreview(null);
      }

      await loadQueue(todayRes.language);

      const localSpeechRes = await fetch("/api/pronunciation/health").then(
        readJson<LocalSpeechHealth>,
      );
      setLocalSpeech(localSpeechRes);
    } catch (caught) {
      const apiError = caught as ApiError;
      if (apiError.status === 401) {
        setAuthenticated(false);
        setToday(null);
        setProgress(null);
        setQueue([]);
        setLocalSpeech(null);
      } else {
        setError(apiError.message ?? "Could not load dashboard.");
      }
    } finally {
      setLoading(false);
    }
  }, [loadQueue]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVoiceReady(supportsAudioRecording());
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).then(readJson<{ user: { id: string; email: string } }>);

      setPassword("");
      await bootstrap();
      setInfo("Logged in.");
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError(null);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setToday(null);
      setProgress(null);
      setQueue([]);
      setLessonPreview(null);
      setInfo("Logged out.");
    } catch {
      setError("Logout failed.");
    } finally {
      setBusy(false);
    }
  }

  async function startSession() {
    if (!today) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: today.language }),
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

  async function gradeCard(reviewCardId: string, grade: "again" | "hard" | "good" | "easy") {
    setBusy(true);
    setError(null);

    try {
      await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewCardId, grade }),
      }).then(readJson<{ reviewCard: { id: string } }>);

      await bootstrap();
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not grade card.");
    } finally {
      setBusy(false);
    }
  }

  function playTargetAudioFallback(card: QueueCard): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.scriptText);
      utterance.lang = languageLocale(card.language);
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function playTargetAudio(card: QueueCard): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const response = await fetch(
        `/api/pronunciation/target-audio?lexicalItemId=${card.lexicalItemId}`,
      );

      if (!response.ok) {
        await playTargetAudioFallback(card);
        return;
      }

      const blob = await response.blob();
      if (!blob.size) {
        await playTargetAudioFallback(card);
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
        reject(new Error("Audio recording is not available in this browser."));
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

          recorder.onerror = () => {
            reject(new Error("Recording failed."));
          };

          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            void audioContext.close();
            if (chunks.length === 0) {
              reject(new Error("No audio captured. Try speaking louder and closer to mic."));
              return;
            }

            const blob = new Blob(chunks, { type: mimeType ?? "audio/webm" });
            resolve(blob);
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
        .catch(() => {
          reject(new Error("Microphone permission denied or unavailable."));
        });
    });
  }

  async function runVoiceDrill(card: QueueCard) {
    setBusy(true);
    setError(null);
    setInfo(null);
    setActiveVoiceCardId(card.id);

    try {
      if (!voiceReady) {
        throw new Error("Voice recording is not supported in this browser.");
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
          remainingMonthly: number;
          transcript?: string;
          components?: Record<string, number>;
        }>,
      );

      setInfo(
        `Transcript: "${result.transcript ?? "-"}". Score ${result.score}. ${result.feedback} Remaining today: ${result.remainingDaily}.`,
      );
      await bootstrap();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Voice drill failed.";
      setError(message);
    } finally {
      setBusy(false);
      setActiveVoiceCardId(null);
    }
  }

  async function submitPronunciation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pronItemId || !pronTranscript.trim()) {
      setError("Provide both lexical item id and transcript.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await fetch("/api/pronunciation/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lexicalItemId: pronItemId, transcript: pronTranscript }),
      }).then(
        readJson<{ score: number; feedback: string; remainingDaily: number; remainingMonthly: number }>,
      );

      setInfo(
        `Pronunciation score ${result.score}. ${result.feedback} Remaining today: ${result.remainingDaily}.`,
      );
      setPronTranscript("");
      await bootstrap();
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Pronunciation check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await fetch("/api/reminders/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminder),
      }).then(readJson<ReminderPref & { updatedAt: string }>);

      setReminder({ enabled: result.enabled, localTime: result.localTime, timezone: result.timezone });
      setInfo(`Reminder preferences saved (${result.timezone}).`);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.message ?? "Could not save reminder settings.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-10 text-sm text-slate-700">Loading your language dashboard...</div>;
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <div className="w-full rounded-3xl border border-slate-300 bg-white p-8 shadow-xl shadow-slate-200/70">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Language Learning MVP</h1>
          <p className="mt-2 text-sm text-slate-600">
            First login auto-creates your single account if no user exists yet.
          </p>

          <form className="mt-6 space-y-3" onSubmit={handleLogin}>
            <label className="block text-sm text-slate-700">
              Email
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-emerald-500"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>

            <label className="block text-sm text-slate-700">
              Password
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-emerald-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={8}
                required
              />
            </label>

            <button
              disabled={busy}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
              type="submit"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Daily guided lessons</p>
          <h1 className="text-3xl font-semibold text-slate-900">Arabic + Chinese Progress</h1>
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
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:border-slate-500"
            onClick={handleLogout}
            disabled={busy}
          >
            Logout
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-800">{error}</p> : null}
      {info ? <p className="mb-4 rounded-xl bg-emerald-100 px-4 py-2 text-sm text-emerald-900">{info}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Today</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{today?.languageLabel}</p>
          <p className="mt-1 text-sm text-slate-600">{today?.date.slice(0, 10)}</p>
          <p className="mt-3 text-sm text-slate-700">
            Session progress: {today?.session.completedMinutes}/{today?.session.plannedMinutes} min
          </p>
          <p className="text-sm text-slate-700">Streak: {today?.session.streakCount ?? 0}</p>
          <p className="text-sm text-slate-700">Reviews due: {today?.reviewQueueDue ?? 0}</p>
          <p className="text-sm text-slate-700">
            New content: {today?.allowNewContent ? "enabled" : "paused (backlog > 50)"}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Daily split</p>
          <p className="mt-3 text-sm text-slate-800">Review: {today ? asPercent(today.dailyAllocation.review) : "-"}</p>
          <p className="text-sm text-slate-800">New: {today ? asPercent(today.dailyAllocation.newContent) : "-"}</p>
          <p className="text-sm text-slate-800">
            Pronunciation: {today ? asPercent(today.dailyAllocation.pronunciation) : "-"}
          </p>

          {today?.nextLesson ? (
            <p className="mt-3 text-sm text-slate-700">
              Next lesson: {today.nextLesson.domain} #{today.nextLesson.sequenceNo} ({today.nextLesson.completedCount}/
              {today.nextLesson.lessonItemCount} seen)
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-700">No lesson assigned yet.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">7-day output</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{progress?.totalAttempts ?? 0}</p>
          <p className="text-sm text-slate-600">attempts</p>
          <p className="mt-3 text-sm text-slate-700">Global streak: {progress?.streakCount ?? 0}</p>
          <p className="text-sm text-slate-700">
            Listening: {progress?.attemptsBySkill.listening ?? 0} | Speaking: {progress?.attemptsBySkill.speaking ?? 0}
          </p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Language stats</h2>
          <div className="mt-3 space-y-2">
            {progressRows.map((row) => (
              <div key={row.code} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{row.label}</p>
                <p>Attempts: {row.attempts} | Avg score: {row.averageScore}</p>
                <p>Mastered: {row.mastered} | Due now: {row.due}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reminder settings</h2>
          <form className="mt-3 space-y-3" onSubmit={saveReminder}>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={reminder.enabled}
                onChange={(event) =>
                  setReminder((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              Enable daily reminder
            </label>

            <label className="block text-sm text-slate-700">
              Time
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                type="time"
                value={reminder.localTime}
                onChange={(event) =>
                  setReminder((current) => ({
                    ...current,
                    localTime: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700">
              Timezone
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                value={reminder.timezone}
                onChange={(event) =>
                  setReminder((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-70"
              disabled={busy}
            >
              Save reminder
            </button>
          </form>
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Lesson preview</h2>
        {lessonPreview ? (
          <>
            <p className="mt-2 text-sm text-slate-700">
              {lessonPreview.lesson.domain} #{lessonPreview.lesson.sequenceNo} ({lessonPreview.lesson.estimatedMinutes} min)
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lessonPreview.items.map((item) => (
                <div key={item.lexicalItemId} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className={`text-lg font-medium ${languageClass(today?.language ?? "ar_msa")}`}>{item.scriptText}</p>
                  <p className="text-slate-600">{item.transliteration ?? "(hidden, tap reveal in drill)"}</p>
                  <p className="text-slate-700">{item.gloss}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-700">No lesson available yet.</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Voice practice</h2>
        <p className="mt-2 text-sm text-slate-700">
          Use each review card: first play the target audio, then speak and get scored.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Browser support: {voiceReady ? "microphone ready" : "microphone recording not available in this browser"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Local speech backend:{" "}
          {localSpeech?.available
            ? `online (${localSpeech.ttsBackend ?? "tts"} / ${localSpeech.whisperModel ?? "stt"})`
            : "offline - run `npm run speech:dev`"}
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={submitPronunciation}>
          <input
            value={pronItemId}
            onChange={(event) => setPronItemId(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Fallback: lexical item id"
          />
          <input
            value={pronTranscript}
            onChange={(event) => setPronTranscript(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Fallback: type transcript manually"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-70"
            disabled={busy}
          >
            Score typed transcript
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Review queue ({queue.length})</h2>
          <button
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-500"
            onClick={() => void loadQueue(today?.language)}
            disabled={busy}
          >
            Reload queue
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {queue.map((card) => (
            <article key={card.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {card.domain} | {card.state}
              </p>
              <p className={`text-2xl font-medium text-slate-900 ${languageClass(card.language)}`}>{card.scriptText}</p>
              <p className="text-sm text-slate-600">{card.transliteration ?? "(transliteration hidden)"}</p>
              <p className="text-sm text-slate-800">{card.gloss}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-900 hover:border-emerald-500"
                  disabled={busy}
                  onClick={() => {
                    setPronItemId(card.lexicalItemId);
                    void playTargetAudio(card);
                  }}
                >
                  Play target
                </button>
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 hover:border-amber-500 disabled:opacity-60"
                  disabled={busy || !voiceReady || !localSpeech?.available}
                  onClick={() => {
                    setPronItemId(card.lexicalItemId);
                    void runVoiceDrill(card);
                  }}
                >
                  {activeVoiceCardId === card.id ? "Recording..." : "Speak & score"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(["again", "hard", "good", "easy"] as const).map((grade) => (
                  <button
                    key={grade}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:border-slate-600"
                    disabled={busy}
                    onClick={() => void gradeCard(card.id, grade)}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
