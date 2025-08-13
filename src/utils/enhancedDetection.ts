/**
 * Enhanced Data Detection for nVitro Studio
 * Prioritizes mathematical pattern analysis over keyword matching
 */

import { CellData, DetectionResult, DetectionIssue, parseConcentration } from './dataDetection';
import { analyzeDilutionPattern, ConcentrationAnalysis, validateConcentrationSequence } from './dilutionPatterns';
import { scanForMultipleDatasets, MultiDatasetResult, DataBlock, filterValidBlocks } from './multiDatasetDetection';

export interface EnhancedDetectionResult extends DetectionResult {
  multiDatasetResult?: MultiDatasetResult;
  concentrationAnalysis?: ConcentrationAnalysis;
  patternBasedConfidence: number;
  keywordBasedConfidence: number;
  detectionMethod: 'pattern' | 'keyword' | 'hybrid';
  alternativeDetections?: DetectionResult[];
}

export interface EnhancedDetectionOptions {
  enableMultiDataset?: boolean;
  prioritizePatterns?: boolean;
  minPatternConfidence?: number;
  fallbackToKeywords?: boolean;
  scanOptions?: {
    minRows?: number;
    minCols?: number;
    maxGapRows?: number;
    maxGapCols?: number;
  };
}

/**
 * Enhanced analysis that prioritizes mathematical patterns over keywords
 */
export function analyzeExcelDataEnhanced(
  rawData: any[][],
  options: EnhancedDetectionOptions = {}
): EnhancedDetectionResult {
  const defaultOptions: EnhancedDetectionOptions = {
    enableMultiDataset: true,
    prioritizePatterns: true,
    minPatternConfidence: 0.4,
    fallbackToKeywords: true,
    scanOptions: {
      minRows: 3,
      minCols: 2,
      maxGapRows: 3,
      maxGapCols: 2
    }
  };

  const opts = { ...defaultOptions, ...options };

  // Step 1: Check for multiple datasets if enabled
  let multiDatasetResult: MultiDatasetResult | undefined;
  if (opts.enableMultiDataset) {
    multiDatasetResult = scanForMultipleDatasets(rawData, opts.scanOptions);
    
    // If multiple valid datasets found, analyze the best one or return multi-dataset result
    if (multiDatasetResult.validBlocks > 1) {
      return handleMultipleDatasets(multiDatasetResult, rawData, opts);
    }
  }

  // Step 2: Single dataset analysis with pattern prioritization
  return analyzeSingleDatasetEnhanced(rawData, opts, multiDatasetResult);
}

/**
 * Handles multiple datasets detected in the same sheet
 */
function handleMultipleDatasets(
  multiDatasetResult: MultiDatasetResult,
  rawData: any[][],
  options: EnhancedDetectionOptions
): EnhancedDetectionResult {
  const validBlocks = filterValidBlocks(multiDatasetResult, options.minPatternConfidence);
  
  if (validBlocks.length === 0) {
    // Fallback to single dataset analysis
    return analyzeSingleDatasetEnhanced(rawData, options, multiDatasetResult);
  }

  // Use the highest confidence block as the primary detection
  const bestBlock = validBlocks.sort((a, b) => b.confidence - a.confidence)[0];
  
  const result: EnhancedDetectionResult = {
    ...bestBlock.detection,
    multiDatasetResult,
    concentrationAnalysis: bestBlock.concentrationAnalysis,
    patternBasedConfidence: bestBlock.concentrationAnalysis?.overallConfidence || 0,
    keywordBasedConfidence: bestBlock.detection.confidence,
    detectionMethod: 'pattern',
    alternativeDetections: validBlocks.slice(1).map(block => block.detection)
  };

  // Adjust confidence based on pattern analysis
  result.confidence = calculateHybridConfidence(
    result.patternBasedConfidence,
    result.keywordBasedConfidence,
    options
  );

  // Add issues about multiple datasets
  result.issues = [
    ...result.issues,
    {
      type: 'info',
      message: `${multiDatasetResult.totalBlocks} data blocks detected, ${multiDatasetResult.validBlocks} are valid`,
      suggestion: 'Consider importing datasets individually or selecting specific blocks'
    }
  ];

  return result;
}

/**
 * Analyzes a single dataset with pattern prioritization
 */
