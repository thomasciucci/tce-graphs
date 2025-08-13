/**
 * Auto-suggestion logic for gate detection
 * Analyzes spreadsheet to suggest likely data regions
 */

import { GateSelection, SpreadsheetData, CellData, BoundingBox } from '../types';
import { scanForMultipleDatasets } from './multiDatasetDetection';
import { detectDoseTitrationPatterns, DosePattern } from './dosePatternDetection';
import { detectEnhancedDosePatterns, EnhancedDosePattern } from './enhancedDosePatternDetection';

const GATE_COLORS = [
  '#3b82f680', // blue
  '#22c55e80', // green
  '#ef444480', // red
  '#a855f780', // purple
  '#f59e0b80', // amber
  '#ec489980', // pink
];

export interface SuggestedGate extends GateSelection {
  confidence: number;
  reason: string;
  dataPreview: any[][];
}

/**
 * Main function to suggest gates based on spreadsheet analysis
 */
export function suggestGates(spreadsheetData: SpreadsheetData): SuggestedGate[] {
  const suggestions: SuggestedGate[] = [];

  try {
    // PRIORITY 1: Enhanced biological dose titration pattern detection with bidirectional support
    let enhancedPatterns: EnhancedDosePattern[] = [];
    try {
      enhancedPatterns = detectEnhancedDosePatterns(spreadsheetData.originalData);
    } catch (error) {
      console.error('❌ GATE DETECTION: Enhanced detection failed with error:', error);
      // Keep error logging as console.error but don't trigger on debug messages
    }
    
    console.log('📊 ENHANCED DETECTION RESULT:', enhancedPatterns.length, 'patterns found');

    // Convert enhanced patterns to gate suggestions (highest priority)
    console.log('🔍 Enhanced patterns found:', enhancedPatterns.map(p => `${p.orientation} ${p.patternType} (confidence: ${p.confidence.toFixed(2)})`));
    
    if (enhancedPatterns.length === 0) {
      console.log('❌ ENHANCED DETECTION FOUND ZERO PATTERNS - INVESTIGATING WHY');
    }
    enhancedPatterns.forEach((pattern, index) => {
      if (pattern.confidence > 0.3) { // Even lower threshold for testing
        const suggestion = createGateFromEnhancedPattern(pattern, index);
        suggestions.push(suggestion);
        console.log(`Enhanced pattern gate ${index + 1} (${pattern.orientation}):`, suggestion.reason, `(confidence: ${suggestion.confidence})`);
      }
    });

    // Always run original detection for comparison
    const dosePatterns = detectDoseTitrationPatterns(spreadsheetData.originalData);
    console.log('📊 COMPARISON: Original found:', dosePatterns.length, 'patterns, Enhanced found:', enhancedPatterns.length, 'patterns');
    
    if (suggestions.length === 0) {
      console.log('🔄 Using original detection results as fallback');
      dosePatterns.forEach((pattern, index) => {
        if (pattern.confidence > 0.5) {
          const suggestion = createGateFromDosePattern(pattern, index);
          suggestions.push(suggestion);
          console.log(`Original pattern gate ${index + 1}:`, suggestion.reason, `(confidence: ${suggestion.confidence})`);
        }
      });
    } else {
      console.log('✅ Using enhanced detection results');
    }

    // PRIORITY 2: Fallback to multi-dataset detection if no high-confidence biological patterns found
    if (suggestions.filter(s => s.confidence > 0.7).length === 0) {
      const multiDatasetResult = scanForMultipleDatasets(spreadsheetData.originalData, {
        minRows: 6, // Biological assays typically have at least 6 concentration points
        minCols: 3, // At least concentration + 2 replicates
        maxGapRows: 2, // Tighter gaps for biological data
        maxGapCols: 1,
        requirePatterns: true, // Require dilution patterns for biological relevance
      });

      console.log('Multi-dataset detection found:', multiDatasetResult.blocks?.length || 0, 'blocks');

      if (multiDatasetResult.blocks && multiDatasetResult.blocks.length > 0) {
        // Convert detected blocks to gate suggestions with biological filtering
        multiDatasetResult.blocks.forEach((block, index) => {
          if (block.confidence > 0.3) { // Higher threshold for biological relevance
            const suggestion = createGateFromDataset(block, index, block.confidence);
            suggestions.push(suggestion);
            console.log(`Biological fallback gate ${index + 1}:`, suggestion.reason, `(confidence: ${suggestion.confidence})`);
          }
        });
      }
    }

    // Always try pattern-based detection for additional suggestions
    const patternSuggestions = detectDataPatternsAsGates(spreadsheetData);
    console.log('Pattern-based detection found:', patternSuggestions.length, 'suggestions');
    suggestions.push(...patternSuggestions);

    // Always try dense region detection for fallback
    const denseSuggestions = detectDenseDataRegions(spreadsheetData);
    console.log('Dense region detection found:', denseSuggestions.length, 'suggestions');
    suggestions.push(...denseSuggestions);

  } catch (error) {
    console.error('Error in gate suggestion:', error);
    
    // Fallback to simple heuristic detection
    const fallbackSuggestions = fallbackGateDetection(spreadsheetData);
    console.log('Fallback detection found:', fallbackSuggestions.length, 'suggestions');
    suggestions.push(...fallbackSuggestions);
  }

  // Remove duplicates and sort by confidence
  const uniqueSuggestions = removeDuplicateGates(suggestions);
  
  // Sort by confidence and limit to top 8 suggestions
  return uniqueSuggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

/**
 * Create gate from biological dose pattern detection result
 */
function createGateFromDosePattern(pattern: DosePattern, index: number): SuggestedGate {
  const gateId = `dose-pattern-${index}-${Date.now()}`;
  const colorIndex = index % GATE_COLORS.length;
  
  // Enhanced naming based on biological characteristics
  let patternName = 'Data';
  if (pattern.patternType === 'classic-titration') {
    patternName = pattern.biologicalMetrics?.dilutionType === '2-fold' ? '2-Fold Titration' :
                  pattern.biologicalMetrics?.dilutionType === '3-fold' ? '3-Fold Titration' :
                  pattern.biologicalMetrics?.dilutionType === '10-fold' ? '10-Fold Titration' :
                  'Dose Titration';
  } else if (pattern.patternType === 'horizontal-matrix') {
    patternName = pattern.biologicalMetrics?.plateFormat === '96-well' ? '96-Well Matrix' :
                  pattern.biologicalMetrics?.plateFormat === '384-well' ? '384-Well Matrix' :
                  'Matrix Assay';
  } else if (pattern.patternType === 'multi-dilution') {
    patternName = 'Multi-Dilution Assay';
  } else if (pattern.biologicalMetrics?.plateFormat === '96-well' || pattern.biologicalMetrics?.plateFormat === '384-well') {
    patternName = pattern.biologicalMetrics.plateFormat === '96-well' ? '96-Well Assay' : '384-Well Assay';
  } else if (pattern.patternType === 'concentration-series') {
    patternName = 'Concentration Series';
  }
  
  // Enhanced description with biological context
  let description = pattern.description;
  if (pattern.biologicalMetrics) {
    const metrics = pattern.biologicalMetrics;
    const details = [];
    
    if (metrics.concentrationUnit) details.push(metrics.concentrationUnit);
    if (metrics.responseType !== 'unknown') details.push(metrics.responseType);
    if (metrics.cvPercent && metrics.cvPercent < 30) details.push(`CV: ${metrics.cvPercent.toFixed(1)}%`);
    
    if (details.length > 0) {
      description += ` (${details.join(', ')})`;
    }
  }
  
  return {
    id: gateId,
    name: `${patternName} ${index + 1}`,
    boundingBox: pattern.boundingBox,
    isSelected: false,
    dataType: 'dose-response',
    color: GATE_COLORS[colorIndex],
    confidence: pattern.confidence,
    reason: `${description} (${Math.round(pattern.confidence * 100)}% confidence)`,
    dataPreview: [], // Will be filled by preview function
  };
}

/**
 * Convert detected dataset to gate suggestion
 */
function createGateFromDataset(dataset: any, index: number, confidence: number): SuggestedGate {
  const boundingBox: BoundingBox = {
    startRow: dataset.boundingBox.startRow,
    endRow: dataset.boundingBox.endRow,
    startColumn: dataset.boundingBox.startColumn,
    endColumn: dataset.boundingBox.endColumn,
  };

  const gateId = `suggested-${index + 1}`;
  
  return {
    id: gateId,
    name: `Dataset ${index + 1}`,
    boundingBox,
    isSelected: false,
    dataType: 'dose-response',
    color: GATE_COLORS[index % GATE_COLORS.length],
    confidence,
    reason: generateReasonString(dataset, confidence),
    dataPreview: dataset.preview || [],
  };
}

/**
 * Create gate suggestion from enhanced dose pattern
 */
function createGateFromEnhancedPattern(pattern: EnhancedDosePattern, index: number): SuggestedGate {
  const gateId = `enhanced-${pattern.orientation}-${index + 1}`;
  
  return {
    id: gateId,
    name: `${pattern.orientation === 'horizontal' ? 'H' : 'V'}-Pattern ${index + 1}`,
    boundingBox: pattern.boundingBox,
    isSelected: false,
    dataType: 'dose-response',
    color: GATE_COLORS[index % GATE_COLORS.length],
    confidence: pattern.confidence,
    reason: generateEnhancedReasonString(pattern),
    dataPreview: [],
  };
}

/**
 * Generate human-readable reason for enhanced pattern
 */
function generateEnhancedReasonString(pattern: EnhancedDosePattern): string {
  const reasons = [];
  
  // Orientation and pattern type
  reasons.push(`${pattern.orientation} ${pattern.patternType}`);
  
  // Dilution information
  if (pattern.dilutionFactor) {
    const dilutionStr = pattern.biologicalMetrics?.dilutionType || `${pattern.dilutionFactor}-fold`;
    reasons.push(dilutionStr);
  }
  
  // Outlier information
  if (pattern.outliers && pattern.outliers.length > 0) {
    reasons.push(`${pattern.outliers.length} outlier${pattern.outliers.length > 1 ? 's' : ''} tolerated`);
  }
  
  // Confidence level
  if (pattern.confidence > 0.8) {
    reasons.push('high confidence');
  } else if (pattern.confidence > 0.6) {
    reasons.push('good confidence');
  }
  
  // Sample/replicate count
  if (pattern.biologicalMetrics?.replicateCount) {
    reasons.push(`${pattern.biologicalMetrics.replicateCount} replicates`);
  }
  
  return reasons.join(', ');
}

/**
 * Generate human-readable reason for suggestion
 */
function generateReasonString(dataset: any, confidence: number): string {
  const reasons = [];

  if (confidence > 0.8) {
    reasons.push('Strong dose-response pattern detected');
  } else if (confidence > 0.6) {
    reasons.push('Likely dose-response data');
  } else {
    reasons.push('Possible data region');
  }

  if (dataset.concentrationColumn !== undefined) {
    reasons.push('concentration column found');
  }

  if (dataset.responseColumns && dataset.responseColumns.length > 1) {
    reasons.push(`${dataset.responseColumns.length} response columns`);
  }

  if (dataset.dilutionPattern && dataset.dilutionPattern.type !== 'unknown') {
    reasons.push(`${dataset.dilutionPattern.type} dilution pattern`);
  }

  return reasons.join(', ');
}

/**
 * Biological pattern-based gate detection as fallback
 */
function detectDataPatternsAsGates(spreadsheetData: SpreadsheetData): SuggestedGate[] {
  const suggestions: SuggestedGate[] = [];
  const { cells } = spreadsheetData;
  
  // Look for numerical sequences with biological characteristics
  for (let col = 0; col < Math.min(cells[0]?.length || 0, 12); col++) {
    const numericSequence = findBiologicalNumericSequence(cells, col);
    
    if (numericSequence.length >= 6) { // Biological assays typically have 6+ points
      // Look for response data to the right with replicate analysis
      const responseAnalysis = findBiologicalResponseColumns_pattern(cells, numericSequence, col);
      
      if (responseAnalysis.columns.length >= 2) { // At least 2 replicates
        const boundingBox: BoundingBox = {
          startRow: Math.max(0, numericSequence[0] - 1), // Include potential header
          endRow: numericSequence[numericSequence.length - 1],
          startColumn: col,
          endColumn: Math.max(...responseAnalysis.columns),
        };

        const confidence = calculateBiologicalPatternConfidence(numericSequence, responseAnalysis, cells);
        
        if (confidence > 0.5) { // Higher threshold for biological relevance
          suggestions.push({
            id: `bio-pattern-${suggestions.length + 1}`,
            name: `Assay Pattern ${suggestions.length + 1}`,
            boundingBox,
            isSelected: false,
            dataType: 'dose-response',
            color: GATE_COLORS[suggestions.length % GATE_COLORS.length],
            confidence,
            reason: `Biological pattern: ${responseAnalysis.columns.length} replicates, CV: ${responseAnalysis.cvPercent?.toFixed(1)}%`,
            dataPreview: extractPreview(cells, boundingBox),
          });
        }
      }
    }
  }

  return suggestions;
}

/**
 * Detect biological data regions as potential gates
 */
function detectDenseDataRegions(spreadsheetData: SpreadsheetData): SuggestedGate[] {
  const suggestions: SuggestedGate[] = [];
  const { cells } = spreadsheetData;
  
  const regions = findBiologicalDataRegions(cells);
  
  regions.forEach((region, index) => {
    if (region.density > 0.7 && region.numericRatio > 0.6 && region.biologicalScore > 0.3) {
      suggestions.push({
        id: `bio-region-${index + 1}`,
        name: `Assay Region ${index + 1}`,
        boundingBox: region.boundingBox,
        isSelected: false,
        dataType: 'dose-response',
        color: GATE_COLORS[index % GATE_COLORS.length],
        confidence: Math.min(region.density * 0.6 + region.biologicalScore * 0.4, 0.8), // Combined scoring
        reason: `Dense biological region (${Math.round(region.density * 100)}% filled, ${region.dimensionMatch})`,
        dataPreview: extractPreview(cells, region.boundingBox),
      });
    }
  });

  return suggestions;
}

/**
 * Fallback detection using simple heuristics
 */
function fallbackGateDetection(spreadsheetData: SpreadsheetData): SuggestedGate[] {
  const { cells, dimensions } = spreadsheetData;
  
  // Simple heuristic: look for the first dense block of data
  let startRow = -1, endRow = -1, startCol = -1, endCol = -1;
  
  // Find first non-empty row
  for (let row = 0; row < Math.min(dimensions.rows, 50); row++) {
    let nonEmptyCount = 0;
    for (let col = 0; col < Math.min(dimensions.columns, 20); col++) {
      if (!cells[row]?.[col]?.isEmpty) {
        nonEmptyCount++;
      }
    }
    
    if (nonEmptyCount >= 2) {
      if (startRow === -1) startRow = row;
      endRow = row;
    } else if (startRow !== -1 && nonEmptyCount === 0) {
      break; // End of data block
    }
  }

  // Find column range
  if (startRow !== -1) {
    for (let col = 0; col < Math.min(dimensions.columns, 20); col++) {
      let nonEmptyCount = 0;
      for (let row = startRow; row <= endRow; row++) {
        if (!cells[row]?.[col]?.isEmpty) {
          nonEmptyCount++;
        }
      }
      
      if (nonEmptyCount >= 2) {
        if (startCol === -1) startCol = col;
        endCol = col;
      }
    }
  }

  if (startRow !== -1 && startCol !== -1 && endRow - startRow >= 2 && endCol - startCol >= 1) {
    const boundingBox: BoundingBox = { startRow, endRow, startColumn: startCol, endColumn: endCol };
    
    return [{
      id: 'fallback-1',
      name: 'Detected Data',
      boundingBox,
      isSelected: false,
      dataType: 'dose-response',
      color: GATE_COLORS[0],
      confidence: 0.5,
      reason: 'Basic data region detected',
      dataPreview: extractPreview(cells, boundingBox),
    }];
  }

  return [];
}

/**
 * Helper functions
 */

function findBiologicalNumericSequence(cells: CellData[][], column: number): number[] {
  const sequence: number[] = [];
  const values: number[] = [];
  
  for (let row = 0; row < cells.length && row < 50; row++) {
    const cell = cells[row]?.[column];
    if (cell && cell.isNumeric && !cell.isEmpty) {
      const value = typeof cell.value === 'number' ? cell.value : Number(cell.value);
      if (!isNaN(value) && value >= 0) {
        sequence.push(row);
        values.push(value);
      }
    }
  }
  
  // Check if sequence shows biological dilution pattern
  if (sequence.length >= 6) {
    const isDescending = values.every((val, i) => i === 0 || val <= values[i - 1] * 1.01);
    const isAscending = values.every((val, i) => i === 0 || val >= values[i - 1] * 0.99);
    
    if (isDescending || isAscending) {
      return sequence;
    }
  }
  
  return [];
}

function findBiologicalResponseColumns_pattern(cells: CellData[][], numericSequence: number[], concentrationCol: number): {
  columns: number[];
  cvPercent?: number;
  consistency: number;
} {
  const responseColumns: number[] = [];
  const columnValues: number[][] = [];
  
  // Check columns to the right of concentration column
  for (let col = concentrationCol + 1; col < Math.min((cells[0]?.length || 0), concentrationCol + 10); col++) {
    let numericCount = 0;
    const values: number[] = [];
    
    for (const row of numericSequence) {
      const cell = cells[row]?.[col];
      if (cell && cell.isNumeric && !cell.isEmpty) {
        numericCount++;
        const value = typeof cell.value === 'number' ? cell.value : Number(cell.value);
        if (!isNaN(value)) values.push(value);
      }
    }
    
    // Higher threshold for biological data (at least 80%)
    if (numericCount / numericSequence.length >= 0.8 && values.length >= 4) {
      responseColumns.push(col);
      columnValues.push(values);
    }
  }
  
  // Calculate replicate consistency if multiple columns
  let cvPercent: number | undefined;
  let consistency = 1.0;
  
  if (responseColumns.length >= 2 && columnValues.length >= 2) {
    const cvs: number[] = [];
    
    for (let i = 0; i < columnValues[0].length; i++) {
      const pointValues = columnValues.map(col => col[i]).filter(v => !isNaN(v));
      if (pointValues.length >= 2) {
        const mean = pointValues.reduce((a, b) => a + b, 0) / pointValues.length;
        const std = Math.sqrt(pointValues.reduce((a, b) => a + (b - mean) ** 2, 0) / pointValues.length);
        const cv = (std / mean) * 100;
        if (cv < 100) cvs.push(cv);
      }
    }
    
    if (cvs.length > 0) {
      cvPercent = cvs.reduce((a, b) => a + b, 0) / cvs.length;
      consistency = Math.max(0, 1 - cvPercent / 50);
    }
  }
  
  return {
    columns: responseColumns,
    cvPercent,
    consistency
  };
}

function calculateBiologicalPatternConfidence(
  numericSequence: number[], 
  responseAnalysis: { columns: number[]; cvPercent?: number; consistency: number }, 
  cells: CellData[][]
): number {
  let confidence = 0.4; // Base confidence
  
  // Biological sequence length bonus (6-12 points typical)
  if (numericSequence.length >= 6 && numericSequence.length <= 12) confidence += 0.2;
  if (numericSequence.length >= 8) confidence += 0.1;
  
  // Replicate count bonus (3-8 typical)
  if (responseAnalysis.columns.length >= 3 && responseAnalysis.columns.length <= 8) confidence += 0.15;
  if (responseAnalysis.columns.length >= 4) confidence += 0.05;
  
  // CV-based confidence (lower CV = higher confidence)
  if (responseAnalysis.cvPercent !== undefined) {
    if (responseAnalysis.cvPercent < 15) confidence += 0.2;
    else if (responseAnalysis.cvPercent < 25) confidence += 0.1;
    else if (responseAnalysis.cvPercent < 35) confidence += 0.05;
  }
  
  // Consistency bonus
  confidence += responseAnalysis.consistency * 0.1;
  
  // Check concentration values for dilution pattern
  const concentrationCol = responseAnalysis.columns[0] - 1;
  const concentrationValues = numericSequence.map(row => {
    const cell = cells[row]?.[concentrationCol];
    return cell ? parseFloat(String(cell.value)) : null;
  }).filter(v => v !== null && v > 0) as number[];
  
  if (concentrationValues.length >= 4) {
    const isDescending = concentrationValues.every((val, i) => i === 0 || val <= concentrationValues[i - 1] * 1.01);
    const isAscending = concentrationValues.every((val, i) => i === 0 || val >= concentrationValues[i - 1] * 0.99);
    
    if (isDescending || isAscending) {
      confidence += 0.15;
      
      // Check for common dilution ratios
      const ratios = [];
      for (let i = 1; i < concentrationValues.length; i++) {
        const ratio = isDescending ? concentrationValues[i - 1] / concentrationValues[i] : concentrationValues[i] / concentrationValues[i - 1];
        if (ratio > 1.1 && ratio < 20) ratios.push(ratio);
      }
      
      if (ratios.length >= 2) {
        const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        if (Math.abs(avgRatio - 2) < 0.3 || Math.abs(avgRatio - 3) < 0.5 || Math.abs(avgRatio - 10) < 1.5) {
          confidence += 0.15; // Common dilution factors
        }
      }
    }
  }
  
  return Math.min(confidence, 1.0);
}

function findBiologicalDataRegions(cells: CellData[][]): Array<{
  boundingBox: BoundingBox;
  density: number;
  numericRatio: number;
  biologicalScore: number;
  dimensionMatch: string;
}> {
  const regions: Array<{
    boundingBox: BoundingBox;
    density: number;
    numericRatio: number;
    biologicalScore: number;
    dimensionMatch: string;
  }> = [];

  // Test biological assay block sizes
  const biologicalBlocks = [
    { height: 8, width: 12, name: '96-well format' },
    { height: 12, width: 8, name: '96-well transposed' },
    { height: 8, width: 6, name: 'half-plate' },
    { height: 6, width: 10, name: 'custom assay' },
    { height: 10, width: 4, name: 'narrow assay' },
  ];
  
  for (const { height: blockHeight, width: blockWidth, name } of biologicalBlocks) {
    for (let startRow = 0; startRow < cells.length - blockHeight + 1; startRow += Math.max(1, Math.floor(blockHeight / 2))) {
      for (let startCol = 0; startCol < (cells[0]?.length || 0) - blockWidth + 1; startCol += Math.max(1, Math.floor(blockWidth / 2))) {
        let totalCells = 0;
        let filledCells = 0;
        let numericCells = 0;
        let concentrationLikeColumns = 0;
        
        for (let row = startRow; row < Math.min(startRow + blockHeight, cells.length); row++) {
          for (let col = startCol; col < Math.min(startCol + blockWidth, cells[row]?.length || 0); col++) {
            totalCells++;
            const cell = cells[row]?.[col];
            
            if (cell && !cell.isEmpty) {
              filledCells++;
              if (cell.isNumeric) {
                numericCells++;
              }
            }
          }
        }
        
        // Check for concentration-like columns (decreasing/increasing sequences)
        for (let col = startCol; col < Math.min(startCol + 3, startCol + blockWidth); col++) {
          const sequence = findBiologicalNumericSequence(cells.slice(startRow, startRow + blockHeight), col - startCol);
          if (sequence.length >= Math.min(6, blockHeight - 2)) {
            concentrationLikeColumns++;
          }
        }
        
        const density = filledCells / totalCells;
        const numericRatio = filledCells > 0 ? numericCells / filledCells : 0;
        
        // Biological scoring based on:
        // - Good density and numeric ratio
        // - Presence of concentration-like columns
        // - Appropriate dimensions for biological assays
        let biologicalScore = 0;
        if (density > 0.6) biologicalScore += 0.3;
        if (numericRatio > 0.7) biologicalScore += 0.3;
        if (concentrationLikeColumns > 0) biologicalScore += 0.4;
        
        // Dimension bonuses for common assay formats
        if (blockHeight >= 6 && blockHeight <= 12 && blockWidth >= 4 && blockWidth <= 12) {
          biologicalScore += 0.2;
        }
        
        if (density > 0.5 && totalCells > 15 && biologicalScore > 0.2) {
          regions.push({
            boundingBox: {
              startRow,
              endRow: Math.min(startRow + blockHeight - 1, cells.length - 1),
              startColumn: startCol,
              endColumn: Math.min(startCol + blockWidth - 1, (cells[0]?.length || 1) - 1),
            },
            density,
            numericRatio,
            biologicalScore,
            dimensionMatch: name
          });
        }
      }
    }
  }
  
  return regions;
}

function extractPreview(cells: CellData[][], boundingBox: BoundingBox): any[][] {
  const preview: any[][] = [];
  
  for (let row = boundingBox.startRow; row <= Math.min(boundingBox.endRow, boundingBox.startRow + 4); row++) {
    const previewRow: any[] = [];
    for (let col = boundingBox.startColumn; col <= Math.min(boundingBox.endColumn, boundingBox.startColumn + 4); col++) {
      const cell = cells[row]?.[col];
      previewRow.push(cell?.value || '');
    }
    preview.push(previewRow);
  }
  
  return preview;
}

/**
 * Remove duplicate gates based on overlapping regions
 */
function removeDuplicateGates(suggestions: SuggestedGate[]): SuggestedGate[] {
  const unique: SuggestedGate[] = [];
  
  for (const suggestion of suggestions) {
    let isDuplicate = false;
    
    for (const existing of unique) {
      // Check if gates significantly overlap (>70% overlap)
      const overlap = calculateOverlap(suggestion.boundingBox, existing.boundingBox);
      if (overlap > 0.7) {
        isDuplicate = true;
        // Keep the higher confidence suggestion
        if (suggestion.confidence > existing.confidence) {
          const index = unique.indexOf(existing);
          unique[index] = suggestion;
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      unique.push(suggestion);
    }
  }
  
  return unique;
}

/**
 * Calculate overlap percentage between two bounding boxes
 */
function calculateOverlap(box1: BoundingBox, box2: BoundingBox): number {
  const intersectStartRow = Math.max(box1.startRow, box2.startRow);
  const intersectEndRow = Math.min(box1.endRow, box2.endRow);
  const intersectStartCol = Math.max(box1.startColumn, box2.startColumn);
  const intersectEndCol = Math.min(box1.endColumn, box2.endColumn);
  
  if (intersectStartRow > intersectEndRow || intersectStartCol > intersectEndCol) {
    return 0; // No overlap
  }
  
  const intersectArea = (intersectEndRow - intersectStartRow + 1) * (intersectEndCol - intersectStartCol + 1);
  const box1Area = (box1.endRow - box1.startRow + 1) * (box1.endColumn - box1.startColumn + 1);
  const box2Area = (box2.endRow - box2.startRow + 1) * (box2.endColumn - box2.startColumn + 1);
  
  const unionArea = box1Area + box2Area - intersectArea;
  return intersectArea / unionArea;
}