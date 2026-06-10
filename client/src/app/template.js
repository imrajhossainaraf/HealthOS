// A template re-mounts on every navigation (unlike layout), so this wrapper
// replays its entrance animation on each route change — giving the whole app a
// smooth page-transition feel without any client-side router library.
export default function Template({ children }) {
  return <div className="animate-page-enter">{children}</div>;
}
