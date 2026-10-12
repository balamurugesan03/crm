const LOGO_SRC = `${import.meta.env.BASE_URL}unizova-logo.jpeg`;
// White-lettered variant with a transparent background, made for dark surfaces.
const LOGO_DARK_SRC = `${import.meta.env.BASE_URL}unilogo-dark.png`;

export function BrandLogo({ height = 32, onDark = false }) {
  return (
    <img
      src={onDark ? LOGO_DARK_SRC : LOGO_SRC}
      alt="Unizova Technologies"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}
