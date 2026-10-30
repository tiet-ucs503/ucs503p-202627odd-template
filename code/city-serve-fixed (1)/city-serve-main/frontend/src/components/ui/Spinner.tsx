import { Loader2 } from "lucide-react";

export default function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 size={24} className="animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
