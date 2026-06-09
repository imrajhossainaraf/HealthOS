import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-white">Go home</Link>
        <Link href="/emergency" className="glass glass-hover rounded-xl px-5 py-2.5 font-semibold">Emergency SOS</Link>
      </div>
    </div>
  );
}
