import { Box } from '@mantine/core';

const LOGO_SRC = `${import.meta.env.BASE_URL}unizova-logo.jpeg`;

// The logo has a light background, so on dark surfaces it sits on a light plate.
export function BrandLogo({ height = 32, onDark = false }) {
  const img = <img src={LOGO_SRC} alt="Unizova Technologies" style={{ height, width: 'auto', display: 'block' }} />;
  if (!onDark) return img;
  return (
    <Box style={{ background: '#f7f7f7', borderRadius: 8, padding: '4px 8px', display: 'inline-block', lineHeight: 0 }}>
      {img}
    </Box>
  );
}
