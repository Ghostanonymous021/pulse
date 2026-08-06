/**
 * Marca-icone oficial — traco de batimento (EKG), nao mais a letra "p".
 *
 * Fonte da verdade visual junto com PulseWordmark (pulse-wordmark.tsx).
 * fill=currentColor: herda a cor do contexto, funciona nos dois temas e
 * em qualquer superficie sem precisar de variantes hardcoded.
 *
 * Usado em: icones do app/favicon (public/brand/icon-source.svg deriva
 * deste mesmo desenho), e como base visual do PulseLoader (pulse-loader.tsx).
 */
export function PulseMark({
  className,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      viewBox="3687 5399 888 896"
      className={className}
      fill="none"
      role={ariaHidden ? undefined : "img"}
      aria-hidden={ariaHidden}
      aria-label={ariaHidden ? undefined : "Pulse"}
    >
      <path
        fill="currentColor"
        d="M3927.15 5942.17c12.36,0 14.61,-20.26 18.32,-31.24l60.96 -172.37c4.17,-12.09 7.67,-21.95 12.29,-34.33 4.02,-10.78 6,-25.61 15.1,-32.6 6.03,9.41 5.68,22.88 6.79,34.44l25.59 251.42c5.2,52.39 22.45,248.81 29,284.09 6.76,36.42 61.13,44.2 72.83,15.26 24.21,-59.86 128.29,-354.78 142.46,-364.85 17.32,18.24 10.93,50.19 30,50.19l166.67 0c24.35,0 40.45,-7.08 45.32,-27.34 23.59,-98.17 -129.27,-41.54 -156.98,-60.52 -10.82,-11.75 -39.67,-101.74 -49.24,-124.05 -9.75,-22.72 -43.52,-25.28 -59.39,-14.61 -18.42,12.38 -66.09,154.95 -76.07,180.68 -5.13,13.24 -36.81,114.22 -50.3,118.57 -4.5,-8.77 -47.8,-445.7 -55.56,-527.09 -2.61,-27.36 0.85,-45.78 -20.23,-59.4 -20.48,-13.23 -48.49,-13.55 -60.82,4.31 -10.59,15.33 -137.74,397.63 -152.49,423.54 -30.33,1.93 -125.55,-4.22 -145.16,5.37 -21.64,10.59 -38.05,80.54 27.59,80.54l173.33 0z"
      />
    </svg>
  );
}
