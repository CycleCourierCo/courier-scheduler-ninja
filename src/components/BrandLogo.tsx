import { cn } from "@/lib/utils";
import horizontalLogo from "@/assets/brand/lockup-horizontal.png.asset.json";
import reversedHorizontalLogo from "@/assets/brand/lockup-horizontal-reversed.png.asset.json";
import solidLogo from "@/assets/brand/c-solid-blue.png.asset.json";
import { publicBrandAssetUrl } from "@/lib/brandAssets";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  showMobileWordmark?: boolean;
};

export default function BrandLogo({ className, compact = false, showMobileWordmark = false }: BrandLogoProps) {
  if (compact) {
    return (
      <span className={cn("flex min-w-0 items-center gap-2", className)}>
        <img src={publicBrandAssetUrl(solidLogo.url)} alt="" className="h-8 w-8 shrink-0" />
        {showMobileWordmark && <span className="truncate text-xs font-extrabold sm:text-sm">CYCLE COURIER CO.</span>}
      </span>
    );
  }

  return (
    <span className={cn("block", className)}>
      <img src={publicBrandAssetUrl(horizontalLogo.url)} alt="Cycle Courier Co." className="h-full w-full object-contain object-left dark:hidden" />
      <img src={publicBrandAssetUrl(reversedHorizontalLogo.url)} alt="Cycle Courier Co." className="hidden h-full w-full object-contain object-left dark:block" />
    </span>
  );
}