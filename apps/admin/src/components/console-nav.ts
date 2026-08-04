import type { StaffRole } from '@icb/contracts';
import type { Route } from 'next';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CreditCard,
  FileText,
  HandCoins,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Scale,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * The console navigation model.
 *
 * Each section names the staff roles whose API permissions let them actually use it — the
 * sidebar filters by the signed-in operator's roles, so a role never sees a door it cannot
 * open. The role lists mirror the API's controller guards (`@Roles` / `@Permissions`); an item
 * with no `roles` is visible to every signed-in operator.
 *
 * Append-only by convention: new console sections add an entry here, they do not reorder
 * existing ones.
 */
export interface ConsoleNavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  roles?: readonly StaffRole[];
}

export interface ConsoleNavGroup {
  label: string;
  items: readonly ConsoleNavItem[];
}

const LEDGER_ROLES = ['operations', 'compliance', 'admin', 'super_admin'] as const;
const RISK_ROLES = ['fraud_analyst', 'compliance', 'operations', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export const CONSOLE_NAV: readonly ConsoleNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Operations', icon: LayoutDashboard, roles: LEDGER_ROLES },
      { href: '/monitor', label: 'Monitor', icon: Activity, roles: LEDGER_ROLES },
      { href: '/ledger', label: 'Trial balance', icon: BookOpen, roles: LEDGER_ROLES },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/customers', label: 'Customers', icon: Users },
      {
        href: '/kyc',
        label: 'KYC queue',
        icon: ShieldCheck,
        roles: ['compliance', 'operations', 'admin', 'super_admin'],
      },
      {
        href: '/support',
        label: 'Support',
        icon: LifeBuoy,
        roles: ['support', 'operations', 'admin', 'super_admin'],
      },
    ],
  },
  {
    label: 'Banking',
    items: [
      { href: '/accounts', label: 'Accounts', icon: Wallet, roles: LEDGER_ROLES },
      { href: '/approvals', label: 'Approvals', icon: Stamp },
      {
        href: '/cards',
        label: 'Cards',
        icon: CreditCard,
        roles: ['operations', 'admin', 'super_admin'],
      },
      {
        href: '/loans',
        label: 'Loans',
        icon: HandCoins,
        roles: ['underwriter', 'admin', 'super_admin'],
      },
      { href: '/disputes', label: 'Disputes', icon: Scale, roles: RISK_ROLES },
    ],
  },
  {
    label: 'Risk',
    items: [
      { href: '/fraud', label: 'Fraud', icon: AlertTriangle, roles: RISK_ROLES },
      {
        href: '/aml',
        label: 'AML',
        icon: Landmark,
        roles: ['aml_officer', 'compliance', 'admin', 'super_admin'],
      },
    ],
  },
  {
    label: 'Configuration',
    items: [
      {
        href: '/products',
        label: 'Products',
        icon: Package,
        roles: ['operations', 'admin', 'super_admin'],
      },
      { href: '/content', label: 'Content', icon: FileText, roles: ADMIN_ROLES },
      { href: '/controls', label: 'Bank controls', icon: SlidersHorizontal, roles: ['super_admin'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/staff', label: 'Staff', icon: KeyRound, roles: ADMIN_ROLES },
      {
        href: '/audit',
        label: 'Audit trail',
        icon: ScrollText,
        roles: ['aml_officer', 'compliance', 'admin', 'super_admin'],
      },
      {
        href: '/system',
        label: 'System',
        icon: Server,
        roles: ['operations', 'admin', 'super_admin'],
      },
    ],
  },
];

/** The groups an operator with these roles may see, with items they may open. */
export function navForRoles(roles: readonly string[]): ConsoleNavGroup[] {
  const held = new Set(roles);
  return CONSOLE_NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || item.roles.some((role) => held.has(role)),
    ),
  })).filter((group) => group.items.length > 0);
}
