import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { T } from "@nullshift/ui/tokens";

// Minimal lesson metadata — in production this would come from a CMS or DB
const LESSON_META: Record<
  string,
  Record<
    string,
    {
      title: string;
      description: string;
      duration: string;
      next?: string;
      prev?: string;
      free?: boolean;
    }
  >
> = {
  "ai-fundamentals": {
    "what-is-a-language-model": {
      title: "What is a language model?",
      description:
        "We break down what a large language model actually is — without the jargon. By the end of this lesson you'll have a working mental model of how tools like ChatGPT and Claude generate text, and why that matters for how you use them.",
      duration: "12 min",
      next: "training-data-and-bias",
    },
    "training-data-and-bias": {
      title: "Training data and bias",
      description:
        "Where does an AI's knowledge come from, and why does it sometimes get things wrong or reflect certain perspectives? This lesson covers training data, fine-tuning, and what it means for the reliability of AI output.",
      duration: "10 min",
      prev: "what-is-a-language-model",
      next: "capabilities-and-limits",
    },
    "capabilities-and-limits": {
      title: "Capabilities and limits",
      description:
        "AI is powerful — but not magic. This lesson sets realistic expectations: what today's models genuinely excel at, where they fail, and the patterns of failure you should watch for.",
      duration: "14 min",
      prev: "training-data-and-bias",
      next: "mapping-the-tools",
    },
    "mapping-the-tools": {
      title: "Mapping the tools",
      description:
        "A structured tour of the current AI tool landscape — from language models to image generators, coding assistants, and voice AI. We map the categories so you can orient yourself.",
      duration: "18 min",
      prev: "capabilities-and-limits",
      next: "choosing-the-right-tool",
    },
    "choosing-the-right-tool": {
      title: "Choosing the right tool",
      description:
        "With hundreds of AI tools available, how do you pick? This lesson gives you a decision framework based on task type, cost, and capability — so you stop chasing new tools and start using the right ones.",
      duration: "11 min",
      prev: "mapping-the-tools",
      next: "multimodal-ai",
    },
    "multimodal-ai": {
      title: "Multimodal AI — text, image, voice",
      description:
        "Modern AI isn't just text. We cover multimodal models — tools that can see, hear, and generate across formats — and show you practical use cases for each.",
      duration: "15 min",
      prev: "choosing-the-right-tool",
      next: "real-world-use-cases",
    },
    "real-world-use-cases": {
      title: "Real-world use cases",
      description:
        "Moving from theory to practice — a collection of real use cases across business functions: writing, research, customer support, coding, and operations.",
      duration: "20 min",
      prev: "multimodal-ai",
      next: "evaluating-output-quality",
    },
    "evaluating-output-quality": {
      title: "Evaluating output quality",
      description:
        "How do you know if an AI-generated output is good? This lesson covers quality signals, verification habits, and the mindset shift needed to use AI reliably.",
      duration: "9 min",
      prev: "real-world-use-cases",
    },
  },
  "workflow-automation": {
    "what-is-automation": {
      title: "What is automation?",
      description:
        "A clear-eyed introduction to automation — what it is, what it isn't, and why it matters right now. We cover the core concepts that apply whether you're using Zapier, Make, or custom code.",
      duration: "10 min",
      next: "mapping-your-workflows",
    },
    "mapping-your-workflows": {
      title: "Mapping your workflows",
      description:
        "Before you automate anything, you need to understand what you're automating. This lesson walks through how to document and map a workflow so you can identify where automation adds the most value.",
      duration: "16 min",
      prev: "what-is-automation",
      next: "triggers-actions-conditions",
    },
  },
  "prompt-engineering": {
    "why-prompts-matter": {
      title: "Why prompts matter",
      description:
        "The same AI model can produce wildly different results depending on how you ask. This lesson demonstrates why prompting is a skill — and why learning it pays dividends across every AI tool you use.",
      duration: "8 min",
      next: "anatomy-of-a-prompt",
    },
    "anatomy-of-a-prompt": {
      title: "Anatomy of a prompt",
      description:
        "We dissect a well-structured prompt into its components: the role, the context, the task, the constraints, and the output format. Understanding this structure is the foundation for everything else.",
      duration: "12 min",
      prev: "why-prompts-matter",
      next: "chain-of-thought",
    },
  },
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const courseLessons = LESSON_META[courseSlug];
  if (!courseLessons) notFound();
  const lesson = courseLessons[lessonSlug];
  if (!lesson) notFound();

  if (!hasSupabaseBrowserConfig()) {
    return <SetupScreen />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/learn/login?next=${encodeURIComponent(`/learn/${courseSlug}/${lessonSlug}`)}`
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in oklab, var(--color-primary) 10%, transparent) 0%, transparent 28%), radial-gradient(circle at left 20%, color-mix(in oklab, var(--color-info) 8%, transparent) 0%, transparent 24%)",
      }}
    >
      <div className="px-6 md:px-10 pt-8 pb-12 max-w-5xl">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-2 mb-6"
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: T.muted,
          }}
        >
          <Link href="/learn" style={{ color: T.muted, textDecoration: "none" }}>
            Learn
          </Link>
          <span>/</span>
          <Link
            href={`/learn/${courseSlug}`}
            style={{ color: T.muted, textDecoration: "none" }}
          >
            {courseSlug.replace(/-/g, "_").toUpperCase()}
          </Link>
          <span>/</span>
          <span style={{ color: T.primary }}>
            {lessonSlug.replace(/-/g, "_").toUpperCase()}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            {/* Lesson header */}
            <div
              className="rounded-3xl p-8 md:p-10 mb-6"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadow.md,
              }}
            >
              <div
                className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full"
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: T.primary,
                  background: `${T.primary}12`,
                  border: `1px solid ${T.primary}24`,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: T.primary }}
                />
                <span>{lesson.duration}</span>
              </div>
              <h1
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(1.9rem,3.7vw,3rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: T.fg,
                  marginBottom: "1rem",
                }}
              >
                {lesson.title}
              </h1>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                  maxWidth: "62ch",
                }}
              >
                {lesson.description}
              </p>
            </div>

            {/* Video player placeholder */}
            <div
              className="w-full rounded-3xl mb-6 flex flex-col items-center justify-center gap-4"
              style={{
                aspectRatio: "16/9",
                background: T.surface,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadow.sm,
              }}
            >
              <div
                className="size-16 rounded-full grid place-content-center"
                style={{
                  background: `${T.primary}12`,
                  border: `1px solid ${T.primary}24`,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M6 4l12 6-12 6V4z" fill={T.primary} />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                Video placeholder / {lesson.duration.toUpperCase()}
              </span>
            </div>

            {/* Lesson nav */}
            <div className="flex items-center justify-between gap-4">
              {lesson.prev ? (
                <Link
                  href={`/learn/${courseSlug}/${lesson.prev}`}
                  className="flex items-center gap-2 px-5 h-11 rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.75rem",
                    letterSpacing: "0.06em",
                    color: T.fg,
                    border: `1px solid ${T.borderStr}`,
                    background: T.surface,
                    textDecoration: "none",
                  }}
                >
                  ← Previous
                </Link>
              ) : (
                <div />
              )}
              {lesson.next ? (
                <Link
                  href={`/learn/${courseSlug}/${lesson.next}`}
                  className="flex items-center gap-2 px-5 h-11 rounded-lg transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: `0 0 20px color-mix(in oklab, ${T.primary} 18%, transparent)`,
                    textDecoration: "none",
                  }}
                >
                  Next lesson →
                </Link>
              ) : (
                <Link
                  href={`/learn/${courseSlug}`}
                  className="flex items-center gap-2 px-5 h-11 rounded-lg transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: `0 0 20px color-mix(in oklab, ${T.primary} 18%, transparent)`,
                    textDecoration: "none",
                  }}
                >
                  Course complete →
                </Link>
              )}
            </div>
          </div>

          <aside
            className="rounded-3xl p-6 md:p-7 h-fit"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              boxShadow: T.shadow.sm,
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: T.muted,
                marginBottom: "12px",
              }}
            >
              Lesson details
            </div>
            <div className="space-y-4">
              <Metric label="Duration" value={lesson.duration} />
              <Metric
                label="Course"
                value={courseSlug.replace(/-/g, " ").toUpperCase()}
              />
              <Metric label="Mode" value={lesson.free ? "Preview" : "Members only"} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: T.elevated, border: `1px solid ${T.border}` }}
    >
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: T.muted,
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.05rem",
          letterSpacing: "-0.02em",
          color: T.fg,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SetupScreen() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: T.bg }}
    >
      <div className="text-center max-w-md">
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.danger,
            marginBottom: "16px",
          }}
        >
          SETUP_REQUIRED
        </div>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "2rem",
            color: T.fg,
            marginBottom: "12px",
          }}
        >
          NOT CONFIGURED
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          Supabase environment variables are missing. Add them to <code>.env.local</code>{" "}
          and restart.
        </p>
      </div>
    </main>
  );
}
