/**
 * Biological Dataset Segmentation for nVitro Studio
 * Segments large matrices into biologically appropriate dose-response datasets
 */

import { CellData, DetectionResult, DetectionIssue } from './dataDetection';

export interface BiologicalConstraints {
  maxSamplesPerDataset: number;
  maxConcentrationsPerDataset: number;
  minSamplesPerDataset: number;
  minConcentrationsPerDataset: number;
  preferIndividualCurves: boolean;
  enableMatrixSegmentation: boolean;
}

export interface SegmentedDataset {
  id: string;
  name: string;
  confidence: number;
  biologicalConfidence: number;
  sampleCount: number;
  concentrationCount: number;
  boundingBox: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  };
  replicateInfo?: {
    baseName: string;
    replicateCount: number;
    replicateColumns: number[];
  };
  segmentedFrom?: {
    originalSize: string;
    segmentIndex: number;
    totalSegments: number;
  };
  issues: DetectionIssue[];
}

export interface BiologicalSegmentationResult {
  segmentedDatasets: SegmentedDataset[];
  rejectedPatterns: Array<{
    originalPattern: any;
    reason: string;
    size: string;
  }>;
  segmentationStats: {
    totalOriginalPatterns: number;
    oversizedPatterns: number;
    segmentedPatterns: number;
    finalDatasets: number;
  };
}

const DEFAULT_BIOLOGICAL_CONSTRAINTS: BiologicalConstraints = {
  maxSamplesPerDataset: 8,           // Max 8 samples per dataset (biological limit)
  maxConcentrationsPerDataset: 15,   // Max 15 concentration points
  minSamplesPerDataset: 1,           // Minimum 1 sample
  minConcentrationsPerDataset: 6,    // Minimum 6 concentration points for meaningful curve fitting
  preferIndividualCurves: true,      // Prefer individual dose-response curves
  enableMatrixSegmentation: true     // Enable automatic matrix segmentation
};

/**
 * Main function to apply biological segmentation to detected patterns
 */
export function applyBiologicalSegmentation(
  detectedPatterns: any[],
  rawData: any[][],
  constraints: Partial<BiologicalConstraints> = {}
): BiologicalSegmentationResult {
  
  const biologicalConstraints = { ...DEFAULT_BIOLOGICAL_CONSTRAINTS, ...constraints };
  const segmentedDatasets: SegmentedDataset[] = [];
  const rejectedPatterns: Array<{ originalPattern: any; reason: string; size: string }> = [];
  
  let oversizedPatterns = 0;
  let segmentedPatterns = 0;

  for (const pattern of detectedPatterns) {
    const sampleCount = extractSampleCount(pattern);
    const concentrationCount = extractConcentrationCount(pattern);
    
    // First, filter out patterns that are too small to be meaningful
    if (concentrationCount < biologicalConstraints.minConcentrationsPerDataset) {
      rejectedPatterns.push({
        originalPattern: pattern,
        reason: `Insufficient concentration points (${concentrationCount} < ${biologicalConstraints.minConcentrationsPerDataset}) - cannot fit dose-response curve`,
        size: `${sampleCount} samples × ${concentrationCount} concentrations`
      });
      continue;
    }
    
    if (isOversizedMatrix(sampleCount, concentrationCount, biologicalConstraints)) {
      oversizedPatterns++;
      
      if (biologicalConstraints.enableMatrixSegmentation) {
        // Segment the oversized matrix
        const segments = segmentMatrix(pattern, rawData, biologicalConstraints);
        if (segments.length > 0) {
          // Filter segments to only include those with sufficient concentration points
          const validSegments = segments.filter(segment => 
            segment.concentrationCount >= biologicalConstraints.minConcentrationsPerDataset
          );
          
          if (validSegments.length > 0) {
            segmentedDatasets.push(...validSegments);
            segmentedPatterns++;
            continue;
          }
        }
      }
      
      // If segmentation failed or disabled, reject the pattern
      rejectedPatterns.push({
        originalPattern: pattern,
        reason: 'Oversized matrix not suitable for individual dose-response analysis',
        size: `${sampleCount} samples × ${concentrationCount} concentrations`
      });
      
    } else {
      // Pattern is appropriately sized, validate and include
      const biologicalDataset = createBiologicalDataset(pattern, rawData, biologicalConstraints);
      if (biologicalDataset) {
        segmentedDatasets.push(biologicalDataset);
      }
    }
  }

  return {
    segmentedDatasets: segmentedDatasets.sort((a, b) => b.biologicalConfidence - a.biologicalConfidence),
    rejectedPatterns,
    segmentationStats: {
      totalOriginalPatterns: detectedPatterns.length,
      oversizedPatterns,
      segmentedPatterns,
      finalDatasets: segmentedDatasets.length
    }
  };
}

