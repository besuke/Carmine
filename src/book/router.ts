import { useEffect, useState } from "react";

// Hash routes ("#/part2/yield-curve-ois"). They need no server configuration, so the same build works
// from `npm run dev`, `npm run preview` and the R server on the LAN (which serves only files and /api).

function current(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h === "" ? "/" : h;
}

export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => {
      setRoute(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const href = (route: string) => `#${route}`;
