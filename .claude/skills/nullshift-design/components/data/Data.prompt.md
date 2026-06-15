**StatCard · PricingCard** — data display blocks.

```jsx
<StatCard label="Expected income" value="£8,400" sublabel="Jun 2025 · signed proposals" />
<StatCard label="New enquiries" value="3" sublabel="Awaiting action" accent="var(--warning)" />

<PricingCard
  tier="Pro" price="£2,400" bestFor="Growing businesses ready to scale"
  highlighted
  benefits={[
    "Up to 8 pages",
    "Bespoke design",
    { text: "E-commerce", checked: false },
  ]}
  cta="Start your build"
/>
```

StatCard accent defaults to emerald; switch to a signal colour to flag attention. PricingCard's `highlighted` plan gets the emerald edge, top accent line, and "Most popular" badge — use it on exactly one plan.