/**
 * Determines if a matrix is too large for biological dose-response analysis
 */
function isOversizedMatrix(
  sampleCount: number, 
  concentrationCount: number, 
  constraints: BiologicalConstraints
): boolean {
  return (
    sampleCount > constraints.maxSamplesPerDataset ||
    concentrationCount > constraints.maxConcentrationsPerDataset ||
    (sampleCount > 8 && concentrationCount > 3) // Special rule for very large matrices
  );
}

/**
 * Segments large matrices into individual dose-response curves
 */
function segmentMatrix(
  pattern: any,
  rawData: any[][],
  constraints: BiologicalConstraints
): SegmentedDataset[] {
  const segments: SegmentedDataset[] = [];
  
  try {
    const patternType = pattern.patternType || 'unknown';
    const boundingBox = pattern.boundingBox || extractBoundingBox(pattern);
    
    if (!boundingBox) {
      console.warn('Cannot segment pattern without bounding box:', pattern);
      return [];
    }

    // Determine segmentation strategy based on pattern type
    if (patternType === 'horizontal-matrix') {
      return segmentHorizontalMatrix(pattern, rawData, constraints);
    } else if (patternType.includes('vertical') || patternType === 'classic-titration') {
      return segmentVerticalMatrix(pattern, rawData, constraints);
    } else {
      return segmentBlockMatrix(pattern, rawData, constraints);
    }
    
  } catch (error) {
    console.warn('Error segmenting matrix:', error);
    return [];
  }
}

/**
 * Segments horizontal matrix patterns (concentrations in columns, samples in rows)
 */
function segmentHorizontalMatrix(
  pattern: any,
  rawData: any[][],
  constraints: BiologicalConstraints
): SegmentedDataset[] {
  const segments: SegmentedDataset[] = [];
  const boundingBox = pattern.boundingBox || extractBoundingBox(pattern);
  
  if (!boundingBox) return [];

  const sampleCount = extractSampleCount(pattern);
  const concentrationCount = extractConcentrationCount(pattern);
  
  // Each row represents a different sample's dose-response curve
  for (let sampleRow = boundingBox.startRow + 1; sampleRow <= boundingBox.endRow; sampleRow++) {
    
    // Skip empty rows
    const hasData = rawData[sampleRow]?.some((cell, colIndex) => 
      colIndex >= boundingBox.startColumn && 
      colIndex <= boundingBox.endColumn &&
      cell !== null && cell !== undefined && cell !== ''
    );
    
    if (!hasData) continue;

    const segmentBoundingBox = {
      startRow: boundingBox.startRow, // Include header row
      endRow: sampleRow,
      startColumn: boundingBox.startColumn,
      endColumn: boundingBox.endColumn
    };

    const segment: SegmentedDataset = {
      id: `${pattern.id || 'segment'}_row_${sampleRow}`,
      name: `Individual Curve ${sampleRow - boundingBox.startRow} (from ${pattern.description || 'matrix'})`,
      confidence: pattern.confidence * 0.9, // Slight penalty for segmentation
      biologicalConfidence: calculateBiologicalConfidence(1, concentrationCount, constraints),
      sampleCount: 1,
      concentrationCount,
      boundingBox: segmentBoundingBox,
      segmentedFrom: {
        originalSize: `${sampleCount} samples × ${concentrationCount} concentrations`,
        segmentIndex: sampleRow - boundingBox.startRow,
        totalSegments: sampleCount
      },
      issues: []
    };

    // Add biological validation issues
    const biologicalIssues = validateBiologicalRelevance(segment, constraints);
    segment.issues.push(...biologicalIssues);

    segments.push(segment);
  }

  return segments;
}