function analyzeSingleDatasetEnhanced(
  rawData: any[][],
  options: EnhancedDetectionOptions,
  multiDatasetResult?: MultiDatasetResult
): EnhancedDetectionResult {
  // Convert raw data to cell data
  const cellData = convertToCellData(rawData);
  
  // Step 1: Pattern-based detection
  const patternDetection = detectByPatterns(cellData, rawData);
  
  // Step 2: Keyword-based detection (original method)
  const keywordDetection = detectByKeywords(cellData);
  
  // Step 3: Combine or choose best method
  const finalDetection = combineDetectionMethods(
    patternDetection,
    keywordDetection,
    options
  );

  // Step 4: Enhance with concentration analysis
  let concentrationAnalysis: ConcentrationAnalysis | undefined;
  if (finalDetection.concentrationColumn >= 0 && finalDetection.dataStartRow >= 0) {
    const concValues = extractConcentrationValues(
      rawData,
      finalDetection.concentrationColumn,
      finalDetection.dataStartRow
    );
    concentrationAnalysis = analyzeDilutionPattern(concValues);
    
    // Validate the concentration sequence
    const validation = validateConcentrationSequence(concentrationAnalysis);
    if (!validation.isValid) {
      finalDetection.issues.push(
        ...validation.issues.map(issue => ({
          type: 'warning' as const,
          message: issue,
          suggestion: validation.recommendations.join('. ')
        }))
      );
    }
  }

  const result: EnhancedDetectionResult = {
    ...finalDetection,
    multiDatasetResult,
    concentrationAnalysis,
    patternBasedConfidence: patternDetection.confidence,
    keywordBasedConfidence: keywordDetection.confidence,
    detectionMethod: determineDetectionMethod(patternDetection, keywordDetection, options)
  };

  // Final confidence calculation
  result.confidence = calculateHybridConfidence(
    result.patternBasedConfidence,
    result.keywordBasedConfidence,
    options
  );

  return result;
}

/**
 * Pattern-based detection that looks for mathematical sequences
 */
function detectByPatterns(cellData: CellData[][], rawData: any[][]): DetectionResult {
  const result: DetectionResult = {
    confidence: 0,
    headerRow: -1,
    concentrationColumn: -1,
    responseColumns: [],
    dataStartRow: -1,
    detectedLayout: 'unknown',
    concentrationUnit: 'nM',
    issues: [],
    preview: cellData
  };

  const columnPatterns: Array<{
    column: number;
    analysis: ConcentrationAnalysis;
    startRow: number;
  }> = [];

  // Analyze each column for dilution patterns
  for (let col = 0; col < (cellData[0]?.length || 0); col++) {
    const columnData = rawData.map(row => row[col]);
    
    // Try different starting rows
    for (let startRow = 0; startRow <= Math.min(5, rawData.length - 3); startRow++) {
      const values = columnData.slice(startRow);
      if (values.length < 3) continue;
      
      const analysis = analyzeDilutionPattern(values);
      if (analysis.isValid) {
        columnPatterns.push({
          column: col,
          analysis,
          startRow
        });
      }
    }
  }

  if (columnPatterns.length === 0) {
    result.issues.push({
      type: 'warning',
      message: 'No clear dilution patterns detected in any column',
      suggestion: 'Ensure concentration values follow a systematic dilution scheme'
    });
    return result;
  }

  // Select best pattern
  const bestPattern = columnPatterns.sort((a, b) => 
    b.analysis.overallConfidence - a.analysis.overallConfidence
  )[0];

  result.concentrationColumn = bestPattern.column;
  result.dataStartRow = bestPattern.startRow;
  result.confidence = bestPattern.analysis.overallConfidence;

  // Detect header row (row before data start)
  if (bestPattern.startRow > 0) {
    result.headerRow = bestPattern.startRow - 1;
  }

  // Detect response columns (other numeric columns)
  result.responseColumns = [];
  for (let col = 0; col < (cellData[0]?.length || 0); col++) {
    if (col === result.concentrationColumn) continue;
    
    // Check if column has numeric data in the data region
    let numericCount = 0;
    for (let row = result.dataStartRow; row < Math.min(rawData.length, result.dataStartRow + 10); row++) {
      const cell = cellData[row]?.[col];
      if (cell && cell.type === 'number') {
        numericCount++;
      }
    }
    
    if (numericCount >= 3) {
      result.responseColumns.push(col);
    }
  }

  result.detectedLayout = 'standard';

  return result;
}

/**
 * Keyword-based detection (original method)
 */
