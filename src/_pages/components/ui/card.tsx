// components/ui/Card.tsx
import React from "react"
import { cn } from "../../../lib/utils" // Only if you use class merging

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  title?: string
  subtitle?: string
  footer?: React.ReactNode
  padding?: string // e.g. "p-4" or "p-6"
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  footer,
  className,
  padding = "p-4",
  ...props
}) => {
  return (
    <div
      className={cn(
        "bg-black/60 rounded-xl border border-white/10 shadow-lg text-white backdrop-blur-md",
        padding,
        className
      )}
      {...props}
    >
      {title && (
        <div className="mb-2">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && (
            <p className="text-sm text-white/70">{subtitle}</p>
          )}
        </div>
      )}
      <div className="space-y-2">{children}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}

export default Card
