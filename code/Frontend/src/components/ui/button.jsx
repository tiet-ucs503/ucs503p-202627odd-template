import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-mono",
  {
    variants: {
      variant: {
        default: "bg-zinc-50 text-zinc-900 font-bold hover:bg-zinc-200 shadow-md",
        destructive: "bg-red-600 text-zinc-50 hover:bg-red-500",
        outline:
          "border border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80",
        secondary:
          "bg-zinc-800 text-zinc-50 hover:bg-zinc-700",
        ghost: "hover:bg-zinc-800/60 hover:text-zinc-50 text-zinc-400",
        link: "text-zinc-50 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
