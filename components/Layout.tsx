
import React from 'react';
import { Home, Compass, Store, Backpack, User, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: '农场', path: '/' },
    { icon: Users, label: '好友', path: '/social' },
    { icon: Store, label: '集市', path: '/market' },
    { icon: Backpack, label: '背包', path: '/bag' },
    { icon: User, label: '我的', path: '/profile' },
  ];

  const shouldShowNav = true; 
  const isHomePage = location.pathname === '/';

  return (
    <div className="flex flex-col h-screen w-full bg-[#F2F5EB] relative overflow-hidden font-sans select-none">
      {/* Main Content Area */}
      <div className={`flex-1 w-full ${isHomePage ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'} ${shouldShowNav && !isHomePage ? 'pb-24' : ''}`}>
        {children}
      </div>

      {/* Bottom Navigation */}
      {shouldShowNav && (
        <div 
          className="fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-md rounded-3xl shadow-xl h-20 flex items-center justify-around px-2 z-50 animate-slide-up border border-white/50 select-none touch-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex flex-col items-center justify-center w-14 h-full group active:scale-90 transition-transform select-none`}
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-brand-brown text-brand-orangeLight shadow-md' : 'text-brand-brownLight group-hover:bg-brand-bg'}`}>
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-bold mt-1 transition-opacity duration-200 ${
                  isActive ? 'text-brand-brown' : 'text-brand-brownLight/70'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Layout;
