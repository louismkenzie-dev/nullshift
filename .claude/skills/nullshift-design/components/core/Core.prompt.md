**Card · Badge · Tag · Eyebrow · Avatar** — the core neutral primitives.

```jsx
<Card>…</Card>
<Card interactive>…</Card>
<Card highlighted padding={28}>…</Card>

<Badge tone="warning">new</Badge>
<Badge tone="success">accepted</Badge>
<Badge tone="neutral" dot={false}>draft</Badge>

<Tag>Hospitality</Tag>
<Tag interactive>Retail</Tag>

<Eyebrow>05 — Why us</Eyebrow>
<Eyebrow mono>// 02 — Colour palette</Eyebrow>

<Avatar initials="LM" size={40} status="online" />
<Avatar src="/team/priya.jpg" alt="Priya" size={32} />
```

Cards sit at the surface tier with a hairline border and no shadow — only `highlighted` adds an emerald edge. Badges are mono + signal-coloured and reserved for status. Tags are emerald pills for categories. Eyebrows name a section once.
