/**
 * Flexible Excel Parser for nVitro Studio
 * Modular architecture for parsing various Excel data layouts
 */

import { analyzeExcelData, parseConcentration, normalizeConcentration, DetectionResult, CellData, DatasetDetection, DilutionPatternInfo } from './dataDetection';
import { DataPoint, Dataset } from '../types';

export interface ParseOptions {
  forceParsing?: boolean;
  ignoreErrors?: boolean;
  autoConvertUnits?: boolean;
  skipEmptyRows?: boolean;
  defaultUnit?: string;
  customMapping?: ColumnMapping;
  // Enhanced options
  enableMultiDatasetDetection?: boolean;
  selectedDatasetIds?: string[];
  mergeSelectedDatasets?: boolean;
  patternValidationStrict?: boolean;
}

export interface ColumnMapping {
  concentrationColumn: number;
  responseColumns: number[];
  headerRow: number;
  dataStartRow: number;
  sampleNames?: string[];
}

export interface ParseResult {
  success: boolean;
  data: DataPoint[];
  datasets: Dataset[];
  detection: DetectionResult;
  errors: ParseError[];
  warnings: ParseWarning[];
  metadata: ParseMetadata;
  // Enhanced features
  multipleDatasets?: DatasetParseResult[];
  selectedDatasetIds?: string[];
}

// New interface for individual dataset parse results
export interface DatasetParseResult {
  datasetDetection: DatasetDetection;
  data: DataPoint[];
  dataset: Dataset;
  errors: ParseError[];
  warnings: ParseWarning[];
  metadata: Partial<ParseMetadata>;
}

export interface ParseError {
  type: 'critical' | 'recoverable';
  message: string;
  row?: number;
  column?: number;
  originalValue?: any;
  suggestion?: string;
}

export interface ParseWarning {
  message: string;
  row?: number;
  column?: number;
  impact: 'low' | 'medium' | 'high';
}

export interface ParseMetadata {
  totalRows: number;
  dataRows: number;
  emptyRows: number;
  concentrationRange: { min: number; max: number };
  responseColumns: number;
  detectedFormat: string;
  processingTime: number;
}

/**
 * Enhanced flexible parser that adapts to various Excel formats including multi-dataset detection
 */
