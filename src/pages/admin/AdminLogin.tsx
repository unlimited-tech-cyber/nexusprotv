import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const { loginAsAdmin } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = loginAsAdmin(password);
    if (ok) {
      navigate('/admin');
    } else {
      setError('Nywila si sahihi');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-black tracking-widest text-foreground">ADMIN PANEL</h1>
          <p className="text-muted-foreground text-sm mt-1">Triber Zone TV — Admin</p>
        </div>

        <div className="cyber-card rounded-xl p-6 border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-pwd" className="text-foreground text-sm font-semibold">
                Nywila ya Admin
              </Label>
              <div className="relative">
                <Input
                  id="admin-pwd"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Weka nywila ya admin"
                  className="bg-muted border-border text-foreground pr-10"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm p-3 rounded-lg bg-destructive/20 text-destructive border border-destructive/30">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/80 font-bold tracking-wider"
            >
              {loading ? '...' : 'INGIA KAMA ADMIN'}
            </Button>
          </form>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Rudi kwenye ukurasa wa kawaida
          </button>
        </div>
      </div>
    </div>
  );
}
