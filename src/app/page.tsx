"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type LanguageStats = {
  attempts: number;
  averageScore: number;
  mastered: number;
  due: number;
};

type ProgressData = {
  range: "7d" | "30d";
  streakCount: number;
  totalAttempts: number;
  languageStats: Record<string, LanguageStats>;
};

type TodaySession = {
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
};

type ApiError = {
  status: number;
  message: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed.";
    throw { status: response.status, message } as ApiError;
  }
  return payload as T;
}

export default function MainDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  
  const [email, setEmail] = useState("you@example.com");
  const [password, setPassword] = useState("");
  
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [progressRes, sessionRes] = await Promise.all([
        fetch("/api/progress/summary?range=7d").then(readJson<ProgressData>),
        fetch("/api/session/today").then(readJson<TodaySession>),
      ]);

      setProgress(progressRes);
      setTodaySession(sessionRes);
      setAuthenticated(true);
    } catch (caught) {
      const apiError = caught as ApiError;
      if (apiError.status === 401) {
        setAuthenticated(false);
        setProgress(null);
        setTodaySession(null);
      } else {
        setError(apiError.message ?? "Could not load dashboard.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setProgress(null);
      setTodaySession(null);
      setInfo("Logged out.");
    } catch {
      setError("Logout failed.");
    }
  }

  const arStats = progress?.languageStats.ar_msa;
  const zhStats = progress?.languageStats.zh_hans;
  const totalMastered = (arStats?.mastered ?? 0) + (zhStats?.mastered ?? 0);
  const totalDue = (arStats?.due ?? 0) + (zhStats?.due ?? 0);

  if (loading) {
    return (
      <div className="animate-pulse page-transition">
        <div className="h-8 w-48 rounded bg-slate-200 mb-6"></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-32 rounded-2xl bg-slate-200"></div>
          <div className="h-32 rounded-2xl bg-slate-200"></div>
          <div className="h-32 rounded-2xl bg-slate-200"></div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex max-w-lg items-center py-12 page-transition">
        <div className="w-full rounded-3xl border border-slate-300 bg-white p-8 shadow-xl shadow-slate-200/70">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Language Learning</h1>
          <p className="mt-2 text-sm text-slate-600">
            Master Arabic and Chinese with spaced repetition.
          </p>

          <form className="mt-6 space-y-3" onSubmit={handleLogin}>
            <label className="block text-sm text-slate-700">
              Email
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-emerald-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </label>

            <label className="block text-sm text-slate-700">
              Password
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                minLength={8}
                required
              />
            </label>

            <button
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              type="submit"
            >
              Sign in
            </button>
          </form>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition">
        {error && (
          <div className="mb-4 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-800">{error}</div>
        )}
        {info && (
          <div className="mb-4 rounded-xl bg-emerald-100 px-4 py-2 text-sm text-emerald-900">{info}</div>
        )}

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Your progress</p>
            <h1 className="text-3xl font-semibold text-slate-900">Arabic + Chinese</h1>
            <p className="text-sm text-slate-600">
              {todaySession?.date.slice(0, 10)} • Today: {todaySession?.languageLabel}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:border-slate-500"
              onClick={() => void bootstrap()}
            >
              Refresh
            </button>
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:border-slate-500"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Global streak</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{progress?.streakCount ?? 0}</p>
            <p className="text-sm text-slate-600">days</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cards mastered</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{totalMastered}</p>
            <p className="text-sm text-slate-600">across both languages</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Due for review</p>
            <p className="mt-2 text-3xl font-semibold text-rose-600">{totalDue}</p>
            <p className="text-sm text-slate-600">cards waiting</p>
          </article>
        </section>

        {/* Language Cards */}
        <section className="grid gap-4 md:grid-cols-2">
          {/* Arabic Card */}
          <Link
            href="/ar"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
          >
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-8 rounded-full bg-emerald-100/50 transition-transform group-hover:scale-110" />
            
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-900 lang-ar">العربية</h2>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                  Arabic (MSA)
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Mastered</span>
                  <span className="font-medium text-slate-900">{arStats?.mastered ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Due now</span>
                  <span className={`font-medium ${(arStats?.due ?? 0) > 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {arStats?.due ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Avg score</span>
                  <span className="font-medium text-slate-900">{arStats?.averageScore ?? 0}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">7-day attempts</span>
                  <span className="font-medium text-slate-900">{arStats?.attempts ?? 0}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-600">
                <span>Start learning</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* Chinese Card */}
          <Link
            href="/zh"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-cyan-300 hover:shadow-md"
          >
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-8 rounded-full bg-cyan-100/50 transition-transform group-hover:scale-110" />
            
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-900 lang-zh">中文</h2>
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-800">
                  Mandarin
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Mastered</span>
                  <span className="font-medium text-slate-900">{zhStats?.mastered ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Due now</span>
                  <span className={`font-medium ${(zhStats?.due ?? 0) > 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {zhStats?.due ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Avg score</span>
                  <span className="font-medium text-slate-900">{zhStats?.averageScore ?? 0}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">7-day attempts</span>
                  <span className="font-medium text-slate-900">{zhStats?.attempts ?? 0}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm font-medium text-cyan-600">
                <span>Start learning</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>
        </section>

        {/* Footer info */}
        <footer className="mt-8 text-center text-xs text-slate-500">
          <p>Select a language above to continue learning</p>
        </footer>
    </div>
  );
}
