/**
 * Gate Processing Engine for nVitro Studio
 * Processes user-selected gates using existing detection algorithms
 */

import { 
  GateSelection, 
  ProcessedGate, 
  GateAnalysisResult, 
  SpreadsheetData, 
  CellData,
  DataPoint 
} from '../types';
import { analyzeExcelDataEnhanced, EnhancedDetectionResult } from './enhancedDetection';
import { parseConcentration, normalizeConcentration } from './dataDetection';
import { scanForMultipleDatasets, MultiDatasetResult } from './multiDatasetDetection';
import { extractDatasetName, extractAssayType } from './datasetNaming';
import { detectDoseTitrationPatterns, DosePattern } from './dosePatternDetection';

/**
 * Process multiple gates and return analysis results
 */
export async function processGates(
  gates: GateSelection[],
  spreadsheetData: SpreadsheetData
): Promise<GateAnalysisResult[]> {
  const results: GateAnalysisResult[] = [];

  for (const gate of gates) {
    try {
      const processed = await processGate(gate, spreadsheetData);
      results.push({
        gate,
        processed,
        rawData: extractGateData(gate, spreadsheetData.originalData),
      });
    } catch (error) {
      console.error(`Error processing gate ${gate.id}:`, error);
      
      // Create error result
      const errorResult: ProcessedGate = {
        gateId: gate.id,
        isValid: false,
        confidence: 0,
        data: [],
        issues: ['Failed to process this data region. Please check your selection.'],
        autoDetection: {
          concentrationColumn: -1,
          responseColumns: [],
          headerRow: -1,
        },
        suggestedName: gate.name,
      };
      
      results.push({
        gate,
        processed: errorResult,
        rawData: extractGateData(gate, spreadsheetData.originalData),
      });
    }
  }

  return results;
}

/**
 * Process a single gate using enhanced detection
 */
async function processGate(
  gate: GateSelection,
  spreadsheetData: SpreadsheetData
): Promise<ProcessedGate> {
  // Extract raw data for this gate
  const gateRawData = extractGateData(gate, spreadsheetData.originalData);
  
  if (gateRawData.length === 0) {
    throw new Error('No data found in selected region');
  }

  // First, check if this gate contains multiple datasets
  const multiDatasetResult = scanForMultipleDatasets(gateRawData, {
    minRows: 3,
    minCols: 2,
    maxGapRows: 2,
    maxGapCols: 1,
  });

  // If multiple datasets detected within the gate, process the best one or create sub-gates
  if (multiDatasetResult.blocks && multiDatasetResult.blocks.length > 1) {
    console.log(`Gate ${gate.id} contains ${multiDatasetResult.blocks.length} blocks`);
    
    // For now, take the highest confidence block
    // TODO: In future, we could split this into multiple ProcessedGates
    const bestBlock = multiDatasetResult.blocks
      .filter(block => block.confidence > 0.4)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (bestBlock) {
      const processed: ProcessedGate = {
        gateId: gate.id,
        isValid: true,
        confidence: bestBlock.confidence,
        data: [],
        issues: [], // DataBlock doesn't have issues property
        autoDetection: {
          concentrationColumn: bestBlock.detection.concentrationColumn,
          responseColumns: bestBlock.detection.responseColumns,
          headerRow: bestBlock.detection.headerRow,
          replicatePattern: bestBlock.concentrationAnalysis?.bestPattern?.type || undefined,
        },
        suggestedName: generateSuggestedNameFromDataset(gate, bestBlock, gateRawData),
      };

      // Parse data from the best block's bounding box
      const blockRawData = extractDatasetFromGate(gateRawData, bestBlock);
      
      try {
        processed.data = parseDatasetData(blockRawData, bestBlock);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        processed.isValid = false;
        processed.issues.push('Could not parse concentration-response data from detected dataset.');
      }

      return processed;
    }
  }

  // Check for horizontal matrix patterns (e.g., concentrations in top row, samples in left column)
  const dosePatterns = detectDoseTitrationPatterns(gateRawData);
  const horizontalPattern = dosePatterns.find(p => p.patternType === 'horizontal-matrix' && p.confidence > 0.5);
  
  if (horizontalPattern) {
    const processed: ProcessedGate = {
      gateId: gate.id,
      isValid: true,
      confidence: horizontalPattern.confidence,
      data: [],
      issues: [],
      autoDetection: {
        concentrationColumn: 0, // Concentrations in header row
        responseColumns: [], // Will be determined by parseHorizontalMatrixData
        headerRow: 0,
        replicatePattern: horizontalPattern.biologicalMetrics?.dilutionType || undefined,
      },
      suggestedName: generateSuggestedNameFromPattern(gate, horizontalPattern, gateRawData),
    };
    
    try {
      processed.data = parseHorizontalMatrixData(gateRawData, horizontalPattern);
    } catch (parseError) {
      console.error('Horizontal matrix parse error:', parseError);
      processed.isValid = false;
      processed.issues.push('Could not parse horizontal matrix data from this region.');
    }
    
    return processed;
  }

  // Fallback to single dataset detection
  const detectionResult = analyzeExcelDataEnhanced(gateRawData, {
    enableMultiDataset: true, // Enable multi-dataset detection
    prioritizePatterns: true,
    minPatternConfidence: 0.3,
    fallbackToKeywords: true,
  });

  // Convert detection result to our format
  const processed: ProcessedGate = {
    gateId: gate.id,
    isValid: detectionResult.confidence > 0.3,
    confidence: detectionResult.confidence,
    data: [], // Will be populated by parseGateData
    issues: convertIssuesForUser(detectionResult.issues),
    autoDetection: {
      concentrationColumn: detectionResult.concentrationColumn,
      responseColumns: detectionResult.responseColumns,
      headerRow: detectionResult.headerRow,
      replicatePattern: undefined, // Pattern type not available in single detection
    },
    suggestedName: generateSuggestedName(gate, detectionResult, gateRawData),
  };

  // Parse the actual data points if detection was successful
  if (processed.isValid && detectionResult.confidence > 0.3) {
    try {
      processed.data = parseGateData(gateRawData, detectionResult);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      processed.isValid = false;
      processed.issues.push('Could not parse concentration-response data from this region.');
    }
  }

  return processed;
}