export async function parseExcelData(
  rawData: any[][],
  options: ParseOptions = {}
): Promise<ParseResult> {
  const startTime = performance.now();
  
  const result: ParseResult = {
    success: false,
    data: [],
    datasets: [],
    detection: {} as DetectionResult,
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
    }
  };

  try {
    // Step 1: Analyze data structure with enhanced detection
    result.detection = analyzeExcelData(rawData);
    
    // Step 2: Handle multiple datasets if detected
    if (result.detection.multipleDatasets && 
        result.detection.multipleDatasets.length > 1 && 
        options.enableMultiDatasetDetection !== false) {
      
      const multiDatasetResult = await parseMultipleDatasets(
        rawData, 
        result.detection.multipleDatasets, 
        options
      );
      
      result.multipleDatasets = multiDatasetResult.datasetResults;
      result.errors.push(...multiDatasetResult.errors);
      result.warnings.push(...multiDatasetResult.warnings);
      
      // If specific datasets are selected, use only those
      if (options.selectedDatasetIds && options.selectedDatasetIds.length > 0) {
        const selectedResults = multiDatasetResult.datasetResults.filter(dr => 
          options.selectedDatasetIds!.includes(dr.datasetDetection.id)
        );
        
        if (options.mergeSelectedDatasets) {
          // Merge selected datasets into one
          const mergedResult = mergeDatasetResults(selectedResults);
          result.data = mergedResult.data;
          result.datasets = [mergedResult.dataset];
        } else {
          // Use all selected datasets separately
          result.data = selectedResults.flatMap(dr => dr.data);
          result.datasets = selectedResults.map(dr => dr.dataset);
        }
        
        result.success = selectedResults.every(dr => dr.errors.filter(e => e.type === 'critical').length === 0);
      } else {
        // Use primary dataset only (highest confidence)
        const primaryResult = multiDatasetResult.datasetResults[0];
        if (primaryResult) {
          result.data = primaryResult.data;
          result.datasets = [primaryResult.dataset];
          result.success = primaryResult.errors.filter(e => e.type === 'critical').length === 0;
        }
      }
      
      result.selectedDatasetIds = options.selectedDatasetIds;
    } else {
      // Step 3: Single dataset processing - apply custom mapping if provided
      if (options.customMapping) {
        applyCustomMapping(result.detection, options.customMapping);
      }
      
      // Step 4: Validate detection results
      const validationResult = validateDetection(result.detection, options);
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);
      
      // Step 5: Proceed with parsing if validation passes or forced
      if (validationResult.canProceed || options.forceParsing) {
        const parseResult = await parseDetectedData(rawData, result.detection, options);
        result.data = parseResult.data;
        result.datasets = parseResult.datasets;
        result.errors.push(...parseResult.errors);
        result.warnings.push(...parseResult.warnings);
        result.success = parseResult.success;
      }
    }
    
    // Step 6: Generate metadata
    result.metadata = generateMetadata(rawData, result.detection, result.data);
    result.metadata.processingTime = performance.now() - startTime;
    
  } catch (error) {
    result.errors.push({
      type: 'critical',
      message: `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Please check the file format and try again'
    });
  }

  return result;
}

/**
 * Applies custom column mapping to override detection
 */
function applyCustomMapping(detection: DetectionResult, mapping: ColumnMapping): void {
  detection.concentrationColumn = mapping.concentrationColumn;
  detection.responseColumns = mapping.responseColumns;
  detection.headerRow = mapping.headerRow;
  detection.dataStartRow = mapping.dataStartRow;
  
  // Clear detection issues since user has manually configured
  detection.issues = detection.issues.filter(issue => issue.type !== 'error');
  detection.confidence = 1.0; // User configuration is trusted
}

/**
 * Validates detection results and determines if parsing can proceed
 */
function validateDetection(detection: DetectionResult, options: ParseOptions): {
  canProceed: boolean;
  errors: ParseError[];
  warnings: ParseWarning[];
} {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  let canProceed = true;

  // Convert detection issues to parse errors/warnings
  detection.issues.forEach(issue => {
    if (issue.type === 'error') {
      errors.push({
        type: 'critical',
        message: issue.message,
        row: issue.row,
        column: issue.column,
        suggestion: issue.suggestion
      });
      canProceed = false;
    } else if (issue.type === 'warning') {
      warnings.push({
        message: issue.message,
        row: issue.row,
        column: issue.column,
        impact: 'medium'
      });
    }
  });

  // Additional validation
  if (detection.confidence < 0.5 && !options.forceParsing) {
    errors.push({
      type: 'critical',
      message: `Low confidence in data structure detection (${(detection.confidence * 100).toFixed(1)}%)`,
      suggestion: 'Consider using manual column mapping or providing a more standard Excel format'
    });
    canProceed = false;
  }

  return { canProceed, errors, warnings };
}

/**
 * Parses the data based on detection results
 */
async function parseDetectedData(
  rawData: any[][],
  detection: DetectionResult,
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
        const dataPoint = parseDataRow(row, rowIndex, detection, sampleNames, options);
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
      id: `parsed-${Date.now()}`,
      name: 'Imported Dataset',
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
      message: `Data parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
 * Extracts sample names from the header row
 */
function extractSampleNames(rawData: any[][], detection: DetectionResult): string[] {
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
 * Parses a single data row into a DataPoint
 */
function parseDataRow(
  row: any[],
  rowIndex: number,
  detection: DetectionResult,
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

  // Parse concentration
  const concentrationInfo = parseConcentration(concentrationCell);
  if (!concentrationInfo.isValid) {
    throw new Error(`Invalid concentration value: ${concentrationCell}`);
  }

  // Convert to normalized unit if requested
  let concentrationValue = concentrationInfo.value;
  if (options.autoConvertUnits) {
    concentrationValue = normalizeConcentration(concentrationInfo);
    if (isNaN(concentrationValue)) {
      throw new Error(`Could not convert concentration unit: ${concentrationInfo.unit}`);
    }
  }

  // Extract response values
  const responses: number[] = [];
  detection.responseColumns.forEach((colIndex, index) => {
    if (colIndex < row.length) {
      const responseCell = row[colIndex];
      
      if (responseCell === null || responseCell === undefined || responseCell === '') {
        responses.push(NaN); // Mark as missing data
      } else {
        const numValue = typeof responseCell === 'number' ? responseCell : parseFloat(String(responseCell));
        if (isNaN(numValue)) {
          throw new Error(`Invalid response value in column ${colIndex + 1}: ${responseCell}`);
        }
        responses.push(numValue);
      }
    } else {
      responses.push(NaN); // Missing column
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
    sampleNames: [...sampleNames] // Copy to avoid reference issues
  };
}

/**
 * Generates metadata about the parsing process
 */
function generateMetadata(
  rawData: any[][],
  detection: DetectionResult,
  parsedData: DataPoint[]
): ParseMetadata {
  const emptyRows = rawData.filter(row => !row || row.length === 0 || row.every(cell => 
    cell === null || cell === undefined || cell === ''
  )).length;

  let concentrationRange = { min: Infinity, max: -Infinity };
  if (parsedData.length > 0) {
    const concentrations = parsedData.map(dp => dp.concentration).filter(c => !isNaN(c));
    if (concentrations.length > 0) {
      concentrationRange = {
        min: Math.min(...concentrations),
        max: Math.max(...concentrations)
      };
    }
  }

  return {
    totalRows: rawData.length,
    dataRows: parsedData.length,
    emptyRows,
    concentrationRange,
    responseColumns: detection.responseColumns.length,
    detectedFormat: detection.detectedLayout,
    processingTime: 0 // Will be set by caller
  };
}

/**
 * Utility function to create custom mapping for manual override
 */
export function createCustomMapping(
  concentrationColumn: number,
  responseColumns: number[],
  headerRow: number = 0,
  dataStartRow?: number
): ColumnMapping {
  return {
    concentrationColumn,
    responseColumns,
    headerRow,
    dataStartRow: dataStartRow ?? headerRow + 1
  };
}

/**
 * Parses multiple detected datasets
 */
async function parseMultipleDatasets(
  rawData: any[][],
  datasetDetections: DatasetDetection[],
  options: ParseOptions
): Promise<{
  datasetResults: DatasetParseResult[];
  errors: ParseError[];
  warnings: ParseWarning[];
}> {
  const datasetResults: DatasetParseResult[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  for (const detection of datasetDetections) {
    try {
      // Extract the data block for this dataset
      const blockData = extractDatasetBlock(rawData, detection);
      
      // Parse this individual dataset
      const parseResult = await parseDatasetBlock(blockData, detection, options);
      
      datasetResults.push({
        datasetDetection: detection,
        data: parseResult.data,
        dataset: {
          id: detection.id,
          name: detection.name,
          data: parseResult.data,
          assayType: 'Dose-Response'
        },
        errors: parseResult.errors,
        warnings: parseResult.warnings,
        metadata: {
          totalRows: blockData.length,
          dataRows: parseResult.data.length,
          responseColumns: detection.responseColumns.length,
          detectedFormat: 'multi-block'
        }
      });
      
      errors.push(...parseResult.errors);
      warnings.push(...parseResult.warnings);
      
    } catch (error) {
      const parseError: ParseError = {
        type: 'critical',
        message: `Failed to parse dataset ${detection.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check the dataset structure and try again'
      };
      errors.push(parseError);
    }
  }

  return { datasetResults, errors, warnings };
}

/**
 * Extracts a dataset block from raw data
 */
function extractDatasetBlock(rawData: any[][], detection: DatasetDetection): any[][] {
  const block: any[][] = [];
  const bounds = detection.boundingBox;
  
  for (let row = bounds.startRow; row <= bounds.endRow && row < rawData.length; row++) {
    const blockRow: any[] = [];
    const sourceRow = rawData[row] || [];
    
    for (let col = bounds.startColumn; col <= bounds.endColumn; col++) {
      blockRow.push(sourceRow[col] || '');
    }
    
    block.push(blockRow);
  }
  
  return block;
}

/**
 * Parses a single dataset block
 */
async function parseDatasetBlock(
  blockData: any[][],
  detection: DatasetDetection,
  options: ParseOptions
): Promise<{
  data: DataPoint[];
  errors: ParseError[];
  warnings: ParseWarning[];
}> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const dataPoints: DataPoint[] = [];

  // Adjust detection coordinates to block-relative positions
  const relativeHeaderRow = detection.headerRow - detection.boundingBox.startRow;
  const relativeConcentrationColumn = detection.concentrationColumn - detection.boundingBox.startColumn;
  const relativeResponseColumns = detection.responseColumns.map(col => 
    col - detection.boundingBox.startColumn
  );
  const relativeDataStartRow = detection.dataStartRow - detection.boundingBox.startRow;

  // Extract sample names
  const sampleNames = extractSampleNamesFromBlock(blockData, relativeHeaderRow, relativeResponseColumns);
  
  // Parse each data row
  for (let rowIndex = relativeDataStartRow; rowIndex < blockData.length; rowIndex++) {
    const row = blockData[rowIndex];
    
    if (!row || row.length === 0) {
      if (!options.skipEmptyRows) {
        warnings.push({
          message: `Empty row at row ${rowIndex + 1} in dataset ${detection.name}`,
          row: rowIndex,
          impact: 'low'
        });
      }
      continue;
    }

    try {
      const dataPoint = parseDataRowFromBlock(
        row, 
        rowIndex, 
        relativeConcentrationColumn,
        relativeResponseColumns,
        sampleNames, 
        options
      );
      
      if (dataPoint) {
        dataPoints.push(dataPoint);
      }
    } catch (error) {
      const parseError: ParseError = {
        type: options.ignoreErrors ? 'recoverable' : 'critical',
        message: `Failed to parse row ${rowIndex + 1} in dataset ${detection.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        row: rowIndex,
        suggestion: 'Check for invalid data types or missing values'
      };
      
      errors.push(parseError);
      
      if (!options.ignoreErrors) {
        break;
      }
    }
  }

  return { data: dataPoints, errors, warnings };
}

/**
 * Extracts sample names from a block header
 */
function extractSampleNamesFromBlock(
  blockData: any[][], 
  headerRow: number, 
  responseColumns: number[]
): string[] {
  const sampleNames: string[] = [];
  
  if (headerRow >= 0 && headerRow < blockData.length) {
    const headerRowData = blockData[headerRow];
    
    responseColumns.forEach((colIndex, index) => {
      if (colIndex < headerRowData.length) {
        const cellValue = headerRowData[colIndex];
        sampleNames.push(cellValue ? String(cellValue) : `Sample ${index + 1}`);
      } else {
        sampleNames.push(`Sample ${index + 1}`);
      }
    });
  } else {
    responseColumns.forEach((_, index) => {
      sampleNames.push(`Sample ${index + 1}`);
    });
  }
  
  return sampleNames;
}

/**
 * Parses a single data row from a block
 */
function parseDataRowFromBlock(
  row: any[],
  rowIndex: number,
  concentrationColumn: number,
  responseColumns: number[],
  sampleNames: string[],
  options: ParseOptions
): DataPoint | null {
  // Extract concentration value
  const concentrationCell = row[concentrationColumn];
  if (concentrationCell === null || concentrationCell === undefined || concentrationCell === '') {
    if (!options.skipEmptyRows) {
      throw new Error(`Missing concentration value`);
    }
    return null;
  }

  // Parse concentration
  const concentrationInfo = parseConcentration(concentrationCell);
  if (!concentrationInfo.isValid) {
    throw new Error(`Invalid concentration value: ${concentrationCell}`);
  }

  // Convert to normalized unit if requested
  let concentrationValue = concentrationInfo.value;
  if (options.autoConvertUnits) {
    concentrationValue = normalizeConcentration(concentrationInfo);
    if (isNaN(concentrationValue)) {
      throw new Error(`Could not convert concentration unit: ${concentrationInfo.unit}`);
    }
  }

  // Extract response values
  const responses: number[] = [];
  responseColumns.forEach((colIndex) => {
    if (colIndex < row.length) {
      const responseCell = row[colIndex];
      
      if (responseCell === null || responseCell === undefined || responseCell === '') {
        responses.push(NaN); // Mark as missing data
      } else {
        const numValue = typeof responseCell === 'number' ? responseCell : parseFloat(String(responseCell));
        if (isNaN(numValue)) {
          throw new Error(`Invalid response value in column ${colIndex + 1}: ${responseCell}`);
        }
        responses.push(numValue);
      }
    } else {
      responses.push(NaN); // Missing column
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
    sampleNames: [...sampleNames] // Copy to avoid reference issues
  };
}

/**
 * Merges multiple dataset results into a single dataset
 */
function mergeDatasetResults(datasetResults: DatasetParseResult[]): {
  data: DataPoint[];
  dataset: Dataset;
} {
  const mergedData: DataPoint[] = [];
  const mergedName = datasetResults.map(dr => dr.datasetDetection.name).join(' + ');
  
  // Combine all data points
  datasetResults.forEach((result, datasetIndex) => {
    result.data.forEach(dataPoint => {
      // Prefix sample names with dataset identifier to avoid conflicts
      const prefixedSampleNames = dataPoint.sampleNames.map(name => 
        `${datasetResults[datasetIndex].datasetDetection.name}_${name}`
      );
      
      mergedData.push({
        ...dataPoint,
        sampleNames: prefixedSampleNames
      });
    });
  });

  const mergedDataset: Dataset = {
    id: `merged-${Date.now()}`,
    name: mergedName,
    data: mergedData,
    assayType: 'Dose-Response'
  };

  return { data: mergedData, dataset: mergedDataset };
}

/**
 * Utility function to validate custom mapping
 */
export function validateCustomMapping(
  mapping: ColumnMapping,
  totalColumns: number,
  totalRows: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (mapping.concentrationColumn < 0 || mapping.concentrationColumn >= totalColumns) {
    errors.push(`Concentration column ${mapping.concentrationColumn} is out of range (0-${totalColumns - 1})`);
  }

  mapping.responseColumns.forEach((col, index) => {
    if (col < 0 || col >= totalColumns) {
      errors.push(`Response column ${index + 1} (${col}) is out of range (0-${totalColumns - 1})`);
    }
    if (col === mapping.concentrationColumn) {
      errors.push(`Response column ${index + 1} cannot be the same as concentration column`);
    }
  });

  if (mapping.headerRow < 0 || mapping.headerRow >= totalRows) {
    errors.push(`Header row ${mapping.headerRow} is out of range (0-${totalRows - 1})`);
  }

  if (mapping.dataStartRow < 0 || mapping.dataStartRow >= totalRows) {
    errors.push(`Data start row ${mapping.dataStartRow} is out of range (0-${totalRows - 1})`);
  }

  if (mapping.dataStartRow <= mapping.headerRow) {
    errors.push('Data start row must be after header row');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}