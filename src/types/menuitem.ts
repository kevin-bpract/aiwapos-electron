import { ReactNode } from 'react';

export type MenuItem = {
  id: string;
  icon: ReactNode;
  tooltip?: string;
  route: string;
};
