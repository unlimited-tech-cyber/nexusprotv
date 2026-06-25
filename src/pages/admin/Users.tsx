import { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import {
  Users, Calendar, CheckCircle, XCircle, Crown, Phone, Search,
  Plus, Trash2, RefreshCw, UserCheck, UserX, BadgeCheck, Clock,
} from 'lucide-react';

interface Profile {
  id: string; user_id: string; display_name: string | null;
  avatar_url: string | null; plan: string; created_at: string;
  phone: string | null; is_active: boolean;
}

interface Subscription {
  id: string; user_id: string; plan: string; status: string;
  expires_at: string | null; amount: number; created_at: string;
}

const planLabels: Record<string, string> = {
  day: 'Siku 1', week: 'Wiki 1', week2: 'Wiki 2', month: 'Mwezi 1', free: 'Bure',
};
const planDays: Record<string, number> = { day: 1, week: 7, week2: 14, month: 30 };
const planAmounts: Record<string, number> = { day: 2000, week: 3500, week2: 7000, month: 15000 };
const planColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  expired: 'bg-muted text-muted-foreground',
};

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approvePlan, setApprovePlan] = useState('month');
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => { fetchAll(); const channel = supabase.channel('admin:profiles'); channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll()).subscribe(); channel.on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetchAll()).subscribe(); return () => { supabase.removeChannel(channel); }; }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
    ]);
    setProfiles(pRes.data || []);
    setSubscriptions(sRes.data || []);
    setLoading(false);
  };

  const toggleActive = async (p: Profile) => {
    const newVal = !p.is_active;
    await supabase.from('profiles').update({ is_active: newVal }).eq('user_id', p.user_id);
    setProfiles((prev) => prev.map((x) => x.user_id === p.user_id ? { ...x, is_active: newVal } : x));
    if (selected?.user_id === p.user_id) setSelected({ ...selected, is_active: newVal });
  };

  const approveSubscription = async (p: Profile) => {
    setApproving(p.user_id);
    const days = planDays[approvePlan] || 30;
    const now = new Date();
    const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    await supabase.from('subscriptions').insert({
      user_id: p.user_id,
      plan: approvePlan,
      status: 'active',
      amount: planAmounts[approvePlan] || 0,
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
      phone: p.phone,
    });
    await supabase.from('profiles').update({ plan: approvePlan, is_active: true }).eq('user_id', p.user_id);
    await fetchAll();
    setApproving(null);
  };

  const revokeSubscription = async (subId: string, userId: string) => {
    setRevoking(subId);
    await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', subId);
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (!activeSubs || activeSubs.length === 0) {
      await supabase.from('profiles').update({ plan: 'free' }).eq('user_id', userId);
    }
    await fetchAll();
    setRevoking(null);
  };

  const resetDevice = async (userId: string) => {
    await (supabase.from('profiles') as any).update({ device_id: null }).eq('user_id', userId);
    await fetchAll();
  };

  const getUserSubs = (userId: string) => subscriptions.filter((s) => s.user_id === userId);
  const getActiveSub = (userId: string) =>
    subscriptions.find(
      (s) => s.user_id === userId && s.status === 'active' && s.expires_at && new Date(s.expires_at) > new Date(),
    );

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return !q || (p.display_name || '').toLowerCase().includes(q) || (p.phone || '').includes(q);
  });

  const totalActive = profiles.filter((p) => p.is_active).length;
  const totalPremium = profiles.filter((p) => p.plan !== 'free').length;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-black text-foreground">Watumiaji</h1>
          <p className="text-xs text-muted-foreground">{profiles.length} jumla</p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="cyber-card rounded-xl p-3 text-center">
          <p className="text-xl font-black text-foreground">{profiles.length}</p>
          <p className="text-[10px] text-muted-foreground">Jumla</p>
        </div>
        <div className="cyber-card rounded-xl p-3 text-center">
          <p className="text-xl font-black text-green-400">{totalActive}</p>
          <p className="text-[10px] text-muted-foreground">Hai</p>
        </div>
        <div className="cyber-card rounded-xl p-3 text-center">
          <p className="text-xl font-black text-yellow-400">{totalPremium}</p>
          <p className="text-[10px] text-muted-foreground">Premium</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tafuta kwa jina au simu..."
          className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="cyber-card rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const activeSub = getActiveSub(p.user_id);
            const expiryDate = activeSub?.expires_at ? new Date(activeSub.expires_at) : null;
            const isExpanded = selected?.user_id === p.user_id;
            const daysLeft = expiryDate
              ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 0;

            return (
              <div
                key={p.id}
                className={`cyber-card rounded-xl overflow-hidden transition-all ${!p.is_active ? 'opacity-60' : ''}`}
              >
                {/* Main row */}
                <div className="p-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-black text-sm">
                        {(p.display_name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">
                        {p.display_name || 'Mtumiaji'}
                      </p>
                      {activeSub && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{p.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {activeSub ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                          {planLabels[activeSub.plan] || activeSub.plan}
                          {daysLeft > 0 && ` · siku ${daysLeft}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Bure
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3 inline mr-0.5" />
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => toggleActive(p)}
                      title={p.is_active ? 'Zuia mtumiaji' : 'Ruhusu mtumiaji'}
                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                        p.is_active
                          ? 'bg-green-500/20 text-green-400 hover:bg-destructive/20 hover:text-destructive'
                          : 'bg-destructive/20 text-destructive hover:bg-green-500/20 hover:text-green-400'
                      }`}
                    >
                      {p.is_active
                        ? <><UserCheck className="w-3 h-3" /> Hai</>
                        : <><UserX className="w-3 h-3" /> Imezuiwa</>}
                    </button>
                    <button
                      onClick={() => setSelected(isExpanded ? null : p)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      {isExpanded ? 'Ficha' : 'Simamia'}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border/50 bg-muted/20 p-3 space-y-4">

                    {/* Account Controls */}
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                        Udhibiti wa Akaunti
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition-colors ${
                            p.is_active
                              ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                          }`}
                        >
                          {p.is_active
                            ? <><XCircle className="w-3.5 h-3.5" /> Zuia Akaunti</>
                            : <><CheckCircle className="w-3.5 h-3.5" /> Ruhusu Akaunti</>}
                        </button>
                        <button
                          onClick={() => resetDevice(p.user_id)}
                          title="Fungua kufuli ya kifaa — mtumiaji ataweza kuingia kwenye kifaa chochote"
                          className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border"
                        >
                          <Smartphone className="w-3.5 h-3.5" /> Fungua Kifaa
                        </button>
                      </div>
                    </div>

                    {/* Approve Subscription */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" /> Ongeza Usajili Mkononi
                      </p>
                      <div className="flex gap-2">
                        <select
                          value={approvePlan}
                          onChange={(e) => setApprovePlan(e.target.value)}
                          className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="day">Siku 1 — TZS 2,000</option>
                          <option value="week">Wiki 1 — TZS 3,500</option>
                          <option value="week2">Wiki 2 — TZS 7,000</option>
                          <option value="month">Mwezi 1 — TZS 15,000</option>
                        </select>
                        <button
                          onClick={() => approveSubscription(p)}
                          disabled={approving === p.user_id}
                          className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-primary/80 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          {approving === p.user_id ? '...' : 'Ongeza'}
                        </button>
                      </div>
                    </div>

                    {/* Subscription History */}
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Historia ya Usajili
                      </p>
                      {getUserSubs(p.user_id).length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">Hakuna usajili bado</p>
                      ) : (
                        <div className="space-y-1.5">
                          {getUserSubs(p.user_id).map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between bg-card rounded-xl px-3 py-2 border border-border/40"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground">
                                    {planLabels[s.plan] || s.plan}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    TZS {s.amount.toLocaleString()}
                                  </span>
                                </div>
                                {s.expires_at && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    Inaisha: {new Date(s.expires_at).toLocaleDateString('sw-TZ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    planColors[s.status] || 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {s.status === 'active' ? 'Hai' : s.status === 'pending' ? 'Inasubiri' : 'Imekwisha'}
                                </span>
                                {s.status === 'active' && (
                                  <button
                                    onClick={() => revokeSubscription(s.id, p.user_id)}
                                    disabled={revoking === s.id}
                                    title="Futa usajili huu"
                                    className="p-1 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Hakuna watumiaji wanaolingana</p>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
