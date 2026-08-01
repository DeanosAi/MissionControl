import 'server-only';

export interface BudgetRealtimeEvent {
  revision: number;
  clientId: string;
}

type BudgetSubscriber = (event: BudgetRealtimeEvent) => void;

declare global {
  var __bradyBudgetSubscribers__: Map<string, Set<BudgetSubscriber>> | undefined;
}

function subscriberMap() {
  globalThis.__bradyBudgetSubscribers__ ??= new Map<string, Set<BudgetSubscriber>>();
  return globalThis.__bradyBudgetSubscribers__;
}

export function subscribeToBudget(householdId: string, subscriber: BudgetSubscriber) {
  const subscribers = subscriberMap();
  const householdSubscribers = subscribers.get(householdId) ?? new Set<BudgetSubscriber>();
  householdSubscribers.add(subscriber);
  subscribers.set(householdId, householdSubscribers);

  return () => {
    householdSubscribers.delete(subscriber);
    if (!householdSubscribers.size) subscribers.delete(householdId);
  };
}

export function publishBudgetUpdate(householdId: string, event: BudgetRealtimeEvent) {
  for (const subscriber of subscriberMap().get(householdId) ?? []) {
    subscriber(event);
  }
}

