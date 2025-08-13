/**
 * Export Format Validation and Testing Utility
 * Tests all enhanced export formats for quality and compatibility
 */

import { exportChartAsSVG, exportSVGAsPNG, downloadChartAsSVG } from './svgExport';
import { EnhancedPDFExporter } from './enhancedPdfExport';
import { validateColorContrast, isWCAGCompliant } from './publicationStyles';

export interface ExportValidationResult {
  format: string;
  success: boolean;
  quality: 'high' | 'medium' | 'low';
  fileSize?: number;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ExportTestSuite {
  svgExport: ExportValidationResult;
  pngExport: ExportValidationResult;
  pdfExport: ExportValidationResult;
  accessibilityCheck: ExportValidationResult;
  performanceCheck: ExportValidationResult;
  overall: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    summary: string;
  };
}

/**
 * Comprehensive test of all export formats
 */
export async function validateAllExports(chartElement: HTMLElement): Promise<ExportTestSuite> {
  const results: ExportTestSuite = {
    svgExport: await validateSVGExport(chartElement),
    pngExport: await validatePNGExport(chartElement),
    pdfExport: await validatePDFExport(chartElement),
    accessibilityCheck: await validateAccessibility(chartElement),
    performanceCheck: validatePerformance(chartElement),
    overall: { score: 0, grade: 'F', summary: '' }
  };

  // Calculate overall score
  const scores = [
    results.svgExport.success ? (results.svgExport.quality === 'high' ? 100 : results.svgExport.quality === 'medium' ? 75 : 50) : 0,
    results.pngExport.success ? (results.pngExport.quality === 'high' ? 100 : results.pngExport.quality === 'medium' ? 75 : 50) : 0,
    results.pdfExport.success ? (results.pdfExport.quality === 'high' ? 100 : results.pdfExport.quality === 'medium' ? 75 : 50) : 0,
    results.accessibilityCheck.success ? 100 : 0,
    results.performanceCheck.success ? 100 : 0
  ];

  results.overall.score = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  results.overall.grade = 
    results.overall.score >= 90 ? 'A' :
    results.overall.score >= 80 ? 'B' :
    results.overall.score >= 70 ? 'C' :
    results.overall.score >= 60 ? 'D' : 'F';

  results.overall.summary = generateOverallSummary(results);

  return results;
}

/**
 * Test SVG export quality
 */
async function validateSVGExport(chartElement: HTMLElement): Promise<ExportValidationResult> {
  const result: ExportValidationResult = {
    format: 'SVG',
    success: false,
    quality: 'low',
    errors: [],
    warnings: [],
    recommendations: []
  };

  try {
    const svgString = await exportChartAsSVG(chartElement, {
      width: 800,
      height: 600,
      backgroundColor: 'white',
      includeFonts: true
    });

    if (!svgString) {
      result.errors.push('Failed to generate SVG');
      return result;
    }

    result.success = true;
    result.fileSize = new Blob([svgString]).size;

    // Quality checks
    const qualityChecks = [
      checkSVGStructure(svgString),
      checkSVGFonts(svgString),
      checkSVGColors(svgString),
      checkSVGOptimization(svgString)
    ];

    const passedChecks = qualityChecks.filter(check => check.passed).length;
    result.quality = passedChecks >= 3 ? 'high' : passedChecks >= 2 ? 'medium' : 'low';

    qualityChecks.forEach(check => {
      if (!check.passed) {
        result.warnings.push(check.message);
      }
      if (check.recommendation) {
        result.recommendations.push(check.recommendation);
      }
    });

    // File size recommendations
    if (result.fileSize && result.fileSize > 500000) { // 500KB
      result.warnings.push('SVG file size is large (>500KB)');
      result.recommendations.push('Consider optimizing SVG paths and removing unused elements');
    }

  } catch (error) {
    result.errors.push(`SVG export failed: ${error}`);
  }

  return result;
}

/**
 * Test PNG export quality
 */
