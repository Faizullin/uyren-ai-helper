import { Button } from "@workspace/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export function CreateButton(props: {
  href?: string;
  text?: string;
  link?: boolean;
  onClick?: () => void;
}) {
  const { href, text, onClick } = props;
  const isLink = !!href;
  if (isLink) {
    return (
      <Button asChild>
        <Link href={href || ""}>
          <Plus className="h-4 w-4 mr-2" />
          {text || "New"}
        </Link>
      </Button>
    );
  } else {
    return (
      <Button onClick={onClick}>
        <Plus className="h-4 w-4 mr-2" />
        {text || "New"}
      </Button>
    );
  }
}
