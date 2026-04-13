type CounterKey =
  | "eventsIngested"
  | "eventsDeduplicated"
  | "syncReplayAccepted"
  | "syncReplayRejected"
  | "divergenceScans";

const counters: Record<CounterKey, number> = {
  eventsIngested: 0,
  eventsDeduplicated: 0,
  syncReplayAccepted: 0,
  syncReplayRejected: 0,
  divergenceScans: 0
};

export function incrementCounter(counter: CounterKey, value = 1): void {
  counters[counter] += value;
}

export function readCounters(): Record<CounterKey, number> {
  return { ...counters };
}