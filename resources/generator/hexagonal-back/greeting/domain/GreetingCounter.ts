/** Port: counts the greetings served. Its adapters belong to the infrastructure. */
export interface GreetingCounter {
  /** Records one more greeting and returns the total so far. */
  increment(): number;
}
