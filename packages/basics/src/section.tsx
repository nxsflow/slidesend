import {
  Block,
  blockSlot,
  cssVariable,
  defineSlide,
  FitBox,
  type NodeContext,
  type SlideProps,
  type StepDescription,
  stageHeight,
  stepMeta,
  usePresentation,
} from "@slidesend/core";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

const panelSchema = z.object({
  /** The block this panel shows. A panel without one shows only the heading. */
  content: blockSlot().optional(),
  /** Center the content, e.g. a statement; otherwise it starts at the left. */
  centered: z.boolean().default(false),
  ...stepMeta,
});

const sectionSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  /**
   * Start with the title large and centered as a step of its own; it then travels up and
   * becomes the heading. The top-level step fields describe that first step.
   */
  hero: z.boolean().default(false),
  panels: z.array(panelSchema).default([]),
  ...stepMeta,
});

type SectionData = z.output<typeof sectionSchema>;

/** How long the title travels and a leaving section moves out, in ms. */
export const sectionMotionMs = 820;
const carouselMs = 700;
const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

/** The steps each panel takes: one, or as many as its block builds up in. */
function panelSteps(data: SectionData, stepsOf: NodeContext["stepsOf"]): number[] {
  return data.panels.map((panel) => (panel.content ? stepsOf(panel.content) : 1));
}

/** Leaves out undefined fields, so they do not hide what a block describes. */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

/** Where a section's step lands: the hero title, or a panel and the step within its block. */
export function sectionPosition(
  data: SectionData,
  counts: readonly number[],
  step: number,
): { hero: true } | { hero: false; panel: number; inner: number } {
  if (data.hero && step === 0) return { hero: true };
  let rest = step - (data.hero ? 1 : 0);
  for (let panel = 0; panel < counts.length; panel++) {
    const count = counts[panel] as number;
    if (rest < count) return { hero: false, panel, inner: rest };
    rest -= count;
  }
  return { hero: false, panel: Math.max(0, counts.length - 1), inner: 0 };
}

/** Title size by length, so long titles never reach the edge. */
function titlePx(text: string, hero: boolean): number {
  if (hero) return text.length <= 30 ? 132 : text.length <= 60 ? 104 : 78;
  return text.length <= 34 ? 76 : text.length <= 64 ? 62 : 50;
}

const headerTop = 86;

