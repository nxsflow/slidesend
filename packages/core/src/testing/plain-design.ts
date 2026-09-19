import { type Design, defineDesign } from "../design/define";

/**
 * A complete, plain design for tests: every token set, frames that render only their children,
 * and empty phone pages. Real talks use the default design of `@slidesend/basics` or their own.
 */
export const plainDesign: Design = defineDesign({
  name: "plain",
  tokens: {
    base: {
      color: {
        background: "white",
        surface: "whitesmoke",
        text: "black",
        textMuted: "gray",
        primary: "blue",
        onPrimary: "white",
        border: "silver",
        positive: "green",
        negative: "red",
        focus: "orange",
      },
      font: { display: "serif", sans: "sans-serif", mono: "monospace" },
      radius: { small: "4px", large: "12px" },
      accents: ["teal", "purple", "olive"],
    },
  },
  StageFrame: ({ children }) => children,
  PhoneFrame: ({ children }) => children,
  StartPage: () => null,
  ClosedPage: () => null,
  IdlePage: () => null,
});