/**
 * Extract raw data from spreadsheet for a specific gate
 */
function extractGateData(gate: GateSelection, originalData: any[][]): any[][] {
  const { boundingBox } = gate;
  const result: any[][] = [];

  for (let row = boundingBox.startRow; row <= boundingBox.endRow; row++) {
    if (row < originalData.length) {
      const rowData = [];
      for (let col = boundingBox.startColumn; col <= boundingBox.endColumn; col++) {
        if (col < (originalData[row]?.length || 0)) {
          rowData.push(originalData[row][col]);
        } else {
          rowData.push(null);
        }
      }
      result.push(rowData);
    }
  }

  return result;
}

/**
 * Parse gate data into DataPoint array
 */
function parseGateData(gateRawData: any[][], detectionResult: EnhancedDetectionResult): DataPoint[] {
  const dataPoints: DataPoint[] = [];
  const { headerRow, concentrationColumn, responseColumns, dataStartRow } = detectionResult;

  // Get sample names from header row
  const sampleNames = responseColumns.map(col => {
    const headerValue = gateRawData[headerRow]?.[col];
    return headerValue ? String(headerValue).trim() : `Sample ${col + 1}`;
  });

  // Process each data row
  for (let row = dataStartRow; row < gateRawData.length; row++) {
    const rowData = gateRawData[row];
    if (!rowData || rowData.length === 0) continue;

    // Parse concentration
    const concentrationValue = rowData[concentrationColumn];
    if (concentrationValue == null || concentrationValue === '') continue;

    const concentrationInfo = parseConcentration(concentrationValue);
    if (!concentrationInfo.isValid) continue;
    
    const concentration = normalizeConcentration(concentrationInfo);
    if (concentration <= 0 || isNaN(concentration)) continue;

    // Parse responses
    const responses: number[] = [];
    const validSampleNames: string[] = [];

    for (let i = 0; i < responseColumns.length; i++) {
      const col = responseColumns[i];
      const responseValue = rowData[col];
      
      if (responseValue != null && responseValue !== '') {
        const numericResponse = typeof responseValue === 'number' 
          ? responseValue 
          : parseFloat(String(responseValue));
          
        if (!isNaN(numericResponse)) {
          responses.push(numericResponse);
          validSampleNames.push(sampleNames[i]);
        }
      }
    }

    // Only add data point if we have valid responses
    if (responses.length > 0) {
      dataPoints.push({
        concentration,
        responses,
        sampleNames: validSampleNames,
      });
    }
  }

  // Sort by concentration
  dataPoints.sort((a, b) => a.concentration - b.concentration);

  return dataPoints;
}

/**
 * Convert technical detection issues to user-friendly messages
 */
function convertIssuesForUser(issues: any[]): string[] {
  const userFriendlyMessages: string[] = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'error':
        if (issue.message.includes('concentration')) {
          userFriendlyMessages.push('Could not find concentration data in this region.');
        } else if (issue.message.includes('response')) {
          userFriendlyMessages.push('Could not find response data in this region.');
        } else {
          userFriendlyMessages.push('This region does not appear to contain dose-response data.');
        }
        break;
        
      case 'warning':
        if (issue.message.includes('missing')) {
          userFriendlyMessages.push('Some data points may be missing or incomplete.');
        } else if (issue.message.includes('irregular')) {
          userFriendlyMessages.push('Concentration pattern appears irregular - please verify.');
        }
        break;
        
      default:
        // Skip info messages to keep UI simple
        continue;
    }
  }

  return userFriendlyMessages;
}

