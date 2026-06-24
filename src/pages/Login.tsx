import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Phone, User, Lock, Tv2 } from 'lucide-react';

type Mode = 'login' | 'signup';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const phoneToEmail = (p: string) => {
    const cleaned = p.replace(/\D/g, '');
    return `${cleaned}@chtv.app`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    const internalEmail = phoneToEmail(phone);

    if (mode === 'login') {
      const { error: err, deviceBlocked } = await signIn(internalEmail, password);
      if (deviceBlocked) {
        setError('⚠️ Akaunti hii imefungwa kwa kifaa kingine. Toka kwenye kifaa chako cha awali au wasiliana na msaada.');
      } else if (err) {
        setError('Nambari ya simu au nywila si sahihi');
      } else {
        navigate('/');
      }
    } else {
      if (!displayName.trim()) {
        setError('Name is required');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(internalEmail, password, displayName, cleanPhone);
      if (err) {
        setError(err.message.includes('already') ? 'This number is already registered' : err.message);
      } else {
        setSuccess('Account created! Please log in.');
        setMode('login');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-2 mb-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan">
              <Tv2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-widest text-primary text-glow-cyan">NEXUS PRO TV</p>
              <p className="text-sm font-bold tracking-[0.3em] text-secondary uppercase -mt-1">Premium Streaming</p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Your Premium Streaming Platform</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                mode === m
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="cyber-card rounded-xl p-6 border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-primary" /> Your Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Full name"
                  className="bg-muted border-border text-foreground"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-primary" /> Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 712 345 678"
                className="bg-muted border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-primary" /> Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  className="bg-muted border-border text-foreground pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            {success && (
              <p className="text-sm p-3 rounded-lg bg-green-900/30 text-green-400 border border-green-700">
                {success}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-bold tracking-wider glow-cyan"
            >
              {loading ? '...' : mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
