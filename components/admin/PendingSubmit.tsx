"use client";
import { useFormStatus } from "react-dom";
export function PendingSubmit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending}>{pending ? "處理中..." : children}</button>;
}