/**
 * Extract dataset data from gate using dataset bounding box
 */
function extractDatasetFromGate(gateRawData: any[][], dataset: any): any[][] {
  const result: any[][] = [];
  const { boundingBox } = dataset;

  for (let row = boundingBox.startRow; row <= boundingBox.endRow; row++) {
    if (row < gateRawData.length) {
      const rowData = [];
      for (let col = boundingBox.startColumn; col <= boundingBox.endColumn; col++) {
        if (col < (gateRawData[row]?.length || 0)) {
          rowData.push(gateRawData[row][col]);
        } else {
          rowData.push(null);
        }
      }
      result.push(rowData);
    }
  }

  return result;
}

/**
 * Parse dataset data using dataset detection info
 */
function parseDatasetData(datasetRawData: any[][], dataset: any): DataPoint[] {
  const dataPoints: DataPoint[] = [];
  const { headerRow, concentrationColumn, responseColumns } = dataset;

  // Get sample names from header row
  const sampleNames = responseColumns.map((col: number) => {
    const headerValue = datasetRawData[headerRow]?.[col];
    return headerValue ? String(headerValue).trim() : `Sample ${col + 1}`;
  });

  // Process each data row
  for (let row = headerRow + 1; row < datasetRawData.length; row++) {
    const rowData = datasetRawData[row];
    if (!rowData || rowData.length === 0) continue;

    // Parse concentration
    const concentrationValue = rowData[concentrationColumn];
    if (concentrationValue == null || concentrationValue === '') continue;

    const concentrationInfo = parseConcentration(concentrationValue);
    if (!concentrationInfo.isValid) continue;
    
    const concentration = normalizeConcentration(concentrationInfo);
    if (concentration <= 0 || isNaN(concentration)) continue;

    // Parse responses
    const responses: number[] = [];
    const validSampleNames: string[] = [];

    for (let i = 0; i < responseColumns.length; i++) {
      const col = responseColumns[i];
      const responseValue = rowData[col];
      
      if (responseValue != null && responseValue !== '') {
        const numericResponse = typeof responseValue === 'number' 
          ? responseValue 
          : parseFloat(String(responseValue));
          
        if (!isNaN(numericResponse)) {
          responses.push(numericResponse);
          validSampleNames.push(sampleNames[i]);
        }
      }
    }

    // Only add data point if we have valid responses
    if (responses.length > 0) {
      dataPoints.push({
        concentration,
        responses,
        sampleNames: validSampleNames,
      });
    }
  }

  // Sort by concentration
  dataPoints.sort((a, b) => a.concentration - b.concentration);

  return dataPoints;
}

/**
 * Generate a suggested name from dataset detection
 */
function generateSuggestedNameFromDataset(gate: GateSelection, dataset: any, rawData?: any[][]): string {
  const baseName = gate.name;
  
  // First try smart naming based on content
  if (rawData) {
    const smartName = extractDatasetName(rawData);
    if (smartName && smartName !== 'Dataset') {
      // Check number of samples
      const sampleCount = dataset.responseColumns?.length || 0;
      if (sampleCount > 1) {
        return `${smartName} (${sampleCount} samples)`;
      }
      return smartName;
    }
  }
  
  if (dataset.name && dataset.name !== 'Unknown') {
    return dataset.name;
  }
  
  // Check number of samples
  const sampleCount = dataset.responseColumns?.length || 0;
  if (sampleCount > 1) {
    return `${baseName} (${sampleCount} samples)`;
  }

  // Check dilution pattern
  if (dataset.dilutionPattern && dataset.dilutionPattern.type !== 'unknown') {
    return `${baseName} (${dataset.dilutionPattern.type})`;
  }

  return baseName;
}

/**
 * Generate a suggested name for the dataset based on detection results
 */
function generateSuggestedName(gate: GateSelection, detectionResult: EnhancedDetectionResult, rawData?: any[][]): string {
  // First try smart naming based on content
  if (rawData) {
    const smartName = extractDatasetName(rawData);
    if (smartName && smartName !== 'Dataset') {
      // Add sample count if multiple columns
      const sampleCount = detectionResult.responseColumns.length;
      if (sampleCount > 1) {
        return `${smartName} (${sampleCount} samples)`;
      }
      return smartName;
    }
  }
  
  // Simple detection-based naming

  // Check number of samples
  const sampleCount = detectionResult.responseColumns.length;
  if (sampleCount > 1) {
    return `${gate.name} (${sampleCount} samples)`;
  }

  // Fallback to original name
  return gate.name;
}

/**
 * Utility function to preview gate data for validation
 */
