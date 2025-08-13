/**
 * Error Recovery and Data Repair Utilities for nVitro Studio
 * Provides intelligent error recovery and data cleaning capabilities
 */

import { DetectionResult, CellData, parseConcentration, normalizeConcentration } from './dataDetection';
import { ParseError, ParseWarning } from './flexibleParser';

export interface RecoveryOptions {
  attemptConcentrationRepair?: boolean;
  attemptResponseRepair?: boolean;
  fillMissingConcentrations?: boolean;
  interpolateResponses?: boolean;
  removeIncompleteRows?: boolean;
  maxErrorThreshold?: number; // 0-1, fraction of rows that can have errors
}

export interface RecoveryResult {
  success: boolean;
  repairedData: any[][];
  repairActions: RepairAction[];
  remainingErrors: ParseError[];
  remainingWarnings: ParseWarning[];
  recoveryReport: RecoveryReport;
}

export interface RepairAction {
  type: 'concentration_repair' | 'response_repair' | 'row_removal' | 'data_interpolation' | 'unit_conversion';
  description: string;
  row: number;
  column?: number;
  originalValue: any;
  repairedValue: any;
  confidence: number; // 0-1
}

export interface RecoveryReport {
  totalRows: number;
  repairedRows: number;
  removedRows: number;
  unrepairedErrors: number;
  repairSuccess: boolean;
  recommendations: string[];
}

/**
 * Attempts to automatically repair common data issues
 */
