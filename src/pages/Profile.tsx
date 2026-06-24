import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Camera, Save, CreditCard, LogOut, Crown, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Subscription {
  id: string; plan: string; status: string; expires_at: string | null; starts_at: string | null; amount: number;
}

const planLabels: Record<string, string> = { day: '1 Day', week: '1 Week', week2: '2 Weeks', month: '1 Month' };

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setPhone((profile as any).phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) fetchSubscription();
  }, [user]);

  const fetchSubscription = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription(data);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name: displayName, phone }).eq('user_id', user.id);
    if (!error) { await refreshProfile(); setMsg('Saved!'); setTimeout(() => setMsg(''), 3000); }
    setSaving(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
      await refreshProfile();
    }
    setUploading(false);
  };

  const handleLogout = async () => { await signOut(); navigate('/login'); };

  const isSubActive = subscription && subscription.status === 'active' && subscription.expires_at && new Date(subscription.expires_at) > new Date();
  const expiryDate = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  if (!user) return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You need to log in first</p>
          <Button onClick={() => navigate('/login')} className="bg-primary text-primary-foreground">Login</Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="px-4 py-6 max-w-lg mx-auto">

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary glow-cyan">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl font-black text-primary">{(profile?.display_name || 'U')[0].toUpperCase()}</span>
                </div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-primary-foreground hover:bg-primary/80 transition-colors">
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="mt-3 font-black text-lg text-foreground">{profile?.display_name || 'User'}</p>
          <p className="text-sm text-muted-foreground">{(profile as any)?.phone || user.email}</p>
        </div>

        {/* Subscription Status */}
        <div className={`rounded-2xl p-5 mb-4 border-2 ${isSubActive ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
          <div className="flex items-center gap-3 mb-3">
            {isSubActive ? (
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
            )}
            <div>
              <p className="font-black text-sm text-foreground">
                {isSubActive ? 'Active Subscription' : 'No Subscription'}
              </p>
              {isSubActive && subscription ? (
                <p className="text-xs text-green-400 font-bold">
                  {planLabels[subscription.plan] || subscription.plan} · {daysLeft} days remaining
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Subscribe to watch all channels</p>
              )}
            </div>
            {isSubActive && (
              <div className="ml-auto">
                <Crown className="w-6 h-6 text-yellow-400" />
              </div>
            )}
          </div>

          {isSubActive && expiryDate && (
            <div className="flex items-center gap-2 bg-card/60 rounded-xl px-3 py-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Expires: <span className="text-foreground font-bold">{expiryDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </p>
            </div>
          )}

          <Button
            onClick={() => navigate('/payment')}
            className={`w-full font-black ${isSubActive ? 'bg-card border border-primary/40 text-primary hover:bg-primary/10' : 'bg-primary text-primary-foreground glow-cyan'}`}
          >
            {isSubActive ? (
              <><RefreshCw className="w-4 h-4 mr-2" /> Renew Subscription</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Subscribe Now</>
            )}
          </Button>
        </div>

        {/* Edit Profile */}
        <div className="cyber-card rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-4">Edit Profile</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground text-xs mb-1.5 block">Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground text-xs mb-1.5 block">Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="bg-muted border-border text-foreground" />
            </div>
          </div>
          {msg && <p className="text-sm text-green-400 mt-2">{msg}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full mt-4 bg-primary text-primary-foreground glow-cyan">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full py-3 rounded-2xl border border-destructive/40 text-destructive font-bold text-sm hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
