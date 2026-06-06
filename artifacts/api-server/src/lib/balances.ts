export interface Balance {
  userId: number;
  name: string;
  avatarUrl: string | null;
  net: number;
}

export interface Debt {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  amount: number;
}

export function simplifyDebts(balances: Balance[]): Debt[] {
  const debtors = balances.filter(b => b.net < 0).map(b => ({ ...b, net: -b.net }));
  const creditors = balances.filter(b => b.net > 0).map(b => ({ ...b }));
  const debts: Debt[] = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].net, creditors[j].net);
    if (amount > 0.005) {
      debts.push({
        fromUserId: debtors[i].userId,
        fromUserName: debtors[i].name,
        toUserId: creditors[j].userId,
        toUserName: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
      });
    }
    debtors[i].net -= amount;
    creditors[j].net -= amount;
    if (debtors[i].net < 0.005) i++;
    if (creditors[j].net < 0.005) j++;
  }
  return debts;
}
