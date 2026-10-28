import React from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { RECENT_VERIFICATIONS } from '@/services/verificationData';

export default function HistoryPage() {
  return (
    <div className="flex min-h-screen bg-[#050505] text-[#F5F5F5] font-sans">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 flex flex-col min-w-0">
        <Header pageTitle="HISTORY" breadcrumb="VERIFICATION ARCHIVE" />
        <main className="flex-1 p-6 md:p-10 space-y-6 overflow-y-auto">
          <div className="pb-4 border-b border-[#242424]">
            <h1 className="text-2xl font-mono font-bold uppercase text-[#F5F5F5]">
              Verification History Log
            </h1>
            <p className="text-xs font-mono text-[#8A8A8A] mt-1">
              Complete audit history of all internship offers scanned by your VeriHire account.
            </p>
          </div>

          <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#242424] text-[#555555] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Posting</th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Risk Level</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {RECENT_VERIFICATIONS.map((item) => (
                  <tr key={item.id} className="hover:bg-[#141414]">
                    <td className="py-3.5 px-3 font-semibold text-[#F5F5F5]">{item.posting}</td>
                    <td className="py-3.5 px-3 text-[#8A8A8A]">{item.company}</td>
                    <td className="py-3.5 px-3 font-bold">{item.risk}</td>
                    <td className="py-3.5 px-3 text-[#F5F5F5]">{item.confidence}</td>
                    <td className="py-3.5 px-3 text-[#555555]">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