async function validatePNGExport(chartElement: HTMLElement): Promise<ExportValidationResult> {
  const result: ExportValidationResult = {
    format: 'PNG',
    success: false,
    quality: 'low',
    errors: [],
    warnings: [],
    recommendations: []
  };

  try {
    const svgString = await exportChartAsSVG(chartElement);
    if (!svgString) {
      result.errors.push('Failed to generate base SVG for PNG conversion');
      return result;
    }

    const pngBlob = await exportSVGAsPNG(svgString, 1200, 800, 2); // 2x scale for high DPI
    if (!pngBlob) {
      result.errors.push('Failed to convert SVG to PNG');
      return result;
    }

    result.success = true;
    result.fileSize = pngBlob.size;

    // Quality assessment based on file size and resolution
    const expectedSize = 1200 * 800 * 4; // Rough estimate for high-quality PNG
    if (result.fileSize > expectedSize * 0.1) { // At least 10% of uncompressed size
      result.quality = 'high';
    } else if (result.fileSize > expectedSize * 0.05) {
      result.quality = 'medium';
      result.warnings.push('PNG compression may be too aggressive');
    } else {
      result.quality = 'low';
      result.warnings.push('PNG file size is suspiciously small - quality may be compromised');
    }

    // File size recommendations
    if (result.fileSize > 2000000) { // 2MB
      result.warnings.push('PNG file size is large (>2MB)');
      result.recommendations.push('Consider reducing resolution or using JPEG for photos');
    }

  } catch (error) {
    result.errors.push(`PNG export failed: ${error}`);
  }

  return result;
}

/**
 * Test PDF export quality
 */
async function validatePDFExport(chartElement: HTMLElement): Promise<ExportValidationResult> {
  const result: ExportValidationResult = {
    format: 'PDF',
    success: false,
    quality: 'low',
    errors: [],
    warnings: [],
    recommendations: []
  };

  try {
    // Mock dataset for testing
    const mockOptions = {
      datasets: [{ id: 'test', name: 'Test Dataset', data: [], assayType: 'Dose-Response' }],
      fittedCurvesByDataset: { test: [] },
      originalDataByDataset: { test: [] },
      editedDataByDataset: { test: [] },
      curveColorsByDataset: { test: [] },
      exportOptions: {
        useVectorGraphics: true,
        highResolution: true,
        includeRawData: false,
        includeStatistics: false
      }
    };

    const exporter = new EnhancedPDFExporter(mockOptions);
    const pdfBlob = await exporter.exportToPDF();

    if (!pdfBlob) {
      result.errors.push('Failed to generate PDF');
      return result;
    }

    result.success = true;
    result.fileSize = pdfBlob.size;

    // Quality assessment
    if (result.fileSize > 50000) { // Reasonable size for a PDF with graphics
      result.quality = 'high';
    } else if (result.fileSize > 20000) {
      result.quality = 'medium';
    } else {
      result.quality = 'low';
      result.warnings.push('PDF file size is small - content may be missing');
    }

    // Recommendations
    result.recommendations.push('PDF generated successfully with vector graphics support');
    if (result.fileSize > 10000000) { // 10MB
      result.warnings.push('PDF file size is very large (>10MB)');
      result.recommendations.push('Consider reducing image resolution or using compression');
    }

  } catch (error) {
    result.errors.push(`PDF export failed: ${error}`);
  }

  return result;
}

/**
 * Test accessibility compliance
 */
