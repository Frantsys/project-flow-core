import { ImageResponse } from "next/og";

/** Ícones PNG do PWA (o manifesto pede 192 e 512). Gerados no build, a partir do mesmo desenho do logo. */
const SIZES = ["192", "512"] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params;
  const px = SIZES.includes(size as (typeof SIZES)[number]) ? Number(size) : 192;
  // ícone "maskable": o desenho fica no centro, longe das bordas que o sistema pode cortar
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
      }}
    >
      <svg
        width={px * 0.5}
        height={px * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fafafa"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 7v7M12 7v4M16 7v9" />
      </svg>
    </div>,
    { width: px, height: px }
  );
}
