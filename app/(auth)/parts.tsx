import { Button } from "@/components/ui/button";

// Co-located auth UI pieces shared by the login and signup pages. All Server
// Components (no interactivity) except where noted.

// Leading-icon SVGs for the inputs (mail / lock / user), stroke-based per mockup.
export function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// Trailing arrow for the primary submit button.
export function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// Inline error banner styled like the mockup's destructive alert. Rendered from
// the `?error=` searchParam (the existing server-action error mechanism).
export function AuthError({ message }: { message: string }) {
  return (
    <div className="border-destructive bg-destructive-soft text-destructive mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-0.5 h-4 w-4 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

// "o" divider with flanking rules.
export function AuthDivider() {
  return (
    <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs tracking-[0.08em] uppercase">
      <span className="bg-border h-px flex-1" />o
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

// Google sign-in submit button (official multicolor G). Lives inside the
// existing <form action={signInWithGoogle}> so the OAuth wire is unchanged.
export function GoogleButton() {
  return (
    <Button
      type="submit"
      variant="outline"
      className="bg-card h-[42px] w-full font-semibold"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#4285F4"
          d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9c-.3 1.4-1 2.6-2.2 3.4v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.8c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8C4.1 20.6 7.8 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M6 14.3c-.2-.7-.4-1.4-.4-2.3s.1-1.6.4-2.3V6.9H2.3C1.5 8.4 1 10.2 1 12s.5 3.6 1.3 5.1L6 14.3z"
        />
        <path
          fill="#EA4335"
          d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1 7.8 1 4.1 3.4 2.3 6.9L6 9.7c.9-2.5 3.2-4.2 6-4.2z"
        />
      </svg>
      Continuar con Google
    </Button>
  );
}
