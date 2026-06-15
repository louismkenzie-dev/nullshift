**Tabs · Dropdown** — navigation primitives.

```jsx
<Tabs
  defaultValue="overview"
  items={[
    { value: "overview", label: "Overview", content: <p>…</p> },
    { value: "activity", label: "Activity", content: <p>…</p> },
  ]}
/>
<Tabs variant="pill" items={[…]} />

<Dropdown
  label="Actions"
  align="end"
  items={[
    { label: "Edit", icon: "✎", onSelect: () => {} },
    { divider: true },
    { label: "Delete", icon: "✕", danger: true, onSelect: () => {} },
  ]}
/>
<Dropdown trigger={<Avatar initials="LM" />} items={[…]} />
```

Tabs default to the emerald-underline variant; `pill` fills the active tab on a surface track. Dropdown opens an elevated-tier menu, closes on outside click or Escape, and supports `danger` items and `divider`s.