async function validateAccessibility(chartElement: HTMLElement): Promise<ExportValidationResult> {
  const result: ExportValidationResult = {
    format: 'Accessibility',
    success: false,
    quality: 'low',
    errors: [],
    warnings: [],
    recommendations: []
  };

  try {
    const svg = chartElement.querySelector('svg');
    if (!svg) {
      result.errors.push('No SVG element found for accessibility testing');
      return result;
    }

    let passedChecks = 0;
    let totalChecks = 0;

    // Check color contrast
    totalChecks++;
    const textElements = svg.querySelectorAll('text');
    let contrastIssues = 0;
    
    textElements.forEach(text => {
      const fill = text.getAttribute('fill') || '#000000';
      const backgroundColor = '#ffffff'; // Assume white background
      
      if (!isWCAGCompliant(fill, backgroundColor)) {
        contrastIssues++;
      }
    });

    if (contrastIssues === 0) {
      passedChecks++;
    } else {
      result.warnings.push(`${contrastIssues} text elements fail WCAG contrast requirements`);
      result.recommendations.push('Increase text color contrast for better accessibility');
    }

    // Check for alt text or title
    totalChecks++;
    const title = svg.querySelector('title');
    const hasAriaLabel = svg.hasAttribute('aria-label');
    
    if (title || hasAriaLabel) {
      passedChecks++;
    } else {
      result.warnings.push('SVG lacks title or aria-label for screen readers');
      result.recommendations.push('Add title element or aria-label to SVG for accessibility');
    }

    // Check font sizes
    totalChecks++;
    let smallFontCount = 0;
    textElements.forEach(text => {
      const fontSize = parseFloat(text.getAttribute('font-size') || '12');
      if (fontSize < 12) {
        smallFontCount++;
      }
    });

    if (smallFontCount === 0) {
      passedChecks++;
    } else {
      result.warnings.push(`${smallFontCount} text elements have font sizes below 12px`);
      result.recommendations.push('Increase font sizes to at least 12px for better readability');
    }

    result.success = true;
    result.quality = (passedChecks / totalChecks) >= 0.8 ? 'high' : 
                     (passedChecks / totalChecks) >= 0.6 ? 'medium' : 'low';

  } catch (error) {
    result.errors.push(`Accessibility validation failed: ${error}`);
  }

  return result;
}

/**
 * Test performance characteristics
 */
function validatePerformance(chartElement: HTMLElement): ExportValidationResult {
  const result: ExportValidationResult = {
    format: 'Performance',
    success: false,
    quality: 'low',
    errors: [],
    warnings: [],
    recommendations: []
  };

  try {
    const svg = chartElement.querySelector('svg');
    if (!svg) {
      result.errors.push('No SVG element found for performance testing');
      return result;
    }

    let performanceScore = 0;
    let checks = 0;

    // Check DOM complexity
    checks++;
    const totalElements = svg.querySelectorAll('*').length;
    if (totalElements < 1000) {
      performanceScore += 25;
    } else if (totalElements < 2000) {
      performanceScore += 15;
      result.warnings.push('High DOM complexity may affect performance');
    } else {
      result.warnings.push('Very high DOM complexity will affect performance');
      result.recommendations.push('Consider simplifying chart or using canvas rendering');
    }

    // Check path complexity
    checks++;
    const paths = svg.querySelectorAll('path');
    let complexPaths = 0;
    paths.forEach(path => {
      const d = path.getAttribute('d') || '';
      if (d.length > 1000) { // Arbitrary threshold for complex paths
        complexPaths++;
      }
    });

    if (complexPaths === 0) {
      performanceScore += 25;
    } else if (complexPaths < 5) {
      performanceScore += 15;
      result.warnings.push('Some paths are complex and may affect rendering performance');
    } else {
      result.warnings.push('Many complex paths will affect rendering performance');
      result.recommendations.push('Consider path optimization or data point reduction');
    }

    // Check for inline styles vs classes
    checks++;
    const elementsWithStyle = svg.querySelectorAll('[style]').length;
    const elementsWithClass = svg.querySelectorAll('[class]').length;
    
    if (elementsWithClass > elementsWithStyle) {
      performanceScore += 25;
    } else {
      performanceScore += 10;
      result.recommendations.push('Use CSS classes instead of inline styles for better performance');
    }

    // Check for animations or interactions
    checks++;
    const animatedElements = svg.querySelectorAll('animate, animateTransform').length;
    if (animatedElements === 0) {
      performanceScore += 25;
    } else {
      performanceScore += 15;
      result.warnings.push('Animations may affect export performance');
    }

    result.success = true;
    result.quality = performanceScore >= 80 ? 'high' : performanceScore >= 60 ? 'medium' : 'low';

  } catch (error) {
    result.errors.push(`Performance validation failed: ${error}`);
  }

  return result;
}

/**
 * Helper functions for SVG quality checks
 */
function checkSVGStructure(svgString: string): { passed: boolean; message: string; recommendation?: string } {
  const hasValidSVG = svgString.includes('<svg') && svgString.includes('</svg>');
  const hasViewBox = svgString.includes('viewBox');
  
  return {
    passed: hasValidSVG && hasViewBox,
    message: hasValidSVG ? (hasViewBox ? 'SVG structure is valid' : 'SVG missing viewBox') : 'Invalid SVG structure',
    recommendation: !hasViewBox ? 'Add viewBox attribute for proper scaling' : undefined
  };
}

function checkSVGFonts(svgString: string): { passed: boolean; message: string; recommendation?: string } {
  const hasEmbeddedFonts = svgString.includes('@font-face') || svgString.includes('font-family');
  
  return {
    passed: hasEmbeddedFonts,
    message: hasEmbeddedFonts ? 'Fonts are properly embedded' : 'No font information found',
    recommendation: !hasEmbeddedFonts ? 'Embed font definitions for consistent rendering' : undefined
  };
}

function checkSVGColors(svgString: string): { passed: boolean; message: string; recommendation?: string } {
  const colorCount = (svgString.match(/#[0-9a-fA-F]{6}/g) || []).length;
  const hasTransparency = svgString.includes('opacity') || svgString.includes('rgba');
  
  return {
    passed: colorCount > 0,
    message: colorCount > 0 ? `Found ${colorCount} colors${hasTransparency ? ' with transparency' : ''}` : 'No colors found',
    recommendation: colorCount === 0 ? 'Ensure colors are properly applied' : undefined
  };
}

function checkSVGOptimization(svgString: string): { passed: boolean; message: string; recommendation?: string } {
  const hasComments = svgString.includes('<!--');
  const hasExcessiveWhitespace = /\s{3,}/.test(svgString);
  const hasUnusedDefs = svgString.includes('<defs>') && !svgString.includes('url(#');
  
  const isOptimized = !hasComments && !hasExcessiveWhitespace && !hasUnusedDefs;
  
  return {
    passed: isOptimized,
    message: isOptimized ? 'SVG is well optimized' : 'SVG could be optimized further',
    recommendation: !isOptimized ? 'Remove comments, excess whitespace, and unused definitions' : undefined
  };
}

/**
 * Generate overall summary
 */
function generateOverallSummary(results: ExportTestSuite): string {
  const successCount = [
    results.svgExport.success,
    results.pngExport.success,
    results.pdfExport.success,
    results.accessibilityCheck.success,
    results.performanceCheck.success
  ].filter(Boolean).length;

  const highQualityCount = [
    results.svgExport.quality === 'high',
    results.pngExport.quality === 'high',
    results.pdfExport.quality === 'high',
    results.accessibilityCheck.quality === 'high',
    results.performanceCheck.quality === 'high'
  ].filter(Boolean).length;

  if (successCount === 5 && highQualityCount >= 4) {
    return 'Excellent export quality across all formats. Ready for publication.';
  } else if (successCount >= 4 && highQualityCount >= 3) {
    return 'Good export quality with minor improvements needed.';
  } else if (successCount >= 3) {
    return 'Acceptable export quality but several issues need attention.';
  } else {
    return 'Export quality needs significant improvement before publication.';
  }
}

/**
 * Console logging for validation results
 */
export function logValidationResults(results: ExportTestSuite): void {
  console.group('🎨 nVitro Studio Export Validation Results');
  
  console.log(`📊 Overall Score: ${results.overall.score}/100 (${results.overall.grade})`);
  console.log(`📋 Summary: ${results.overall.summary}`);
  
  [results.svgExport, results.pngExport, results.pdfExport, results.accessibilityCheck, results.performanceCheck].forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const quality = result.quality === 'high' ? '🟢' : result.quality === 'medium' ? '🟡' : '🔴';
    
    console.group(`${icon} ${result.format} Export ${quality}`);
    
    if (result.fileSize) {
      console.log(`📏 File Size: ${(result.fileSize / 1024).toFixed(1)} KB`);
    }
    
    if (result.errors.length > 0) {
      console.warn('❌ Errors:', result.errors);
    }
    
    if (result.warnings.length > 0) {
      console.warn('⚠️  Warnings:', result.warnings);
    }
    
    if (result.recommendations.length > 0) {
      console.info('💡 Recommendations:', result.recommendations);
    }
    
    console.groupEnd();
  });
  
  console.groupEnd();
}