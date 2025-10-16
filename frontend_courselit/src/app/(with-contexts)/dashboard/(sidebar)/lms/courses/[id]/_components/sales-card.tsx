import { useSiteInfo } from "@/components/contexts/site-info-context";
import { getSymbolFromCurrency } from "@workspace/components-library";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SalesCard({
  data,
  loading,
}: {
  data: any;
  loading: boolean;
}) {
  const { siteInfo } = useSiteInfo();

  return (
    <div className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <div className="">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart width={300} height={200} data={data?.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <Line
                    type="monotone"
                    dataKey="count"
                    strokeWidth={2}
                    stroke="#000000"
                    dot={false}
                  />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) =>
                      `${getSymbolFromCurrency(siteInfo.currencyISOCode || "USD")}${value}`
                    }
                    className="text-xs"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#333",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      color: "white",
                    }}
                    itemStyle={{ color: "white" }}
                    formatter={(value) => [`Sales: ${value}`]}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
