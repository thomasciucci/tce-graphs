/**
 * Sheet Pattern Detection for Multi-Sheet Analysis
 * Detects consistency of data patterns across multiple sheets
 */

import { SpreadsheetData, SheetPatternComparison } from '../types';
import { analyzeExcelDataEnhanced } from './enhancedDetection';

interface SheetData {
  sheetName: string;
  data: SpreadsheetData;
}

interface DetectedPattern {
  sheetName: string;
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  confidence: number;
  layout: string;
  issues: string[];
}

/**
 * Detect pattern consistency across multiple sheets
 */
export function detectSheetPatternConsistency(sheetsData: SheetData[]): SheetPatternComparison {
  if (sheetsData.length === 0) {
    return {
      isConsistent: false,
      confidence: 0,
      differences: [],
    };
  }

  if (sheetsData.length === 1) {
    // Single sheet is always consistent
    const pattern = detectSheetPattern(sheetsData[0]);
    return {
      isConsistent: true,
      confidence: pattern.confidence,
      commonPattern: {
        headerRow: pattern.headerRow,
        concentrationColumn: pattern.concentrationColumn,
        responseColumns: pattern.responseColumns,
      },
      differences: [],
    };
  }

  // Detect patterns for all sheets
  const detectedPatterns: DetectedPattern[] = [];
  
  for (const sheetData of sheetsData) {
    try {
      const pattern = detectSheetPattern(sheetData);
      detectedPatterns.push(pattern);
    } catch (error) {
      console.error(`Pattern detection failed for sheet ${sheetData.sheetName}:`, error);
      detectedPatterns.push({
        sheetName: sheetData.sheetName,
        headerRow: -1,
        concentrationColumn: -1,
        responseColumns: [],
        confidence: 0,
        layout: 'unknown',
        issues: ['Pattern detection failed'],
      });
    }
  }

  // Compare patterns for consistency
  const consistency = analyzePatternConsistency(detectedPatterns);
  
  return consistency;
}

/**
 * Detect data pattern in a single sheet
 */
function detectSheetPattern(sheetData: SheetData): DetectedPattern {
  const detectionResult = analyzeExcelDataEnhanced(sheetData.data.originalData, {
    enableMultiDataset: false,
    prioritizePatterns: true,
    minPatternConfidence: 0.2,
    fallbackToKeywords: true,
  });

  return {
    sheetName: sheetData.sheetName,
    headerRow: detectionResult.headerRow,
    concentrationColumn: detectionResult.concentrationColumn,
    responseColumns: detectionResult.responseColumns,
    confidence: detectionResult.confidence,
    layout: detectionResult.detectedLayout,
    issues: detectionResult.issues.map(issue => issue.message),
  };
}

/**
 * Analyze consistency between detected patterns
 */
function analyzePatternConsistency(patterns: DetectedPattern[]): SheetPatternComparison {
  if (patterns.length === 0) {
    return {
      isConsistent: false,
      confidence: 0,
      differences: [],
    };
  }

  // Find the pattern with highest confidence as reference
  const referencePattern = patterns.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  if (referencePattern.confidence < 0.3) {
    // No reliable pattern found
    return {
      isConsistent: false,
      confidence: 0,
      differences: patterns.map(p => ({
        sheetName: p.sheetName,
        pattern: p,
        issues: p.issues.length > 0 ? p.issues : ['Low confidence pattern detection'],
      })),
    };
  }

  // Compare all patterns against reference
  const differences: { sheetName: string; pattern: any; issues: string[] }[] = [];
  let consistentCount = 0;
  let totalConfidence = 0;

  for (const pattern of patterns) {
    const issues: string[] = [];
    let isConsistent = true;

    // Check header row consistency
    if (Math.abs(pattern.headerRow - referencePattern.headerRow) > 1) {
      issues.push(`Header row differs: ${pattern.headerRow} vs ${referencePattern.headerRow}`);
      isConsistent = false;
    }

    // Check concentration column consistency
    if (Math.abs(pattern.concentrationColumn - referencePattern.concentrationColumn) > 1) {
      issues.push(`Concentration column differs: ${pattern.concentrationColumn} vs ${referencePattern.concentrationColumn}`);
      isConsistent = false;
    }

    // Check response columns count consistency
    if (pattern.responseColumns.length !== referencePattern.responseColumns.length) {
      issues.push(`Different number of response columns: ${pattern.responseColumns.length} vs ${referencePattern.responseColumns.length}`);
      isConsistent = false;
    }

    // Check layout consistency
    if (pattern.layout !== referencePattern.layout) {
      issues.push(`Different layout: ${pattern.layout} vs ${referencePattern.layout}`);
      isConsistent = false;
    }

    // Check confidence threshold
    if (pattern.confidence < 0.3) {
      issues.push(`Low confidence: ${pattern.confidence.toFixed(2)}`);
      isConsistent = false;
    }

    if (isConsistent) {
      consistentCount++;
    }

    if (issues.length > 0 || !isConsistent) {
      differences.push({
        sheetName: pattern.sheetName,
        pattern,
        issues,
      });
    }

    totalConfidence += pattern.confidence;
  }

  const averageConfidence = totalConfidence / patterns.length;
  const consistencyRatio = consistentCount / patterns.length;
  const isConsistent = consistencyRatio >= 0.8 && averageConfidence >= 0.4;

  const result: SheetPatternComparison = {
    isConsistent,
    confidence: averageConfidence,
    differences,
  };

  if (isConsistent) {
    result.commonPattern = {
      headerRow: referencePattern.headerRow,
      concentrationColumn: referencePattern.concentrationColumn,
      responseColumns: referencePattern.responseColumns,
    };
  }

  console.log(`Pattern consistency analysis:`, {
    consistentCount,
    totalSheets: patterns.length,
    consistencyRatio,
    averageConfidence,
    isConsistent,
  });

  return result;
}

/**
 * Generate user-friendly explanation of pattern differences
 */
export function explainPatternDifferences(comparison: SheetPatternComparison): string[] {
  if (comparison.isConsistent) {
    return ['All sheets have consistent data patterns and can be processed together.'];
  }

  const explanations: string[] = [];

  if (comparison.differences.length === 0) {
    explanations.push('No reliable data patterns detected in the selected sheets.');
    return explanations;
  }

  // Group issues by type
  const issueTypes = new Set<string>();
  const sheetIssues = new Map<string, string[]>();

  for (const diff of comparison.differences) {
    sheetIssues.set(diff.sheetName, diff.issues);
    diff.issues.forEach(issue => {
      if (issue.includes('Header row')) issueTypes.add('header');
      if (issue.includes('Concentration column')) issueTypes.add('concentration');
      if (issue.includes('response columns')) issueTypes.add('responses');
      if (issue.includes('layout')) issueTypes.add('layout');
      if (issue.includes('confidence')) issueTypes.add('confidence');
    });
  }

  if (issueTypes.has('header')) {
    explanations.push('Sheets have headers in different rows.');
  }
  if (issueTypes.has('concentration')) {
    explanations.push('Concentration data is in different columns across sheets.');
  }
  if (issueTypes.has('responses')) {
    explanations.push('Sheets have different numbers of response columns.');
  }
  if (issueTypes.has('layout')) {
    explanations.push('Sheets have different data layouts (standard vs transposed).');
  }
  if (issueTypes.has('confidence')) {
    explanations.push('Some sheets have unclear or ambiguous data patterns.');
  }

  explanations.push('Each sheet will need individual pattern configuration.');

  return explanations;
}