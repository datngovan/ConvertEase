import React from "react"

interface PolicyRowProps {
  title: string
  description: string
  children?: React.ReactNode
}

const PolicyRow: React.FC<PolicyRowProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="policy-wrapper space-y-2">
      <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
        {title}
      </h2>
      <p>{description}</p>
      {children && <div>{children}</div>}
    </div>
  )
}

export default PolicyRow
