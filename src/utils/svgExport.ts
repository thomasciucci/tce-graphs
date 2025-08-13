/**
 * SVG Export Utility for nVitro Studio
 * Provides true vector graphics export capabilities for scientific charts
 */

import { PUBLICATION_TYPOGRAPHY, CHART_STYLES } from './publicationStyles';

interface SVGExportOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  title?: string;
  preserveAspectRatio?: string;
  includeFonts?: boolean;
}

interface SVGOptimizationOptions {
  removeUnusedDefs?: boolean;
  optimizePaths?: boolean;
  removeComments?: boolean;
  minimizeStyles?: boolean;
}

/**
 * Exports a chart element as optimized SVG string
 */
export const exportChartAsSVG = async (
  chartElement: HTMLElement,
  options: SVGExportOptions = {}
): Promise<string> => {
  const svgElement = chartElement.querySelector('svg');
  if (!svgElement) {
    throw new Error('No SVG found in chart element');
  }

  // Clone SVG to avoid modifying original
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Apply publication-quality enhancements
  enhanceSVGForPublication(clonedSvg, options);
  
  // Optimize SVG for export
  optimizeSVGForExport(clonedSvg);
  
  // Add XML declaration and return serialized SVG
  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
};

/**
 * Exports chart as SVG blob for download
 */
export const exportChartAsSVGBlob = async (
  chartElement: HTMLElement,
  options: SVGExportOptions = {}
): Promise<Blob> => {
  const svgString = await exportChartAsSVG(chartElement, options);
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
};

/**
 * Downloads chart as SVG file
 */
export const downloadChartAsSVG = async (
  chartElement: HTMLElement,
  filename: string = 'chart.svg',
  options: SVGExportOptions = {}
): Promise<void> => {
  const blob = await exportChartAsSVGBlob(chartElement, options);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Enhances SVG with publication-quality styling
 */
function enhanceSVGForPublication(svg: SVGSVGElement, options: SVGExportOptions): void {
  // Set dimensions if provided
  if (options.width) svg.setAttribute('width', options.width.toString());
  if (options.height) svg.setAttribute('height', options.height.toString());
  
  // Set background if provided
  if (options.backgroundColor) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', options.backgroundColor);
    svg.insertBefore(rect, svg.firstChild);
  }
  
  // Add title if provided
  if (options.title) {
    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleElement.textContent = options.title;
    svg.insertBefore(titleElement, svg.firstChild);
  }
  
  // Enhance typography
  enhanceTypography(svg);
  
  // Enhance visual elements
  enhanceVisualElements(svg);
  
  // Add font definitions if needed
  if (options.includeFonts !== false) {
    addFontDefinitions(svg);
  }
  
  // Set preserve aspect ratio
  svg.setAttribute('preserveAspectRatio', options.preserveAspectRatio || 'xMidYMid meet');
}

/**
 * Enhances typography throughout the SVG
 */
function enhanceTypography(svg: SVGSVGElement): void {
  // Update all text elements
  const textElements = svg.querySelectorAll('text');
  textElements.forEach(text => {
    const currentFontSize = parseFloat(text.getAttribute('font-size') || '12');
    
    // Classify text element based on content and position
    const textContent = text.textContent || '';
    const className = text.getAttribute('class') || '';
    
    // Apply appropriate typography based on classification
    if (className.includes('axis-title') || isAxisTitle(text)) {
      text.setAttribute('font-size', PUBLICATION_TYPOGRAPHY.axisTitle.fontSize.toString());
      text.setAttribute('font-weight', PUBLICATION_TYPOGRAPHY.axisTitle.fontWeight);
    } else if (className.includes('axis-label') || isAxisLabel(text)) {
      text.setAttribute('font-size', PUBLICATION_TYPOGRAPHY.axisLabels.fontSize.toString());
      text.setAttribute('font-weight', PUBLICATION_TYPOGRAPHY.axisLabels.fontWeight);
    } else if (className.includes('legend') || isLegendText(text)) {
      text.setAttribute('font-size', PUBLICATION_TYPOGRAPHY.legendText.fontSize.toString());
      text.setAttribute('font-weight', PUBLICATION_TYPOGRAPHY.legendText.fontWeight);
    }
    
    // Always set font family and color
    text.setAttribute('font-family', PUBLICATION_TYPOGRAPHY.primaryFont);
    text.setAttribute('fill', PUBLICATION_TYPOGRAPHY.textColor);
  });
}

