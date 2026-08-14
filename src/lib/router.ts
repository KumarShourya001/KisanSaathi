import { useEffect, useState } from "react";

/**
 * Hash routing in twenty lines.
 *
 * Eight screens with no nested layouts and no data loaders does not justify a
 * router dependency. Hash routes also mean a static host serves the PWA with
 * no rewrite rules, and a hard refresh deep in the app works offline because
 * the service worker only ever has to serve index.html.
 */

export function useRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");

  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (to: string) => {
    if (to === "back") {
      window.history.back();
      return;
    }
    window.location.hash = to;
  };

  return [route, navigate];
}

/** `/flag/exposure:LGD4162:2026-08-02` becomes ["flag", "exposure:LGD4162:..."] */
export function segments(route: string): string[] {
  return route.split("/").filter(Boolean);
}
