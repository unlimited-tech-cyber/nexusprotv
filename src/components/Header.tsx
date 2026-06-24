import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string; title: string; message: string; created_at: string;
  is_read: boolean; un_id?: string;
}

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data: allNotifs } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    if (!allNotifs) return;
    const { data: userNotifs } = await supabase.from('user_notifications').select('*').eq('user_id', user.id);
    const readMap = new Map((userNotifs || []).map((un: any) => [un.notification_id, un]));
    setNotifications(allNotifs.map((n: any) => ({
      ...n, is_read: readMap.has(n.id) ? (readMap.get(n.id) as any).is_read : false, un_id: (readMap.get(n.id) as any)?.id,
    })));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await supabase.from('user_notifications').upsert({ user_id: user.id, notification_id: n.id, is_read: true }, { onConflict: 'user_id,notification_id' });
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-black text-sm leading-none">NX</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-black tracking-widest text-primary text-glow-cyan">NEXUS PRO</span>
            <span className="text-[9px] font-bold tracking-[0.2em] text-secondary uppercase">TV</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user && (
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setShowNotif(!showNotif); if (!showNotif) fetchNotifications(); }}
                className="relative p-2 rounded-full hover:bg-muted transition-colors"
              >
                <Bell className="w-5 h-5 text-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="absolute right-0 top-12 w-80 cyber-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      <span className="font-black text-sm text-foreground">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{unreadCount}</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary font-bold hover:text-primary/70 transition-colors">
                        Mark All Read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                        <p className="text-muted-foreground text-xs">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`px-4 py-3 border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30 ${!n.is_read ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {user ? (
            <Link to="/profile" className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-muted transition-colors">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-primary/50" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
            </Link>
          ) : (
            <Link to="/login" className="text-sm font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
