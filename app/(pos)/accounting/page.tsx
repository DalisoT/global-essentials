import AccountingClient from './AccountingClient';

// Server entry — pass through. Data fetching lives in the client component
// so the period picker can refetch without a full route reload.
export default function AccountingPage() {
  return <AccountingClient />;
}