import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Bell, Send, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    await supabase.from('notifications').insert({ title: title.trim(), message: message.trim() });
    setTitle('');
    setMessage('');
    setMsg('Arifa imetumwa kwa watumiaji wote!');
    setTimeout(() => setMsg(''), 3000);
    await fetchNotifications();
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Futa arifa hii?')) return;
    await supabase.from('notifications').delete().eq('id', id);
    fetchNotifications();
  };

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-2xl">
          <Bell className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-black text-foreground">Tuma Arifa</h1>
          <p className="text-xs text-muted-foreground">Arifa zitaonekana kwa watumiaji wote</p>
        </div>
      </div>

      {/* Compose */}
      <div className="cyber-card rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-4">Arifa Mpya</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-foreground mb-1 block font-bold">Kichwa cha Arifa</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Habari mpya..." className="bg-muted border-border text-foreground" />
          </div>
          <div>
            <label className="text-xs text-foreground mb-1 block font-bold">Ujumbe</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Andika ujumbe hapa..."
              rows={3}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {msg && <p className="text-sm text-primary mt-2">{msg}</p>}
        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full mt-4 bg-primary text-primary-foreground glow-cyan font-black tracking-wider"
        >
          <Send className="w-4 h-4 mr-2" />
          {sending ? 'INATUMA...' : 'TUMA KWA WATUMIAJI WOTE'}
        </Button>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Historia ya Arifa</h2>
        {notifications.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Hakuna arifa bado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="cyber-card rounded-xl p-3 flex items-start gap-3">
                <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