function SectionSlide({ data, step, direction, presence }: SlideProps<SectionData>) {
  const { registry } = usePresentation();
  const counts = useMemo(() => panelSteps(data, registry.stepsOf), [data, registry]);
  const position = sectionPosition(data, counts, step);
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const carousel = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  const [headerHeight, setHeaderHeight] = useState<number>();
  const small = titlePx(data.title, false) / titlePx(data.title, true);

  // The title always has its hero size and is only moved and scaled, so it never re-wraps.
  useLayoutEffect(() => {
    if (!data.hero) return;
    const height = header.current?.scrollHeight ?? 0;
    setLift(Math.max(0, Math.round(stageHeight / 2 - headerTop - height / 2)));
    setHeaderHeight(Math.round(height * small));
  }, [data.hero, small]);

  // The section moves in and out like scrolling: up when going forward, down when going back.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || presence === "present" || !element.animate) return;
    const away = direction === "forward" ? "-100%" : "100%";
    const from = direction === "forward" ? "100%" : "-100%";
    const frames =
      presence === "entering"
        ? [
            { transform: `translateY(${from})`, opacity: 0.35 },
            { opacity: 1, offset: 0.3 },
            { transform: "translateY(0)", opacity: 1 },
          ]
        : [
            { transform: "translateY(0)", opacity: 1 },
            { opacity: 1, offset: 0.7 },
            { transform: `translateY(${away})`, opacity: 0.35 },
          ];
    const animation = element.animate(frames, {
      duration: sectionMotionMs,
      easing: ease,
      fill: "both",
    });
    return () => animation.cancel();
  }, [presence, direction]);

  // The panels of a hero section rise into place while the title travels up.
  const heroShown = position.hero;
  useLayoutEffect(() => {
    if (!data.hero || heroShown || !carousel.current?.animate) return;
    const animation = carousel.current.animate(
      [
        { transform: "translateY(64px)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: carouselMs, easing: ease, fill: "both" },
    );
    return () => animation.cancel();
  }, [data.hero, heroShown]);

  const panel = position.hero ? 0 : position.panel;
  const text = `var(${cssVariable("color", "text")})`;
  const muted = `var(${cssVariable("color", "textMuted")})`;
  return (
    <div
      ref={root}
      data-section
      data-hero={position.hero || undefined}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: `${headerTop}px 108px 104px`,
        willChange: presence === "present" ? undefined : "transform, opacity",
      }}
    >
      <div
        ref={header}
        data-section-title
        style={{
          display: "flex",
          flex: "none",
          flexDirection: "column",
          alignItems: data.hero ? "center" : "flex-start",
          textAlign: data.hero ? "center" : "start",
          ...(data.hero
            ? {
                height: headerHeight,
                transform: position.hero ? `translateY(${lift}px)` : `scale(${small})`,
                transformOrigin: "center top",
                transition: `transform ${sectionMotionMs}ms ${ease}`,
              }
            : {}),
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: `var(${cssVariable("font", "display")})`,
            fontSize: titlePx(data.title, data.hero),
            lineHeight: 1.12,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            textWrap: "balance",
            maxWidth: data.hero ? "20ch" : "26ch",
            color: text,
          }}
        >
          {data.title}
        </h1>
        {data.subtitle && (
          <p
            style={{
              margin: "22px 0 0",
              fontSize: 34,
              lineHeight: 1.36,
              color: muted,
              maxWidth: data.hero ? "38ch" : "52ch",
            }}
          >
            {data.subtitle}
          </p>
        )}
      </div>

      {!position.hero && data.panels.length > 0 && (
        <div
          ref={carousel}
          data-carousel
          style={{ position: "relative", marginTop: 44, minHeight: 0, flex: 1, overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              height: "100%",
              transform: `translateX(-${panel * 100}%)`,
              transition: `transform ${carouselMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {data.panels.map((item, index) => {
              const active = index === panel;
              const count = counts[index] ?? 1;
              // Panels already passed show their last step, later ones their first.
              const inner =
                active && !position.hero ? position.inner : index < panel ? count - 1 : 0;
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: panels have no identity besides their position
                  key={index}
                  data-panel={index}
                  data-active={active || undefined}
                  aria-hidden={!active || undefined}
                  style={{
                    width: "100%",
                    height: "100%",
                    flexShrink: 0,
                    opacity: active ? 1 : 0,
                    transition: `opacity ${carouselMs}ms ${active ? "ease-out" : "ease-in"}`,
                  }}
                >
                  {item.content && (
                    <FitBox measureKey={index} centered={item.centered}>
                      <Block node={item.content} step={inner} direction={direction} />
                    </FitBox>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionPrint({ data }: { data: SectionData }) {
  const { registry } = usePresentation();
  return (
    <div data-section-print>
      <h1 style={{ fontFamily: `var(${cssVariable("font", "display")})`, margin: 0 }}>
        {data.title}
      </h1>
      {data.subtitle && <p>{data.subtitle}</p>}
      {data.panels.map(
        (item, index) =>
          item.content && (
            // biome-ignore lint/suspicious/noArrayIndexKey: panels have no identity besides their position
            <div key={index}>
              <Block node={item.content} step={registry.stepsOf(item.content) - 1} />
            </div>
          ),
      )}
    </div>
  );
}

/**
 * The section: a title, an optional subtitle, and panels that move horizontally like a carousel
 * (spec §6.1). Each panel holds one block and its step fields; a block that builds up takes as
 * many steps as it needs and stays in place while it builds. With `hero`, the section opens with
 * its title large and centered, which then travels up to become the heading.
 */
export const section = defineSlide({
  type: "section",
  schema: sectionSchema,
  leaveMs: sectionMotionMs,
  steps: (data, { stepsOf }) =>
    Math.max(1, (data.hero ? 1 : 0) + panelSteps(data, stepsOf).reduce((sum, n) => sum + n, 0)),
  describe: (data, { describe }) => {
    const { notes, cue, minutes, activity, print } = data;
    const steps: StepDescription[] = data.hero
      ? [{ ...defined({ notes, cue, minutes, activity, print }), frame: { heroTitle: true } }]
      : [];
    for (const { content, centered: _centered, ...own } of data.panels) {
      const nested = content ? describe(content).steps : [{}];
      nested.forEach((step, index) => {
        steps.push(
          index === 0
            ? { ...step, ...defined(own), activity: own.activity ?? step.activity }
            : { ...step, activity: step.activity ?? own.activity },
        );
      });
    }
    return { label: data.title, steps: steps.length > 0 ? steps : [{}] };
  },
  Component: SectionSlide,
  Print: SectionPrint,
});
