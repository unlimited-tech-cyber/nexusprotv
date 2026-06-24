import { Link, useLocation } from 'react-router-dom';
import { Home, CreditCard, User } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const items = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/payment', icon: CreditCard, label: 'Subscribe' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border">
      <div className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const active = path === item.to;
          return (
            <Link key={item.to} to={item.to} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
              {active && <div className="absolute bottom-0 w-6 h-0.5 bg-primary rounded-t-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
