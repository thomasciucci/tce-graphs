/**
 * Enhanced Parser for nVitro Studio
 * Integrates pattern-based detection with multi-dataset support
 */

import { DataPoint, Dataset } from '../types';
import { ParseOptions, ParseResult, ParseError, ParseWarning, ParseMetadata, ColumnMapping } from './flexibleParser';
import { 
  analyzeExcelDataEnhanced, 
  EnhancedDetectionResult, 
  EnhancedDetectionOptions,
  hasMultipleDatasets,
  getValidDataBlocks
} from './enhancedDetection';
import { DataBlock } from './multiDatasetDetection';
import { ConcentrationAnalysis, DilutionPattern } from './dilutionPatterns';
import { parseConcentration, normalizeConcentration } from './dataDetection';

export interface EnhancedParseOptions extends ParseOptions {
  enableMultiDataset?: boolean;
  prioritizePatterns?: boolean;
  minPatternConfidence?: number;
  autoSelectBestBlock?: boolean;
  detectionOptions?: EnhancedDetectionOptions;
}

export interface EnhancedParseResult extends ParseResult {
  enhancedDetection: EnhancedDetectionResult;
  multiDatasetResults?: DatasetBlockResult[];
  concentrationAnalysis?: ConcentrationAnalysis;
  dilutionPattern?: DilutionPattern;
  recommendedAction: 'single_import' | 'multi_select' | 'manual_review' | 'retry_format';
}

export interface DatasetBlockResult {
  block: DataBlock;
  parseResult: ParseResult;
  confidence: number;
  isRecommended: boolean;
}

/**
 * Enhanced parsing with pattern recognition and multi-dataset support
 */
export async function parseExcelDataEnhanced(
  rawData: any[][],
  options: EnhancedParseOptions = {}
): Promise<EnhancedParseResult> {
  const startTime = performance.now();
  
  const defaultOptions: EnhancedParseOptions = {
    autoConvertUnits: true,
    skipEmptyRows: true,
    ignoreErrors: false,
    forceParsing: false,
    enableMultiDataset: true,
    prioritizePatterns: true,
    minPatternConfidence: 0.4,
    autoSelectBestBlock: true,
    detectionOptions: {
      enableMultiDataset: true,
      prioritizePatterns: true,
      minPatternConfidence: 0.4,
      fallbackToKeywords: true
    }
  };

  const opts = { ...defaultOptions, ...options };

  const result: EnhancedParseResult = {
    success: false,
    data: [],
    datasets: [],
    detection: {} as any,
    enhancedDetection: {} as EnhancedDetectionResult,
    errors: [],
    warnings: [],
    metadata: {
      totalRows: rawData.length,
      dataRows: 0,
      emptyRows: 0,
      concentrationRange: { min: Infinity, max: -Infinity },
      responseColumns: 0,
      detectedFormat: 'unknown',
      processingTime: 0
    },
    recommendedAction: 'manual_review'
  };

  try {
    // Step 1: Enhanced detection with pattern analysis
    result.enhancedDetection = analyzeExcelDataEnhanced(rawData, opts.detectionOptions);
    result.detection = result.enhancedDetection; // Backward compatibility
    
    // Extract concentration analysis
    result.concentrationAnalysis = result.enhancedDetection.concentrationAnalysis;
    result.dilutionPattern = result.concentrationAnalysis?.bestPattern || undefined;

    // Step 2: Handle multi-dataset vs single dataset scenarios
    if (hasMultipleDatasets(result.enhancedDetection)) {
      await handleMultiDatasetParsing(result, rawData, opts);
    } else {
      await handleSingleDatasetParsing(result, rawData, opts);
    }

    // Step 3: Determine recommended action
    result.recommendedAction = determineRecommendedAction(result, opts);

    // Step 4: Generate metadata
    result.metadata = generateEnhancedMetadata(rawData, result);
    result.metadata.processingTime = performance.now() - startTime;

  } catch (error) {
    result.errors.push({
      type: 'critical',
      message: `Enhanced parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Try with simpler detection options or manual column mapping'
    });
  }

  return result;
}

/**
 * Handles multi-dataset parsing scenarios
 */
async function handleMultiDatasetParsing(
  result: EnhancedParseResult,
  rawData: any[][],
  options: EnhancedParseOptions
): Promise<void> {
  const validBlocks = getValidDataBlocks(result.enhancedDetection);
  
  if (validBlocks.length === 0) {
    result.errors.push({
      type: 'critical',
      message: 'Multiple data blocks detected but none are valid',
      suggestion: 'Review data format or use manual column mapping'
    });
    return;
  }

  // Parse each valid block
  result.multiDatasetResults = [];
  
  for (const block of validBlocks) {
    try {
      const blockParseResult = await parseDataBlock(block, options);
      
      result.multiDatasetResults.push({
        block,
        parseResult: blockParseResult,
        confidence: block.confidence,
        isRecommended: block.confidence >= (options.minPatternConfidence || 0.4)
      });
    } catch (error) {
      result.warnings.push({
        message: `Failed to parse block ${block.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'medium'
      });
    }
  }

  // If auto-select is enabled, choose the best block
  if (options.autoSelectBestBlock && result.multiDatasetResults.length > 0) {
    const bestResult = result.multiDatasetResults
      .filter(r => r.isRecommended)
      .sort((a, b) => b.confidence - a.confidence)[0];
    
    if (bestResult) {
      result.data = bestResult.parseResult.data;
      result.datasets = bestResult.parseResult.datasets;
      result.success = bestResult.parseResult.success;
      result.errors = [...result.errors, ...bestResult.parseResult.errors];
      result.warnings = [...result.warnings, ...bestResult.parseResult.warnings];
    }
  }
}

