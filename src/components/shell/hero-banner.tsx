import type { HeroConfig } from "@/data/navData";

interface HeroBannerProps {
  config: HeroConfig;
}

export function HeroBanner({ config }: HeroBannerProps) {
  return (
    <div
      className="mx-6 mt-4 mb-0 px-8 py-8 rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, #1B4D4F 0%, #2A6B6E 50%, #245C5A 100%)",
      }}
    >
      {/* Category Label */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[2px] mb-2"
        style={{ color: "#7EC8CA" }}
      >
        {config.category}
      </p>

      {/* Title */}
      <h1
        className="text-[28px] font-bold leading-tight mb-2"
        style={{ color: "#FFFFFF" }}
      >
        {config.title}
      </h1>

      {/* Subtitle */}
      <p
        className="text-[14px] leading-relaxed max-w-2xl"
        style={{ color: "#C8E0E1" }}
      >
        {config.subtitle}
      </p>
    </div>
  );
}
