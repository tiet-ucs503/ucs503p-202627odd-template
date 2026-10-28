import React from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { FREQUENTLY_DETECTED_SIGNALS } from '@/services/verificationData';

export default function AnalyticsPage() {
  return (
    <div className="flex min-h-screen bg-[#050505] text-[#F5F5F5] font-sans">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 flex flex-col min-w-0">
        <Header pageTitle="ANALYTICS" breadcrumb="INTELLIGENCE METRICS" />
        <main className="flex-1 p-6 md:p-10 space-y-6 overflow-y-auto">
          <div className="pb-4 border-b border-[#242424]">
            <h1 className="text-2xl font-mono font-bold uppercase text-[#F5F5F5]">
              Verification Risk Analytics
            </h1>
            <p className="text-xs font-mono text-[#8A8A8A] mt-1">
              Aggregated threat metrics and risk vector breakdowns across internship callsets.
            </p>
          </div>

          <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-4">
            <h2 className="text-sm font-mono font-bold uppercase text-[#F5F5F5]">Top Detected Risk Vectors</h2>
            <div className="space-y-4 pt-2">
              {FREQUENTLY_DETECTED_SIGNALS.map((sig) => (
                <div key={sig.name} className="space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-[#8A8A8A]">
                    <span>{sig.name}</span>
                    <span className="text-[#06C167] font-bold">{sig.percentage}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#050505] rounded-full overflow-hidden border border-[#242424]">
                    <div
                      className="h-full bg-gradient-to-r from-[#06C167] to-[#38BDF8] rounded-full"
                      style={{ width: `${sig.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
