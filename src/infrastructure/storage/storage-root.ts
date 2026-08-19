import { join } from "path";

/**
 * Where uploaded files live on disk.
 *
 * Resolved once, here, rather than repeated in each route. Turbopack's file
 * tracer treats a `path.join(process.cwd(), …)` inside a route as a sign that
 * the whole project needs tracing, which it reports as a build warning and
 * pays for with a much larger traced file list; scoping it to one module with
 * an explicit ignore keeps that contained.
 *
 * The fallback is `public/`, which Next also serves statically with no session
 * check — so anything tenant-private written there is readable by anyone. Set
 * WBOS_STORAGE_ROOT to a directory outside `public/` in any real deployment.
 */
export const STORAGE_ROOT: string =
  process.env.WBOS_STORAGE_ROOT ?? join(/* turbopackIgnore: true */ process.cwd(), "public");

/** Used when STORAGE_ROOT is configured elsewhere but legacy files remain. */
export const PUBLIC_ROOT: string = join(/* turbopackIgnore: true */ process.cwd(), "public");
