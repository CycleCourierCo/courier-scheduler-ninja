import React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignboardProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  reference?: string;
  eyebrow?: string;
}

const Signboard = ({ title, reference, eyebrow, className, children, ...props }: SignboardProps) => (
  <header className={cn("signboard", className)} {...props}>
    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase">
      <MapPin className="h-4 w-4" /> {eyebrow ?? "Cycle Courier Co."}
    </div>
    <h1 className="max-w-3xl text-[40px] font-extrabold leading-[1.1]">{title}</h1>
    {reference && <p className="doorstep-data mt-3 text-primary-foreground">{reference}</p>}
    {children}
  </header>
);

export default Signboard;