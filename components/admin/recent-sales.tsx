import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

interface SaleItem {
  id: string
  name: string
  email: string
  amount: number
  avatar?: string
}

interface RecentSalesProps {
  sales: SaleItem[]
}

export function RecentSales({ sales }: RecentSalesProps) {
  if (sales.length === 0) {
     return <div className="text-sm text-neutral-500">No recent sales found.</div>
  }

  return (
    <div className="space-y-8">
      {sales.map((sale) => (
        <div key={sale.id} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={sale.avatar} alt="Avatar" />
            <AvatarFallback>{sale.name.substring(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{sale.name}</p>
            <p className="text-sm text-muted-foreground">
              {sale.email}
            </p>
          </div>
          <div className="ml-auto font-medium">+₱{sale.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      ))}
    </div>
  )
}
