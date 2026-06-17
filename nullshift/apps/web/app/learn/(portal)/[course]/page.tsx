import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { T } from "@nullshift/ui/tokens";

const COURSES: Record<string, {
  title: string;
  description: string;
  modules: { title: string; lessons: { slug: string; title: string; duration: string; free?: boolean }[] }[];
}> = {
  "ai-fundamentals": {
    title: "AI Fundamentals",
    description: "Understand how modern AI tools work, where they're headed, and how to evaluate them for your workflow. No technical background required.",
    modules: [
      {
        title: "Module 1 — How AI Actually Works",
        lessons: [
          { slug: "what-is-a-language-model", title: "What is a language model?", duration: "12 min", free: true },
          { slug: "training-data-and-bias", title: "Training data and bias", duration: "10 min" },
          { slug: "capabilities-and-limits", title: "Capabilities and limits", duration: "14 min" },
        ],
      },
      {
        title: "Module 2 — The AI Tool Landscape",
        lessons: [
          { slug: "mapping-the-tools", title: "Mapping the tools", duration: "18 min" },
          { slug: "choosing-the-right-tool", title: "Choosing the right tool", duration: "11 min" },
          { slug: "multimodal-ai", title: "Multimodal AI — text, image, voice", duration: "15 min" },
        ],
      },
      {
        title: "Module 3 — AI in Practice",
        lessons: [
          { slug: "real-world-use-cases", title: "Real-world use cases", duration: "20 min" },
          { slug: "evaluating-output-quality", title: "Evaluating output quality", duration: "9 min" },
        ],
      },
    ],
  },
  "workflow-automation": {
    title: "Workflow Automation",
    description: "Connect your tools, eliminate repetitive tasks, and build automated systems that run without you.",
    modules: [
      {
        title: "Module 1 — Automation Foundations",
        lessons: [
          { slug: "what-is-automation", title: "What is automation?", duration: "10 min", free: true },
          { slug: "mapping-your-workflows", title: "Mapping your workflows", duration: "16 min" },
          { slug: "triggers-actions-conditions", title: "Triggers, actions and conditions", duration: "14 min" },
        ],
      },
      {
        title: "Module 2 — No-Code Automation Tools",
        lessons: [
          { slug: "make-and-zapier", title: "Make and Zapier", duration: "22 min" },
          { slug: "n8n-self-hosted", title: "n8n — self-hosted automation", duration: "18 min" },
          { slug: "connecting-apis", title: "Connecting APIs without code", duration: "20 min" },
        ],
      },
      {
        title: "Module 3 — AI-Powered Automation",
        lessons: [
          { slug: "llms-in-workflows", title: "Using LLMs inside workflows", duration: "17 min" },
          { slug: "email-automation", title: "Email automation with AI triage", duration: "15 min" },
          { slug: "document-processing", title: "Document processing pipelines", duration: "19 min" },
          { slug: "monitoring-your-automations", title: "Monitoring and maintaining automations", duration: "12 min" },
        ],
      },
    ],
  },
  "prompt-engineering": {
    title: "Prompt Engineering",
    description: "Get consistently great output from AI. Learn the patterns, structures, and techniques that actually work.",
    modules: [
      {
        title: "Module 1 — Prompt Fundamentals",
        lessons: [
          { slug: "why-prompts-matter", title: "Why prompts matter", duration: "8 min", free: true },
          { slug: "anatomy-of-a-prompt", title: "Anatomy of a prompt", duration: "12 min" },
        ],
      },
      {
        title: "Module 2 — Core Techniques",
        lessons: [
          { slug: "chain-of-thought", title: "Chain-of-thought prompting", duration: "14 min" },
          { slug: "few-shot-examples", title: "Few-shot examples", duration: "11 min" },
          { slug: "role-and-persona", title: "Role and persona prompting", duration: "10 min" },
        ],
      },
      {
        title: "Module 3 — Applied Prompting",
        lessons: [
          { slug: "prompting-for-business", title: "Prompting for business tasks", duration: "18 min" },
        ],
      },
    ],
  },
};

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: courseSlug } = await params;
  const course = COURSES[courseSlug];
  if (!course) notFound();

  if (!hasSupabaseBrowserConfig()) {
    return <SetupScreen />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/learn/login?next=${encodeURIComponent(`/learn/${courseSlug}`)}`);
  }

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div
      className="px-6 md:px-10 py-10"
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in oklab, var(--color-primary) 10%, transparent) 0%, transparent 28%), radial-gradient(circle at left 22%, color-mix(in oklab, var(--color-info) 8%, transparent) 0%, transparent 26%)",
      }}
    >
      <div className="max-w-5xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", color: T.muted }}>
          <Link href="/learn" style={{ color: T.muted, textDecoration: "none" }}>Learn</Link>
          <span>/</span>
          <span style={{ color: T.primary }}>{course.title.toUpperCase().replace(/ /g, "_")}</span>
        </div>

        <div className="rounded-3xl p-8 md:p-10 mb-8" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow.md }}>
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary, background: `${T.primary}12`, border: `1px solid ${T.primary}24` }}>
            <span className="size-1.5 rounded-full" style={{ background: T.primary }} />
            <span>Course overview</span>
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(2.2rem,4.5vw,3.8rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: T.fg,
              marginBottom: "1rem",
            }}
          >
            {course.title}
          </h1>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              letterSpacing: "-0.005em",
              color: T.muted,
              maxWidth: "60ch",
              marginBottom: "1.2rem",
            }}
          >
            {course.description}
          </p>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>
            {course.modules.length} modules · {totalLessons} lessons
          </div>
        </div>

        {/* Modules */}
        <div className="flex flex-col gap-6">
          {course.modules.map((mod, mi) => (
            <section key={mi} className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow.sm }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: T.border }}>
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: T.primary,
                  }}
                >
                  {mod.title}
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: T.border }}>
                {mod.lessons.map((lesson, li) => (
                  <Link
                    key={lesson.slug}
                    href={`/learn/${courseSlug}/${lesson.slug}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors"
                    style={{
                      background: "transparent",
                      textDecoration: "none",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="size-7 rounded-full grid place-content-center shrink-0"
                        style={{ background: T.elevated, border: `1px solid ${T.borderStr}` }}
                      >
                        <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.muted }}>
                          {String(li + 1).padStart(2, "0")}
                        </span>
                      </span>
                      <span style={{ fontFamily: T.sans, fontSize: "0.9375rem", letterSpacing: "-0.005em", color: T.fg }}>
                        {lesson.title}
                      </span>
                      {lesson.free && (
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: "9px",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: T.primary,
                            background: `${T.primary}12`,
                            border: `1px solid ${T.primary}24`,
                            padding: "2px 8px",
                            borderRadius: T.r.full,
                          }}
                        >
                          Preview
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", color: T.muted }}>
                      {lesson.duration}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Start CTA */}
        <div className="mt-10">
          <Link
            href={`/learn/${courseSlug}/${course.modules[0].lessons[0].slug}`}
            className="inline-flex items-center gap-3 px-6 h-12 transition-opacity hover:opacity-90"
            style={{
              fontFamily: T.mono,
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 22%, transparent)`,
              textDecoration: "none",
            }}
          >
            Start from lesson 1 →
          </Link>
        </div>
      </div>
    </div>
  );
}

function SetupScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
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
        <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2rem", color: T.fg, marginBottom: "12px" }}>
          NOT CONFIGURED
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          Supabase environment variables are missing. Add them to <code>.env.local</code> and restart.
        </p>
      </div>
    </main>
  );
}
