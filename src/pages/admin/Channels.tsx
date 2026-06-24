import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Plus, Trash2, Edit2, X, Upload, Tv } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Channel {
  id: string;
  name: string;
  type: string;
  url: string;
  kid: string | null;
  key: string | null;
  img_url: string | null;
  sort_order: number;
  active: boolean;
  is_free: boolean;
}

const emptyForm = { name: '', type: 'hls', url: '', kid: '', key: '', img_url: '', sort_order: 0, is_free: false };

export default function AdminChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchChannels(); }, []);

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('*').order('sort_order');
    setChannels(data || []);
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (ch: Channel) => {
    setEditing(ch);
    setForm({ name: ch.name, type: ch.type, url: ch.url, kid: ch.kid || '', key: ch.key || '', img_url: ch.img_url || '', sort_order: ch.sort_order, is_free: ch.is_free });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('channel-images').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('channel-images').getPublicUrl(path);
      setForm((f) => ({ ...f, img_url: publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      name: form.name,
      type: form.type,
      url: form.url,
      kid: form.kid || null,
      key: form.key || null,
      img_url: form.img_url || null,
      sort_order: form.sort_order,
      is_free: form.is_free,
    };

    if (editing) {
      await supabase.from('channels').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('channels').insert(payload);
    }
    await fetchChannels();
    setShowForm(false);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Futa kituo hiki?')) return;
    await supabase.from('channels').delete().eq('id', id);
    fetchChannels();
  };

  const toggleActive = async (ch: Channel) => {
    await supabase.from('channels').update({ active: !ch.active }).eq('id', ch.id);
    fetchChannels();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-foreground">Simamia Vituo</h1>
        <Button onClick={openAdd} className="bg-primary text-primary-foreground text-xs px-3 py-2 h-auto glow-cyan">
          <Plus className="w-3.5 h-3.5 mr-1" /> Ongeza
        </Button>
      </div>

      {/* Channel list */}
      <div className="space-y-2">
        {channels.map((ch) => (
          <div key={ch.id} className={`cyber-card rounded-xl p-3 flex items-center gap-3 ${!ch.active ? 'opacity-50' : ''}`}>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              {ch.img_url ? <img src={ch.img_url} alt={ch.name} className="w-full h-full object-contain" /> : <Tv className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground truncate">{ch.name}</p>
                {ch.is_free && <span className="text-[9px] font-black bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">FREE</span>}
              </div>
              <p className="text-xs text-muted-foreground uppercase">{ch.type}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(ch)} className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${ch.active ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${ch.active ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <button onClick={() => openEdit(ch)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Edit2 className="w-3.5 h-3.5 text-primary" />
              </button>
              <button onClick={() => handleDelete(ch.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Tv className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Hakuna vituo bado</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-black text-foreground">{editing ? 'Hariri Kituo' : 'Ongeza Kituo'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              {/* Image upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  {form.img_url ? <img src={form.img_url} alt="" className="w-full h-full object-contain" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="border-primary text-primary text-xs">
                  {uploading ? 'Inapakia...' : 'Pakia Picha'}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground">Au weka URL ya picha</Label>
                  <Input value={form.img_url} onChange={(e) => setForm((f) => ({ ...f, img_url: e.target.value }))} placeholder="https://..." className="bg-muted border-border text-xs mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-foreground mb-1 block">Jina la Kituo *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Azam Sport 1" className="bg-muted border-border" required />
              </div>
              <div>
                <Label className="text-xs text-foreground mb-1 block">Aina</Label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground">
                  <option value="hls">HLS</option>
                  <option value="dash">DASH (DRM)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-foreground mb-1 block">URL ya Mkondo *</Label>
                <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className="bg-muted border-border" required />
              </div>
              {form.type === 'dash' && (
                <>
                  <div>
                    <Label className="text-xs text-foreground mb-1 block">KID (ClearKey)</Label>
                    <Input value={form.kid} onChange={(e) => setForm((f) => ({ ...f, kid: e.target.value }))} placeholder="key ID" className="bg-muted border-border font-mono text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground mb-1 block">KEY (ClearKey)</Label>
                    <Input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="decryption key" className="bg-muted border-border font-mono text-xs" />
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs text-foreground mb-1 block">Mpangilio</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} className="bg-muted border-border" />
              </div>
              {/* Free / Paid toggle */}
              <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-3 border border-border">
                <div>
                  <p className="text-sm font-bold text-foreground">Kituo Bure (Free)</p>
                  <p className="text-xs text-muted-foreground">Lipa au angalia bila malipo</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_free: !f.is_free }))}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.is_free ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_free ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <Button onClick={handleSave} disabled={loading || !form.name || !form.url} className="w-full bg-primary text-primary-foreground glow-cyan">
                {loading ? 'Inahifadhi...' : editing ? 'Hifadhi Mabadiliko' : 'Ongeza Kituo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