export async function attemptDataRecovery(
  rawData: any[][],
  detection: DetectionResult,
  errors: ParseError[],
  options: RecoveryOptions = {}
): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    success: false,
    repairedData: JSON.parse(JSON.stringify(rawData)), // Deep copy
    repairActions: [],
    remainingErrors: [...errors],
    remainingWarnings: [],
    recoveryReport: {
      totalRows: rawData.length,
      repairedRows: 0,
      removedRows: 0,
      unrepairedErrors: errors.length,
      repairSuccess: false,
      recommendations: []
    }
  };

  try {
    // Step 1: Attempt concentration column repairs
    if (options.attemptConcentrationRepair) {
      await repairConcentrationValues(result, detection, options);
    }

    // Step 2: Attempt response column repairs
    if (options.attemptResponseRepair) {
      await repairResponseValues(result, detection, options);
    }

    // Step 3: Handle missing data
    if (options.fillMissingConcentrations) {
      await fillMissingConcentrations(result, detection, options);
    }

    if (options.interpolateResponses) {
      await interpolateResponseValues(result, detection, options);
    }

    // Step 4: Remove severely damaged rows if needed
    if (options.removeIncompleteRows) {
      await removeIncompleteRows(result, detection, options);
    }

    // Step 5: Validate repair success
    result.recoveryReport.repairSuccess = validateRecoverySuccess(result, options);
    result.success = result.recoveryReport.repairSuccess;

    // Step 6: Generate recommendations
    result.recoveryReport.recommendations = generateRecommendations(result, options);

  } catch (error) {
    result.remainingErrors.push({
      type: 'critical',
      message: `Recovery process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Manual data cleaning may be required'
    });
  }

  return result;
}

/**
 * Repairs common concentration value issues
 */
async function repairConcentrationValues(
  result: RecoveryResult,
  detection: DetectionResult,
  options: RecoveryOptions
): Promise<void> {
  const concCol = detection.concentrationColumn;
  
  for (let rowIndex = detection.dataStartRow; rowIndex < result.repairedData.length; rowIndex++) {
    const row = result.repairedData[rowIndex];
    if (!row || concCol >= row.length) continue;

    const originalValue = row[concCol];
    let repairedValue = originalValue;
    let repairConfidence = 0;
    let repairType: RepairAction['type'] = 'concentration_repair';

    // Case 1: Handle string concentrations with units
    if (typeof originalValue === 'string' && originalValue.trim()) {
      const concentrationInfo = parseConcentration(originalValue);
      if (concentrationInfo.isValid) {
        repairedValue = concentrationInfo.value;
        repairConfidence = 0.9;
      } else {
        // Try to extract numbers from complex strings
        const numberMatch = originalValue.match(/([0-9.]+(?:[eE][+-]?[0-9]+)?)/);
        if (numberMatch) {
          const numValue = parseFloat(numberMatch[1]);
          if (!isNaN(numValue) && numValue >= 0) {
            repairedValue = numValue;
            repairConfidence = 0.7;
          }
        }
      }
    }

    // Case 2: Handle empty or null values by interpolation
    if ((originalValue === null || originalValue === undefined || originalValue === '') && 
        options.fillMissingConcentrations) {
      const interpolatedValue = interpolateConcentration(result.repairedData, rowIndex, concCol, detection);
      if (interpolatedValue !== null) {
        repairedValue = interpolatedValue;
        repairConfidence = 0.6;
        repairType = 'data_interpolation';
      }
    }

    // Case 3: Handle scientific notation issues
    if (typeof originalValue === 'string' && /[eE]/.test(originalValue)) {
      const scientificValue = parseFloat(originalValue);
      if (!isNaN(scientificValue) && scientificValue >= 0) {
        repairedValue = scientificValue;
        repairConfidence = 0.95;
      }
    }

    // Apply repair if confidence is sufficient
    if (repairedValue !== originalValue && repairConfidence > 0.5) {
      row[concCol] = repairedValue;
      
      result.repairActions.push({
        type: repairType,
        description: `Repaired concentration value from "${originalValue}" to ${repairedValue}`,
        row: rowIndex,
        column: concCol,
        originalValue,
        repairedValue,
        confidence: repairConfidence
      });

      result.recoveryReport.repairedRows++;
      
      // Remove corresponding error if it exists
      result.remainingErrors = result.remainingErrors.filter(error => 
        !(error.row === rowIndex && error.column === concCol)
      );
    }
  }
}

/**
 * Repairs common response value issues
 */
async function repairResponseValues(
  result: RecoveryResult,
  detection: DetectionResult,
  options: RecoveryOptions
): Promise<void> {
  for (let rowIndex = detection.dataStartRow; rowIndex < result.repairedData.length; rowIndex++) {
    const row = result.repairedData[rowIndex];
    if (!row) continue;

    for (const respCol of detection.responseColumns) {
      if (respCol >= row.length) continue;

      const originalValue = row[respCol];
      let repairedValue = originalValue;
      let repairConfidence = 0;

      // Case 1: Handle string numbers
      if (typeof originalValue === 'string' && originalValue.trim()) {
        // Remove common non-numeric characters but preserve decimal points and scientific notation
        const cleanValue = originalValue.replace(/[^\d.eE+-]/g, '');
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue)) {
          repairedValue = numValue;
          repairConfidence = 0.8;
        }
      }

      // Case 2: Handle percentage values
      if (typeof originalValue === 'string' && originalValue.includes('%')) {
        const percentMatch = originalValue.match(/([0-9.]+)\s*%/);
        if (percentMatch) {
          repairedValue = parseFloat(percentMatch[1]);
          repairConfidence = 0.9;
        }
      }

      // Case 3: Handle negative values (might indicate inhibition data)
      if (typeof originalValue === 'number' && originalValue < 0) {
        // Keep negative values but flag as potential issue
        result.remainingWarnings.push({
          message: `Negative response value detected: ${originalValue}`,
          row: rowIndex,
          column: respCol,
          impact: 'low'
        });
      }

      // Apply repair if confidence is sufficient
      if (repairedValue !== originalValue && repairConfidence > 0.7) {
        row[respCol] = repairedValue;
        
        result.repairActions.push({
          type: 'response_repair',
          description: `Repaired response value from "${originalValue}" to ${repairedValue}`,
          row: rowIndex,
          column: respCol,
          originalValue,
          repairedValue,
          confidence: repairConfidence
        });

        // Remove corresponding error
        result.remainingErrors = result.remainingErrors.filter(error => 
          !(error.row === rowIndex && error.column === respCol)
        );
      }
    }
  }
}

/**
 * Fills missing concentration values using interpolation
 */
async function fillMissingConcentrations(
  result: RecoveryResult,
  detection: DetectionResult,
  options: RecoveryOptions
): Promise<void> {
  const concCol = detection.concentrationColumn;
  const dataRows = result.repairedData.slice(detection.dataStartRow);
  
  // Collect valid concentration values
  const validConcentrations: Array<{ row: number; value: number }> = [];
  dataRows.forEach((row, index) => {
    if (row && concCol < row.length) {
      const value = row[concCol];
      if (typeof value === 'number' && !isNaN(value) && value >= 0) {
        validConcentrations.push({ row: index + detection.dataStartRow, value });
      }
    }
  });

  // If we have at least 2 valid concentrations, try to interpolate missing ones
  if (validConcentrations.length >= 2) {
    // Sort by value to detect pattern
    validConcentrations.sort((a, b) => a.value - b.value);
    
    // Detect if it's a log-scale pattern
    const isLogScale = detectLogScale(validConcentrations.map(c => c.value));
    
    for (let rowIndex = detection.dataStartRow; rowIndex < result.repairedData.length; rowIndex++) {
      const row = result.repairedData[rowIndex];
      if (!row || concCol >= row.length) continue;

      const currentValue = row[concCol];
      if (currentValue === null || currentValue === undefined || currentValue === '' || 
          (typeof currentValue === 'number' && isNaN(currentValue))) {
        
        const interpolatedValue = interpolateConcentration(result.repairedData, rowIndex, concCol, detection);
        if (interpolatedValue !== null) {
          row[concCol] = interpolatedValue;
          
          result.repairActions.push({
            type: 'data_interpolation',
            description: `Filled missing concentration with interpolated value: ${interpolatedValue}`,
            row: rowIndex,
            column: concCol,
            originalValue: currentValue,
            repairedValue: interpolatedValue,
            confidence: 0.6
          });
        }
      }
    }
  }
}

/**
 * Interpolates missing response values
 */
async function interpolateResponseValues(
  result: RecoveryResult,
  detection: DetectionResult,
  options: RecoveryOptions
): Promise<void> {
  for (const respCol of detection.responseColumns) {
    // For each response column, try to interpolate missing values
    for (let rowIndex = detection.dataStartRow; rowIndex < result.repairedData.length; rowIndex++) {
      const row = result.repairedData[rowIndex];
      if (!row || respCol >= row.length) continue;

      const currentValue = row[respCol];
      if (currentValue === null || currentValue === undefined || currentValue === '' ||
          (typeof currentValue === 'number' && isNaN(currentValue))) {
        
        // Try to interpolate from neighboring values
        const interpolatedValue = interpolateResponseValue(result.repairedData, rowIndex, respCol, detection);
        if (interpolatedValue !== null) {
          row[respCol] = interpolatedValue;
          
          result.repairActions.push({
            type: 'data_interpolation',
            description: `Interpolated missing response value: ${interpolatedValue}`,
            row: rowIndex,
            column: respCol,
            originalValue: currentValue,
            repairedValue: interpolatedValue,
            confidence: 0.5
          });
        }
      }
    }
  }
}

/**
 * Removes rows that have too many errors to be salvageable
 */
async function removeIncompleteRows(
  result: RecoveryResult,
  detection: DetectionResult,
  options: RecoveryOptions
): Promise<void> {
  const rowsToRemove: number[] = [];
  
  for (let rowIndex = detection.dataStartRow; rowIndex < result.repairedData.length; rowIndex++) {
    const row = result.repairedData[rowIndex];
    if (!row) {
      rowsToRemove.push(rowIndex);
      continue;
    }

    let errorCount = 0;
    let totalCells = 0;

    // Check concentration column
    const concValue = row[detection.concentrationColumn];
    totalCells++;
    if (concValue === null || concValue === undefined || concValue === '' ||
        (typeof concValue === 'number' && isNaN(concValue))) {
      errorCount++;
    }

    // Check response columns
    for (const respCol of detection.responseColumns) {
      if (respCol < row.length) {
        totalCells++;
        const respValue = row[respCol];
        if (respValue === null || respValue === undefined || respValue === '' ||
            (typeof respValue === 'number' && isNaN(respValue))) {
          errorCount++;
        }
      }
    }

    // Remove row if more than 50% of critical data is missing/invalid
    const errorRate = errorCount / totalCells;
    if (errorRate > 0.5) {
      rowsToRemove.push(rowIndex);
    }
  }

  // Remove rows in reverse order to maintain indices
  for (const rowIndex of rowsToRemove.reverse()) {
    result.repairedData.splice(rowIndex, 1);
    result.recoveryReport.removedRows++;
    
    result.repairActions.push({
      type: 'row_removal',
      description: `Removed row ${rowIndex + 1} due to excessive missing/invalid data`,
      row: rowIndex,
      originalValue: 'incomplete row',
      repairedValue: 'removed',
      confidence: 0.8
    });

    // Remove errors associated with this row
    result.remainingErrors = result.remainingErrors.filter(error => error.row !== rowIndex);
  }
}

/**
 * Helper function to interpolate a missing concentration value
 */
function interpolateConcentration(
  data: any[][],
  targetRow: number,
  concCol: number,
  detection: DetectionResult
): number | null {
  // Find nearest valid concentrations above and below
  let before: number | null = null;
  let after: number | null = null;

  // Look backwards
  for (let i = targetRow - 1; i >= detection.dataStartRow; i--) {
    const row = data[i];
    if (row && concCol < row.length) {
      const value = row[concCol];
      if (typeof value === 'number' && !isNaN(value) && value >= 0) {
        before = value;
        break;
      }
    }
  }

  // Look forwards
  for (let i = targetRow + 1; i < data.length; i++) {
    const row = data[i];
    if (row && concCol < row.length) {
      const value = row[concCol];
      if (typeof value === 'number' && !isNaN(value) && value >= 0) {
        after = value;
        break;
      }
    }
  }

  // If we have both bounds, interpolate (assuming log scale for concentrations)
  if (before !== null && after !== null) {
    // Geometric mean for log-scale data
    return Math.sqrt(before * after);
  }

  return null;
}

/**
 * Helper function to interpolate a missing response value
 */
function interpolateResponseValue(
  data: any[][],
  targetRow: number,
  respCol: number,
  detection: DetectionResult
): number | null {
  // Simple linear interpolation between nearest valid values
  let before: number | null = null;
  let after: number | null = null;

  // Look backwards
  for (let i = targetRow - 1; i >= detection.dataStartRow; i--) {
    const row = data[i];
    if (row && respCol < row.length) {
      const value = row[respCol];
      if (typeof value === 'number' && !isNaN(value)) {
        before = value;
        break;
      }
    }
  }

  // Look forwards
  for (let i = targetRow + 1; i < data.length; i++) {
    const row = data[i];
    if (row && respCol < row.length) {
      const value = row[respCol];
      if (typeof value === 'number' && !isNaN(value)) {
        after = value;
        break;
      }
    }
  }

  // Linear interpolation
  if (before !== null && after !== null) {
    return (before + after) / 2;
  }

  return null;
}

/**
 * Detects if concentration values follow a log scale pattern
 */
function detectLogScale(values: number[]): boolean {
  if (values.length < 3) return false;
  
  const ratios: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i-1] > 0 && values[i] > 0) {
      ratios.push(values[i] / values[i-1]);
    }
  }

  if (ratios.length < 2) return false;

  // Check if ratios are approximately consistent (log scale)
  const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const variability = ratios.reduce((sum, ratio) => sum + Math.abs(ratio - avgRatio), 0) / ratios.length;
  
  return variability / avgRatio < 0.3; // Less than 30% variability in ratios
}

/**
 * Validates if the recovery was successful
 */
function validateRecoverySuccess(result: RecoveryResult, options: RecoveryOptions): boolean {
  const criticalErrors = result.remainingErrors.filter(e => e.type === 'critical').length;
  const totalRows = result.recoveryReport.totalRows - result.recoveryReport.removedRows;
  
  if (totalRows === 0) return false;
  
  const errorRate = criticalErrors / totalRows;
  const maxThreshold = options.maxErrorThreshold || 0.1; // Default 10% error tolerance
  
  return errorRate <= maxThreshold;
}

/**
 * Generates recommendations for further data cleaning
 */
function generateRecommendations(result: RecoveryResult, options: RecoveryOptions): string[] {
  const recommendations: string[] = [];
  
  if (result.remainingErrors.length > 0) {
    recommendations.push(`${result.remainingErrors.length} errors remain after recovery. Consider manual review.`);
  }

  if (result.recoveryReport.removedRows > 0) {
    recommendations.push(`${result.recoveryReport.removedRows} rows were removed due to excessive errors. Verify this is acceptable.`);
  }

  if (result.repairActions.filter(a => a.confidence < 0.7).length > 0) {
    recommendations.push('Some repairs have low confidence. Manual verification recommended.');
  }

  const interpolationActions = result.repairActions.filter(a => a.type === 'data_interpolation').length;
  if (interpolationActions > 0) {
    recommendations.push(`${interpolationActions} values were interpolated. Consider if this affects your analysis.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Data recovery completed successfully. No additional actions needed.');
  }

  return recommendations;
}