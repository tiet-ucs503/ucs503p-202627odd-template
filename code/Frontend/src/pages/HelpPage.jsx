import React from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { ShieldCheck, AlertCircle, FileSearch, Lock } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="flex min-h-screen bg-[#050505] text-[#F5F5F5] font-sans">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 flex flex-col min-w-0">
        <Header pageTitle="HELP / METHODOLOGY" breadcrumb="DOCUMENTATION" />
        <main className="flex-1 p-6 md:p-10 space-y-6 overflow-y-auto max-w-5xl">
          <div className="pb-4 border-b border-[#242424]">
            <h1 className="text-2xl font-mono font-bold uppercase text-[#F5F5F5]">
              Verification Methodology & Methodology Framework
            </h1>
            <p className="text-xs font-mono text-[#8A8A8A] mt-1">
              How VeriHire detects deceptive job postings, fee scams, and domain anomalies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-[#06C167] font-bold uppercase text-sm">
                <ShieldCheck className="w-5 h-5" />
                1. Domain & Entity Inspection
              </div>
              <p className="text-[#8A8A8A] leading-relaxed">
                VeriHire queries WHOIS registration databases, DNS records, and corporate registries to detect newly created disposable domains (under 30 days old) mimicking established tech companies.
              </p>
            </div>

            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-[#EF4444] font-bold uppercase text-sm">
                <AlertCircle className="w-5 h-5" />
                2. Fee & Security Deposit Detection
              </div>
              <p className="text-[#8A8A8A] leading-relaxed">
                Legitimate internships NEVER require applicants to pay application fees, equipment security deposits, or training charges. Any mention of upfront payment triggers an immediate HIGH RISK flag.
              </p>
            </div>

            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-[#38BDF8] font-bold uppercase text-sm">
                <FileSearch className="w-5 h-5" />
                3. Contact & Channel Auditing
              </div>
              <p className="text-[#8A8A8A] leading-relaxed">
                Recruiters relying exclusively on Telegram, WhatsApp, or generic `@gmail.com` addresses without verifiable corporate email authentication are flagged for manual review.
              </p>
            </div>

            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-[#F59E0B] font-bold uppercase text-sm">
                <Lock className="w-5 h-5" />
                4. Offer Letter Integrity Scoring
              </div>
              <p className="text-[#8A8A8A] leading-relaxed">
                Automated NLP parsing checks offer letter templates against thousands of known fraudulent templates to flag unrealistic compensation promises and pressure language.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
