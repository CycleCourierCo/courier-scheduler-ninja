const BRAND_ASSET_ORIGIN = "https://courier-scheduler-ninja.lovable.app";

export const publicBrandAssetUrl = (path: string) => new URL(path, BRAND_ASSET_ORIGIN).href;