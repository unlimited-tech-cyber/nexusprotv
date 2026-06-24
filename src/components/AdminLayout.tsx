import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Tv, Image, Key, Users, Bell, LogOut, ChevronRight,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, logoutAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logoutAdmin();
    await signOut();
    navigate('/login');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Ruhusa imekataliwa</p>
      <button onClick={() => navigate('/admin/login')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold">
            Ingia kama Admin
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/admin', label: 'Dashibodi', icon: LayoutDashboard },
    { to: '/admin/channels', label: 'Vituo', icon: Tv },
    { to: '/admin/slider', label: 'Slider', icon: Image },
    { to: '/admin/token', label: 'Token', icon: Key },
    { to: '/admin/users', label: 'Watumiaji', icon: Users },
    { to: '/admin/notifications', label: 'Arifa', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <span className="text-lg font-black tracking-widest text-primary text-glow-cyan">⚡ ADMIN</span>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80">
          <LogOut className="w-3.5 h-3.5" /> Toka
        </button>
      </header>

      {/* Side scroll nav */}
      <div className="overflow-x-auto border-b border-border bg-card">
        <div className="flex min-w-max px-2 py-2 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = window.location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