/**
 * Handles single dataset parsing
 */
async function handleSingleDatasetParsing(
  result: EnhancedParseResult,
  rawData: any[][],
  options: EnhancedParseOptions
): Promise<void> {
  // Validate detection results
  const validationResult = validateEnhancedDetection(result.enhancedDetection, options);
  result.errors.push(...validationResult.errors);
  result.warnings.push(...validationResult.warnings);
  
  if (!validationResult.canProceed && !options.forceParsing) {
    return;
  }

  // Parse the single dataset
  try {
    const parseResult = await parseDetectedData(rawData, result.enhancedDetection, options);
    result.data = parseResult.data;
    result.datasets = parseResult.datasets;
    result.success = parseResult.success;
    result.errors.push(...parseResult.errors);
    result.warnings.push(...parseResult.warnings);
  } catch (error) {
    result.errors.push({
      type: 'critical',
      message: `Single dataset parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

/**
 * Parses a single data block
 */
async function parseDataBlock(
  block: DataBlock,
  options: EnhancedParseOptions
): Promise<ParseResult> {
  const blockOptions: ParseOptions = {
    autoConvertUnits: options.autoConvertUnits,
    skipEmptyRows: options.skipEmptyRows,
    ignoreErrors: options.ignoreErrors,
    forceParsing: options.forceParsing
  };

  // Convert DetectionResult to EnhancedDetectionResult for compatibility
  const enhancedDetection = {
    ...block.detection,
    patternBasedConfidence: 0.8,
    keywordBasedConfidence: 0.7,
    detectionMethod: 'hybrid' as const
  };
  
  const parseResult = await parseDetectedData(block.data, enhancedDetection, blockOptions);
  return {
    ...parseResult,
    detection: block.detection,
    metadata: {
      totalRows: block.data.length,
      dataRows: block.data.length - (block.detection.dataStartRow || 0),
      emptyRows: 0,
      concentrationRange: { min: 0, max: 100 },
      responseColumns: block.detection.responseColumns.length,
      detectedFormat: 'enhanced',
      processingTime: 0
    }
  };
}

/**
 * Parses data based on enhanced detection results
 */
async function parseDetectedData(
  rawData: any[][],
  detection: EnhancedDetectionResult,
  options: ParseOptions
): Promise<{
  success: boolean;
  data: DataPoint[];
  datasets: Dataset[];
  errors: ParseError[];
  warnings: ParseWarning[];
}> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const dataPoints: DataPoint[] = [];

  try {
    // Extract sample names from header row
    const sampleNames = extractSampleNames(rawData, detection);
    
    // Parse each data row
    for (let rowIndex = detection.dataStartRow; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      
      if (!row || row.length === 0) {
        if (!options.skipEmptyRows) {
          warnings.push({
            message: `Empty row at row ${rowIndex + 1}`,
            row: rowIndex,
            impact: 'low'
          });
        }
        continue;
      }

      try {
        const dataPoint = parseDataRowEnhanced(
          row, 
          rowIndex, 
          detection, 
          sampleNames, 
          options
        );
        if (dataPoint) {
          dataPoints.push(dataPoint);
        }
      } catch (error) {
        const parseError: ParseError = {
          type: options.ignoreErrors ? 'recoverable' : 'critical',
          message: `Failed to parse row ${rowIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          row: rowIndex,
          suggestion: 'Check for invalid data types or missing values'
        };
        
        errors.push(parseError);
        
        if (!options.ignoreErrors) {
          break;
        }
      }
    }

    // Create dataset
    const dataset: Dataset = {
      id: `enhanced-${Date.now()}`,
      name: 'Enhanced Import Dataset',
      data: dataPoints,
      assayType: 'Dose-Response'
    };

    return {
      success: errors.filter(e => e.type === 'critical').length === 0,
      data: dataPoints,
      datasets: [dataset],
      errors,
      warnings
    };

  } catch (error) {
    errors.push({
      type: 'critical',
      message: `Enhanced data parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return {
      success: false,
      data: [],
      datasets: [],
      errors,
      warnings
    };
  }
}

/**
 * Enhanced data row parsing with pattern-aware concentration handling
 */
function parseDataRowEnhanced(
  row: any[],
  rowIndex: number,
  detection: EnhancedDetectionResult,
  sampleNames: string[],
  options: ParseOptions
): DataPoint | null {
  // Extract concentration value
  const concentrationCell = row[detection.concentrationColumn];
  if (concentrationCell === null || concentrationCell === undefined || concentrationCell === '') {
    if (!options.skipEmptyRows) {
      throw new Error(`Missing concentration value`);
    }
    return null;
  }

  // Enhanced concentration parsing using pattern information
  const concentrationInfo = parseConcentration(concentrationCell);
  if (!concentrationInfo.isValid) {
    throw new Error(`Invalid concentration value: ${concentrationCell}`);
  }

  // Use pattern information to improve unit handling
  let concentrationValue = concentrationInfo.value;
  if (options.autoConvertUnits) {
    concentrationValue = normalizeConcentration(concentrationInfo);
    if (isNaN(concentrationValue)) {
      // Try to use pattern-based estimation
      if (detection.concentrationAnalysis?.metadata.estimatedUnit) {
        const estimatedUnit = detection.concentrationAnalysis.metadata.estimatedUnit;
        const fallbackInfo = { ...concentrationInfo, unit: estimatedUnit };
        concentrationValue = normalizeConcentration(fallbackInfo);
      }
      
      if (isNaN(concentrationValue)) {
        throw new Error(`Could not convert concentration unit: ${concentrationInfo.unit}`);
      }
    }
  }

  // Extract response values
  const responses: number[] = [];
  detection.responseColumns.forEach((colIndex) => {
    if (colIndex < row.length) {
      const responseCell = row[colIndex];
      
      if (responseCell === null || responseCell === undefined || responseCell === '') {
        responses.push(NaN);
      } else {
        const numValue = typeof responseCell === 'number' ? responseCell : parseFloat(String(responseCell));
        if (isNaN(numValue)) {
          throw new Error(`Invalid response value in column ${colIndex + 1}: ${responseCell}`);
        }
        responses.push(numValue);
      }
    } else {
      responses.push(NaN);
    }
  });

  // Check if all responses are missing
  const validResponses = responses.filter(r => !isNaN(r));
  if (validResponses.length === 0 && !options.skipEmptyRows) {
    throw new Error('All response values are missing or invalid');
  }

  return {
    concentration: concentrationValue,
    responses,
    sampleNames: [...sampleNames]
  };
}

/**
 * Extract sample names with enhanced header detection
 */
function extractSampleNames(rawData: any[][], detection: EnhancedDetectionResult): string[] {
  const sampleNames: string[] = [];
  
  if (detection.headerRow >= 0 && detection.headerRow < rawData.length) {
    const headerRow = rawData[detection.headerRow];
    
    detection.responseColumns.forEach((colIndex, index) => {
      if (colIndex < headerRow.length) {
        const cellValue = headerRow[colIndex];
        sampleNames.push(cellValue ? String(cellValue) : `Sample ${index + 1}`);
      } else {
        sampleNames.push(`Sample ${index + 1}`);
      }
    });
  } else {
    // Generate default sample names
    detection.responseColumns.forEach((_, index) => {
      sampleNames.push(`Sample ${index + 1}`);
    });
  }
  
  return sampleNames;
}

/**
 * Validates enhanced detection results
 */
function validateEnhancedDetection(
  detection: EnhancedDetectionResult,
  options: EnhancedParseOptions
): {
  canProceed: boolean;
  errors: ParseError[];
  warnings: ParseWarning[];
} {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  let canProceed = true;

  // Check pattern-based detection confidence
  if (detection.patternBasedConfidence < (options.minPatternConfidence || 0.4)) {
    if (detection.detectionMethod === 'pattern') {
      errors.push({
        type: 'critical',
        message: `Low pattern confidence: ${(detection.patternBasedConfidence * 100).toFixed(1)}%`,
        suggestion: 'Consider using manual column mapping or improving data format'
      });
      canProceed = false;
    } else {
      warnings.push({
        message: `Pattern detection confidence low: ${(detection.patternBasedConfidence * 100).toFixed(1)}%`,
        impact: 'medium'
      });
    }
  }

  // Check concentration analysis if available
  if (detection.concentrationAnalysis && !detection.concentrationAnalysis.isValid) {
    warnings.push({
      message: 'Concentration sequence has quality issues',
      impact: 'high'
    });
  }

  // Add detection-specific issues
  detection.issues.forEach(issue => {
    if (issue.type === 'error') {
      errors.push({
        type: 'critical',
        message: issue.message,
        suggestion: issue.suggestion
      });
      canProceed = false;
    } else {
      warnings.push({
        message: issue.message,
        impact: issue.type === 'warning' ? 'medium' : 'low'
      });
    }
  });

  return { canProceed, errors, warnings };
}

/**
 * Determines the recommended action based on parsing results
 */
function determineRecommendedAction(
  result: EnhancedParseResult,
  options: EnhancedParseOptions
): EnhancedParseResult['recommendedAction'] {
  // Critical errors require manual review
  if (result.errors.filter(e => e.type === 'critical').length > 0) {
    return 'manual_review';
  }

  // Multiple datasets detected
  if (result.multiDatasetResults && result.multiDatasetResults.length > 1) {
    const recommendedCount = result.multiDatasetResults.filter(r => r.isRecommended).length;
    if (recommendedCount > 1) {
      return 'multi_select';
    }
  }

  // Single dataset with good confidence
  if (result.enhancedDetection.confidence > 0.7) {
    return 'single_import';
  }

  // Low confidence suggests format issues
  if (result.enhancedDetection.confidence < 0.4) {
    return 'retry_format';
  }

  return 'single_import';
}

/**
 * Generates enhanced metadata
 */
function generateEnhancedMetadata(
  rawData: any[][],
  result: EnhancedParseResult
): ParseMetadata {
  const emptyRows = rawData.filter(row => !row || row.length === 0 || row.every(cell => 
    cell === null || cell === undefined || cell === ''
  )).length;

  let concentrationRange = { min: Infinity, max: -Infinity };
  if (result.data.length > 0) {
    const concentrations = result.data.map(dp => dp.concentration).filter(c => !isNaN(c));
    if (concentrations.length > 0) {
      concentrationRange = {
        min: Math.min(...concentrations),
        max: Math.max(...concentrations)
      };
    }
  }

  return {
    totalRows: rawData.length,
    dataRows: result.data.length,
    emptyRows,
    concentrationRange,
    responseColumns: result.enhancedDetection.responseColumns.length,
    detectedFormat: result.enhancedDetection.detectionMethod === 'pattern' ? 
      'pattern-based' : result.enhancedDetection.detectedLayout,
    processingTime: 0
  };
}