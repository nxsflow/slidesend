import { cssVariable, defineBlock, useSessionInfo } from "@slidesend/core";
import { z } from "zod";
import { useJoinUrl, useQrImage } from "./join-qr";

const color = (name: Parameters<typeof cssVariable>[1]) => `var(${cssVariable("color", name)})`;

/**
 * The join address of the running session as a QR code (spec §12, Join): `/` in a live session
 * and `/r/<token>` in a rehearsal, so a rehearsal shows its own link. In local mode there is no
 * address to show, because no audience can join.
 */
export const qr = defineBlock({
  type: "qr",
  schema: z.object({
    caption: z.string().default("Join on your phone"),
    size: z.number().int().min(120).max(900).default(420),
  }),
  Component: ({ data }) => {
    const session = useSessionInfo();
    const url = useJoinUrl();
    const image = useQrImage(url, data.size);

    return (
      <div data-block="qr" data-join={url} style={{ textAlign: "center" }}>
        {image ? (
          <img src={image} alt={`QR code of ${url}`} width={data.size} height={data.size} />
        ) : (
          <p style={{ fontSize: 36, color: color("textMuted") }}>
            {session?.hosted
              ? "The join address is not known yet."
              : "Local mode: no audience can join."}
          </p>
        )}
        <p style={{ fontSize: 36, marginTop: 24 }}>{data.caption}</p>
        {url && <p style={{ fontSize: 28, color: color("textMuted") }}>{url}</p>}
      </div>
    );
  },
  Print: ({ data }) => <p data-block="qr">{data.caption}</p>,
});
