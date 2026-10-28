import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShieldAlert,
  LayoutDashboard,
  SearchCheck,
  History,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronDown,
  LogOut,
  User,
  Menu,
} from 'lucide-react';

export default function Sidebar({ className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const mainNavItems = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Check Posting', path: '/check', icon: SearchCheck },
    { label: 'History', path: '/history', icon: History },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  const systemNavItems = [
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Help / Methodology', path: '/help', icon: HelpCircle },
  ];

  const isCurrentActive = (path) => {
    if (path === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/')) {
      return true;
    }
    return location.pathname === path;
  };

  return (
    <aside
      className={`${
        isOpen ? 'w-[230px]' : 'w-16'
      } h-screen bg-[#0A0A0A] border-r border-[#242424] flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${className}`}
    >
      {/* Top Header Logo & Animated Toggle Button */}
      <div className="h-16 px-3.5 border-b border-[#242424] flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer overflow-hidden"
          onClick={() => navigate('/dashboard')}
        >
          
          {isOpen && (
            <span className="text-base font-black font-mono tracking-widest uppercase text-[#F5F5F5] whitespace-nowrap animate-in fade-in duration-200">
              Menu
            </span>
          )}
        </div>

        {/* Animated Toggle Hamburger Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 text-[#8A8A8A] hover:text-[#F5F5F5] hover:bg-[#141414] cursor-pointer shrink-0"
          title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 py-4 px-2">
        {/* MAIN SECTION */}
        <div className="space-y-1 mb-6">
          {isOpen && (
            <div className="px-3 pb-2 text-[10px] font-mono font-bold tracking-widest text-[#555555] uppercase animate-in fade-in duration-200">
              Main
            </div>
          )}
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrentActive(item.path);

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center ${
                  isOpen ? 'gap-3 px-3' : 'justify-center px-0'
                } py-2.5 rounded-md text-xs font-mono transition-all cursor-pointer relative ${
                  active
                    ? 'bg-[#141414] text-[#F5F5F5] font-semibold shadow-xs'
                    : 'text-[#8A8A8A] hover:text-[#F5F5F5] hover:bg-[#0F0F0F]'
                }`}
              >
                {/* Active Green Indicator Bar */}
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#06C167] rounded-r-full" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#06C167]' : 'text-[#8A8A8A]'
                  }`}
                />
                {isOpen && (
                  <span className="truncate animate-in fade-in duration-200">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* DIVIDER */}
        <div className="my-4 border-t border-[#242424] mx-2" />

        {/* SYSTEM SECTION */}
        <div className="space-y-1">
          {isOpen && (
            <div className="px-3 pb-2 text-[10px] font-mono font-bold tracking-widest text-[#555555] uppercase animate-in fade-in duration-200">
              System
            </div>
          )}
          {systemNavItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrentActive(item.path);

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center ${
                  isOpen ? 'gap-3 px-3' : 'justify-center px-0'
                } py-2.5 rounded-md text-xs font-mono transition-all cursor-pointer relative ${
                  active
                    ? 'bg-[#141414] text-[#F5F5F5] font-semibold shadow-xs'
                    : 'text-[#8A8A8A] hover:text-[#F5F5F5] hover:bg-[#0F0F0F]'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#06C167] rounded-r-full" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#06C167]' : 'text-[#8A8A8A]'
                  }`}
                />
                {isOpen && (
                  <span className="truncate animate-in fade-in duration-200">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* User Footer Profile */}
      <div className="p-2 border-t border-[#242424]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`w-full flex items-center ${
                isOpen ? 'justify-between p-2' : 'justify-center p-1.5'
              } rounded-md hover:bg-[#0F0F0F] transition-all cursor-pointer text-left`}
              title={!isOpen ? 'Nidhish (Student)' : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-[#141414] text-[#06C167] font-mono font-bold text-xs">
                    N
                  </AvatarFallback>
                </Avatar>
                {isOpen && (
                  <div className="flex flex-col truncate animate-in fade-in duration-200">
                    <span className="text-xs font-mono font-semibold text-[#F5F5F5] leading-tight truncate">
                      Nidhish
                    </span>
                    <span className="text-[10px] font-mono text-[#555555] leading-tight truncate">
                      Student
                    </span>
                  </div>
                )}
              </div>
              {isOpen && <ChevronDown className="w-3.5 h-3.5 text-[#555555] shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#0F0F0F] border-[#242424] text-[#F5F5F5]">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
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
    </aside>
  );
}
