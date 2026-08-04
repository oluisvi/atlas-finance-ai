export interface AccountResponse {
  archivedAt: Date | null;
  color: string | null;
  createdAt: Date;
  currency: string;
  currentBalance: string;
  id: string;
  icon: string | null;
  includeInDashboard: boolean;
  initialBalance: string;
  name: string;
  status: string;
  type: string;
  updatedAt: Date;
}
