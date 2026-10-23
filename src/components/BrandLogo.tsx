import { cn } from "@/lib/utils";
import sageLogo from "@/assets/brand/logo-sage.png.asset.json";
import creamLogo from "@/assets/brand/logo-cream.png.asset.json";
import cloudMark from "@/assets/brand/icon-128.png.asset.json";
import { publicBrandAssetUrl } from "@/lib/brandAssets";

type BrandLogoProps = {
  className?: string;
  /** The cloud mark alone (36px). Use wherever the full logo would be under 140px wide. */
  compact?: boolean;
  /** Kept for older callers; the hand lettering is never set in type. */
  showMobileWordmark?: boolean;
  /** Always use the sage artwork, e.g. on customer pages that never render dark. */
  lightOnly?: boolean;
  /** Show "Cycle Courier Co." beside the cloud mark. Only meaningful with compact. */
  withWordmark?: boolean;
};

export default function BrandLogo({ className, compact = false, lightOnly = false, withWordmark = false }: BrandLogoProps) {
  if (compact) {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <img src={publicBrandAssetUrl(cloudMark.url)} alt="Cycle Courier Co." width={36} height={36} className="h-9 w-9 shrink-0" />
        {withWordmark && (
          <span aria-hidden className="whitespace-nowrap text-[13px] font-bold leading-none tracking-tight text-primary sm:text-[15px]">
            Cycle Courier Co.
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("block min-w-[140px]", className)}>
      <img
        src={publicBrandAssetUrl(sageLogo.url)}
        alt="Cycle Courier Co."
        className={cn("h-full w-full object-contain object-left", !lightOnly && "dark:hidden")}
      />
      {!lightOnly && (
        <img src={publicBrandAssetUrl(creamLogo.url)} alt="Cycle Courier Co." className="hidden h-full w-full object-contain object-left dark:block" />
      )}
    </span>
  );
}
