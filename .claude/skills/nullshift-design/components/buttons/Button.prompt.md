**Button** — actions across marketing and admin surfaces. Exactly one `primary` (emerald) button per view; everything else is `secondary`, `ghost`, or `destructive`.

```jsx
<Button>Book a call</Button>
<Button variant="secondary">Client login</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button as="a" href="/book" iconEnd={<span>→</span>}>Tell us more</Button>
```

Sizes: `sm` 32px · `md` 40px · `lg` 48px. Primary carries the top-light inset and brightens to `--primary-hover`. Never use mono on buttons; never add outlines or glows to non-primary buttons.