/**
 * Enhances visual elements (lines, shapes, etc.)
 */
function enhanceVisualElements(svg: SVGSVGElement): void {
  // Enhance data lines
  const pathElements = svg.querySelectorAll('path[stroke]');
  pathElements.forEach(path => {
    const currentStrokeWidth = parseFloat(path.getAttribute('stroke-width') || '1');
    if (currentStrokeWidth < 2) {
      path.setAttribute('stroke-width', CHART_STYLES.curveLine.strokeWidth.toString());
    }
    path.setAttribute('stroke-linecap', CHART_STYLES.curveLine.strokeLinecap);
    path.setAttribute('stroke-linejoin', CHART_STYLES.curveLine.strokeLinejoin);
  });
  
  // Enhance data points
  const circleElements = svg.querySelectorAll('circle');
  circleElements.forEach(circle => {
    const currentStrokeWidth = parseFloat(circle.getAttribute('stroke-width') || '1');
    if (currentStrokeWidth < 2) {
      circle.setAttribute('stroke-width', CHART_STYLES.dataPoint.strokeWidth.toString());
    }
  });
  
  // Enhance grid lines
  const gridLines = svg.querySelectorAll('line[stroke="#e0e0e0"], line[stroke="#cccccc"]');
  gridLines.forEach(line => {
    line.setAttribute('stroke', CHART_STYLES.grid.stroke);
    line.setAttribute('stroke-width', CHART_STYLES.grid.strokeWidth.toString());
    if (CHART_STYLES.grid.strokeDasharray) {
      line.setAttribute('stroke-dasharray', CHART_STYLES.grid.strokeDasharray);
    }
  });
}

/**
 * Adds font definitions to SVG for better compatibility
 */
function addFontDefinitions(svg: SVGSVGElement): void {
  const defs = svg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  if (!svg.querySelector('defs')) {
    svg.insertBefore(defs, svg.firstChild);
  }
  
  // Add font face definition
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute('type', 'text/css');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap');
    
    .publication-text {
      font-family: ${PUBLICATION_TYPOGRAPHY.primaryFont};
    }
    
    .axis-title {
      font-size: ${PUBLICATION_TYPOGRAPHY.axisTitle.fontSize}px;
      font-weight: ${PUBLICATION_TYPOGRAPHY.axisTitle.fontWeight};
    }
    
    .axis-label {
      font-size: ${PUBLICATION_TYPOGRAPHY.axisLabels.fontSize}px;
      font-weight: ${PUBLICATION_TYPOGRAPHY.axisLabels.fontWeight};
    }
    
    .legend-text {
      font-size: ${PUBLICATION_TYPOGRAPHY.legendText.fontSize}px;
      font-weight: ${PUBLICATION_TYPOGRAPHY.legendText.fontWeight};
    }
  `;
  defs.appendChild(style);
}

/**
 * Optimizes SVG for smaller file size and better performance
 */
function optimizeSVGForExport(svg: SVGSVGElement, options: SVGOptimizationOptions = {}): void {
  // Remove comments
  if (options.removeComments !== false) {
    removeComments(svg);
  }
  
  // Remove unused definitions
  if (options.removeUnusedDefs !== false) {
    removeUnusedDefs(svg);
  }
  
  // Optimize paths
  if (options.optimizePaths) {
    optimizePaths(svg);
  }
  
  // Round coordinates to reduce file size
  roundCoordinates(svg);
}

/**
 * Helper functions for text classification
 */
function isAxisTitle(text: SVGTextElement): boolean {
  const content = text.textContent || '';
  const fontSize = parseFloat(text.getAttribute('font-size') || '12');
  
  // Common axis titles
  const axisTitlePatterns = [
    /concentration|dose|conc\./i,
    /response|%|percent/i,
    /log.*concentration/i,
    /cytotoxicity|activation|degranulation/i
  ];
  
  return fontSize > 14 || axisTitlePatterns.some(pattern => pattern.test(content));
}

function isAxisLabel(text: SVGTextElement): boolean {
  const content = text.textContent || '';
  // Check if it's a numeric label or coordinate
  return /^-?\d+\.?\d*$/.test(content.trim()) || content.length < 6;
}

function isLegendText(text: SVGTextElement): boolean {
  const content = text.textContent || '';
  const x = parseFloat(text.getAttribute('x') || '0');
  const y = parseFloat(text.getAttribute('y') || '0');
  
  // Legend text is usually positioned to the right or bottom
  // and contains sample names or descriptions
  return content.length > 2 && !isAxisLabel(text) && !isAxisTitle(text);
}

/**
 * Optimization helper functions
 */
function removeComments(svg: SVGSVGElement): void {
  const walker = document.createTreeWalker(
    svg,
    NodeFilter.SHOW_COMMENT,
    null
  );
  
  const comments: Comment[] = [];
  let node;
  while (node = walker.nextNode()) {
    comments.push(node as Comment);
  }
  
  comments.forEach(comment => comment.parentNode?.removeChild(comment));
}

function removeUnusedDefs(svg: SVGSVGElement): void {
  const defs = svg.querySelector('defs');
  if (!defs) return;
  
  const defsChildren = Array.from(defs.children);
  const usedIds = new Set<string>();
  
  // Find all used IDs
  svg.querySelectorAll('*').forEach(element => {
    const attributes = ['fill', 'stroke', 'filter', 'mask', 'clip-path'];
    attributes.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && value.startsWith('url(#')) {
        const id = value.slice(5, -1);
        usedIds.add(id);
      }
    });
  });
  
  // Remove unused definitions
  defsChildren.forEach(child => {
    const id = child.getAttribute('id');
    if (id && !usedIds.has(id)) {
      defs.removeChild(child);
    }
  });
}

function optimizePaths(svg: SVGSVGElement): void {
  const paths = svg.querySelectorAll('path');
  paths.forEach(path => {
    const d = path.getAttribute('d');
    if (d) {
      // Simple path optimization - remove redundant commands
      const optimized = d
        .replace(/\s+/g, ' ')
        .replace(/([MLHVCSQTAZ])\s*/gi, '$1')
        .trim();
      path.setAttribute('d', optimized);
    }
  });
}

function roundCoordinates(svg: SVGSVGElement): void {
  const precision = 2;
  const elements = svg.querySelectorAll('*');
  
  elements.forEach(element => {
    ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2'].forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && !isNaN(parseFloat(value))) {
        const rounded = Math.round(parseFloat(value) * Math.pow(10, precision)) / Math.pow(10, precision);
        element.setAttribute(attr, rounded.toString());
      }
    });
  });
}

/**
 * Converts SVG to other formats using canvas
 */
export const convertSVGToCanvas = async (
  svgString: string,
  width: number,
  height: number
): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas);
    };
    
    img.onerror = () => reject(new Error('Failed to load SVG image'));
    
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(blob);
  });
};

/**
 * Exports SVG as high-resolution PNG
 */
export const exportSVGAsPNG = async (
  svgString: string,
  width: number = 1200,
  height: number = 800,
  scale: number = 2
): Promise<Blob> => {
  const canvas = await convertSVGToCanvas(svgString, width * scale, height * scale);
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png', 1.0);
  });
};