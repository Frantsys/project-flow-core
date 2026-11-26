import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
      {/* iniciais por baixo: aparecem enquanto a foto carrega ou se ela falhar */}
      <AvatarFallback className="bg-avatar font-semibold text-badge-foreground">
        {initials(name)}
      </AvatarFallback>
      {image && (
        // next/image: a foto do Google/GitHub chega redimensionada (64 px, nítida em tela 2x) e em WebP/AVIF
        <Image
          src={image}
          alt=""
          width={64}
          height={64}
          className="absolute inset-0 size-full rounded-full object-cover"
        />
      )}
    </Avatar>
  );
}
