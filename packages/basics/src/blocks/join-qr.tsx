import { cssVariable, joinUrl, useSessionInfo, useText } from "@slidesend/core";
import { type ReactNode, useEffect, useState } from "react";
import { z } from "zod";

/** The field a results block takes to show the join QR code beside its results. */
export const qrField = {
  /** A small join QR code beside the results, so latecomers can still join. */
  qr: z.boolean().default(false),
};

/** The full join address of the running session, or `undefined` where nobody can join. */
export function useJoinUrl(): string | undefined {
  const session = useSessionInfo();
  return joinUrl(session, typeof window === "undefined" ? "" : window.location.origin);
}

/** A QR code of `url` as an image source, once it is drawn. */
export function useQrImage(url: string | undefined, size: number): string | undefined {
  const [image, setImage] = useState<string>();
  useEffect(() => {
    if (!url) return setImage(undefined);
    let current = true;
    import("qrcode").then(
      ({ default: qrcode }) =>
        qrcode
          .toDataURL(url, { margin: 1, width: size, errorCorrectionLevel: "M" })
          .then((source) => current && setImage(source))
          .catch(() => current && setImage(undefined)),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [url, size]);
  return image;
}

const qrSize = 240;

/**
 * Results with the join QR code beside them, when `show` is set and the session has a join
 * address; otherwise the results alone (local mode, print).
 */
export function WithJoinQr({ show, children }: { show: boolean; children: ReactNode }) {
  const text = useText();
  const url = useJoinUrl();
  const image = useQrImage(show ? url : undefined, qrSize);
  if (!show || !url) return <>{children}</>;
  return (
    <div data-with-qr style={{ display: "flex", alignItems: "center", gap: 64, width: "100%" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>{children}</div>
      <aside data-join-qr={url} style={{ flex: "none", width: qrSize, textAlign: "center" }}>
        {image && (
          <img
            src={image}
            alt={`QR code of ${url}`}
            width={qrSize}
            height={qrSize}
            style={{ display: "block", borderRadius: `var(${cssVariable("radius", "small")})` }}
          />
        )}
        <p
          style={{
            margin: "16px 0 0",
            fontSize: 26,
            lineHeight: 1.3,
            color: `var(${cssVariable("color", "textMuted")})`,
          }}
        >
          {text("basics.qr.join")}
        </p>
      </aside>
    </div>
  );
}
