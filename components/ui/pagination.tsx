import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-row items-center gap-1", className)} {...props} />
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn(className)} {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<VariantProps<typeof buttonVariants>, "size"> &
  React.ComponentProps<"button">

function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink }
