import { createTheme, rem } from '@mantine/core';

const FONT = "'Inter', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  cursorType: 'pointer',
  fontFamily: FONT,
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: {
    fontFamily: FONT,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: rem(30), lineHeight: '1.25' },
      h2: { fontSize: rem(24), lineHeight: '1.3' },
      h3: { fontSize: rem(19), lineHeight: '1.35' },
      h4: { fontSize: rem(16), lineHeight: '1.4' },
    },
  },
  colors: {
    indigo: ['#eef0ff', '#dfe1ff', '#bcc0fd', '#959cfa', '#7479f7', '#5f62f5', '#4f4ff0', '#4141d6', '#3838bf', '#2a2a9c'],
    // Slate-tinted dark palette so dark mode reads "product", not "terminal".
    dark: ['#c9ced8', '#a7afbd', '#7d8698', '#5b6477', '#3a4152', '#2a303e', '#1f2430', '#171b25', '#11141c', '#0b0d13'],
  },
  shadows: {
    xs: '0 1px 2px rgba(16, 24, 40, 0.05)',
    sm: '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)',
    md: '0 8px 20px -6px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.05)',
    lg: '0 18px 40px -12px rgba(16, 24, 40, 0.22)',
  },
  components: {
    Card: { defaultProps: { withBorder: true, shadow: 'xs', radius: 'lg' } },
    Paper: { defaultProps: { withBorder: true, radius: 'lg' } },
    Button: { defaultProps: { radius: 'md' }, styles: { root: { fontWeight: 600 } } },
    Badge: { defaultProps: { radius: 'sm' }, styles: { root: { textTransform: 'none', fontWeight: 600 } } },
    TextInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md', comboboxProps: { shadow: 'md' } } },
    Drawer: { defaultProps: { overlayProps: { backgroundOpacity: 0.35, blur: 2 } } },
    Modal: { defaultProps: { radius: 'lg', overlayProps: { backgroundOpacity: 0.35, blur: 2 } } },
    Menu: { defaultProps: { shadow: 'md', radius: 'md' } },
    Popover: { defaultProps: { shadow: 'md', radius: 'md' } },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 200 } },
    Table: { styles: { th: { fontSize: rem(12), textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mantine-color-dimmed)', fontWeight: 600 } } },
  },
});

export function formatCurrency(n, { compact = false } = {}) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(n || 0);
}
