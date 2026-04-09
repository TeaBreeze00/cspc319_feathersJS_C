# Monoids (Documentation Sheet)

A **monoid** is a simple algebraic structure used heavily in functional programming and data composition.

## Definition

A monoid has:

- A set of values of one type
- A binary operation to combine two values of that same type
- An identity value

In code terms, you can think of it as:

- `concat(a, b)` (or similar combine operation)
- `empty` (identity element)

## Laws

A valid monoid must satisfy two laws:

1. **Associativity**
   - `concat(concat(a, b), c) === concat(a, concat(b, c))`
2. **Identity**
   - `concat(empty, a) === a`
   - `concat(a, empty) === a`

These laws are what make monoids practical for safe composition.

## Common JavaScript Monoids

- Numbers under addition: `empty = 0`, `concat = (a, b) => a + b`
- Numbers under multiplication: `empty = 1`, `concat = (a, b) => a * b`
- Strings: `empty = ''`, `concat = (a, b) => a + b`
- Arrays: `empty = []`, `concat = (a, b) => a.concat(b)`
- Objects (merge style): `empty = {}`, `concat = (a, b) => ({ ...a, ...b })`

## Minimal Example

```ts
type Monoid<T> = {
  empty: T
  concat: (a: T, b: T) => T
}

const Sum: Monoid<number> = {
  empty: 0,
  concat: (a, b) => a + b
}

const total = [1, 2, 3, 4].reduce(Sum.concat, Sum.empty)
// total = 10
```

## Why Monoids Matter in FeathersJS

Monoid-style composition can simplify Feathers code where data is accumulated or merged:

- Building composed query fragments
- Aggregating validation errors or warnings
- Combining service-level metrics
- Merging hook-produced metadata

### Example: Compose query fragments safely

```ts
type Query = Record<string, any>

const QueryMonoid = {
  empty: {} as Query,
  concat: (a: Query, b: Query): Query => ({ ...a, ...b })
}

const filters = [
  { archived: false },
  { userId: 42 },
  { $limit: 20 }
]

const query = filters.reduce(QueryMonoid.concat, QueryMonoid.empty)
```

Because an identity exists (`{}`) and composition is predictable, the reducer is easy to reason about and reuse.

## Practical Notes

- Pick one monoid behavior per type and context (for example, object merge strategy).
- Prefer explicit `empty` values instead of `null` checks.
- In hooks, monoid-style reducers keep transformation logic deterministic and testable.
