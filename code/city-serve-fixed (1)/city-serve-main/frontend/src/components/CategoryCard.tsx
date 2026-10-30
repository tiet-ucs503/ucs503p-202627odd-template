import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategoryIcon } from "@/lib/icons";
import type { Category } from "@/types";

export default function CategoryCard({ category, count }: { category: Category; count?: number }) {
  const Icon = getCategoryIcon(category.icon || category.name);
  return (
    <Link
      href={`/category/${category.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardHover hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon size={20} strokeWidth={2} />
        </div>

        <div className="mt-4">
          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
            {category.name}
          </h3>
          {category.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{typeof count === "number" ? `${count} listings` : "Explore"}</span>
        <ArrowRight
          size={14}
          className="text-primary transition-transform duration-200 group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}