function detectByKeywords(cellData: CellData[][]): DetectionResult {
  // This would call the original analyzeExcelData function
  // For now, implementing a simplified version
  
  const result: DetectionResult = {
    confidence: 0,
    headerRow: -1,
    concentrationColumn: -1,
    responseColumns: [],
    dataStartRow: -1,
    detectedLayout: 'unknown',
    concentrationUnit: 'nM',
    issues: [],
    preview: cellData
  };

  const concentrationKeywords = [
    'concentration', 'conc', 'dose', 'dilution', 'molarity', 'molar',
    'nm', 'um', 'mm', 'μm', 'μg/ml', 'ng/ml', 'mg/ml',
    'nM', 'μM', 'mM', 'M', 'log', 'log10'
  ];

  // Find header row
  for (let row = 0; row < Math.min(cellData.length, 5); row++) {
    const rowData = cellData[row];
    if (!rowData) continue;

    const hasKeywords = rowData.some(cell => 
      cell.type === 'string' && 
      concentrationKeywords.some(keyword =>
        cell.value?.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    if (hasKeywords) {
      result.headerRow = row;
      result.dataStartRow = row + 1;
      break;
    }
  }

  // Find concentration column based on keywords
  if (result.headerRow >= 0) {
    const headerRow = cellData[result.headerRow];
    for (let col = 0; col < headerRow.length; col++) {
      const cell = headerRow[col];
      if (cell.type === 'string') {
        const hasConcentrationKeyword = concentrationKeywords.some(keyword =>
          cell.value?.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasConcentrationKeyword) {
          result.concentrationColumn = col;
          break;
        }
      }
    }
  }

  // Calculate confidence based on keyword matches
  if (result.headerRow >= 0 && result.concentrationColumn >= 0) {
    result.confidence = 0.7;
  } else if (result.headerRow >= 0) {
    result.confidence = 0.4;
  } else {
    result.confidence = 0.1;
  }

  return result;
}

/**
 * Combines pattern and keyword detection methods
 */
function combineDetectionMethods(
  patternDetection: DetectionResult,
  keywordDetection: DetectionResult,
  options: EnhancedDetectionOptions
): DetectionResult {
  if (options.prioritizePatterns && patternDetection.confidence >= (options.minPatternConfidence || 0.4)) {
    // Use pattern detection but supplement with keyword info
    const result = { ...patternDetection };
    
    // If pattern detection didn't find header but keyword did, use keyword header
    if (result.headerRow === -1 && keywordDetection.headerRow >= 0) {
      result.headerRow = keywordDetection.headerRow;
      result.issues.push({
        type: 'info',
        message: 'Header row detected by keyword analysis',
        suggestion: 'Verify header row alignment with detected data pattern'
      });
    }
    
    return result;
  }
  
  if (options.fallbackToKeywords && keywordDetection.confidence > patternDetection.confidence) {
    // Use keyword detection
    return keywordDetection;
  }
  
  // Hybrid approach: use the best elements from both
  const result = patternDetection.confidence > keywordDetection.confidence ? 
    { ...patternDetection } : { ...keywordDetection };
  
  result.confidence = Math.max(patternDetection.confidence, keywordDetection.confidence);
  
  return result;
}

/**
 * Determines which detection method was primarily used
 */
function determineDetectionMethod(
  patternDetection: DetectionResult,
  keywordDetection: DetectionResult,
  options: EnhancedDetectionOptions
): 'pattern' | 'keyword' | 'hybrid' {
  if (patternDetection.confidence >= (options.minPatternConfidence || 0.4) && 
      patternDetection.confidence > keywordDetection.confidence) {
    return 'pattern';
  }
  
  if (keywordDetection.confidence > patternDetection.confidence) {
    return 'keyword';
  }
  
  return 'hybrid';
}

/**
 * Calculates hybrid confidence combining pattern and keyword analysis
 */
function calculateHybridConfidence(
  patternConfidence: number,
  keywordConfidence: number,
  options: EnhancedDetectionOptions
): number {
  if (options.prioritizePatterns) {
    return patternConfidence * 0.8 + keywordConfidence * 0.2;
  }
  
  return Math.max(patternConfidence, keywordConfidence);
}

/**
 * Convert raw data to structured cell data
 */
function convertToCellData(rawData: any[][]): CellData[][] {
  return rawData.map((row, rowIndex) => 
    row.map((cell, colIndex) => ({
      value: cell,
      type: getCellType(cell),
      originalValue: cell,
      row: rowIndex,
      column: colIndex
    }))
  );
}

/**
 * Determine cell type
 */
function getCellType(value: any): CellData['type'] {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }
  if (typeof value === 'number' && !isNaN(value)) {
    return 'number';
  }
  if (typeof value === 'string') {
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
 * Extracts concentration values from a specific column
 */
function extractConcentrationValues(
  rawData: any[][],
  column: number,
  startRow: number
): any[] {
  const values: any[] = [];
  
  for (let row = startRow; row < rawData.length; row++) {
    const cell = rawData[row]?.[column];
    if (cell !== undefined && cell !== null && cell !== '') {
      values.push(cell);
    }
  }
  
  return values;
}

/**
 * Gets concentration analysis from enhanced detection result
 */
export function getConcentrationAnalysis(result: EnhancedDetectionResult): ConcentrationAnalysis | null {
  return result.concentrationAnalysis || null;
}

/**
 * Gets multi-dataset result from enhanced detection
 */
export function getMultiDatasetResult(result: EnhancedDetectionResult): MultiDatasetResult | null {
  return result.multiDatasetResult || null;
}

/**
 * Checks if the result indicates multiple datasets
 */
export function hasMultipleDatasets(result: EnhancedDetectionResult): boolean {
  return result.multiDatasetResult ? result.multiDatasetResult.validBlocks > 1 : false;
}

/**
 * Gets all valid data blocks from the result
 */
export function getValidDataBlocks(result: EnhancedDetectionResult): DataBlock[] {
  if (!result.multiDatasetResult) return [];
  return filterValidBlocks(result.multiDatasetResult);
}