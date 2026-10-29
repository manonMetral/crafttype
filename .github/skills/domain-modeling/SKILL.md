---
name: domain-modeling
description: Represent a business domain with explicit concepts, rules, and boundaries. Use when requirements involve meaningful entities, lifecycle states, terminology, or invariants.
---

# Domain modeling

Make the business rules visible in the model rather than scattering them across UI handlers and persistence code.

## Explore

- Gather terms from users and existing behavior; record synonyms and ambiguous words.
- Identify the actors, important events, entities, value-like concepts, and external systems.
- For each concept, define identity, lifecycle, ownership, and the rules that must always hold.
- Separate facts that change from derived values and presentation-only fields.
- Identify where rules are authoritative and what happens when another system disagrees.

## Shape

Use types and boundaries that prevent invalid combinations where practical. Keep domain decisions independent from transport and storage details. Model state transitions explicitly when order matters. Treat a bounded context as a useful language boundary, not a reason to duplicate every concept.

Regardless of the surrounding architecture, isolate the model in a `domain` module or package within its bounded context. Do not import UI, transport, persistence implementations, or framework-specific types into it.

Represent meaningful domain values with immutable, validated Value Objects that compare by value. Construct entities and aggregates from these Value Objects rather than raw primitives for domain concepts. Keep entity identity distinct from value equality, and enforce cross-field invariants and state transitions inside the entity or aggregate. Convert transport and persistence representations outside the domain; neither creation nor reconstitution may expose invalid business objects.

Validate the model against concrete scenarios, including rejection, cancellation, and change over time. Confirm terminology with the people who use it. Avoid speculative fields and abstractions; evolve the model when real cases reveal missing rules.
