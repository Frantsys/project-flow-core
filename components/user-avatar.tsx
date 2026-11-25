import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SIZES = { sm: "size-6 text-[10px]", md: "size-7 text-[11px]", lg: "size-8 text-xs" } as const;

export function UserAvatar({
  name,
  image,
  size = "md",
  className,
}: {
  name: string;
  image?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)} title={name}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="bg-avatar font-semibold text-badge-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
