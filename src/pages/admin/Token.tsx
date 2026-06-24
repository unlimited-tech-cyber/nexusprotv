import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Key, Save, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminToken() {
  const [token, setToken] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => { fetchToken(); }, []);

  const fetchToken = async () => {
    const { data } = await supabase.from('tokens').select('*').order('updated_at', { ascending: false }).limit(1).single();
    if (data) {
      setToken(data.value);
      setTokenId(data.id);
      setUpdatedAt(data.updated_at);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    if (tokenId) {
      await supabase.from('tokens').update({ value: token, updated_at: now }).eq('id', tokenId);
    } else {
      await supabase.from('tokens').insert({ value: token });
    }
    setMsg('Token imesasishwa! Itumika kwenye vituo vyote vya DASH.');
    setTimeout(() => setMsg(''), 4000);
    setSaving(false);
    fetchToken();
  };

  return (
    <AdminLayout>
      <div className="max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">Token ya CDN</h1>
            <p className="text-xs text-muted-foreground">Itumika kwenye vituo vyote vya DASH moja kwa moja</p>
          </div>
        </div>

        <div className="cyber-card rounded-2xl p-5">
          {updatedAt && (
            <div className="mb-4 p-3 bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground">Ilisasishwa mara ya mwisho:</p>
              <p className="text-xs font-mono text-foreground mt-0.5">{new Date(updatedAt).toLocaleString()}</p>
            </div>
          )}

          <div className="space-y-2 mb-4">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Token ya Leo</label>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Weka token hapa..."
                className="bg-muted border-border text-foreground font-mono text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {msg && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-xs">
              {msg}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground glow-cyan font-black tracking-wider">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'INAHIFADHI...' : 'HIFADHI TOKEN'}
          </Button>
        </div>

        <div className="mt-4 p-4 bg-muted/50 rounded-2xl">
          <p className="text-xs font-bold text-muted-foreground mb-2">ℹ️ Jinsi inavyofanya kazi:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Token hii itaongezwa kiotomatiki kwenye URL za vituo vyote vya DASH</li>
            <li>• Vituo vya HLS havitumii token</li>
            <li>• Badilisha token hapa kila siku au kulingana na ratiba ya CDN yako</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
