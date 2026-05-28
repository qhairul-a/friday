"use client";

import PageShell from "../components/page-shell";
import { HealthAnalyticsPanel } from "../components/health-charts";

export default function HealthAnalyticsPage() {
  return (
    <PageShell>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Health Analytics</h1>
        <p className="text-xs text-[#4a7a9b] mb-6">Synced from Garmin — updates every 4 hours</p>
        <HealthAnalyticsPanel />
      </div>
    </PageShell>
  );
}
