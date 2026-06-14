"use client";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const SIZE_MAP = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export default function Loader({ size = "md", text }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <span className={`spinner ${SIZE_MAP[size]}`} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
