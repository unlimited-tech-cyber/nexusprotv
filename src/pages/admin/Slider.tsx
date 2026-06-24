import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface SliderImage {
  id: string;
  img_url: string;
  caption: string | null;
  sort_order: number;
  active: boolean;
}

export default function AdminSlider() {
  const [slides, setSlides] = useState<SliderImage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ img_url: '', caption: '', sort_order: 0 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSlides(); }, []);

  const fetchSlides = async () => {
    const { data } = await supabase.from('slider_images').select('*').order('sort_order');
    setSlides(data || []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('slider-images').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('slider-images').getPublicUrl(path);
      setForm((f) => ({ ...f, img_url: publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.img_url) return;
    setSaving(true);
    await supabase.from('slider_images').insert({ img_url: form.img_url, caption: form.caption || null, sort_order: form.sort_order });
    await fetchSlides();
    setShowForm(false);
    setForm({ img_url: '', caption: '', sort_order: 0 });
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Futa picha hii?')) return;
    await supabase.from('slider_images').delete().eq('id', id);
    fetchSlides();
  };

  const toggleActive = async (s: SliderImage) => {
    await supabase.from('slider_images').update({ active: !s.active }).eq('id', s.id);
    fetchSlides();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-foreground">Picha za Slider</h1>
        <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground text-xs px-3 py-2 h-auto glow-cyan">
          <Plus className="w-3.5 h-3.5 mr-1" /> Ongeza
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {slides.map((s) => (
          <div key={s.id} className={`cyber-card rounded-xl overflow-hidden ${!s.active ? 'opacity-50' : ''}`}>
            <div className="h-32 overflow-hidden">
              <img src={s.img_url} alt={s.caption || ''} className="w-full h-full object-cover" />
            </div>
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{s.caption || '(Hakuna maelezo)'}</p>
                <p className="text-xs text-muted-foreground">Mpangilio: {s.sort_order}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(s)} className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${s.active ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${s.active ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {slides.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Hakuna picha bado</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-black text-foreground">Ongeza Picha ya Slider</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-col items-center gap-2">
                <div className="w-full h-32 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  {form.img_url ? <img src={form.img_url} alt="" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="border-primary text-primary text-xs">
                  {uploading ? 'Inapakia...' : 'Pakia Picha kutoka Gallery'}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <div className="w-full">
                  <Label className="text-xs">Au URL ya picha</Label>
                  <Input value={form.img_url} onChange={(e) => setForm((f) => ({ ...f, img_url: e.target.value }))} placeholder="https://..." className="bg-muted border-border mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Maelezo</Label>
                <Input value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} placeholder="Live Sports..." className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Mpangilio</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} className="bg-muted border-border" />
              </div>
              <Button onClick={handleSave} disabled={saving || !form.img_url} className="w-full bg-primary text-primary-foreground glow-cyan">
                {saving ? 'Inahifadhi...' : 'Ongeza'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
