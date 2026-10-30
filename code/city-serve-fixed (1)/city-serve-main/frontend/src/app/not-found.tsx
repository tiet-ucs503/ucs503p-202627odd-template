import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <Compass size={32} className="text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link href="/" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white">
        Back to home
      </Link>
    </div>
  );
}
