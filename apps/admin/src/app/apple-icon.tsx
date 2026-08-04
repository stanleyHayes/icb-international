import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * The iOS home-screen icon, rendered to PNG at build time.
 *
 * It exists as code rather than as a file because `apple-touch-icon` is one of the few places
 * that still refuses SVG: iOS silently ignores it and falls back to a screenshot of the page.
 * Every app previously pointed `apple` at `/icon.svg`, so every one of them had no home-screen
 * icon at all. `ImageResponse` rasterises this at build time, so there is no binary to keep in
 * step with the brand and no rasteriser in the toolchain.
 *
 * The mark is redrawn here rather than imported: Satori does not implement SVG masks, and the
 * source mark uses one to notch the arc where the stem crosses it. At 180px that notch is
 * sub-pixel, so drawing the stem over the arc is indistinguishable and needs no mask.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          // No rounding: iOS applies its own mask, and a pre-rounded icon shows dark corners.
          background: 'linear-gradient(135deg, #0F3B63 0%, #0B2C4D 55%, #06182B 100%)',
        }}
      >
        <svg width="112" height="112" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="arc" x1="18" y1="14" x2="88" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#A9CDEC" />
            </linearGradient>
            <linearGradient id="stem" x1="16.5" y1="16" x2="16.5" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#F2DA8B" />
              <stop offset="1" stopColor="#C9A227" />
            </linearGradient>
          </defs>
          <path d="M72.42 29.24A27 27 0 1 0 72.42 66.76" stroke="url(#arc)" strokeWidth="13" fill="none" />
          <path d="M16.5 22.5V73.5" stroke="url(#stem)" strokeWidth="13" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    size,
  );
}
