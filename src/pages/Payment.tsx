import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Check, Zap, Crown, Calendar, Clock, Loader2, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const plans = [
  {
    id: 'day', name: '1 Day', price: '2,000', amount: 2000, currency: 'TZS',
    icon: Clock, colorClass: 'text-primary', bgClass: 'bg-primary/10',
    borderActive: 'border-primary glow-cyan',
    features: ['All Channels', 'HD Quality', '1 Device'],
  },
  {
    id: 'week', name: '1 Week', price: '3,500', amount: 3500, currency: 'TZS',
    icon: Zap, colorClass: 'text-orange-400', bgClass: 'bg-orange-400/10',
    borderActive: 'border-orange-500 shadow-[0_0_20px_rgba(251,146,60,0.3)]',
    features: ['All Channels', 'HD Quality', '2 Devices'],
  },
  {
    id: 'week2', name: '2 Weeks', price: '7,000', amount: 7000, currency: 'TZS',
    icon: Calendar, colorClass: 'text-yellow-400', bgClass: 'bg-yellow-400/10',
    borderActive: 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]',
    popular: true,
    features: ['All Channels', 'HD Quality', '3 Devices'],
  },
  {
    id: 'month', name: '1 Month', price: '15,000', amount: 15000, currency: 'TZS',
    icon: Crown, colorClass: 'text-yellow-300', bgClass: 'bg-yellow-300/10',
    borderActive: 'border-yellow-400 shadow-[0_0_20px_rgba(253,224,71,0.3)]',
    features: ['All Channels', '4K Ultra HD', '4 Devices', 'Ad-Free', 'Priority Support'],
  },
];

type Step = 'select' | 'phone' | 'waiting' | 'success' | 'failed';

export default function Payment() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [phone, setPhone] = useState((profile as any)?.phone || '');
  const [step, setStep] = useState<Step>('select');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);

  const selectedPlan = plans.find((p) => p.id === selected);

  const handleProceed = () => {
    if (!user) { navigate('/login'); return; }
    if (!selected) return;
    setStep('phone');
    setError('');
  };

  const handlePay = async () => {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    if (!selectedPlan) return;
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();

    try {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sonicpesa-payment?action=create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            phone: phone.trim(),
            amount: selectedPlan.amount,
            plan: selectedPlan.id,
            buyer_name: profile?.display_name || 'Customer',
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setOrderId(data.order_id);
        setStep('waiting');
        startPolling(data.order_id, session?.access_token || '');
      } else {
        setError(data.message || 'Payment error. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const startPolling = (oid: string, token: string) => {
    setPolling(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sonicpesa-payment?action=status&order_id=${oid}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.payment_status === 'COMPLETED') {
          clearInterval(interval);
          setPolling(false);
          await refreshProfile();
          setStep('success');
        } else if (data.payment_status === 'FAILED') {
          clearInterval(interval);
          setPolling(false);
          setStep('failed');
        } else if (attempts >= 24) {
          clearInterval(interval);
          setPolling(false);
          setStep('failed');
        }
      } catch {
        if (attempts >= 24) { clearInterval(interval); setPolling(false); setStep('failed'); }
      }
    }, 5000);
  };

  // Step: Success
  if (step === 'success') return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-6 animate-bounce">
          <Check className="w-12 h-12 text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Payment Successful!</h2>
        <p className="text-muted-foreground text-center text-sm mb-2">
          You have successfully subscribed to <span className="text-primary font-bold">{selectedPlan?.name}</span>
        </p>
        <p className="text-muted-foreground text-center text-sm mb-8">Your entertainment starts now 🎉</p>
        <button onClick={() => navigate('/')} className="w-full max-w-sm py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg glow-cyan">
          WATCH CHANNELS
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // Step: Failed
  if (step === 'failed') return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-24 h-24 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center mb-6">
          <span className="text-4xl">✕</span>
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Payment Failed</h2>
        <p className="text-muted-foreground text-center text-sm mb-8">Please try again or contact support.</p>
        <button onClick={() => { setStep('select'); setOrderId(''); setError(''); }} className="w-full max-w-sm py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg glow-cyan">
          TRY AGAIN
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // Step: Waiting for payment
  if (step === 'waiting') return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mb-6">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Please Wait...</h2>
        <p className="text-muted-foreground text-center text-sm mb-2">Payment request sent to your phone</p>
        <p className="text-primary font-bold text-center text-sm mb-8">{phone}</p>
        <div className="w-full max-w-sm cyber-card rounded-2xl p-5">
          <p className="text-xs text-muted-foreground text-center mb-3">Next steps:</p>
          {['Check your phone', 'A USSD SMS will arrive shortly', `Confirm payment of TZS ${selectedPlan?.price}`, 'You will be redirected automatically'].map((s, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-black flex-shrink-0">{i + 1}</span>
              <span className="text-sm text-foreground">{s}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6 text-center">Checking payment status every 5 seconds...</p>
      </div>
      <BottomNav />
    </div>
  );

  // Step: Phone input
  if (step === 'phone') return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => setStep('select')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          ← Back
        </button>
        <div className="cyber-card rounded-2xl p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-foreground mb-1">Enter Phone Number</h2>
            <p className="text-sm text-muted-foreground">Plan: <span className="text-primary font-bold">{selectedPlan?.name} — TZS {selectedPlan?.price}</span></p>
          </div>
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground mb-1.5 block">M-Pesa / Tigo Pesa / Airtel Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="bg-muted border-border pl-10 text-foreground text-lg tracking-wider"
                type="tel"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Example: 0712345678 or 255712345678</p>
          </div>
          {error && <p className="text-destructive text-sm mb-3 bg-destructive/10 rounded-xl p-3">{error}</p>}
          <button
            onClick={handlePay}
            disabled={loading || !phone.trim()}
            className="w-full py-4 rounded-2xl font-black text-lg bg-primary text-primary-foreground glow-cyan disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/80 transition-colors"
          >
            {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Sending...</span> : 'SEND PAYMENT REQUEST'}
          </button>
          <p className="text-center text-xs text-muted-foreground mt-3">Secure payment via SonicPesa</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // Step: Select plan
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black tracking-wide text-foreground mb-1">
            Choose a <span className="text-primary text-glow-cyan">Plan</span>
          </h1>
          <p className="text-sm text-muted-foreground">Enjoy premium entertainment</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`text-left rounded-2xl p-4 border-2 transition-all relative overflow-hidden bg-card ${selected === plan.id ? plan.borderActive : 'border-border hover:border-muted-foreground/30'}`}
              >
                {plan.popular && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">POPULAR</span>
                  </div>
                )}
                {selected === plan.id && (
                  <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <div className={`w-9 h-9 rounded-xl ${plan.bgClass} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${plan.colorClass}`} />
                </div>
                <p className="font-black text-foreground text-sm">{plan.name}</p>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className={`text-lg font-black ${plan.colorClass}`}>{plan.price}</span>
                  <span className="text-[10px] text-muted-foreground"> TZS</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-center gap-1 text-[10px] text-foreground/70">
                      <Check className={`w-2.5 h-2.5 flex-shrink-0 ${plan.colorClass}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <button
          disabled={!selected}
          onClick={handleProceed}
          className="w-full py-4 rounded-2xl font-black text-lg tracking-wider bg-primary text-primary-foreground glow-cyan disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/80 transition-colors"
        >
          {user ? 'PROCEED TO PAY' : 'REGISTER FIRST'}
        </button>
        {!user && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            You must register before subscribing
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground mt-2">
          Pay via M-Pesa · Tigo Pesa · Airtel Money
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
