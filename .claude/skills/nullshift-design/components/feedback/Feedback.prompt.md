**Toast · ToastViewport** — transient feedback.

```jsx
<ToastViewport position="bottom-right">
  <Toast tone="success" title="Brief received" message="We'll reply within 24 hours." onClose={…} />
  <Toast tone="danger" title="Couldn't send" message="Check your connection and retry." onClose={…} />
</ToastViewport>
```

Toasts sit on the elevated tier with a signal-coloured accent rail + dot. They're presentational — manage mount/unmount and auto-dismiss timing in your app. Tone follows the signal system (status only).
