import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Tv, Image, Key, Users, Bell, TrendingUp, Megaphone } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ channels: 0, sliders: 0, users: 0, notifications: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [ch, sl, un] = await Promise.all([
        supabase.from('channels').select('id', { count: 'exact', head: true }),
        supabase.from('slider_images').select('id', { count: 'exact', head: true }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }),
      ]);
      setStats((s) => ({
        ...s,
        channels: ch.count || 0,
        sliders: sl.count || 0,
        notifications: un.count || 0,
      }));
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Vituo', value: stats.channels, icon: Tv, to: '/admin/channels', color: 'primary' },
    { label: 'Slider', value: stats.sliders, icon: Image, to: '/admin/slider', color: 'primary' },
    { label: 'Arifa', value: stats.notifications, icon: Bell, to: '/admin/notifications', color: 'primary' },
    { label: 'Token', value: '•••', icon: Key, to: '/admin/token', color: 'primary' },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl font-black tracking-wide text-foreground">Muhtasari</h1>
        <p className="text-sm text-muted-foreground">Welcome to Triber Zone TV Dashboard</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="cyber-card rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="cyber-card rounded-2xl p-4">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Viungo vya Haraka</h2>
        <div className="space-y-2">
          {[
            { label: 'Ongeza Kituo Kipya', to: '/admin/channels', icon: Tv },
            { label: 'Simamia Matangazo (Ads)', to: '/admin/ads', icon: Megaphone },
            { label: 'Sasisha Token ya Leo', to: '/admin/token', icon: Key },
            { label: 'Tuma Arifa kwa Watumiaji', to: '/admin/notifications', icon: Bell },
            { label: 'Simamia Picha za Slider', to: '/admin/slider', icon: Image },
            { label: 'Angalia Watumiaji', to: '/admin/users', icon: Users },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{item.label}</span>
                <span className="ml-auto text-muted-foreground">›</span>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
