import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white shadow-sm shadow-brand-500/20 hover:bg-brand-600",
        dark: "bg-ink text-white hover:bg-ink-soft",
        secondary: "bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50 hover:ring-stone-300 shadow-xs",
        ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        danger: "bg-red-600 text-white hover:bg-red-700",
        "danger-ghost": "text-red-600 hover:bg-red-50",
        link: "text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline px-0 h-auto",
      },
      size: { sm: "h-8 px-3 text-xs", md: "h-10 px-4", lg: "h-11 px-5 text-[15px]", icon: "size-9", "icon-sm": "size-8" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
        {asChild ? children : (<>{loading && <Loader2 className="animate-spin" />}{children}</>)}
      </Comp>
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
