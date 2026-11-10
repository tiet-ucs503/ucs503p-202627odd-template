"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  authErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/services/auth";
import { Alert, Button, Input } from "@/components/ui";
import { readDraft } from "@/lib/draft-storage";
import { cn } from "@/lib/utils";

function postSignInDestination(): string {
  return readDraft() ? "/trips/new" : "/dashboard";
}

type Mode = "sign-in" | "sign-up";
type Field = "name" | "email" | "password";

const MIN_PASSWORD = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const copy: Record<Mode, { title: string; subtitle: string; submit: string; alt: string; altHref: string; altLabel: string }> = {
  "sign-in": {
    title: "Welcome back",
    subtitle: "Sign in to see your trips.",
    submit: "Sign in",
    alt: "New to TripEase?",
    altHref: "/sign-up",
    altLabel: "Create an account",
  },
  "sign-up": {
    title: "Create your account",
    subtitle: "It's free, and your first trip takes a few minutes.",
    submit: "Create account",
    alt: "Already have an account?",
    altHref: "/sign-in",
    altLabel: "Sign in",
  },
};

/** What is wrong with the email and password, or nothing at all. */
function validate(mode: Mode, email: string, password: string): Partial<Record<Field, string>> {
  const problems: Partial<Record<Field, string>> = {};
  if (!email.trim()) problems.email = "Enter your email address.";
  else if (!EMAIL.test(email.trim())) problems.email = "That email address doesn't look right.";

  if (!password) problems.password = mode === "sign-up" ? "Choose a password." : "Enter your password.";
  else if (mode === "sign-up" && password.length < MIN_PASSWORD) problems.password = `Use at least ${MIN_PASSWORD} characters.`;
  return problems;
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
}

/** Closing the Google window is a choice, not a failure, so it isn't shown as one. */
const DISMISSED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

/**
 * Google's own "G", in its four colours. Google's branding rules ask for this
 * mark unaltered on a plain light or dark button, so it is drawn exactly and
 * never recoloured with the theme.
 */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Spinner() {
  return <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />;
}

/** A labelled input with its error (or hint) tied to it for screen readers. */
function AuthField({
  id,
  label,
  error,
  hint,
  trailing,
  inputClassName,
  ...input
}: {
  id: string;
  label: string;
  error?: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  inputClassName?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            error && "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/25",
            trailing && "pr-11",
            inputClassName,
          )}
          {...input}
        />
        {trailing ? <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-xs text-zinc-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const t = copy[mode];
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  /** A problem the server reported about one field, cleared when that field is edited. */
  const [serverField, setServerField] = useState<{ field: Field; message: ReactNode } | null>(null);
  const [formError, setFormError] = useState<{ message: string; tone: "error" | "info" } | null>(null);
  const [busy, setBusy] = useState<null | "email" | "google">(null);

  const problems = validate(mode, email, password);
  const showProblem = (field: Field) => (submitted || touched[field] ? problems[field] : undefined);
  const fieldError = (field: Field): ReactNode =>
    serverField?.field === field ? serverField.message : showProblem(field);

  function touch(field: Field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function edit(field: Field, set: (value: string) => void, value: string) {
    set(value);
    setFormError(null);
    if (serverField?.field === field) setServerField(null);
  }

  /** Put a server error where it belongs, and say it plainly. */
  function report(error: unknown) {
    const code = errorCode(error);
    const message = authErrorMessage(error);

    if (code === "auth/email-already-in-use") {
      setServerField({
        field: "email",
        message: (
          <>
            An account already exists for that email.{" "}
            <Link href="/sign-in" className="font-medium underline underline-offset-2">
              Sign in instead
            </Link>
            .
          </>
        ),
      });
    } else if (code === "auth/invalid-email") {
      setServerField({ field: "email", message });
    } else if (code === "auth/weak-password") {
      setServerField({ field: "password", message });
    } else {
      setFormError({ message, tone: DISMISSED.has(code) ? "info" : "error" });
    }
    setBusy(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    setServerField(null);

    const first = (["email", "password"] as const).find((field) => problems[field]);
    if (first) {
      formRef.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus();
      return;
    }

    setBusy("email");
    try {
      if (mode === "sign-up") {
        await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      router.replace(postSignInDestination());
    } catch (err) {
      report(err);
    }
  }

  async function handleGoogle() {
    setFormError(null);
    setServerField(null);
    setBusy("google");
    try {
      await signInWithGoogle();
      router.replace(postSignInDestination());
    } catch (err) {
      report(err);
    }
  }

  const longEnough = password.length >= MIN_PASSWORD;

  return (
    <div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">{t.title}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t.subtitle}</p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy !== null}
        className={cn(
          "mt-8 inline-flex h-11 w-full items-center justify-center gap-3 rounded-full border text-sm font-medium transition-colors",
          "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
          "dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f21]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {busy === "google" ? <Spinner /> : <GoogleLogo className="h-[18px] w-[18px]" />}
        {busy === "google" ? "Waiting for Google…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-zinc-500" role="separator" aria-label="or use your email">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or use your email
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {mode === "sign-up" ? (
          <AuthField
            id="name"
            label="Name (optional)"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="What should we call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : null}

        <AuthField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => edit("email", setEmail, e.target.value)}
          onBlur={() => touch("email")}
          error={fieldError("email")}
        />

        <AuthField
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => edit("password", setPassword, e.target.value)}
          onBlur={() => touch("password")}
          error={fieldError("password")}
          hint={
            mode === "sign-up" ? (
              <span className={cn("inline-flex items-center gap-1.5", longEnough && "text-emerald-700 dark:text-emerald-400")}>
                {longEnough ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                At least {MIN_PASSWORD} characters
              </span>
            ) : undefined
          }
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-orange-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          }
        />

        {formError ? <Alert tone={formError.tone}>{formError.message}</Alert> : null}

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy !== null}>
          {busy === "email" ? (
            <>
              <Spinner />
              {mode === "sign-up" ? "Creating your account…" : "Signing in…"}
            </>
          ) : (
            t.submit
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        {t.alt}{" "}
        <Link href={t.altHref} className="font-medium text-orange-700 hover:underline dark:text-orange-400">
          {t.altLabel}
        </Link>
      </p>
    </div>
  );
}
