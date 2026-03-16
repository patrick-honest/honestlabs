"use client";

import { Header } from "@/components/layout/header";
import { Building } from "lucide-react";

export default function OricoPage() {
  return (
    <div className="flex flex-col">
      <Header title="Orico Reports" />

      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold text-white">[Orico] Reports</h2>
          <p className="mt-1 text-sm text-slate-400">
            Orico-specific reporting and analytics
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-24">
          <Building className="h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-lg font-semibold text-slate-300">
            Orico Reports
          </h3>
          <p className="mt-2 max-w-md text-center text-sm text-slate-500">
            This section will contain Orico-specific reporting including partner
            performance metrics, co-brand analytics, and joint portfolio reviews.
          </p>
        </div>
      </div>
    </div>
  );
}
