// Templates remount on every navigation (unlike layouts, which persist), so
// wrapping the form here makes the auth-form-in entry animation re-run each time
// the user moves between /login and /signup -- the brand panel (in layout.tsx)
// stays put. Reduced-motion is honored inside auth.css.
export default function AuthTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="auth-form-in w-full max-w-sm">{children}</div>
  );
}
