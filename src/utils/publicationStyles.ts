// Publication-quality typography and styling constants for scientific charts

export const PUBLICATION_TYPOGRAPHY = {
  // Font families - scientific publication standards
  primaryFont: '"Source Sans Pro", "Arial", sans-serif',
  secondaryFont: '"Arial", "Helvetica", sans-serif',
  
  // Font sizes for different chart elements (in pixels)
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  axisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  axisLabels: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  legendText: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  dataLabels: {
    fontSize: 10,
    fontWeight: 'normal',
  },
  
  // Colors for text elements
  textColor: '#000000',
  secondaryTextColor: '#333333',
  
  // Chart margins for publication layout
  margins: {
    top: 20,
    right: 30,
    bottom: 60,
    left: 80,
  },
};

export const CHART_STYLES = {
  // Grid and axis styling
  grid: {
    stroke: '#E5E5E5',
    strokeWidth: 1,
    strokeDasharray: '2,2',
  },
  axis: {
    stroke: '#000000',
    strokeWidth: 2,
  },
  
  // Data point styling
  dataPoint: {
    strokeWidth: 2,
    size: 6,
  },
  
  // Line styling for curves
  curveLine: {
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  },
  
  // Error bar styling
  errorBar: {
    strokeWidth: 2,
    capLength: 4,
  },
  
  // Legend styling
  legend: {
    itemGap: 10,
    iconType: 'line' as const,
  },
};

// Pre-configured style objects for Recharts components
export const getPublicationAxisStyle = () => ({
  tick: { 
    fontSize: PUBLICATION_TYPOGRAPHY.axisLabels.fontSize,
    fontFamily: PUBLICATION_TYPOGRAPHY.primaryFont,
    fontWeight: PUBLICATION_TYPOGRAPHY.axisLabels.fontWeight,
    fill: PUBLICATION_TYPOGRAPHY.textColor,
  },
  axisLine: {
    stroke: CHART_STYLES.axis.stroke,
    strokeWidth: CHART_STYLES.axis.strokeWidth,
  },
  tickLine: {
    stroke: CHART_STYLES.axis.stroke,
    strokeWidth: 1,
  },
});

export const getPublicationAxisLabelStyle = () => ({
  fontSize: PUBLICATION_TYPOGRAPHY.axisTitle.fontSize,
  fontFamily: PUBLICATION_TYPOGRAPHY.primaryFont,
  fontWeight: PUBLICATION_TYPOGRAPHY.axisTitle.fontWeight,
  fill: PUBLICATION_TYPOGRAPHY.textColor,
});

export const getPublicationLegendStyle = () => ({
  fontSize: PUBLICATION_TYPOGRAPHY.legendText.fontSize,
  fontFamily: PUBLICATION_TYPOGRAPHY.primaryFont,
  fontWeight: PUBLICATION_TYPOGRAPHY.legendText.fontWeight,
  color: PUBLICATION_TYPOGRAPHY.textColor,
});

export const getPublicationChartTitleStyle = () => ({
  fontSize: PUBLICATION_TYPOGRAPHY.chartTitle.fontSize,
  fontFamily: PUBLICATION_TYPOGRAPHY.primaryFont,
  fontWeight: PUBLICATION_TYPOGRAPHY.chartTitle.fontWeight,
  color: PUBLICATION_TYPOGRAPHY.textColor,
  textAlign: 'center' as const,
  marginBottom: '16px',
});

// Responsive font sizing based on chart dimensions
export const getResponsiveFontSizes = (chartWidth: number, chartHeight: number) => {
  const baseSize = Math.min(chartWidth, chartHeight);
  const scaleFactor = Math.max(0.8, Math.min(1.2, baseSize / 600));
  
  return {
    axisTitle: Math.round(PUBLICATION_TYPOGRAPHY.axisTitle.fontSize * scaleFactor),
    axisLabels: Math.round(PUBLICATION_TYPOGRAPHY.axisLabels.fontSize * scaleFactor),
    legendText: Math.round(PUBLICATION_TYPOGRAPHY.legendText.fontSize * scaleFactor),
    chartTitle: Math.round(PUBLICATION_TYPOGRAPHY.chartTitle.fontSize * scaleFactor),
  };
};

// Color contrast validation for accessibility
export const validateColorContrast = (foreground: string, background: string): number => {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  
  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  
  if (!fg || !bg) return 0;
  
  const fgLum = getLuminance(fg.r, fg.g, fg.b);
  const bgLum = getLuminance(bg.r, bg.g, bg.b);
  
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  
  return (lighter + 0.05) / (darker + 0.05);
};

// WCAG AA compliance requires contrast ratio of at least 4.5:1 for normal text
export const isWCAGCompliant = (foreground: string, background: string): boolean => {
  return validateColorContrast(foreground, background) >= 4.5;
};