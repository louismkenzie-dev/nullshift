**Input · Textarea · Switch** — form fields for briefs, enquiries, and the contact flow.

```jsx
<Input label="Business name" placeholder="Acme Ltd" />
<Input label="Email" type="email" error="Enter a valid email" />
<Textarea label="Tell us about your project" rows={5} helper="~2 minutes" />

<Switch label="Email me updates" defaultChecked />
<Switch checked={on} onChange={setOn} label="SMS reminders" />
```

Input/Textarea sit on the surface tier with a hairline border that turns emerald with a focus ring on focus, and danger-red when `error` is set. Switch fills emerald when on; works controlled (`checked`+`onChange`) or uncontrolled (`defaultChecked`).
