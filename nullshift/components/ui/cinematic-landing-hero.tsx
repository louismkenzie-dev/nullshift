"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { T } from "@/lib/tokens";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  .film-grain {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50; opacity: 0.05; mix-blend-mode: overlay;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .bg-grid-theme {
      background-size: 60px 60px;
      background-image:
          linear-gradient(to right, color-mix(in srgb, var(--color-foreground) 5%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, var(--color-foreground) 5%, transparent) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .text-3d-matte {
      color: var(--color-foreground);
      text-shadow:
          0 10px 30px color-mix(in srgb, var(--color-foreground) 20%, transparent),
          0 2px 4px color-mix(in srgb, var(--color-foreground) 10%, transparent);
  }

  .text-silver-matte {
      background: linear-gradient(180deg, var(--color-foreground) 0%, color-mix(in srgb, var(--color-foreground) 40%, transparent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 10px 20px color-mix(in srgb, var(--color-foreground) 15%, transparent))
          drop-shadow(0px 2px 4px color-mix(in srgb, var(--color-foreground) 10%, transparent));
  }

  .text-card-silver-matte {
      background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 12px 24px rgba(0,0,0,0.8))
          drop-shadow(0px 4px 8px rgba(0,0,0,0.6));
  }

  .premium-depth-card {
      background: linear-gradient(145deg, #162C6D 0%, #0A101D 100%);
      box-shadow:
          0 40px 100px -20px rgba(0, 0, 0, 0.9),
          0 20px 40px -20px rgba(0, 0, 0, 0.8),
          inset 0 1px 2px rgba(255, 255, 255, 0.2),
          inset 0 -2px 4px rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.04);
      position: relative;
  }

  .card-sheen {
      position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
      background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 40%);
      mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  .iphone-bezel {
      background-color: #111;
      box-shadow:
          inset 0 0 0 2px #52525B,
          inset 0 0 0 7px #000,
          0 40px 80px -15px rgba(0,0,0,0.9),
          0 15px 25px -5px rgba(0,0,0,0.7);
      transform-style: preserve-3d;
  }

  .hardware-btn {
      background: linear-gradient(90deg, #404040 0%, #171717 100%);
      box-shadow:
          -2px 0 5px rgba(0,0,0,0.8),
          inset -1px 0 1px rgba(255,255,255,0.15),
          inset 1px 0 2px rgba(0,0,0,0.8);
      border-left: 1px solid rgba(255,255,255,0.05);
  }

  .screen-glare {
      background: linear-gradient(110deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%);
  }

  .widget-depth {
      background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
      box-shadow:
          0 10px 20px rgba(0,0,0,0.3),
          inset 0 1px 1px rgba(255,255,255,0.05),
          inset 0 -1px 1px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.03);
  }

  .floating-ui-badge {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.1),
          0 25px 50px -12px rgba(0, 0, 0, 0.8),
          inset 0 1px 1px rgba(255,255,255,0.2),
          inset 0 -1px 1px rgba(0,0,0,0.5);
  }
