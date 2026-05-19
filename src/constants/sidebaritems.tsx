import { MenuItem } from '../types/menuitem';

const sideBarItems: MenuItem[] = [
  {
    id: 'restaurant',
    tooltip: 'Restaurant',
    route: 'restaurant',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M6 10h12" />
        <path d="M6 14h12" />

        <path d="M7 3v6" />
        <path d="M6 3v3" />
        <path d="M8 3v3" />

        <path d="M17 3c0 4-2 6-2 6v4" />

        <path d="M4 20h16" />
      </svg>
    ),
  },
  // {
  //   id: 'wallet',
  //   tooltip: 'Wallet',
  //   route: '/wallet',
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="2"
  //     >
  //       <rect x="2" y="6" width="20" height="14" rx="2" />
  //       <path d="M2 10H22" />
  //       <circle cx="18" cy="15" r="1" fill="currentColor" />
  //     </svg>
  //   ),
  // },
  // {
  //   id: 'drawer',
  //   tooltip: 'Cash Drawer',
  //   route: '/cash',
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="2"
  //     >
  //       <rect x="3" y="6" width="18" height="12" rx="2" />
  //       <path d="M3 10H21" />
  //       <circle cx="7" cy="14" r="0.5" fill="currentColor" />
  //       <circle cx="12" cy="14" r="0.5" fill="currentColor" />
  //       <circle cx="17" cy="14" r="0.5" fill="currentColor" />
  //     </svg>
  //   ),
  // },
  {
    id: 'createcustomer',
    tooltip: 'New Customer',
    route: '__createcustomer__',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    ),
  },
  {
    id: 'history',
    tooltip: 'Session',
    route: '__session__',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6V12L16 14" />
      </svg>
    ),
  },
  {
    id: 'shifthistory',
    tooltip: 'Shift History',
    route: '__shifthistory__',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <path d="M22 6l-10 7L2 6" />
      </svg>
    ),
  },
  {
    id: 'createproduct',
    tooltip: 'New Product',
    route: '__createproduct__',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        <line x1="17" y1="3" x2="17" y2="9" />
        <line x1="14" y1="6" x2="20" y2="6" />
      </svg>
    ),
  },

  // {
  //   id: 'folder',
  //   tooltip: 'Files',
  //   route: '/files',
  //   icon: (
  //     <svg
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="2"
  //     >
  //       <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H12L10 4H5C3.89543 4 3 4.89543 3 5V7Z" />
  //     </svg>
  //   ),
  // },
];

export default sideBarItems;
