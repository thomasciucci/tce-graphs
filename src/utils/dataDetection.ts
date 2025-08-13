/**
 * Enhanced Data Detection Utilities for nVitro Studio
 * Provides intelligent detection and parsing of various Excel data formats
 */

import { detectEnhancedDosePatterns } from './enhancedDosePatternDetection';

export interface DataLayout {
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  dataStartRow: number;
  dataEndRow?: number;
  detectedLayout: 'standard' | 'transposed' | 'multi-block' | 'unknown';
  concentrationUnit: string;
  sampleNames?: string[];
}

export interface DetectionResult {
  confidence: number; // 0-1 confidence score
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  dataStartRow: number;
  detectedLayout: 'standard' | 'transposed' | 'multi-block' | 'unknown';
  concentrationUnit: string;
  issues: DetectionIssue[];
  preview: CellData[][];
  // Enhanced features for multi-dataset and pattern detection
  multipleDatasets?: DatasetDetection[];
  dilutionPattern?: DilutionPatternInfo;
  patternConfidence?: number;
}

// New interface for individual dataset detection within a sheet
export interface DatasetDetection {
  id: string;
  name: string;
  confidence: number;
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  dataStartRow: number;
  dataEndRow: number;
  concentrationUnit: string;
  dilutionPattern?: DilutionPatternInfo;
  issues: DetectionIssue[];
  boundingBox: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  };
  preview: CellData[][];
}

// New interface for dilution pattern analysis
export interface DilutionPatternInfo {
  type: 'serial' | 'log-scale' | 'half-log' | 'custom' | 'irregular' | 'unknown';
  factor?: number; // e.g., 2, 3, 10 for serial dilutions
  confidence: number; // 0-1 confidence score
  detectedRatio: number; // actual calculated ratio between concentrations
  concentrationRange: {
    min: number;
    max: number;
    orderOfMagnitude: number;
  };
  patternConsistency: number; // how consistent the pattern is (0-1)
  missingPoints: number[]; // indices of expected but missing concentration points
  irregularities: string[]; // descriptions of pattern deviations
}

export interface DetectionIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  row?: number;
  column?: number;
  suggestion?: string;
}

export interface CellData {
  value: any;
  type: 'number' | 'string' | 'date' | 'empty' | 'error';
  originalValue: any;
  row: number;
  column: number;
}

export interface ConcentrationInfo {
  value: number;
  unit: string;
  originalText: string;
  isValid: boolean;
}

// Common concentration keywords for detection
const CONCENTRATION_KEYWORDS = [
  'concentration', 'conc', 'dose', 'dilution', 'molarity', 'molar',
  'nm', 'um', 'mm', 'μm', 'μg/ml', 'ng/ml', 'mg/ml',
  'nM', 'μM', 'mM', 'M', 'log', 'log10'
];

// Common dilution ratios used in laboratory settings
const COMMON_DILUTION_RATIOS = [2, 3, 5, 10, Math.sqrt(10)]; // sqrt(10) ≈ 3.162 for half-log dilutions
const LOG_SCALE_BASES = [10, Math.E]; // Base 10 and natural log
const DILUTION_TOLERANCE = 0.15; // 15% tolerance for ratio detection

// Common response keywords
const RESPONSE_KEYWORDS = [
  'response', 'activity', 'inhibition', 'activation', 'viability',
  'signal', 'fluorescence', 'absorbance', 'od', 'rlu', 'rfu',
  'percent', '%', 'fold', 'ratio'
];

// Unit conversion factors to nM (base unit)
const UNIT_CONVERSION = {
  'M': 1e9,
  'mM': 1e6,
  'μM': 1e3,
  'uM': 1e3,
  'nM': 1,
  'pM': 1e-3,
  'fM': 1e-6,
  'g/L': 1, // Will need molecular weight
  'mg/mL': 1, // Will need molecular weight
  'μg/mL': 1, // Will need molecular weight
  'ng/mL': 1 // Will need molecular weight
};

/**
 * Analyzes raw Excel data to detect structure and format with enhanced multi-dataset and pattern recognition
 */
export function analyzeExcelData(rawData: any[][]): DetectionResult {
  const result: DetectionResult = {
    confidence: 0,
    headerRow: -1,
    concentrationColumn: -1,
    responseColumns: [],
    dataStartRow: -1,
    detectedLayout: 'unknown',
    concentrationUnit: 'nM',
    issues: [],
    preview: []
  };

  if (!rawData || rawData.length === 0) {
    result.issues.push({
      type: 'error',
      message: 'No data found in Excel file'
    });
    return result;
  }

  // Try enhanced detection first (if available)
  try {
    const enhancedResult = analyzeWithEnhancedDetection(rawData);
    if (enhancedResult && enhancedResult.confidence > 0.4) {
      console.log('✅ Using enhanced detection results');
      return enhancedResult;
    }
  } catch (error) {
    console.log('⚠️ Enhanced detection failed, falling back to original');
  }

  // Convert raw data to structured cell data
  const cellData = convertToCellData(rawData);
  result.preview = cellData;

  // Step 1: Check for multiple datasets
  const multipleDatasets = detectMultipleDatasets(cellData);
  if (multipleDatasets.length > 1) {
    result.multipleDatasets = multipleDatasets;
    result.detectedLayout = 'multi-block';
    
    // Use the highest confidence dataset for primary analysis
    const primaryDataset = multipleDatasets[0];
    result.headerRow = primaryDataset.headerRow;
    result.concentrationColumn = primaryDataset.concentrationColumn;
    result.responseColumns = primaryDataset.responseColumns;
    result.dataStartRow = primaryDataset.dataStartRow;
    result.concentrationUnit = primaryDataset.concentrationUnit;
    result.dilutionPattern = primaryDataset.dilutionPattern;
    result.confidence = primaryDataset.confidence;
    result.patternConfidence = primaryDataset.dilutionPattern?.confidence || 0;
    
    result.issues.push({
      type: 'info',
      message: `Detected ${multipleDatasets.length} potential datasets in this sheet`,
      suggestion: 'You can choose to import individual datasets or merge selected ones'
    });
    
    return result;
  }

  // Step 2: Single dataset analysis - detect header row
  const headerDetection = detectHeaderRow(cellData);
  result.headerRow = headerDetection.row;
  let structuralConfidence = headerDetection.confidence * 0.3;

  // Step 3: Enhanced concentration column detection with pattern analysis
  const concentrationDetection = detectConcentrationColumnWithPattern(cellData, result.headerRow);
  result.concentrationColumn = concentrationDetection.column;
  result.concentrationUnit = concentrationDetection.unit;
  result.dilutionPattern = concentrationDetection.dilutionPattern;
  result.patternConfidence = concentrationDetection.dilutionPattern?.confidence || 0;
  
  // Weight both structural and pattern-based confidence
  const concentrationConfidence = (concentrationDetection.confidence * 0.6) + 
                                  (result.patternConfidence * 0.4);
  structuralConfidence += concentrationConfidence * 0.4;

  // Step 4: Detect response columns
  const responseDetection = detectResponseColumns(cellData, result.headerRow, result.concentrationColumn);
  result.responseColumns = responseDetection.columns;
  structuralConfidence += responseDetection.confidence * 0.2;

  // Step 5: Determine data start row
  result.dataStartRow = result.headerRow + 1;

  // Step 6: Detect overall layout pattern
  const layoutDetection = detectDataLayout(cellData, result);
  result.detectedLayout = layoutDetection.layout;
  structuralConfidence += layoutDetection.confidence * 0.1;

  // Step 7: Enhanced validation including pattern analysis
  const validation = validateDetectionWithPattern(cellData, result);
  result.issues.push(...validation.issues);
  result.confidence = structuralConfidence * validation.confidenceMultiplier;

  return result;
}

