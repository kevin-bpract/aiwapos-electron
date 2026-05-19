import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../renderer/contexts/AuthContext';
import { MenuItem } from '../../types/menuitem';
import sideBarItems from '../../constants/sidebaritems';
import POSSettingsModal from '../modals/possettingsmodal';
import Portal from '../portal';
import CreateCustomerModal from '../modals/createcustomermodal';
import CreateProductModal from '../modals/createproductmodal';

interface SidebarProps {
  items?: MenuItem[];
  onItemClick?: (id: string) => void;
  onSessionClick?: () => void;
  onShiftHistoryClick?: () => void;
}

const POSSidebar: React.FC<SidebarProps> = ({
  items = sideBarItems,
  onItemClick,
  onSessionClick,
  onShiftHistoryClick,
}) => {
  const [activeId, setActiveId] = useState<string>('cart');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleItemClick = (id: string, route: string): void => {
    // Intercept session click — open modal instead of navigating
    if (route === '__session__') {
      onSessionClick?.();
      return;
    }

    if (route === '__shifthistory__') {
      onShiftHistoryClick?.();
      return;
    }

    if (route === '__createcustomer__') {
      setShowCreateCustomerModal(true);
      return;
    }

    if (route === '__createproduct__') {
      setShowCreateProductModal(true);
      return;
    }

    setActiveId(id);
    onItemClick?.(id);
    navigate(`/dashboard/${route}`);

    // Hide sidebar completely when navigating to restaurant
    if (id === 'restaurant') {
      setIsMinimized(true);
    } else {
      setIsMinimized(false);
    }
  };

  const getUserInitials = (username: string): string => {
    return username
      .split(' ')
      .map((n: string) => n)
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const userEmail = user
    ? `${user.toLowerCase().replace(/\s+/g, '.')}@store.com`
    : '';

  return (
    <>
      {/* Chevron Button - Show when sidebar is hidden on restaurant screen */}
      {isMinimized && activeId === 'restaurant' && (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="fixed left-0 top-2 z-50 flex items-center justify-center w-6 h-14 transition-all duration-200"
          style={{
            background: '#fff',
            color: 'var(--color-ink-muted)',
            borderRadius: '0 10px 10px 0',
            border: '1px solid var(--color-line)',
            borderLeft: 'none',
            boxShadow: '0 6px 14px rgba(15,23,42,0.10)',
          }}
          aria-label="Expand sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="w-4 h-4"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      <aside
        className={`flex flex-col h-screen transition-all duration-300 relative ${
          isMinimized && activeId === 'restaurant'
            ? 'w-0 overflow-hidden opacity-0'
            : 'opacity-100'
        }`}
        role="navigation"
        aria-label="POS Navigation"
        style={{
          width: isMinimized && activeId === 'restaurant' ? 0 : 76,
          background: '#fff',
          color: 'var(--color-ink-muted)',
          borderRight: '1px solid var(--color-line)',
          padding:
            isMinimized && activeId === 'restaurant' ? 0 : '16px 10px',
        }}
      >
        {/* Collapse Button - Only show when expanded on restaurant screen */}
        {!isMinimized && activeId === 'restaurant' && (
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-6 h-14 transition-all duration-200"
            style={{
              background: '#fff',
              color: 'var(--color-ink-muted)',
              borderRadius: '0 10px 10px 0',
              border: '1px solid var(--color-line)',
              borderLeft: 'none',
              boxShadow: '0 6px 14px rgba(15,23,42,0.10)',
            }}
            aria-label="Collapse sidebar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="w-4 h-4"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <nav className="flex-1 flex flex-col space-y-1.5 pt-2">
          {items.map((item: MenuItem, index: number) => {
            const isActive = activeId === item.id;
            return (
              <React.Fragment key={item.id}>
                <button
                  type="button"
                  tabIndex={-1}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Spacebar'
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="group relative flex items-center justify-center h-12 transition-all duration-200 focus:outline-none"
                  style={{
                    borderRadius: 12,
                    background: isActive
                      ? 'var(--color-primary-soft)'
                      : 'transparent',
                    color: isActive
                      ? 'var(--color-primary-deep)'
                      : 'var(--color-ink-muted)',
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(15,23,42,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.color =
                        'var(--color-ink)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color =
                        'var(--color-ink-muted)';
                    }
                  }}
                  onClick={() => handleItemClick(item.id, item.route)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  aria-label={item['aria-label']}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {React.cloneElement(
                    React.Children.only(item.icon) as React.ReactElement<
                      React.SVGProps<SVGSVGElement>
                    >,
                    {
                      className: 'w-5 h-5 flex-shrink-0',
                    },
                  )}

                  {hoveredId === item.id && (
                    <div
                      className="absolute left-full ml-3 px-3 py-2 text-[12px] font-semibold whitespace-nowrap z-50"
                      style={{
                        background: 'var(--color-ink)',
                        color: '#fff',
                        borderRadius: 8,
                        boxShadow: '0 8px 18px rgba(15,23,42,0.22)',
                      }}
                    >
                      {item.tooltip}
                      <div
                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45"
                        style={{ background: 'var(--color-ink)' }}
                      />
                    </div>
                  )}
                </button>

                {index === 3 && (
                  <div
                    className="w-full"
                    style={{
                      height: 1,
                      background: 'var(--color-line)',
                      margin: '8px 0',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div
          className="pb-2 pt-3 space-y-3"
          style={{ borderTop: '1px solid var(--color-line)' }}
        >
          <div className="flex flex-col items-center">
            <div
              className="flex items-center justify-center font-bold cursor-pointer transition-all duration-200"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 14,
                letterSpacing: '0.02em',
              }}
              aria-label={user ? `User profile for ${user}` : 'User profile'}
              role="button"
              tabIndex={-1}
              onClick={() => setShowSettingsModal(true)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' ||
                  e.key === ' ' ||
                  e.key === 'Spacebar'
                ) {
                  e.preventDefault();
                  setShowSettingsModal(true);
                }
              }}
              title={user ? `${user}\n${userEmail}` : 'User profile'}
            >
              {user ? getUserInitials(user) : 'U'}
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
              }
            }}
            className="group relative w-full flex items-center justify-center h-10 transition-all duration-200"
            style={{
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--color-ink-muted)',
              border: '1px solid var(--color-line)',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'var(--color-primary-soft)';
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-primary-deep)';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-primary-soft)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'transparent';
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-ink-muted)';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-line)';
            }}
            onClick={handleLogout}
            onMouseEnter={() => setHoveredId('logout')}
            onMouseLeave={() => setHoveredId(null)}
            aria-label="Logout"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="w-5 h-5 flex-shrink-0"
              aria-hidden="true"
            >
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" />
              <path d="M16 17L21 12L16 7" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>

        {/* POS Settings Modal */}
        {showSettingsModal && (
          <POSSettingsModal onClose={() => setShowSettingsModal(false)} />
        )}

        {showCreateCustomerModal && (
          <Portal
            modalTitle="Create Customer"
            onClose={() => setShowCreateCustomerModal(false)}
          >
            <CreateCustomerModal
              onClose={() => setShowCreateCustomerModal(false)}
            />
          </Portal>
        )}

        {showCreateProductModal && (
          <Portal
            modalTitle="Create Product"
            onClose={() => setShowCreateProductModal(false)}
          >
            <CreateProductModal
              onClose={() => setShowCreateProductModal(false)}
            />
          </Portal>
        )}
      </aside>
    </>
  );
};

POSSidebar.displayName = 'POSSidebar';

export default POSSidebar;
