"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A QR code drawn in the browser. The link never leaves the page. */
export function QrCode({ url, size = 480 }: { url: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 1, width: size }).then(
      (s) => live && setSvg(s),
    );
    return () => {
      live = false;
    };
  }, [url, size]);
  if (!svg)
    return <div style={{ width: size, height: size }} aria-busy="true" />;
  return (
    <div
      role="img"
      aria-label="QR code for the guest's proposal"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
