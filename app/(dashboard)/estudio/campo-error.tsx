"use client";

/**
 * The message for one rejected field, shown under the input that caused it.
 *
 * Package A made the top alert impossible to miss; A2 made the save partial, and
 * a partial save needs to say WHICH field it left out — the summary at the top of
 * a two-column form cannot point at an input a screen away. Renders nothing when
 * the field is fine, so call sites stay one line.
 */
export function CampoError({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {mensaje}
    </p>
  );
}

/** Looks a field's message up by its anchor. `undefined` = nothing wrong. */
export type ErroresPorCampo = (campo: string) => string | undefined;
