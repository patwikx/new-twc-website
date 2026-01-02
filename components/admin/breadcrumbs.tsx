"use client"

import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from "react"

export function DynamicBreadcrumbs() {
  const pathname = usePathname()
  
  // Split pathname into segments, keeping "admin" as the root context
  const segments = pathname.split("/").filter((segment) => segment !== "")

  // We want to map "admin" to "Dashboard"
  // and other segments to their capitalized names
  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const isLast = index === segments.length - 1
    
    let label = segment.charAt(0).toUpperCase() + segment.slice(1)
    if (segment === "admin") label = "Dashboard"

    // If it's a UUID (typically lengthy), truncate or show "Details"
    // Simple check: length > 20 is likely an ID
    if (segment.length > 20) label = "Details"

    return { href, label, isLast }
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
