import { notFound } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/tokens";

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

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className="px-8 md:px-12 py-10 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", color: T.muted }}>
        <Link href="/learn" style={{ color: T.muted, textDecoration: "none" }}>LEARN</Link>
        <span>/</span>
        <span style={{ color: T.primary }}>{course.title.toUpperCase().replace(/ /g, "_")}</span>
      </div>

      {/* Header */}
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 900,
          fontSize: "clamp(2.2rem,4.5vw,3.5rem)",
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: T.fg,
          marginBottom: "1rem",
        }}
      >
        {course.title.toUpperCase()}
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9375rem",
          lineHeight: 1.65,
          letterSpacing: "-0.005em",
          color: T.muted,
          maxWidth: "56ch",
          marginBottom: "0.75rem",
        }}
      >
        {course.description}
      </p>
      <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>
        {course.modules.length} modules · {totalLessons} lessons
      </div>

      {/* Divider */}
      <div className="my-8 h-px" style={{ background: T.border }} />

      {/* Modules */}
      <div className="flex flex-col gap-8">
        {course.modules.map((mod, mi) => (
          <div key={mi}>
            <div
              className="mb-3"
              style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary }}
            >
              {mod.title}
            </div>
            <div className="flex flex-col rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              {mod.lessons.map((lesson, li) => (
                <Link
                  key={lesson.slug}
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-900"
                  style={{
                    borderTop: li > 0 ? `1px solid ${T.border}` : "none",
                    background: "transparent",
                    textDecoration: "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-6 rounded-full grid place-content-center shrink-0"
                      style={{ background: T.surface2, border: `1px solid ${T.border}` }}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.muted }}>
                        {String(li + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span style={{ fontFamily: T.sans, fontSize: "0.875rem", letterSpacing: "-0.005em", color: T.fg }}>
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
                          background: `${T.primary}15`,
                          border: `1px solid ${T.primary}30`,
                          padding: "1px 6px",
                          borderRadius: T.r.full,
                        }}
                      >
                        preview
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", color: T.muted }}>
                    {lesson.duration}
                  </span>
                </Link>
              ))}
            </div>
          </div>
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
            boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)`,
            textDecoration: "none",
          }}
        >
          Start from lesson 1 →
        </Link>
      </div>
    </div>
  );
}
