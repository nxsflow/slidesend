/**
 * The slidesend product page. The copy comes from the brand's copy deck
 * (nxsflow/brand, copy/slidesend-landing.md); see site/BRAND.md for the commit.
 *
 * Brand rules that shape it: the wordmark in the header and the icon only as the favicon; the
 * name always lowercase; violet as the spotlight, one lit element per view — here the install
 * command — never a fill for whole sections.
 */
import { Fragment, type ReactNode, useState } from "react";
import { links, SiteFooter, SiteHeader } from "./chrome";

const install = "npm create @slidesend@latest my-talk";

/** The install command with a copy button: the one lit element of the views it appears in. */
function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(install).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  };
  return (
    <div className="install">
      <code>
        <span className="prompt" aria-hidden="true">
          ${" "}
        </span>
        {/* Words that never break inside, so a narrow screen wraps only between them. */}
        {install.split(" ").map((word, index) => (
          <Fragment key={word}>
            {index > 0 && " "}
            <span className="word">{word}</span>
          </Fragment>
        ))}
      </code>
      <button type="button" onClick={copy} aria-label="Copy the install command">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Section({
  id,
  heading,
  children,
  tone,
}: {
  id: string;
  heading: string;
  children: ReactNode;
  tone?: "surface";
}) {
  return (
    <section id={id} className={tone === "surface" ? "band surface" : "band"}>
      <div className="wrap">
        <h2>{heading}</h2>
        {children}
      </div>
    </section>
  );
}

/** A screen in outline, so the three views read as three devices without screenshots. */
function Screen({ kind }: { kind: "stage" | "desk" | "phone" }) {
  return (
    <div className={`screen screen-${kind}`} aria-hidden="true">
      <span className="line wide" />
      <span className="line" />
      {kind === "stage" && <span className="qr" />}
      {kind === "desk" && <span className="clock">+0:42</span>}
      {kind === "phone" && (
        <>
          <span className="choice" />
          <span className="choice" />
        </>
      )}
    </div>
  );
}

export function App() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">Open source · Apache-2.0</p>
            <h1>A talk the room takes part in.</h1>
            <p className="lead">
              slidesend is a presentation tool for talks your audience joins on their phones. You
              write the talk with your AI agent, in TypeScript; the room answers polls and questions
              while you speak.
            </p>
            <InstallCommand />
            <p className="after-install">
              Then <code>cd my-talk</code> and <code>npm run dev</code>. Phones on your network can
              join right away — no cloud account needed.
            </p>
            <p>
              <a className="more" href={links.docs}>
                Read the docs →
              </a>
            </p>
          </div>
        </section>

        <Section id="views" heading="Three views of one talk." tone="surface">
          <p className="intro">Every talk runs on three screens at once, and they stay in step.</p>
          <ul className="cards three">
            <li>
              <Screen kind="stage" />
              <h3>Stage</h3>
              <p>
                What the room sees on the projector: the slide, the code to join, and the answers as
                they come in.
              </p>
            </li>
            <li>
              <Screen kind="desk" />
              <h3>Desk</h3>
              <p>
                Your view, dark for a dark room: your notes in large type, what is on stage now and
                what comes next, and a clock that shows whether you are ahead of plan or behind.
              </p>
            </li>
            <li>
              <Screen kind="phone" />
              <h3>Phone</h3>
              <p>
                The audience scans the code and joins. They answer polls and open questions, and a
                phone that was locked finds its way back to the current slide on its own.
              </p>
            </li>
          </ul>
        </Section>

        <Section id="agent" heading="Written with your AI agent.">
          <div className="split">
            <div className="prose">
              <p>
                Every talk comes with an <code>AGENTS.md</code> that points your coding agent at the
                docs of the slidesend version you installed. The docs ship inside the packages, so
                the agent reads the ones that match your code.
              </p>
              <p>
                Before it writes a single slide, the agent asks you for the calls only you can make.
                Your answers are written into the talk, so the next session starts from them. It
                does not invent facts or quotes — it asks, or leaves a visible placeholder.
              </p>
              <p>
                Then it writes one idea per slide, with what you will say as the notes.{" "}
                <code>slidesend check</code> names every mistake by slide and field, so the agent
                can fix it.
              </p>
            </div>
            <figure className="panel">
              <figcaption>The calls only you can make</figcaption>
              <ol>
                <li>The message</li>
                <li>The audience</li>
                <li>The length</li>
                <li>The storyline</li>
                <li>Where the room takes part</li>
              </ol>
            </figure>
          </div>
        </Section>

        <Section id="sessions" heading="Rehearse. Go live. Review." tone="surface">
          <ol className="cards three steps">
            <li>
              <h3>Rehearse</h3>
              <p>
                With a private join link and a clock on every step. A rehearsal keeps its own
                answers and timings, apart from the real talk.
              </p>
            </li>
            <li>
              <h3>Go live</h3>
              <p>
                In one click, or plan the talk for later and the session opens by itself before you
                start. The audience joins with the code on the stage.
              </p>
            </li>
            <li>
              <h3>Review</h3>
              <p>
                Afterwards: planned against measured time for every step. Adopt the measured times
                as your new plan, or export every answer as JSON.
              </p>
            </li>
          </ol>
        </Section>

        <Section id="hosting" heading="On your laptop, or on your own AWS account.">
          <ul className="cards three">
            <li>
              <h3>Local</h3>
              <p>
                <code>npm run dev</code> serves the talk from your laptop. Phones on the same
                network join directly — no cloud account, no sign-up, nothing to pay.
              </p>
            </li>
            <li>
              <h3>On AWS</h3>
              <p>
                Create the talk with <code>--aws</code>, and <code>slidesend deploy</code> puts it
                online with one command, so anyone with the link can join. Between talks it costs
                about USD 1 a month; a session for a class-sized audience costs a few cents.{" "}
                <code>slidesend destroy</code> removes it all.
              </p>
            </li>
            <li>
              <h3>An AI agent for the audience, if you want one</h3>
              <p>
                The room can ask questions to an agent on their phones, running on Amazon Bedrock,
                for about USD 0.0005 per question. Nothing that costs money runs outside an open
                session, and a forgotten session closes on its own.
              </p>
            </li>
          </ul>
          <p className="fine">
            Estimates at eu-central-1 prices. The costs are AWS's, billed to your own account —
            check your bill.
          </p>
        </Section>

        <Section id="start" heading="Start your talk." tone="surface">
          <InstallCommand />
          <ul className="cards three links">
            <li>
              <a href={links.github}>
                <h3>GitHub</h3>
                <p>Source, issues and releases.</p>
              </a>
            </li>
            <li>
              <a href={links.npm}>
                <h3>npm</h3>
                <p>
                  The <code>@slidesend</code> packages.
                </p>
              </a>
            </li>
            <li>
              <a href={links.docs}>
                <h3>Docs</h3>
                <p>From your first talk to your own slide types.</p>
              </a>
            </li>
          </ul>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
