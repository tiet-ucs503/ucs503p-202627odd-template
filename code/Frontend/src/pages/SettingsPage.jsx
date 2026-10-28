import React from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-[#050505] text-[#F5F5F5] font-sans">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 flex flex-col min-w-0">
        <Header pageTitle="SETTINGS" breadcrumb="SYSTEM PREFERENCES" />
        <main className="flex-1 p-6 md:p-10 space-y-6 overflow-y-auto">
          <div className="pb-4 border-b border-[#242424]">
            <h1 className="text-2xl font-mono font-bold uppercase text-[#F5F5F5]">
              Account & Engine Settings
            </h1>
            <p className="text-xs font-mono text-[#8A8A8A] mt-1">
              Manage your VeriHire profile settings, notification triggers, and API keys.
            </p>
          </div>

          <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg max-w-2xl space-y-5">
            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-xs font-mono text-[#8A8A8A] uppercase">Full Name</Label>
              <Input defaultValue="Nidhish" className="bg-[#050505] border-[#242424] text-[#F5F5F5]" />
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-xs font-mono text-[#8A8A8A] uppercase">Account Type</Label>
              <Input defaultValue="Student / Job Seeker" disabled className="bg-[#050505] border-[#242424] text-[#555555]" />
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-xs font-mono text-[#8A8A8A] uppercase">Risk Alert Sensitivity</Label>
              <select className="w-full h-10 rounded-md bg-[#050505] border border-[#242424] px-3 text-xs text-[#F5F5F5] font-mono focus:outline-none">
                <option>HIGH (Flag all domain anomalies & fee requests)</option>
                <option>MEDIUM (Standard sensitivity)</option>
                <option>LOW (Minimal sensitivity)</option>
              </select>
            </div>

            <Button className="bg-[#06C167] hover:bg-[#05a858] text-[#050505] font-mono font-bold uppercase tracking-wider text-xs px-5">
              Save Settings
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
