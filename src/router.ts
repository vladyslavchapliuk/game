import { useEffect, useState } from 'react';

// Hash routing works from a web server and from a file opened by double-click.
export const useRoute = (): string[] => {
  const parse = () => (window.location.hash.replace(/^#\/?/, '') || 'map').split('/');
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const fn = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
};

export const go = (path: string) => { window.location.hash = `/${path}`; };
export const href = (path: string) => `#/${path}`;