export function previewGateData(gate: GateSelection, spreadsheetData: SpreadsheetData): any[][] {
  return extractGateData(gate, spreadsheetData.originalData);
}

/**
 * Utility function to validate if gate contains meaningful data
 */
export function validateGateSelection(gate: GateSelection, spreadsheetData: SpreadsheetData): {
  isValid: boolean;
  issues: string[];
} {
  const gateData = extractGateData(gate, spreadsheetData.originalData);
  const issues: string[] = [];

  // Check minimum size
  if (gateData.length < 3) {
    issues.push('Selection too small - need at least 3 rows for dose-response analysis.');
  }

  if (gateData[0]?.length < 2) {
    issues.push('Selection too narrow - need at least 2 columns (concentration + response).');
  }

  // Check if there's any data
  let hasData = false;
  for (const row of gateData) {
    for (const cell of row) {
      if (cell != null && cell !== '') {
        hasData = true;
        break;
      }
    }
    if (hasData) break;
  }

  if (!hasData) {
    issues.push('Selected region appears to be empty.');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Parse horizontal matrix data where concentrations are in the top row and samples are in the left column
 */
function parseHorizontalMatrixData(gateRawData: any[][], pattern: DosePattern): DataPoint[] {
  const dataPoints: DataPoint[] = [];
  
  if (gateRawData.length < 2 || !gateRawData[0] || gateRawData[0].length < 2) {
    throw new Error('Insufficient data for horizontal matrix parsing');
  }
  
  // Extract concentrations from the first row (skip first cell which is often empty or label)
  const concentrationRow = gateRawData[0];
  const concentrations: number[] = [];
  const concentrationIndices: number[] = [];
  
  for (let col = 1; col < concentrationRow.length; col++) {
    const cellValue = concentrationRow[col];
    if (cellValue != null && cellValue !== '') {
      const concentrationInfo = parseConcentration(cellValue);
      if (concentrationInfo.isValid) {
        const concentration = normalizeConcentration(concentrationInfo);
        if (concentration > 0 && !isNaN(concentration)) {
          concentrations.push(concentration);
          concentrationIndices.push(col);
        }
      }
    }
  }
  
  if (concentrations.length === 0) {
    throw new Error('No valid concentrations found in header row');
  }
  
  // Extract sample names from the first column (skip header row)
  const sampleNames: string[] = [];
  const sampleRows: number[] = [];
  
  for (let row = 1; row < gateRawData.length; row++) {
    const rowData = gateRawData[row];
    if (rowData && rowData[0] != null && rowData[0] !== '') {
      sampleNames.push(String(rowData[0]).trim());
      sampleRows.push(row);
    }
  }
  
  if (sampleNames.length === 0) {
    throw new Error('No valid sample names found in first column');
  }
  
  // Parse data matrix - each concentration becomes a DataPoint with responses from all samples
  for (let concIndex = 0; concIndex < concentrations.length; concIndex++) {
    const concentration = concentrations[concIndex];
    const colIndex = concentrationIndices[concIndex];
    const responses: number[] = [];
    const validSampleNames: string[] = [];
    
    // Collect responses from all sample rows for this concentration
    for (let sampleIndex = 0; sampleIndex < sampleRows.length; sampleIndex++) {
      const rowIndex = sampleRows[sampleIndex];
      const responseValue = gateRawData[rowIndex]?.[colIndex];
      
      if (responseValue != null && responseValue !== '') {
        const numericResponse = typeof responseValue === 'number' 
          ? responseValue 
          : parseFloat(String(responseValue));
          
        if (!isNaN(numericResponse)) {
          responses.push(numericResponse);
          validSampleNames.push(sampleNames[sampleIndex]);
        }
      }
    }
    
    // Only add data point if we have valid responses
    if (responses.length > 0) {
      dataPoints.push({
        concentration,
        responses,
        sampleNames: validSampleNames,
      });
    }
  }
  
  // Sort by concentration
  dataPoints.sort((a, b) => a.concentration - b.concentration);
  
  return dataPoints;
}

/**
 * Generate a suggested name from dose pattern detection
 */
function generateSuggestedNameFromPattern(gate: GateSelection, pattern: DosePattern, rawData?: any[][]): string {
  const baseName = gate.name;
  
  // First try smart naming based on content
  if (rawData) {
    const smartName = extractDatasetName(rawData);
    if (smartName && smartName !== 'Dataset') {
      return smartName;
    }
  }
  
  // Use pattern-specific naming
  if (pattern.patternType === 'horizontal-matrix') {
    const metrics = pattern.biologicalMetrics;
    if (metrics?.plateFormat) {
      return `${baseName} (${metrics.plateFormat})`;
    }
    if (metrics?.dilutionType) {
      return `${baseName} (${metrics.dilutionType})`;
    }
    return `${baseName} (Matrix)`;
  }
  
  return baseName;
}