/**
 * Segments vertical matrix patterns (samples in columns, concentrations in rows)
 */
function segmentVerticalMatrix(
  pattern: any,
  rawData: any[][],
  constraints: BiologicalConstraints
): SegmentedDataset[] {
  const segments: SegmentedDataset[] = [];
  const boundingBox = pattern.boundingBox || extractBoundingBox(pattern);
  
  if (!boundingBox) return [];

  const sampleCount = extractSampleCount(pattern);
  const concentrationCount = extractConcentrationCount(pattern);
  
  // Detect replicate columns
  const replicateGroups = detectReplicateColumns(rawData, boundingBox);
  
  if (replicateGroups.length > 0) {
    // Group by replicates
    replicateGroups.forEach((group, index) => {
      const segment: SegmentedDataset = {
        id: `${pattern.id || 'segment'}_replicate_group_${index}`,
        name: `${group.baseName} (${group.replicateCount} replicates)`,
        confidence: pattern.confidence * 0.95, // Small penalty for grouping
        biologicalConfidence: calculateBiologicalConfidence(group.replicateCount, concentrationCount, constraints),
        sampleCount: group.replicateCount,
        concentrationCount,
        boundingBox: {
          startRow: boundingBox.startRow,
          endRow: boundingBox.endRow,
          startColumn: Math.min(...group.columns),
          endColumn: Math.max(...group.columns)
        },
        replicateInfo: {
          baseName: group.baseName,
          replicateCount: group.replicateCount,
          replicateColumns: group.columns
        },
        segmentedFrom: {
          originalSize: `${sampleCount} samples × ${concentrationCount} concentrations`,
          segmentIndex: index,
          totalSegments: replicateGroups.length
        },
        issues: []
      };

      const biologicalIssues = validateBiologicalRelevance(segment, constraints);
      segment.issues.push(...biologicalIssues);

      segments.push(segment);
    });
  } else {
    // Individual columns as separate datasets
    for (let sampleCol = boundingBox.startColumn + 1; sampleCol <= boundingBox.endColumn; sampleCol++) {
      
      const hasData = rawData.some((row, rowIndex) => 
        rowIndex >= boundingBox.startRow + 1 && 
        rowIndex <= boundingBox.endRow &&
        row[sampleCol] !== null && row[sampleCol] !== undefined && row[sampleCol] !== ''
      );
      
      if (!hasData) continue;

      const segment: SegmentedDataset = {
        id: `${pattern.id || 'segment'}_col_${sampleCol}`,
        name: `Individual Curve ${sampleCol - boundingBox.startColumn} (Column ${getColumnLetter(sampleCol)})`,
        confidence: pattern.confidence * 0.9,
        biologicalConfidence: calculateBiologicalConfidence(1, concentrationCount, constraints),
        sampleCount: 1,
        concentrationCount,
        boundingBox: {
          startRow: boundingBox.startRow,
          endRow: boundingBox.endRow,
          startColumn: boundingBox.startColumn, // Include concentration column
          endColumn: sampleCol
        },
        segmentedFrom: {
          originalSize: `${sampleCount} samples × ${concentrationCount} concentrations`,
          segmentIndex: sampleCol - boundingBox.startColumn,
          totalSegments: sampleCount
        },
        issues: []
      };

      const biologicalIssues = validateBiologicalRelevance(segment, constraints);
      segment.issues.push(...biologicalIssues);

      segments.push(segment);
    }
  }

  return segments;
}

/**
 * Segments block/grid matrix patterns using intelligent heuristics
 */
