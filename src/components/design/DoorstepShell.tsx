import React from "react";
import Signboard from "./Signboard";

interface DoorstepShellProps {
  title: string;
  reference?: string;
  children: React.ReactNode;
}

const DoorstepShell = ({ title, reference, children }: DoorstepShellProps) => (
  <div className="doorstep-page flex items-start justify-center px-4 py-6 sm:py-10">
    <main className="w-full max-w-xl overflow-hidden rounded-md border bg-card shadow-card">
      <Signboard title={title} reference={reference} className="rounded-none" />
      <div className="space-y-6 p-5 sm:p-7">{children}</div>
    </main>
  </div>
);

export default DoorstepShell;