/**
 * Converts raw Excel data to structured cell data with type information
 */
function convertToCellData(rawData: any[][]): CellData[][] {
  return rawData.map((row, rowIndex) => 
    row.map((cell, colIndex) => {
      const cellData: CellData = {
        value: cell,
        type: getCellType(cell),
        originalValue: cell,
        row: rowIndex,
        column: colIndex
      };
      return cellData;
    })
  );
}

/**
 * Determines the type of a cell value
 */
function getCellType(value: any): CellData['type'] {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }
  
  if (typeof value === 'number' && !isNaN(value)) {
    return 'number';
  }
  
  if (typeof value === 'string') {
    // Try to parse as number
    const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
    if (!isNaN(numValue)) {
      return 'number';
    }
    return 'string';
  }
  
  if (value instanceof Date) {
    return 'date';
  }
  
  return 'error';
}

/**
 * Detects the most likely header row using heuristics
 */
function detectHeaderRow(cellData: CellData[][]): { row: number; confidence: number } {
  let bestRow = 0;
  let bestScore = 0;

  for (let rowIndex = 0; rowIndex < Math.min(cellData.length, 10); rowIndex++) {
    const row = cellData[rowIndex];
    let score = 0;

    // Count non-empty text cells
    const textCells = row.filter(cell => cell.type === 'string' && cell.value).length;
    score += textCells * 2;

    // Check for concentration keywords
    const hasConcentrationKeyword = row.some(cell => 
      cell.type === 'string' && 
      CONCENTRATION_KEYWORDS.some(keyword => 
        cell.value.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    if (hasConcentrationKeyword) score += 10;

    // Check for response keywords
    const responseKeywords = row.filter(cell => 
      cell.type === 'string' && 
      RESPONSE_KEYWORDS.some(keyword => 
        cell.value.toLowerCase().includes(keyword.toLowerCase())
      )
    ).length;
    score += responseKeywords * 3;

    // Penalize rows that are mostly numbers (likely data rows)
    const numberCells = row.filter(cell => cell.type === 'number').length;
    if (numberCells > textCells) score -= 5;

    // Prefer earlier rows (headers are usually at the top)
    score -= rowIndex * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;
    }
  }

  const confidence = Math.min(bestScore / 15, 1); // Normalize to 0-1
  return { row: bestRow, confidence };
}

/**
 * Enhanced concentration column detection with dilution pattern analysis
 */
function detectConcentrationColumnWithPattern(cellData: CellData[][], headerRow: number): { 
  column: number; 
  unit: string; 
  confidence: number;
  dilutionPattern?: DilutionPatternInfo;
} {
  let bestColumn = 0;
  let bestScore = 0;
  let detectedUnit = 'nM';
  let bestDilutionPattern: DilutionPatternInfo | undefined;

  if (headerRow >= 0 && headerRow < cellData.length) {
    const headerRowData = cellData[headerRow];

    for (let colIndex = 0; colIndex < headerRowData.length; colIndex++) {
      const cell = headerRowData[colIndex];
      let score = 0;

      // Extract concentration values from this column
      const concentrationValues = extractColumnConcentrations(cellData, colIndex, headerRow + 1);
      
      // Analyze dilution pattern for this column
      const dilutionPattern = analyzeDilutionPattern(concentrationValues);
      
      // Pattern-based scoring (prioritize over keywords)
      const patternScore = dilutionPattern.confidence * 20; // Higher weight for pattern detection
      score += patternScore;

      if (cell.type === 'string' && cell.value) {
        const cellText = cell.value.toLowerCase();

        // Check for concentration keywords (lower weight than pattern)
        const hasConcentrationKeyword = CONCENTRATION_KEYWORDS.some(keyword => 
          cellText.includes(keyword.toLowerCase())
        );
        if (hasConcentrationKeyword) score += 8; // Reduced from 15

        // Check for units in header
        const unitMatch = Object.keys(UNIT_CONVERSION).find(unit => 
          cellText.includes(unit.toLowerCase())
        );
        if (unitMatch) {
          score += 6; // Reduced from 10
          detectedUnit = unitMatch;
        }

        // Check if subsequent rows contain numeric values
        let numericValuesBelow = 0;
        for (let rowIndex = headerRow + 1; rowIndex < Math.min(cellData.length, headerRow + 20); rowIndex++) {
          if (cellData[rowIndex] && cellData[rowIndex][colIndex]) {
            const dataCell = cellData[rowIndex][colIndex];
            if (dataCell.type === 'number' || 
                (dataCell.type === 'string' && isConcentrationString(dataCell.value))) {
              numericValuesBelow++;
            }
          }
        }
        score += numericValuesBelow * 0.5; // Reduced weight

        // Prefer first column for concentration (common pattern)
        if (colIndex === 0) score += 3; // Reduced from 5
      }

      // Bonus for detected dilution patterns
      if (dilutionPattern.type !== 'unknown' && dilutionPattern.type !== 'irregular') {
        score += 10;
      }

      // Bonus for good pattern consistency
      score += dilutionPattern.patternConsistency * 5;

      if (score > bestScore) {
        bestScore = score;
        bestColumn = colIndex;
        bestDilutionPattern = dilutionPattern;
      }
    }
  }

  const confidence = Math.min(bestScore / 35, 1); // Adjusted for new scoring
  return { column: bestColumn, unit: detectedUnit, confidence, dilutionPattern: bestDilutionPattern };
}

/**
 * Extracts concentration values from a specific column
 */
function extractColumnConcentrations(cellData: CellData[][], columnIndex: number, startRow: number): number[] {
  const concentrations: number[] = [];
  
  for (let row = startRow; row < cellData.length; row++) {
    const cell = cellData[row]?.[columnIndex];
    if (cell && (cell.type === 'number' || (cell.type === 'string' && isConcentrationString(cell.value)))) {
      const parsed = parseConcentration(cell.value);
      if (parsed.isValid) {
        const normalized = normalizeConcentration(parsed);
        if (!isNaN(normalized)) {
          concentrations.push(normalized);
        }
      }
    }
  }
  
  return concentrations;
}

/**
 * Legacy function for backward compatibility
 */
function detectConcentrationColumn(cellData: CellData[][], headerRow: number): { 
  column: number; 
  unit: string; 
  confidence: number 
} {
  const result = detectConcentrationColumnWithPattern(cellData, headerRow);
  return {
    column: result.column,
    unit: result.unit,
    confidence: result.confidence
  };
}

/**
 * Detects response columns (sample data columns)
 */
function detectResponseColumns(cellData: CellData[][], headerRow: number, concentrationColumn: number): {
  columns: number[];
  confidence: number;
} {
  const responseColumns: number[] = [];
  let totalScore = 0;

  if (headerRow >= 0 && headerRow < cellData.length) {
    const headerRowData = cellData[headerRow];

    for (let colIndex = 0; colIndex < headerRowData.length; colIndex++) {
      // Skip concentration column
      if (colIndex === concentrationColumn) continue;

      let score = 0;
      const cell = headerRowData[colIndex];

      if (cell.type === 'string' && cell.value) {
        const cellText = cell.value.toLowerCase();

        // Check for response keywords
        const hasResponseKeyword = RESPONSE_KEYWORDS.some(keyword => 
          cellText.includes(keyword.toLowerCase())
        );
        if (hasResponseKeyword) score += 10;

        // Check if column has sample-like naming (Sample1, A1, etc.)
        if (/^(sample|samp|s)\d+$/i.test(cellText) || 
            /^[a-z]\d+$/i.test(cellText) ||
            /^(well|w)\d+$/i.test(cellText)) {
          score += 8;
        }
      }

      // Check if subsequent rows contain numeric values
      let numericValuesBelow = 0;
      let totalValuesBelow = 0;
      for (let rowIndex = headerRow + 1; rowIndex < Math.min(cellData.length, headerRow + 20); rowIndex++) {
        if (cellData[rowIndex] && cellData[rowIndex][colIndex]) {
          const dataCell = cellData[rowIndex][colIndex];
          totalValuesBelow++;
          if (dataCell.type === 'number') {
            numericValuesBelow++;
          }
        }
      }

      const numericRatio = totalValuesBelow > 0 ? numericValuesBelow / totalValuesBelow : 0;
      score += numericRatio * 10;

      // If score is reasonable, consider it a response column
      if (score >= 5) {
        responseColumns.push(colIndex);
        totalScore += score;
      }
    }
  }

  const confidence = responseColumns.length > 0 ? Math.min(totalScore / (responseColumns.length * 15), 1) : 0;
  return { columns: responseColumns, confidence };
}

/**
 * Detects the overall data layout pattern
 */
function detectDataLayout(cellData: CellData[][], detection: Partial<DetectionResult>): {
  layout: DetectionResult['detectedLayout'];
  confidence: number;
} {
  // For now, assume standard layout (concentration in first column, responses in subsequent columns)
  // Future versions could detect transposed layouts, multi-block formats, etc.
  
  if (detection.concentrationColumn === 0 && 
      detection.responseColumns && detection.responseColumns.length > 0) {
    return { layout: 'standard', confidence: 0.8 };
  }

  return { layout: 'unknown', confidence: 0.2 };
}

/**
 * Enhanced validation including dilution pattern analysis
 */
function validateDetectionWithPattern(cellData: CellData[][], detection: Partial<DetectionResult>): {
  issues: DetectionIssue[];
  confidenceMultiplier: number;
} {
  const issues: DetectionIssue[] = [];
  let confidenceMultiplier = 1.0;

  // Check if we found essential components
  if (detection.concentrationColumn === -1) {
    issues.push({
      type: 'error',
      message: 'Could not detect concentration column',
      suggestion: 'Ensure the concentration column has a clear header with units (e.g., "Concentration [nM]") or contains a recognizable dilution pattern'
    });
    confidenceMultiplier *= 0.3;
  }

  if (!detection.responseColumns || detection.responseColumns.length === 0) {
    issues.push({
      type: 'error',
      message: 'Could not detect any response columns',
      suggestion: 'Ensure response columns have clear headers and contain numeric data'
    });
    confidenceMultiplier *= 0.3;
  }

  // Check for sufficient data rows
  const dataRows = cellData.length - (detection.dataStartRow || 1);
  if (dataRows < 3) {
    issues.push({
      type: 'warning',
      message: `Only ${dataRows} data rows detected. Need at least 3 concentration points for curve fitting`,
      suggestion: 'Add more concentration points for better curve fitting'
    });
    confidenceMultiplier *= 0.8;
  }

  // Enhanced dilution pattern validation
  if (detection.dilutionPattern) {
    const pattern = detection.dilutionPattern;
    
    if (pattern.confidence < 0.5) {
      issues.push({
        type: 'warning',
        message: `Low confidence in dilution pattern detection (${(pattern.confidence * 100).toFixed(1)}%)`,
        suggestion: 'Verify that concentrations follow a consistent dilution scheme'
      });
      confidenceMultiplier *= 0.9;
    }

    if (pattern.type === 'irregular') {
      issues.push({
        type: 'warning',
        message: 'Irregular dilution pattern detected',
        suggestion: 'Consider using standard dilution ratios (e.g., 2-fold, 3-fold, 10-fold) for better analysis'
      });
      confidenceMultiplier *= 0.8;
    }

    if (pattern.missingPoints && pattern.missingPoints.length > 0) {
      issues.push({
        type: 'info',
        message: `${pattern.missingPoints.length} expected concentration points appear to be missing`,
        suggestion: 'Consider adding missing concentration points for complete dose-response coverage'
      });
    }

    if (pattern.irregularities && pattern.irregularities.length > 0) {
      pattern.irregularities.forEach(irregularity => {
        issues.push({
          type: 'warning',
          message: `Pattern irregularity: ${irregularity}`,
          suggestion: 'Review concentration values for consistency'
        });
      });
      confidenceMultiplier *= 0.9;
    }

    // Validate scientific appropriateness
    if (pattern.concentrationRange.orderOfMagnitude < 2) {
      issues.push({
        type: 'info',
        message: `Narrow concentration range detected (${pattern.concentrationRange.orderOfMagnitude.toFixed(1)} orders of magnitude)`,
        suggestion: 'Consider expanding concentration range for better dose-response characterization'
      });
    }

    if (pattern.concentrationRange.orderOfMagnitude > 6) {
      issues.push({
        type: 'warning',
        message: `Very wide concentration range detected (${pattern.concentrationRange.orderOfMagnitude.toFixed(1)} orders of magnitude)`,
        suggestion: 'Verify concentration values are correct - extremely wide ranges may indicate data entry errors'
      });
      confidenceMultiplier *= 0.95;
    }
  }

  // Check for missing data in key columns
  if (detection.concentrationColumn !== undefined && detection.dataStartRow !== undefined) {
    let missingConcentrations = 0;
    for (let row = detection.dataStartRow; row < cellData.length; row++) {
      const cell = cellData[row]?.[detection.concentrationColumn];
      if (!cell || cell.type === 'empty') {
        missingConcentrations++;
      }
    }

    if (missingConcentrations > 0) {
      issues.push({
        type: 'warning',
        message: `${missingConcentrations} missing concentration values detected`,
        suggestion: 'Fill in missing concentration values or remove incomplete rows'
      });
      confidenceMultiplier *= 0.9;
    }
  }

  return { issues, confidenceMultiplier };
}

/**
 * Legacy validation function for backward compatibility
 */
function validateDetection(cellData: CellData[][], detection: Partial<DetectionResult>): {
  issues: DetectionIssue[];
  confidenceMultiplier: number;
} {
  return validateDetectionWithPattern(cellData, detection);
}

/**
 * Checks if a string represents a concentration value
 */
function isConcentrationString(value: string): boolean {
  if (typeof value !== 'string') return false;
  
  // Remove common units and formatting
  const cleaned = value.replace(/[^\d.\-e]/gi, '');
  const number = parseFloat(cleaned);
  
  return !isNaN(number) && number >= 0;
}

/**
 * Parses concentration values with units
 */
export function parseConcentration(value: any): ConcentrationInfo {
  const result: ConcentrationInfo = {
    value: 0,
    unit: 'nM',
    originalText: String(value),
    isValid: false
  };

  if (typeof value === 'number') {
    result.value = value;
    result.isValid = value >= 0;
    return result;
  }

  if (typeof value === 'string') {
    // Extract number and unit
    const match = value.match(/([0-9.e\-+]+)\s*([a-zA-Z/μ]*)/);
    if (match) {
      const numValue = parseFloat(match[1]);
      const unit = match[2] || 'nM';
      
      if (!isNaN(numValue) && numValue >= 0) {
        result.value = numValue;
        result.unit = unit;
        result.isValid = true;
      }
    }
  }

  return result;
}

/**
 * Converts concentration to normalized unit (nM)
 */
export function normalizeConcentration(concentration: ConcentrationInfo): number {
  if (!concentration.isValid) return NaN;
  
  const conversionFactor = UNIT_CONVERSION[concentration.unit as keyof typeof UNIT_CONVERSION] || 1;
  return concentration.value * conversionFactor;
}

/**
 * Analyzes concentration values to detect dilution patterns with comprehensive error handling
 */
export function analyzeDilutionPattern(concentrations: number[]): DilutionPatternInfo {
  try {
    // Input validation
    if (!Array.isArray(concentrations)) {
      throw new Error('Invalid input: concentrations must be an array');
    }

    // Filter out invalid values and sort
    const validConcentrations = concentrations
      .filter(c => typeof c === 'number' && !isNaN(c) && isFinite(c) && c > 0)
      .sort((a, b) => b - a); // Sort descending (highest to lowest)

    if (validConcentrations.length < 2) {
      return {
        type: 'unknown',
        confidence: 0,
        detectedRatio: NaN,
        concentrationRange: {
          min: 0,
          max: 0,
          orderOfMagnitude: 0
        },
        patternConsistency: 0,
        missingPoints: [],
        irregularities: ['Insufficient valid data points for pattern analysis']
      };
    }

    if (validConcentrations.length < 3) {
      // Special handling for 2 data points
      const ratio = validConcentrations[0] / validConcentrations[1];
      return {
        type: 'unknown',
        confidence: 0.1,
        detectedRatio: ratio,
        concentrationRange: {
          min: Math.min(...validConcentrations),
          max: Math.max(...validConcentrations),
          orderOfMagnitude: Math.log10(Math.max(...validConcentrations) / Math.min(...validConcentrations))
        },
        patternConsistency: 0,
        missingPoints: [],
        irregularities: ['Only 2 data points available - pattern analysis requires at least 3 points']
      };
    }

  const min = Math.min(...validConcentrations);
  const max = Math.max(...validConcentrations);
  const orderOfMagnitude = Math.log10(max / min);

  // Calculate ratios between consecutive concentrations
  const ratios: number[] = [];
  for (let i = 0; i < validConcentrations.length - 1; i++) {
    const ratio = validConcentrations[i] / validConcentrations[i + 1];
    ratios.push(ratio);
  }

  // Analyze ratio consistency
  const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const ratioVariance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - averageRatio, 2), 0) / ratios.length;
  const ratioStdDev = Math.sqrt(ratioVariance);
  const coefficientOfVariation = ratioStdDev / averageRatio;

  // Determine pattern type
  let patternType: DilutionPatternInfo['type'] = 'unknown';
  let confidence = 0;
  let detectedFactor = averageRatio;

  // Check for common dilution ratios
  for (const commonRatio of COMMON_DILUTION_RATIOS) {
    const difference = Math.abs(averageRatio - commonRatio) / commonRatio;
    if (difference < DILUTION_TOLERANCE) {
      if (commonRatio === 10) {
        patternType = 'log-scale';
      } else if (Math.abs(commonRatio - Math.sqrt(10)) < 0.1) {
        patternType = 'half-log';
      } else {
        patternType = 'serial';
      }
      detectedFactor = commonRatio;
      confidence = Math.max(0, 1 - (difference / DILUTION_TOLERANCE));
      break;
    }
  }

  // Check for log-scale patterns (powers of 10)
  if (patternType === 'unknown' && orderOfMagnitude >= 2) {
    const logRatios = ratios.map(r => Math.log10(r));
    const avgLogRatio = logRatios.reduce((sum, r) => sum + r, 0) / logRatios.length;
    
    if (Math.abs(avgLogRatio - 1) < 0.2) { // Close to log10(10) = 1
      patternType = 'log-scale';
      detectedFactor = 10;
      confidence = Math.max(0, 1 - Math.abs(avgLogRatio - 1) / 0.2);
    }
  }

  // If no standard pattern, check if it's reasonably consistent
  if (patternType === 'unknown' && coefficientOfVariation < 0.3) {
    patternType = 'custom';
    confidence = Math.max(0, 1 - coefficientOfVariation / 0.3);
  } else if (patternType === 'unknown') {
    patternType = 'irregular';
    confidence = 0.1;
  }

  // Calculate pattern consistency
  const patternConsistency = Math.max(0, 1 - coefficientOfVariation);

  // Identify missing points for serial dilutions
  const missingPoints: number[] = [];
  const irregularities: string[] = [];

  if (patternType === 'serial' || patternType === 'log-scale') {
    // Check for expected concentration points
    const expectedPoints = generateExpectedConcentrations(max, min, detectedFactor);
    for (let i = 0; i < expectedPoints.length; i++) {
      const expected = expectedPoints[i];
      const found = validConcentrations.find(c => 
        Math.abs(c - expected) / expected < DILUTION_TOLERANCE
      );
      if (!found) {
        missingPoints.push(i);
      }
    }
  }

  // Identify irregularities
  if (coefficientOfVariation > 0.2) {
    irregularities.push(`High variation in dilution ratios (CV: ${(coefficientOfVariation * 100).toFixed(1)}%)`);
  }

  if (ratios.some(r => r < 1)) {
    irregularities.push('Some concentrations increase instead of decrease');
  }

    return {
      type: patternType,
      factor: detectedFactor,
      confidence,
      detectedRatio: averageRatio,
      concentrationRange: {
        min,
        max,
        orderOfMagnitude
      },
      patternConsistency,
      missingPoints,
      irregularities
    };
  } catch (error) {
    console.warn('Error in dilution pattern analysis:', error);
    // Return safe fallback pattern
    return {
      type: 'unknown',
      confidence: 0,
      detectedRatio: NaN,
      concentrationRange: {
        min: 0,
        max: 0,
        orderOfMagnitude: 0
      },
      patternConsistency: 0,
      missingPoints: [],
      irregularities: [`Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Generates expected concentration points for a given dilution pattern
 */
function generateExpectedConcentrations(
  maxConc: number, 
  minConc: number, 
  dilutionFactor: number
): number[] {
  const points: number[] = [];
  let current = maxConc;
  
  while (current >= minConc * 0.5) { // Allow some tolerance for the minimum
    points.push(current);
    current /= dilutionFactor;
  }
  
  return points;
}

/**
 * Scans entire sheet for multiple dataset blocks with improved gap detection
 * Uses statistical analysis and spatial pattern recognition
 */
export function detectMultipleDatasets(cellData: CellData[][]): DatasetDetection[] {
  try {
    // Try the improved detection algorithm first
    const improvedResult = detectMultipleDatasetsImproved(cellData);
    
    if (improvedResult.datasets.length > 0) {
      // Convert improved results to legacy format
      return improvedResult.datasets.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        confidence: dataset.confidence,
        headerRow: dataset.headerRow,
        concentrationColumn: dataset.concentrationColumn,
        responseColumns: dataset.responseColumns,
        dataStartRow: dataset.dataStartRow,
        dataEndRow: dataset.dataEndRow,
        concentrationUnit: dataset.concentrationUnit,
        dilutionPattern: dataset.dilutionPattern,
        issues: dataset.issues,
        boundingBox: dataset.boundingBox,
        preview: dataset.preview
      }));
    }
  } catch (error) {
    console.warn('Improved multi-dataset detection failed, falling back to legacy method:', error);
  }
  
  // Fallback to legacy detection method
  return detectMultipleDatasetsLegacy(cellData);
}

/**
 * Legacy multi-dataset detection method (preserved for fallback)
 */
function detectMultipleDatasetsLegacy(cellData: CellData[][]): DatasetDetection[] {
  const datasets: DatasetDetection[] = [];
  const processedRegions: Set<string> = new Set();
  
  // Performance optimization: limit search area for very large sheets
  const maxRows = Math.min(cellData.length, 1000); // Limit to first 1000 rows
  const maxCols = Math.min(cellData[0]?.length || 0, 100); // Limit to first 100 columns
  
  // Optimize scanning pattern - skip by larger steps for initial discovery
  const stepSize = Math.max(1, Math.floor(Math.sqrt(maxRows * maxCols) / 50));
  
  try {
    // First pass: quick discovery with larger steps
    for (let row = 0; row < maxRows; row += stepSize) {
      for (let col = 0; col < maxCols; col += stepSize) {
        const regionKey = `${row}-${col}`;
        
        if (processedRegions.has(regionKey)) {
          continue;
        }

        // Quick check for potential dataset start
        if (isPotentialDatasetStart(cellData, row, col)) {
          // Analyze this region more carefully
          const potentialDataset = analyzeDatasetBlock(cellData, row, col, processedRegions);
          
          if (potentialDataset && potentialDataset.confidence > 0.3) {
            datasets.push(potentialDataset);
            
            // Mark this region as processed
            markRegionAsProcessed(processedRegions, potentialDataset.boundingBox);
          }
        }
      }
    }
    
    // Second pass: fill in gaps if we found multiple datasets
    if (datasets.length > 0) {
      const gaps = findUnprocessedGaps(cellData, processedRegions, maxRows, maxCols);
      for (const gap of gaps) {
        const potentialDataset = analyzeDatasetBlock(cellData, gap.row, gap.col, processedRegions);
        if (potentialDataset && potentialDataset.confidence > 0.2) {
          datasets.push(potentialDataset);
          markRegionAsProcessed(processedRegions, potentialDataset.boundingBox);
        }
      }
    }
  } catch (error) {
    console.warn('Error during legacy multi-dataset detection:', error);
    // Return empty array if both methods fail
    return [];
  }

  return datasets
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // Limit to maximum 10 datasets for performance
}

/**
 * Improved multi-dataset detection with better gap handling
 */
function detectMultipleDatasetsImproved(cellData: CellData[][]): {
  datasets: Array<{
    id: string;
    name: string;
    confidence: number;
    headerRow: number;
    concentrationColumn: number;
    responseColumns: number[];
    dataStartRow: number;
    dataEndRow: number;
    concentrationUnit: string;
    dilutionPattern?: DilutionPatternInfo;
    issues: DetectionIssue[];
    boundingBox: {
      startRow: number;
      endRow: number;
      startColumn: number;
      endColumn: number;
    };
    preview: CellData[][];
  }>;
} {
  // Convert cellData back to raw data for improved detection
  const rawData = cellData.map(row => 
    row.map(cell => cell.value)
  );
  
  // For now, return empty datasets array as a placeholder
  // The improved algorithm will be integrated properly in a future update
  return {
    datasets: []
  };
}

/**
 * Quick heuristic check for potential dataset start position
 */
function isPotentialDatasetStart(cellData: CellData[][], row: number, col: number): boolean {
  const cell = cellData[row]?.[col];
  if (!cell || cell.type !== 'string') {
    return false;
  }
  
  // Look for concentration-like keywords or patterns
  const cellText = cell.value.toLowerCase();
  const hasConcentrationKeyword = CONCENTRATION_KEYWORDS.some(keyword => 
    cellText.includes(keyword.toLowerCase())
  );
  
  if (hasConcentrationKeyword) {
    return true;
  }
  
  // Check if next few rows contain numeric data (potential concentration column)
  let numericCount = 0;
  for (let r = row + 1; r < Math.min(row + 6, cellData.length); r++) {
    const dataCell = cellData[r]?.[col];
    if (dataCell?.type === 'number') {
      numericCount++;
    }
  }
  
  return numericCount >= 3; // At least 3 numeric values below
}

/**
 * Marks a bounding box region as processed
 */
function markRegionAsProcessed(processedRegions: Set<string>, boundingBox: {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}): void {
  for (let r = boundingBox.startRow; r <= boundingBox.endRow; r++) {
    for (let c = boundingBox.startColumn; c <= boundingBox.endColumn; c++) {
      processedRegions.add(`${r}-${c}`);
    }
  }
}

/**
 * Finds unprocessed gaps that might contain additional datasets
 */
function findUnprocessedGaps(
  cellData: CellData[][], 
  processedRegions: Set<string>, 
  maxRows: number, 
  maxCols: number
): Array<{ row: number; col: number }> {
  const gaps: Array<{ row: number; col: number }> = [];
  
  // Look for significant unprocessed areas
  for (let row = 0; row < maxRows; row += 10) {
    for (let col = 0; col < maxCols; col += 10) {
      if (!processedRegions.has(`${row}-${col}`)) {
        // Check if this area has potential data
        const hasData = checkAreaForData(cellData, row, col, Math.min(row + 10, maxRows), Math.min(col + 10, maxCols));
        if (hasData) {
          gaps.push({ row, col });
        }
      }
    }
  }
  
  return gaps;
}

/**
 * Checks if an area contains potential dataset data
 */
function checkAreaForData(cellData: CellData[][], startRow: number, startCol: number, endRow: number, endCol: number): boolean {
  let textCells = 0;
  let numericCells = 0;
  
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const cell = cellData[row]?.[col];
      if (cell?.type === 'string') textCells++;
      if (cell?.type === 'number') numericCells++;
    }
  }
  
  // Heuristic: potential dataset if we have some text (headers) and numbers (data)
  return textCells >= 2 && numericCells >= 6;
}

/**
 * Analyzes a potential dataset block starting from given position with enhanced error handling
 */
function analyzeDatasetBlock(
  cellData: CellData[][], 
  startRow: number, 
  startCol: number,
  processedRegions: Set<string>
): DatasetDetection | null {
  const regionKey = `${startRow}-${startCol}`;
  if (processedRegions.has(regionKey)) {
    return null;
  }

  try {
    // Validate input parameters
    if (!cellData || cellData.length === 0 || startRow < 0 || startCol < 0) {
      return null;
    }

    if (startRow >= cellData.length || startCol >= (cellData[startRow]?.length || 0)) {
      return null;
    }

    // Find the boundaries of this data block
    const boundaries = findDataBlockBoundaries(cellData, startRow, startCol);
    
    if (!boundaries || boundaries.endRow - boundaries.startRow < 3) {
      return null; // Too small to be a meaningful dataset
    }

    // Validate boundaries
    if (boundaries.startRow < 0 || boundaries.endRow >= cellData.length ||
        boundaries.startColumn < 0 || boundaries.endColumn >= (cellData[0]?.length || 0)) {
      return null; // Invalid boundaries
    }

    // Extract the data block with error handling
    const blockData = extractDataBlock(cellData, boundaries);
    if (!blockData || blockData.length === 0) {
      return null;
    }
    
    // Analyze this block using existing detection logic
    const blockDetection = analyzeExcelData(blockData);
    
    // Validate block detection results
    if (blockDetection.concentrationColumn === -1 || 
        !blockDetection.responseColumns || 
        blockDetection.responseColumns.length === 0) {
      return null;
    }

    // Apply dilution pattern analysis with error handling
    let dilutionPattern: DilutionPatternInfo;
    try {
      const concentrationValues = extractConcentrationValues(blockData, blockDetection);
      dilutionPattern = analyzeDilutionPattern(concentrationValues);
    } catch (error) {
      console.warn('Error analyzing dilution pattern:', error);
      // Create a default pattern if analysis fails
      dilutionPattern = {
        type: 'unknown',
        confidence: 0,
        detectedRatio: NaN,
        concentrationRange: { min: 0, max: 0, orderOfMagnitude: 0 },
        patternConsistency: 0,
        missingPoints: [],
        irregularities: ['Pattern analysis failed']
      };
    }
    
    // Calculate overall confidence considering both structure and pattern
    const structuralConfidence = Math.max(0, Math.min(1, blockDetection.confidence));
    const patternConfidence = Math.max(0, Math.min(1, dilutionPattern.confidence));
    const combinedConfidence = (structuralConfidence * 0.6) + (patternConfidence * 0.4);

    if (combinedConfidence < 0.2) { // Lowered threshold for robustness
      return null; // Not confident enough
    }

    // Generate dataset name with fallback
    const columnLetter = startCol < 26 ? String.fromCharCode(65 + startCol) : `Col${startCol + 1}`;
    const datasetName = `Dataset at ${columnLetter}${startRow + 1}`;

    return {
      id: `dataset-${startRow}-${startCol}`,
      name: datasetName,
      confidence: combinedConfidence,
      headerRow: boundaries.startRow + Math.max(0, blockDetection.headerRow),
      concentrationColumn: boundaries.startColumn + Math.max(0, blockDetection.concentrationColumn),
      responseColumns: blockDetection.responseColumns.map(col => 
        Math.max(0, boundaries.startColumn + col)
      ).filter(col => col < (cellData[0]?.length || 0)), // Validate column indices
      dataStartRow: boundaries.startRow + Math.max(0, blockDetection.dataStartRow),
      dataEndRow: Math.min(boundaries.endRow, cellData.length - 1),
      concentrationUnit: blockDetection.concentrationUnit || 'nM',
      dilutionPattern,
      issues: blockDetection.issues || [],
      boundingBox: boundaries,
      preview: blockData.slice(0, 10) // Limit preview size
    };
  } catch (error) {
    console.warn(`Error analyzing dataset block at ${startRow},${startCol}:`, error);
    return null;
  }
}

/**
 * Finds the boundaries of a data block starting from a given position
 */
function findDataBlockBoundaries(cellData: CellData[][], startRow: number, startCol: number): {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
} | null {
  // Look for header-like content at the starting position
  const startCell = cellData[startRow]?.[startCol];
  if (!startCell || startCell.type !== 'string') {
    return null;
  }

  let endRow = startRow;
  let endColumn = startCol;

  // Expand right to find the end of the header row
  while (endColumn + 1 < (cellData[startRow]?.length || 0)) {
    const nextCell = cellData[startRow][endColumn + 1];
    if (!nextCell || nextCell.type === 'empty') {
      break;
    }
    endColumn++;
  }

  // Expand down to find the end of the data block
  let consecutiveEmptyRows = 0;
  for (let row = startRow + 1; row < cellData.length; row++) {
    let hasData = false;
    
    for (let col = startCol; col <= endColumn; col++) {
      const cell = cellData[row]?.[col];
      if (cell && cell.type !== 'empty') {
        hasData = true;
        break;
      }
    }
    
    if (hasData) {
      endRow = row;
      consecutiveEmptyRows = 0;
    } else {
      consecutiveEmptyRows++;
      if (consecutiveEmptyRows >= 2) {
        break; // Stop at 2 consecutive empty rows
      }
    }
  }

  // Ensure we have a reasonable dataset size
  if (endRow - startRow < 3 || endColumn - startCol < 1) {
    return null;
  }

  return {
    startRow,
    endRow,
    startColumn: startCol,
    endColumn
  };
}

/**
 * Extracts a data block from the full cell data
 */
function extractDataBlock(cellData: CellData[][], boundaries: {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}): CellData[][] {
  const block: CellData[][] = [];
  
  for (let row = boundaries.startRow; row <= boundaries.endRow; row++) {
    const blockRow: CellData[] = [];
    
    for (let col = boundaries.startColumn; col <= boundaries.endColumn; col++) {
      const cell = cellData[row]?.[col];
      if (cell) {
        // Adjust row and column indices to be relative to the block
        blockRow.push({
          ...cell,
          row: row - boundaries.startRow,
          column: col - boundaries.startColumn
        });
      } else {
        // Create empty cell if missing
        blockRow.push({
          value: '',
          type: 'empty',
          originalValue: '',
          row: row - boundaries.startRow,
          column: col - boundaries.startColumn
        });
      }
    }
    
    block.push(blockRow);
  }
  
  return block;
}

/**
 * Extracts concentration values from detected data for pattern analysis
 */
function extractConcentrationValues(blockData: CellData[][], detection: DetectionResult): number[] {
  const concentrations: number[] = [];
  
  if (detection.concentrationColumn === -1 || detection.dataStartRow === -1) {
    return concentrations;
  }

  for (let row = detection.dataStartRow; row < blockData.length; row++) {
    const cell = blockData[row]?.[detection.concentrationColumn];
    if (cell && cell.type === 'number') {
      const parsed = parseConcentration(cell.value);
      if (parsed.isValid) {
        const normalized = normalizeConcentration(parsed);
        if (!isNaN(normalized)) {
          concentrations.push(normalized);
        }
      }
    }
  }
  
  return concentrations;
}

/**
 * Enhanced detection using the new bidirectional, multi-dilution, outlier-tolerant detection
 */
/**
 * Map dilution type name to enum values
 */
function mapDilutionTypeName(dilutionTypeName?: string): 'unknown' | 'custom' | 'serial' | 'log-scale' | 'half-log' | 'irregular' {
  if (!dilutionTypeName) return 'unknown';
  
  if (dilutionTypeName.includes('log-scale') || dilutionTypeName.includes('10-fold')) {
    return 'log-scale';
  } else if (dilutionTypeName.includes('fold') && (dilutionTypeName.includes('2-') || dilutionTypeName.includes('3-') || dilutionTypeName.includes('4-') || dilutionTypeName.includes('5-'))) {
    return 'serial';
  } else if (dilutionTypeName.includes('custom')) {
    return 'custom';
  } else if (dilutionTypeName.includes('irregular')) {
    return 'irregular';
  } else if (dilutionTypeName.includes('half-log')) {
    return 'half-log';
  }
  
  return 'unknown';
}

function analyzeWithEnhancedDetection(rawData: any[][]): DetectionResult | null {
  try {
    console.log('🚀 Trying enhanced detection...');
    const enhancedPatterns = detectEnhancedDosePatterns(rawData);
    
    if (enhancedPatterns.length === 0) {
      console.log('⚠️ No enhanced patterns found');
      return null;
    }
    
    // Convert the best enhanced pattern to DetectionResult format
    const bestPattern = enhancedPatterns[0]; // Already sorted by confidence
    console.log(`✅ Best enhanced pattern: ${bestPattern.orientation} ${bestPattern.patternType} (confidence: ${bestPattern.confidence})`);
    
    const result: DetectionResult = {
      confidence: bestPattern.confidence,
      headerRow: bestPattern.headerRow || bestPattern.boundingBox.startRow,
      concentrationColumn: bestPattern.concentrationColumn || -1,
      responseColumns: bestPattern.responseColumns,
      dataStartRow: bestPattern.boundingBox.startRow + 1,
      detectedLayout: bestPattern.orientation === 'horizontal' ? 'transposed' : 'standard',
      concentrationUnit: bestPattern.biologicalMetrics?.concentrationUnit || 'nM',
      issues: [],
      preview: convertToCellData(rawData),
      dilutionPattern: {
        type: mapDilutionTypeName(bestPattern.biologicalMetrics?.dilutionType) || 'unknown',
        factor: bestPattern.dilutionFactor || 0,
        confidence: bestPattern.confidence,
        detectedRatio: bestPattern.dilutionFactor || 0,
        concentrationRange: {
          min: bestPattern.concentrationRange?.min || 0,
          max: bestPattern.concentrationRange?.max || 0,
          orderOfMagnitude: bestPattern.concentrationRange ? 
            Math.log10(bestPattern.concentrationRange.max / bestPattern.concentrationRange.min) : 0
        },
        patternConsistency: bestPattern.confidence,
        missingPoints: [],
        irregularities: bestPattern.outliers?.map(o => 
          `${o.type} outlier at position ${o.position}: ${o.value.toFixed(2)} (expected ~${o.expectedValue.toFixed(2)})`
        ) || []
      }
    };
    
    // Add informational messages about enhanced features
    if (bestPattern.orientation === 'vertical') {
      result.issues.push({
        type: 'info',
        message: 'Detected vertical dose-response layout (transposed)',
        suggestion: 'Data arranged with concentrations in columns'
      });
    }
    
    if (bestPattern.outliers && bestPattern.outliers.length > 0) {
      result.issues.push({
        type: 'info',
        message: `${bestPattern.outliers.length} outlier(s) detected and tolerated`,
        suggestion: 'Pattern detection was robust to concentration outliers'
      });
    }
    
    if (bestPattern.detectedDilutionFactors && bestPattern.detectedDilutionFactors.length > 1) {
      result.issues.push({
        type: 'info',
        message: `Multiple dilution factors detected: ${bestPattern.detectedDilutionFactors.join(', ')}-fold`,
        suggestion: 'Mixed dilution series detected'
      });
    }
    
    console.log('✅ Enhanced detection successful:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Enhanced detection failed:', error);
    return null;
  }
}