function segmentBlockMatrix(
  pattern: any,
  rawData: any[][],
  constraints: BiologicalConstraints
): SegmentedDataset[] {
  // For complex block patterns, try both horizontal and vertical segmentation
  // and choose the approach that yields more biologically appropriate results
  
  const horizontalSegments = segmentHorizontalMatrix(pattern, rawData, constraints);
  const verticalSegments = segmentVerticalMatrix(pattern, rawData, constraints);
  
  // Choose segmentation approach based on biological appropriateness
  const horizontalAvgBioConfidence = horizontalSegments.reduce((sum, s) => sum + s.biologicalConfidence, 0) / (horizontalSegments.length || 1);
  const verticalAvgBioConfidence = verticalSegments.reduce((sum, s) => sum + s.biologicalConfidence, 0) / (verticalSegments.length || 1);
  
  if (horizontalAvgBioConfidence > verticalAvgBioConfidence) {
    return horizontalSegments;
  } else {
    return verticalSegments;
  }
}

/**
 * Detects replicate columns in vertical matrices
 */
function detectReplicateColumns(
  rawData: any[][],
  boundingBox: { startRow: number; endRow: number; startColumn: number; endColumn: number }
): Array<{ baseName: string; columns: number[]; replicateCount: number }> {
  
  const headerRow = rawData[boundingBox.startRow];
  if (!headerRow) return [];

  const replicateGroups: Map<string, number[]> = new Map();
  
  for (let col = boundingBox.startColumn + 1; col <= boundingBox.endColumn; col++) {
    const headerValue = headerRow[col];
    if (headerValue && typeof headerValue === 'string') {
      const baseName = extractBaseName(headerValue);
      
      if (!replicateGroups.has(baseName)) {
        replicateGroups.set(baseName, []);
      }
      replicateGroups.get(baseName)!.push(col);
    }
  }
  
  // Only return groups with 2-4 replicates (biological constraint)
  return Array.from(replicateGroups.entries())
    .filter(([_, columns]) => columns.length >= 2 && columns.length <= 4)
    .map(([baseName, columns]) => ({
      baseName,
      columns,
      replicateCount: columns.length
    }));
}

/**
 * Extracts base sample name from replicate column headers
 */
function extractBaseName(headerValue: string): string {
  // Remove common replicate indicators
  return headerValue
    .replace(/[_\-\s]*(rep|replicate|r)\d+$/i, '')
    .replace(/[_\-\s]*\d+$/i, '')
    .replace(/[_\-\s]*[abc]$/i, '')
    .trim();
}

/**
 * Calculates biological appropriateness confidence score
 */
