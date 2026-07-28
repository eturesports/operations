// The lens the glass surfaces refract through.
//
// feTurbulence makes a soft, organic field; blurring it removes the grain so
// what is left are slow undulations, and feDisplacementMap pushes the blurred
// backdrop around by that field. The result is the wobble you get looking
// through real glass rather than the noise you get looking through frosted
// plastic — scale is what separates the two, and 14 is about the limit before
// text behind a panel starts to look broken.
//
// Rendered once, near the root: a filter is referenced by id from CSS, so it
// only has to exist somewhere in the document.
export function GlassFilter() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <filter id="eture-lens" x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.012"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="6" result="field" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="field"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
