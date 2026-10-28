import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Menu, ChevronDown, ShieldAlert, LogOut, User, HelpCircle } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Header({ pageTitle = 'OVERVIEW', breadcrumb = 'VERIFICATION CONTROL' }) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header className="h-16 px-6 bg-[#050505] border-b border-[#242424] flex items-center justify-between select-none">
      {/* Left Contextual Breadcrumb & Mobile Trigger */}
      <div className="flex items-center gap-3">
        {/* Mobile Sidebar Sheet Trigger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-[#8A8A8A] hover:text-[#F5F5F5] hover:bg-[#0F0F0F]"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] p-0 bg-[#0A0A0A] border-[#242424]">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Page Context */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono tracking-widest text-[#555555] uppercase leading-tight">
            {breadcrumb}
          </span>
          <h1 className="text-sm font-bold font-mono tracking-wider text-[#F5F5F5] uppercase leading-tight">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right User & Notification Controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-md text-[#8A8A8A] hover:text-[#F5F5F5] hover:bg-[#0F0F0F] transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#06C167]" />
        </button>

        <div className="h-4 w-px bg-[#242424]" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 rounded-md hover:bg-[#0F0F0F] transition-all cursor-pointer">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[#141414] text-[#06C167] font-mono font-bold text-xs">
                  N
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-mono font-medium text-[#F5F5F5] hidden sm:inline-block">
                Nidhish
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#555555]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#0F0F0F] border-[#242424] text-[#F5F5F5]">
            <DropdownMenuLabel className="text-xs font-mono text-[#555555] uppercase">
              Nidhish (Student)
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#242424]" />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer font-mono text-xs">
              <User className="w-3.5 h-3.5 mr-2 text-[#06C167]" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/help')} className="cursor-pointer font-mono text-xs">
              <HelpCircle className="w-3.5 h-3.5 mr-2 text-[#38BDF8]" />
              Methodology
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#242424]" />
            <DropdownMenuItem onClick={() => navigate('/login')} className="cursor-pointer font-mono text-xs text-red-400">
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