`;

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
  scrollLabel?: string;
}

export function CinematicHero({
  eyebrow = "• SYS_01 / WEB_STUDIO",
  brandName = "",
  tagline1 = "BUILT FOR",
  tagline2 = "BUSINESSES\nDOING THE WORK.",
  cardHeading = "What we do",
  cardDescription = (
    <>
      Websites and branding for established businesses that want to look sharp, move fast, and convert visitors into customers.
    </>
  ),
  metricValue = 365,
  metricLabel = "Days Online",
  ctaHeading = "Book a discovery call",
  ctaDescription = "Nullshift Studio helps established businesses make the move online — with websites and branding built to last.",
  scrollLabel = "SCROLL",
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.scrollY > window.innerHeight * 2) return;
      cancelAnimationFrame(requestRef.current);

      requestRef.current = requestAnimationFrame(() => {
        if (mainCardRef.current && mockupRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          mainCardRef.current.style.setProperty("--mouse-x", `${mouseX}px`);
          mainCardRef.current.style.setProperty("--mouse-y", `${mouseY}px`);

          const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
          const yVal = (e.clientY / window.innerHeight - 0.5) * 2;

          gsap.to(mockupRef.current, {
            rotationY: xVal * 12,
            rotationX: -yVal * 12,
            ease: "power3.out",
            duration: 1.2,
          });
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const ctx = gsap.context(() => {
      gsap.set(".gsap-reveal", { visibility: "visible", autoAlpha: 1 });
      gsap.set(".hero-text-wrapper", { autoAlpha: 1, y: 0 });
      gsap.set(".main-card", { y: 0, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".mockup-scroll-wrapper", ".floating-badge", ".phone-widget"], { autoAlpha: 1 });

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=3200",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      scrollTl
        .to(".hero-text-wrapper", { autoAlpha: 0, y: -24, ease: "power3.out", duration: 0.8 }, 0.15)
        .to(".main-card", { y: 0, ease: "power3.inOut", duration: 1.4 }, 0)
        .to(".main-card", { width: "100%", height: "100%", borderRadius: "0px", ease: "power3.inOut", duration: 1.6 }, 0.2)
        .to(".mockup-scroll-wrapper", { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 1.8 }, 0.35)
        .to(".phone-widget", { y: 0, autoAlpha: 1, scale: 1, stagger: 0.12, ease: "back.out(1.2)", duration: 1.2 }, 0.7)
        .to(".floating-badge", { y: 0, autoAlpha: 1, scale: 1, ease: "back.out(1.4)", duration: 1.2, stagger: 0.2 }, 0.9)
        .to(".card-left-text", { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.1 }, 1)
        .to(".card-right-text", { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.1 }, 1)
        .to(".main-card", {
          width: isMobile ? "92vw" : "85vw",
          height: isMobile ? "92vh" : "85vh",
          borderRadius: isMobile ? "32px" : "40px",
          ease: "expo.inOut",
          duration: 1.4,
        }, 2.4);
    }, containerRef);

    return () => ctx.revert();
  }, [metricValue]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-screen h-screen overflow-hidden flex items-center justify-center bg-background text-foreground font-sans antialiased", className)}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="film-grain" aria-hidden="true" />
      <div className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      <div className="hero-text-wrapper absolute z-50 left-[4.5vw] top-[19vh] w-[min(90vw,46rem)] flex flex-col items-start justify-center text-left px-4 will-change-transform">
        <div className="gsap-reveal mb-5 flex items-center gap-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: `${T.primary}88` }}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          <span>{eyebrow}</span>
        </div>
        <h1 className="w-full text-track gsap-reveal text-3d-matte text-[clamp(3.3rem,7.4vw,5.8rem)] md:text-[clamp(4.2rem,8.3vw,7rem)] lg:text-[6.35rem] font-black tracking-tight leading-[0.84] pb-1 mb-4" style={{ fontFamily: T.display }}>
          <span className="block text-white">{tagline1}</span>
          {tagline2.split("\n").map((line, index) => (
            <span
              key={`${line}-${index}`}
              className="block"
              style={{
                color: index === 0 ? "#a1a1a6" : T.primary,
                textShadow: index === 1 ? `0 0 22px color-mix(in oklab, ${T.primary} 32%, transparent)` : undefined,
              }}
            >
              {line}
            </span>
          ))}
        </h1>
        <p className="gsap-reveal max-w-[30ch] text-balance text-sm md:text-base lg:text-[1.03rem] leading-[1.8] text-white/65 mb-8" style={{ fontFamily: T.sans }}>
          {ctaDescription}
        </p>
        <div className="gsap-reveal flex flex-col items-start gap-4">
          <a
            href="/book"
            className="inline-flex items-center gap-3 rounded-[2px] px-6 py-4 transition-transform duration-200 hover:-translate-y-0.5"
            style={{
              fontFamily: T.mono,
              fontSize: "0.95rem",
              letterSpacing: "0.02em",
              background: "#55c48f",
              color: "#0c1110",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            {ctaHeading}
            <span aria-hidden="true">→</span>
          </a>
          <div className="flex flex-col items-center gap-2 pl-1" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: `${T.muted}aa` }}>
            <span>{scrollLabel}</span>
            <span className="h-4 w-px bg-current opacity-70" />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card relative z-10 overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">
            {brandName ? (
              <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
                <h2 className="text-4xl md:text-[4.5rem] lg:text-[5.75rem] font-black normal-case tracking-tighter text-card-silver-matte leading-[0.9] lg:mt-0 text-center lg:text-right max-w-[8ch] lg:max-w-[9ch]" style={{ fontFamily: T.display, letterSpacing: "0.02em" }}>
                  {brandName}
                </h2>
              </div>
            ) : (
              <div className="order-1 lg:order-3 hidden lg:block" aria-hidden="true" />
            )}

            <div className="mockup-scroll-wrapper order-2 lg:order-2 relative w-full h-[380px] lg:h-[600px] flex items-center justify-center z-10" style={{ perspective: "1000px" }}>
              <div className="relative w-full h-full flex items-center justify-center transform scale-[0.7] md:scale-85 lg:scale-100">
                <div
                  ref={mockupRef}
                  className="relative w-[280px] h-[580px] rounded-[3rem] iphone-bezel flex flex-col will-change-transform transform-style-3d"
                >
                  <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] hardware-btn rounded-r-md z-0 scale-x-[-1]" aria-hidden="true" />

                  <div className="absolute inset-[7px] bg-[#050914] rounded-[2.5rem] overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,1)] text-white z-10">
                    <div className="absolute inset-0 screen-glare z-40 pointer-events-none" aria-hidden="true" />
                    <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50 flex items-center justify-end px-3 shadow-[inset_0_-1px_2px_rgba(255,255,255,0.1)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                    </div>

                    <div className="relative w-full h-full pt-12 px-5 pb-8 flex flex-col">
                      <div className="phone-widget flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1">Today</span>
                          <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">Journey</span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-white/5 text-neutral-200 flex items-center justify-center font-bold text-sm border border-white/10 shadow-lg shadow-black/50">JS</div>
                      </div>

                      <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 flex items-center justify-center mr-3 border border-blue-400/20 shadow-inner">
                          <svg className="w-4 h-4 text-blue-400 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-20 bg-neutral-300 rounded-full mb-2 shadow-inner" />
                          <div className="h-1.5 w-12 bg-neutral-600 rounded-full shadow-inner" />
                        </div>
                      </div>

                      <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center mb-5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 flex items-center justify-center mr-3 border border-emerald-400/20 shadow-inner">
                          <svg className="w-4 h-4 text-emerald-400 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-16 bg-neutral-300 rounded-full mb-2 shadow-inner" />
                          <div className="h-1.5 w-24 bg-neutral-600 rounded-full shadow-inner" />
                        </div>
                      </div>

                      <div className="phone-widget grid gap-3">
                        <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">01</span>
                            <span className="text-sm font-semibold text-white">What we do</span>
                          </div>
                          <p className="text-xs leading-6 text-neutral-300">
                            Web design, branding, and development built for businesses ready to move online.
                          </p>
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-blue-100/80">
                            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" aria-hidden="true" />
                            {metricLabel}
                          </div>
                        </div>
                        <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">02</span>
                            <span className="text-sm font-semibold text-white">Branding & identity</span>
                          </div>
                          <p className="text-xs leading-6 text-neutral-300">
                            Clean systems, strong visuals, and a premium feel that matches your business.
                          </p>
                        </div>
                      </div>

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-white/20 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    </div>
                  </div>
                </div>

                <div className="floating-badge absolute flex top-6 lg:top-12 left-[-15px] lg:left-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 lg:gap-4 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-blue-500/20 to-blue-900/10 flex items-center justify-center border border-blue-400/30 shadow-inner">
                    <span className="text-base lg:text-xl drop-shadow-lg" aria-hidden="true">🔥</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">1 Year Streak</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Milestone unlocked</p>
                  </div>
                </div>

                <div className="floating-badge absolute flex bottom-12 lg:bottom-20 right-[-15px] lg:right-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 lg:gap-4 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-indigo-500/20 to-indigo-900/10 flex items-center justify-center border border-indigo-400/30 shadow-inner">
                    <span className="text-base lg:text-lg drop-shadow-lg" aria-hidden="true">🤝</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">Sponsor Update</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Shared successfully</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full lg:max-w-none px-4 lg:px-0">
              <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-0 lg:mb-5 tracking-tight">
                {cardHeading}
              </h3>
              <div className="hidden md:block text-blue-100/70 text-sm md:text-base lg:text-lg font-normal leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-none">
                {cardDescription}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
