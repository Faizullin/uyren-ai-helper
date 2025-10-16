"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { trpc } from "@/utils/trpc";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useParams } from "next/navigation";
import ProductManageClient from "./_components/product-manage-client";

export default function ProductManagePage() {
  const params = useParams();
  const productId = params.id as string;

  const { data: product, isLoading: productLoading } =
    trpc.lmsModule.courseModule.course.getByCourseDetailed.useQuery({
      courseId: productId,
    });

  if (productLoading) {
    return (
      <DashboardContent
        breadcrumbs={[
          { label: "Products", href: "/dashboard/products" },
          { label: "...", href: "#" },
          { label: "Manage", href: "#" },
        ]}
      >
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </DashboardContent>
    );
  }

  if (!product) {
    return (
      <DashboardContent
        breadcrumbs={[
          { label: "Products", href: "/dashboard/products" },
          { label: "Product", href: "#" },
          { label: "Manage", href: "#" },
        ]}
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground">Product not found</p>
        </div>
      </DashboardContent>
    );
  }

  return <ProductManageClient product={product} />;
}
