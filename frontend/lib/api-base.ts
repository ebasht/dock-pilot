/** Resolve API origin. Use NEXT_PUBLIC_API_URL=auto at build time for domain-based installs. */
export function resolveApiBase(): string {
  const baked = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (typeof window !== "undefined") {
    if (!baked || baked === "auto" || baked === "same-origin") {
      return window.location.origin.replace(/\/$/, "");
    }
  }
  if (baked && baked !== "auto" && baked !== "same-origin") {
    return baked.replace(/\/$/, "");
  }
  return "http://localhost:8080";
}