function calculateBiologicalConfidence(
  sampleCount: number,
  concentrationCount: number,
  constraints: BiologicalConstraints
): number {
  let confidence = 1.0;
  
  // Sample count scoring
  if (sampleCount === 1) {
    confidence *= 1.0; // Individual curves are ideal
  } else if (sampleCount <= 4) {
    confidence *= 0.9 - (sampleCount - 2) * 0.1; // 2-4 replicates are good
  } else if (sampleCount <= constraints.maxSamplesPerDataset) {
    confidence *= 0.6 - (sampleCount - 5) * 0.05; // 5-8 samples are less ideal
  } else {
    confidence *= 0.2; // Oversized patterns get low confidence
  }
  
  // Concentration count scoring - much stricter requirements
  if (concentrationCount >= 8 && concentrationCount <= 12) {
    confidence *= 1.0; // Ideal range for dose-response
  } else if (concentrationCount >= 6 && concentrationCount <= 15) {
    confidence *= 0.8; // Good range  
  } else if (concentrationCount >= constraints.minConcentrationsPerDataset) {
    confidence *= 0.5; // Minimal but workable
  } else {
    confidence *= 0.1; // Too few points for meaningful curve fitting
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Creates a biological dataset from an appropriately-sized pattern
 */
function createBiologicalDataset(
  pattern: any,
  rawData: any[][],
  constraints: BiologicalConstraints
): SegmentedDataset | null {
  
  const sampleCount = extractSampleCount(pattern);
  const concentrationCount = extractConcentrationCount(pattern);
  
  const dataset: SegmentedDataset = {
    id: pattern.id || `bio_dataset_${Date.now()}`,
    name: generateBiologicalName(pattern, sampleCount, concentrationCount),
    confidence: pattern.confidence || 0.5,
    biologicalConfidence: calculateBiologicalConfidence(sampleCount, concentrationCount, constraints),
    sampleCount,
    concentrationCount,
    boundingBox: pattern.boundingBox || extractBoundingBox(pattern),
    issues: []
  };

  // Validate biological relevance
  const biologicalIssues = validateBiologicalRelevance(dataset, constraints);
  dataset.issues.push(...biologicalIssues);
  
  // Only return if biologically relevant
  return dataset.biologicalConfidence > 0.3 ? dataset : null;
}

/**
 * Validates biological relevance and generates issues
 */
function validateBiologicalRelevance(
  dataset: SegmentedDataset,
  constraints: BiologicalConstraints
): DetectionIssue[] {
  const issues: DetectionIssue[] = [];
  
  if (dataset.sampleCount > constraints.maxSamplesPerDataset) {
    issues.push({
      type: 'warning',
      message: `Dataset has ${dataset.sampleCount} samples, which exceeds biological limit of ${constraints.maxSamplesPerDataset}`,
      suggestion: 'Consider segmenting into individual dose-response curves'
    });
  }
  
  if (dataset.concentrationCount < constraints.minConcentrationsPerDataset) {
    issues.push({
      type: 'warning',
      message: `Dataset has only ${dataset.concentrationCount} concentration points, minimum ${constraints.minConcentrationsPerDataset} recommended for curve fitting`,
      suggestion: 'Add more concentration points for better dose-response characterization'
    });
  }
  
  if (dataset.concentrationCount > constraints.maxConcentrationsPerDataset) {
    issues.push({
      type: 'info',
      message: `Dataset has ${dataset.concentrationCount} concentration points, which is unusually high`,
      suggestion: 'Verify that all concentration points are necessary for analysis'
    });
  }
  
  return issues;
}

/**
 * Utility functions
 */
function extractSampleCount(pattern: any): number {
  if (pattern.sampleCount) return pattern.sampleCount;
  if (pattern.description) {
    const match = pattern.description.match(/(\d+)\s*samples/);
    if (match) return parseInt(match[1]);
  }
  return 1; // Default assumption
}

function extractConcentrationCount(pattern: any): number {
  if (pattern.concentrationCount) return pattern.concentrationCount;
  if (pattern.description) {
    const match = pattern.description.match(/(\d+)\s*concentrations/);
    if (match) return parseInt(match[1]);
  }
  return 4; // Default assumption
}

function extractBoundingBox(pattern: any): any {
  return pattern.boundingBox || pattern.bounds || {
    startRow: 0,
    endRow: 0,
    startColumn: 0,
    endColumn: 0
  };
}

function generateBiologicalName(pattern: any, sampleCount: number, concentrationCount: number): string {
  if (sampleCount === 1) {
    return `Individual Dose-Response Curve (${concentrationCount} points)`;
  } else if (sampleCount <= 4) {
    return `Replicate Group (${sampleCount} replicates × ${concentrationCount} concentrations)`;
  } else {
    return `Multi-Sample Dataset (${sampleCount} samples × ${concentrationCount} concentrations)`;
  }
}

function getColumnLetter(columnIndex: number): string {
  return columnIndex < 26 ? String.fromCharCode(65 + columnIndex) : `Col${columnIndex + 1}`;
}

/**
 * Filters datasets to only include biologically relevant ones
 */
export function filterBiologicallyRelevantDatasets(
  datasets: SegmentedDataset[],
  minBiologicalConfidence: number = 0.5
): SegmentedDataset[] {
  return datasets
    .filter(dataset => dataset.biologicalConfidence >= minBiologicalConfidence)
    .sort((a, b) => b.biologicalConfidence - a.biologicalConfidence);
}