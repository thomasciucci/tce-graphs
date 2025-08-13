/**
 * Enhanced dose-response pattern detection with bidirectional support,
 * expanded dilution series, outlier tolerance, and boundary detection
 */

import { parseConcentration, normalizeConcentration } from './dataDetection';

export interface EnhancedDosePattern {
  boundingBox: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  };
  confidence: number;
  orientation: 'horizontal' | 'vertical';
  patternType: 'classic-titration' | 'concentration-series' | 'multi-dilution' | 'horizontal-matrix' | 'vertical-matrix' | 'generic';
  description: string;
  concentrationColumn?: number;
  concentrationRow?: number;
  responseColumns: number[];
  responseRows?: number[];
  headerRow?: number;
  headerColumn?: number;
  dilutionFactor?: number;
  detectedDilutionFactors?: number[];
  outliers?: OutlierInfo[];
  concentrationRange?: { min: number; max: number };
  biologicalMetrics?: {
    plateFormat: '96-well' | '384-well' | 'custom' | 'unknown';
    dilutionType: string; // Now supports "2-fold" through "10-fold" + custom
    replicateCount: number;
    replicateConsistency: number;
    concentrationUnit: string | null;
    responseType: 'OD' | 'fluorescence' | 'luminescence' | 'inhibition' | 'unknown';
    cvPercent?: number;
  };
}

interface OutlierInfo {
  position: number;
  value: number;
  expectedValue: number;
  deviation: number;
  type: 'endpoint' | 'internal';
}

interface OrientationAnalysis {
  orientation: 'horizontal' | 'vertical';
  confidence: number;
  patternConsistency: number;
  structuralConfidence: number;
  concentrationRange: number;
  patterns: EnhancedDosePattern[];
}

// Extended dilution factors to detect
const DILUTION_FACTORS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const COMMON_DILUTION_NAMES = {
  2: '2-fold serial',
  3: '3-fold serial',
  4: '4-fold serial',
  5: '5-fold serial',
  6: '6-fold serial',
  7: '7-fold serial',
  8: '8-fold serial',
  9: '9-fold serial',
  10: 'log-scale (10-fold)'
};

/**
 * Main entry point for enhanced dose pattern detection
 * Detects both horizontal and vertical patterns with improved flexibility
 */
export function detectEnhancedDosePatterns(data: any[][]): EnhancedDosePattern[] {
  console.log('🚀🚀🚀 ENHANCED DETECTION: FUNCTION ENTRY - detectEnhancedDosePatterns called');
  console.log('🚀 Enhanced dose pattern detection starting...');
  
  // Detailed data validation
  console.log('📊 Input validation:');
  console.log('  - data exists:', !!data);
  console.log('  - data is array:', Array.isArray(data));
  console.log('  - data length:', data?.length);
  console.log('  - data[0] exists:', !!data?.[0]);
  console.log('  - data[0] is array:', Array.isArray(data?.[0]));
  console.log('  - data[0] length:', data?.[0]?.length);
  
  if (!data || data.length < 3 || !data[0] || data[0].length < 3) {
    console.log('❌ Insufficient data for pattern detection');
    console.log('❌ Requirements: data array with ≥3 rows and ≥3 columns');
    return [];
  }

  console.log(`📊 ENHANCED DETECTION: Analyzing ${data.length} rows × ${data[0]?.length || 0} columns`);


  // Step 1: Detect empty row/column boundaries to segment datasets
  const datasetBoundaries = detectDatasetBoundaries(data);
  console.log(`🔲 Found ${datasetBoundaries.length} potential dataset regions:`);
  datasetBoundaries.forEach((boundary, i) => {
    const size = `${boundary.endRow - boundary.startRow + 1}×${boundary.endColumn - boundary.startColumn + 1}`;
    console.log(`  Region ${i + 1}: rows ${boundary.startRow}-${boundary.endRow}, cols ${boundary.startColumn}-${boundary.endColumn} (${size})`);
  });

  const allPatterns: EnhancedDosePattern[] = [];

  // Step 2: Analyze each bounded region separately
  for (const boundary of datasetBoundaries) {
    console.log(`\n📦 Analyzing region: rows ${boundary.startRow}-${boundary.endRow}, cols ${boundary.startColumn}-${boundary.endColumn}`);
    
    // Extract data region for analysis
    const regionData = extractDataRegion(data, boundary);
    
    // Step 3: Bidirectional pattern detection
    const horizontalAnalysis = analyzeOrientation(regionData, 'horizontal', boundary);
    const verticalAnalysis = analyzeOrientation(regionData, 'vertical', boundary);
    
    // Step 4: Choose best orientation
    const bestOrientation = selectBestOrientation(horizontalAnalysis, verticalAnalysis);
    console.log(`🎯 Best orientation for region: ${bestOrientation.orientation} (confidence: ${bestOrientation.confidence.toFixed(3)})`);
    
    // Add offset to patterns to match original data coordinates
    const adjustedPatterns = bestOrientation.patterns.map(pattern => ({
      ...pattern,
      boundingBox: {
        startRow: pattern.boundingBox.startRow + boundary.startRow,
        endRow: pattern.boundingBox.endRow + boundary.startRow,
        startColumn: pattern.boundingBox.startColumn + boundary.startColumn,
        endColumn: pattern.boundingBox.endColumn + boundary.startColumn
      },
      concentrationColumn: pattern.concentrationColumn !== undefined 
        ? pattern.concentrationColumn + boundary.startColumn 
        : undefined,
      concentrationRow: pattern.concentrationRow !== undefined
        ? pattern.concentrationRow + boundary.startRow
        : undefined,
      responseColumns: pattern.responseColumns.map(col => col + boundary.startColumn),
      responseRows: pattern.responseRows?.map(row => row + boundary.startRow),
      headerRow: pattern.headerRow !== undefined
        ? pattern.headerRow + boundary.startRow
        : undefined,
      headerColumn: pattern.headerColumn !== undefined
        ? pattern.headerColumn + boundary.startColumn
        : undefined
    }));
    
    allPatterns.push(...adjustedPatterns);
  }

  // Step 5: Sort by confidence and remove overlapping patterns
  const finalPatterns = filterOverlappingPatterns(allPatterns);
  
  console.log(`\n✅ Detection complete: Found ${finalPatterns.length} dose-response patterns`);
  finalPatterns.forEach((pattern, i) => {
    console.log(`  ${i + 1}. ${pattern.orientation} ${pattern.patternType} (confidence: ${pattern.confidence.toFixed(3)})`);
    console.log(`     Dilution: ${pattern.dilutionFactor || 'variable'}-fold, Range: ${pattern.concentrationRange?.min.toExponential(1)} - ${pattern.concentrationRange?.max.toExponential(1)}`);
  });

  return finalPatterns;
}

/**
 * Detect dataset boundaries using empty rows/columns
 */
function detectDatasetBoundaries(data: any[][]): Array<{startRow: number, endRow: number, startColumn: number, endColumn: number}> {
  const boundaries = [];
  const minGapSize = 2; // Minimum empty rows/cols to consider as boundary
  const emptyThreshold = 0.8; // 80% empty cells to consider row/col as empty
  
  // Find horizontal gaps (empty rows)
  const emptyRows: number[] = [];
  for (let row = 0; row < data.length; row++) {
    const rowData = data[row] || [];
    const emptyCount = rowData.filter(cell => 
      cell === null || cell === undefined || cell === '' || 
      (typeof cell === 'string' && cell.trim() === '')
    ).length;
    
    if (rowData.length === 0 || emptyCount / rowData.length >= emptyThreshold) {
      emptyRows.push(row);
    }
  }
  
  // Find vertical gaps (empty columns)
  const maxCols = Math.max(...data.map(row => row?.length || 0));
  const emptyColumns: number[] = [];
  
  for (let col = 0; col < maxCols; col++) {
    let emptyCount = 0;
    let totalCount = 0;
    
    for (let row = 0; row < data.length; row++) {
      if (data[row] && col < data[row].length) {
        totalCount++;
        const cell = data[row][col];
        if (cell === null || cell === undefined || cell === '' || 
            (typeof cell === 'string' && cell.trim() === '')) {
          emptyCount++;
        }
      }
    }
    
    if (totalCount === 0 || emptyCount / totalCount >= emptyThreshold) {
      emptyColumns.push(col);
    }
  }
  
  // Group consecutive empty rows/columns into gaps
  const rowGaps = groupConsecutive(emptyRows, minGapSize);
  const colGaps = groupConsecutive(emptyColumns, minGapSize);
  
  // Create dataset boundaries from gaps
  const rowBoundaries = [0, ...rowGaps.map(gap => gap.end + 1), data.length];
  const colBoundaries = [0, ...colGaps.map(gap => gap.end + 1), maxCols];
  
  // Generate all bounded regions
  for (let i = 0; i < rowBoundaries.length - 1; i++) {
    for (let j = 0; j < colBoundaries.length - 1; j++) {
      const boundary = {
        startRow: rowBoundaries[i],
        endRow: rowBoundaries[i + 1] - 1,
        startColumn: colBoundaries[j],
        endColumn: colBoundaries[j + 1] - 1
      };
      
      // Only include regions with sufficient data
      if (boundary.endRow - boundary.startRow >= 2 && 
          boundary.endColumn - boundary.startColumn >= 2) {
        boundaries.push(boundary);
      }
    }
  }
  
  // If no boundaries found, return entire dataset
  if (boundaries.length === 0) {
    boundaries.push({
      startRow: 0,
      endRow: data.length - 1,
      startColumn: 0,
      endColumn: maxCols - 1
    });
  }
  
  return boundaries;
}

/**
 * Group consecutive numbers into ranges
 */
function groupConsecutive(numbers: number[], minSize: number): Array<{start: number, end: number}> {
  if (numbers.length === 0) return [];
  
  const groups = [];
  let currentGroup = [numbers[0]];
  
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) {
      currentGroup.push(numbers[i]);
    } else {
      if (currentGroup.length >= minSize) {
        groups.push({
          start: currentGroup[0],
          end: currentGroup[currentGroup.length - 1]
        });
      }
      currentGroup = [numbers[i]];
    }
  }
  
  if (currentGroup.length >= minSize) {
    groups.push({
      start: currentGroup[0],
      end: currentGroup[currentGroup.length - 1]
    });
  }
  
  return groups;
}

/**
 * Extract a data region based on boundaries
 */
function extractDataRegion(data: any[][], boundary: {startRow: number, endRow: number, startColumn: number, endColumn: number}): any[][] {
  const region = [];
  for (let row = boundary.startRow; row <= boundary.endRow; row++) {
    if (data[row]) {
      const rowData = [];
      for (let col = boundary.startColumn; col <= boundary.endColumn; col++) {
        rowData.push(data[row][col] || null);
      }
      region.push(rowData);
    }
  }
  return region;
}

/**
 * Analyze patterns in a specific orientation
 */
function analyzeOrientation(
  data: any[][], 
  orientation: 'horizontal' | 'vertical',
  boundary: {startRow: number, endRow: number, startColumn: number, endColumn: number}
): OrientationAnalysis {
  const patterns: EnhancedDosePattern[] = [];
  
  if (orientation === 'horizontal') {
    // First try matrix format (concentrations in header row, samples in rows)
    patterns.push(...detectHorizontalMatrixPatterns(data));
    // Then try row-wise patterns as fallback
    patterns.push(...detectHorizontalPatterns(data));
  } else {
    // Look for patterns where concentrations are in columns (top to bottom)
    patterns.push(...detectVerticalPatterns(data));
  }
  
  // Calculate overall confidence for this orientation
  const maxConfidence = patterns.length > 0 ? Math.max(...patterns.map(p => p.confidence)) : 0;
  const avgConfidence = patterns.length > 0 
    ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length 
    : 0;
  
  return {
    orientation,
    confidence: maxConfidence * 0.7 + avgConfidence * 0.3,
    patternConsistency: calculatePatternConsistency(patterns),
    structuralConfidence: calculateStructuralConfidence(data, orientation),
    concentrationRange: calculateConcentrationRange(patterns),
    patterns
  };
}

/**
 * Detect horizontal matrix patterns (concentrations in top row, samples in left column)
 * This matches the original detection's successful horizontal matrix approach
 */
function detectHorizontalMatrixPatterns(data: any[][]): EnhancedDosePattern[] {
  const patterns: EnhancedDosePattern[] = [];
  
  console.log(`🏢 MATRIX DETECTION: Starting horizontal matrix pattern detection`);
  console.log(`🏢 Input: ${data?.length || 0} rows × ${data?.[0]?.length || 0} columns`);
  
  if (!data || data.length < 3) {
    console.log(`❌ MATRIX: Insufficient data (need ≥3 rows)`);
    return patterns;
  }
  
  // Look for patterns where:
  // - Top row contains concentration values (numeric, in order)
  // - Left column contains sample/well identifiers
  // - Interior forms a data matrix
  
  let searchCount = 0;
  for (let startRow = 0; startRow < Math.min(data.length - 2, 3); startRow++) { // Limit search to first few rows
    for (let startCol = 0; startCol < Math.min((data[startRow]?.length || 0) - 2, 3); startCol++) { // Limit search to first few cols
      searchCount++;
      console.log(`🔎 MATRIX: Checking position [${startRow}, ${startCol}] (search #${searchCount})`);
      
      // Look for concentration header row
      const concentrationHeaderRow = findConcentrationHeaderRow(data, startRow, startCol);
      if (concentrationHeaderRow === -1) {
        continue;
      }
      
      // Look for sample identifier column  
      const sampleColumn = findSampleIdentifierColumn(data, concentrationHeaderRow + 1, startCol);
      console.log(`🔍 MATRIX: Sample column search result: ${sampleColumn}`);
      if (sampleColumn === -1) {
        console.log(`❌ MATRIX: No sample column found`);
        continue;
      }
      
      // Find matrix bounds
      const matrixBounds = findMatrixBounds(data, concentrationHeaderRow, sampleColumn);
      console.log(`🔍 MATRIX: Matrix bounds result:`, matrixBounds);
      if (!matrixBounds.isValid) {
        console.log(`❌ MATRIX: Invalid matrix bounds`);
        continue;
      }
      
      // Analyze pattern quality
      const matrixAnalysis = analyzeMatrixPattern(data, matrixBounds);
      console.log(`🔍 MATRIX: Pattern analysis confidence: ${matrixAnalysis.confidence}`);
      if (matrixAnalysis.confidence < 0.5) {
        console.log(`❌ MATRIX: Low confidence (${matrixAnalysis.confidence} < 0.5)`);
        continue;
      }
      
      // Extract concentrations from header row
      const concentrations = extractConcentrationsFromRow(
        data, concentrationHeaderRow, matrixBounds.startCol + 1, matrixBounds.endCol
      );
      console.log(`✅ MATRIX: SUCCESS! Creating pattern with ${concentrations.length} concentrations`);
      console.log(`🎯 MATRIX: Pattern details - ${matrixBounds.sampleCount} samples × ${concentrations.length} concentrations`);
      
      // Apply contextual confidence boosting
      const contextualBonus = calculateContextualConfidence(data, matrixBounds, concentrationHeaderRow);
      const finalConfidence = Math.min(1.0, matrixAnalysis.confidence + 0.3 + contextualBonus);
      
      console.log(`🎯 MATRIX: Contextual bonus: +${contextualBonus.toFixed(3)}, final confidence: ${finalConfidence.toFixed(3)}`);
      
      const pattern: EnhancedDosePattern = {
        boundingBox: {
          startRow: matrixBounds.startRow,
          endRow: matrixBounds.endRow,
          startColumn: matrixBounds.startCol,
          endColumn: matrixBounds.endCol
        },
        confidence: finalConfidence,
        orientation: 'horizontal',
        patternType: 'horizontal-matrix',
        description: `Horizontal matrix: ${matrixBounds.sampleCount} samples × ${concentrations.length} concentrations`,
        concentrationRow: concentrationHeaderRow,
        responseColumns: Array.from({length: concentrations.length}, (_, i) => matrixBounds.startCol + 1 + i),
        responseRows: Array.from({length: matrixBounds.sampleCount}, (_, i) => concentrationHeaderRow + 1 + i),
        headerRow: concentrationHeaderRow,
        concentrationRange: concentrations.length > 0 ? {
          min: Math.min(...concentrations.filter(c => !isNaN(c))),
          max: Math.max(...concentrations.filter(c => !isNaN(c)))
        } : undefined,
        biologicalMetrics: {
          plateFormat: inferPlateFormat(concentrations.length, matrixBounds.sampleCount),
          dilutionType: 'custom',
          replicateCount: matrixBounds.sampleCount,
          replicateConsistency: 0.8,
          concentrationUnit: 'nM',
          responseType: 'unknown'
        }
      };
      
      patterns.push(pattern);
    }
  }
  
  return patterns;
}

/**
 * Find concentration header row (contains numeric series)
 */
function findConcentrationHeaderRow(data: any[][], startRow: number, startCol: number): number {
  console.log(`🔍 HEADER: Looking for concentration header starting at [${startRow}, ${startCol}]`);
  
  for (let row = startRow; row < Math.min(data.length, startRow + 3); row++) {
    const rowData = data[row] || [];
    console.log(`🔍 HEADER: Checking row ${row}, length=${rowData.length}`);
    
    // Look for numeric values that could be concentrations
    let numericCount = 0;
    let totalNonEmpty = 0;
    const values: number[] = [];
    
    for (let col = startCol + 1; col < Math.min(rowData.length, startCol + 15); col++) {
      const cell = rowData[col];
      if (cell != null && cell !== '') {
        totalNonEmpty++;
        const num = parseConcentrationValue(cell);
        if (num !== null) {
          numericCount++;
          values.push(num);
        }
      }
    }
    
    // Check if this looks like a concentration series
    console.log(`🔍 HEADER: Row ${row} analysis - ${numericCount} numeric of ${totalNonEmpty} non-empty (values: [${values.slice(0, 5).join(', ')}])`);
    
    if (numericCount >= 3 && numericCount >= totalNonEmpty * 0.7) {
      // Check if values are in order
      const isIncreasing = values.every((val, i) => i === 0 || val >= values[i - 1]);
      const isDecreasing = values.every((val, i) => i === 0 || val <= values[i - 1]);
      
      console.log(`🔍 HEADER: Row ${row} ordering - increasing: ${isIncreasing}, decreasing: ${isDecreasing}`);
      
      if (isIncreasing || isDecreasing) {
        console.log(`✅ HEADER: Found concentration header at row ${row}!`);
        return row;
      } else {
        console.log(`❌ HEADER: Row ${row} values not in order`);
      }
    } else {
      console.log(`❌ HEADER: Row ${row} insufficient concentrations (${numericCount} < 3 or ${numericCount}/${totalNonEmpty} < 70%)`);
    }
  }
  console.log(`❌ HEADER: No concentration header found in rows ${startRow}-${Math.min(data.length, startRow + 3)}`);
  return -1;
}

/**
 * Find sample identifier column (contains sample names/IDs)
 */
function findSampleIdentifierColumn(data: any[][], startRow: number, startCol: number): number {
  for (let col = startCol; col < Math.min((data[0]?.length || 0), startCol + 3); col++) {
    let textCount = 0;
    let totalCount = 0;
    
    for (let row = startRow; row < Math.min(data.length, startRow + 10); row++) {
      const cell = data[row]?.[col];
      if (cell != null && cell !== '') {
        totalCount++;
        // Look for sample identifiers
        const cellStr = String(cell);
        if (/^(Row\s*[A-H]|[A-H]\d+|Sample|Well|Rep|R\d+)/i.test(cellStr) || 
            (typeof cell === 'string' && isNaN(Number(cell)))) {
          textCount++;
        }
      }
    }
    
    // Sample column should be mostly text/identifiers
    if (totalCount >= 2 && textCount >= totalCount * 0.6) {
      return col;
    }
  }
  return -1;
}

/**
 * Find matrix bounds
 */
function findMatrixBounds(data: any[][], concentrationRow: number, sampleCol: number): {
  isValid: boolean;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  sampleCount: number;
} {
  const dataStartRow = concentrationRow + 1;
  let endRow = dataStartRow;
  let endCol = sampleCol + 1;
  let sampleCount = 0;
  
  // Find end of sample column
  for (let row = dataStartRow; row < data.length; row++) {
    const cell = data[row]?.[sampleCol];
    if (cell != null && cell !== '') {
      endRow = row;
      sampleCount++;
    } else if (sampleCount > 0) {
      break;
    }
  }
  
  // Find end of concentration row
  const concentrationRowData = data[concentrationRow] || [];
  for (let col = sampleCol + 1; col < concentrationRowData.length; col++) {
    const cell = concentrationRowData[col];
    if (cell != null && cell !== '') {
      const num = parseConcentrationValue(cell);
      if (num !== null) {
        endCol = col;
      }
    }
  }
  
  const concentrationCount = endCol - sampleCol;
  const isValid = sampleCount >= 2 && concentrationCount >= 3;
  
  return {
    isValid,
    startRow: concentrationRow,
    endRow,
    startCol: sampleCol,
    endCol,
    sampleCount
  };
}

/**
 * Analyze matrix pattern quality
 */
function analyzeMatrixPattern(data: any[][], bounds: {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  sampleCount: number;
}): { confidence: number } {
  let confidence = 0.4; // Base confidence
  
  // Check data density in the matrix
  let totalCells = 0;
  let filledCells = 0;
  let numericCells = 0;
  
  for (let row = bounds.startRow + 1; row <= bounds.endRow; row++) {
    for (let col = bounds.startCol + 1; col <= bounds.endCol; col++) {
      totalCells++;
      const cell = data[row]?.[col];
      if (cell != null && cell !== '') {
        filledCells++;
        const num = parseConcentrationValue(cell);
        if (num !== null) {
          numericCells++;
        }
      }
    }
  }
  
  const density = totalCells > 0 ? filledCells / totalCells : 0;
  const numericRatio = filledCells > 0 ? numericCells / filledCells : 0;
  
  // High density and numeric content boost confidence
  confidence += density * 0.3 + numericRatio * 0.2;
  
  // Optimal sample count
  if (bounds.sampleCount >= 3 && bounds.sampleCount <= 12) {
    confidence += 0.2;
  }
  
  // Good concentration count
  const concCount = bounds.endCol - bounds.startCol;
  if (concCount >= 4 && concCount <= 12) {
    confidence += 0.1;
  }
  
  return { confidence: Math.min(confidence, 1.0) };
}

/**
 * Extract concentration values from a specific row
 */
function extractConcentrationsFromRow(data: any[][], row: number, startCol: number, endCol: number): number[] {
  const concentrations: number[] = [];
  const rowData = data[row] || [];
  
  for (let col = startCol; col <= endCol; col++) {
    const cell = rowData[col];
    const parsed = parseConcentrationValue(cell);
    if (parsed !== null) {
      concentrations.push(parsed);
    }
  }
  
  return concentrations;
}

/**
 * Detect horizontal dose-response patterns (row-wise patterns)
 */
function detectHorizontalPatterns(data: any[][]): EnhancedDosePattern[] {
  const patterns: EnhancedDosePattern[] = [];
  
  // Look for concentration headers in rows
  for (let row = 0; row < data.length; row++) {
    const rowData = data[row] || [];
    const concentrations = extractConcentrations(rowData);
    
    if (concentrations.validCount >= 3) {
      // Analyze dilution pattern with outlier tolerance
      const dilutionAnalysis = analyzeFlexibleDilutionPattern(concentrations.values);
      
      if (dilutionAnalysis.confidence > 0.3) {
        // Look for response data in subsequent rows
        const responseRows = findResponseRows(data, row + 1, concentrations.indices);
        
        if (responseRows.length > 0) {
          patterns.push({
            boundingBox: {
              startRow: row,
              endRow: row + responseRows.length,
              startColumn: Math.min(...concentrations.indices),
              endColumn: Math.max(...concentrations.indices)
            },
            confidence: Math.min(1.0, (dilutionAnalysis.confidence * 0.8 + 0.2 * (responseRows.length / 10)) + calculateContextualConfidence(data, { startRow: row, endRow: row + responseRows.length, startCol: Math.min(...concentrations.indices), endCol: Math.max(...concentrations.indices) }, row)),
            orientation: 'horizontal',
            patternType: 'horizontal-matrix',
            description: `Horizontal ${dilutionAnalysis.dilutionName} dilution series`,
            concentrationRow: row,
            responseColumns: concentrations.indices,
            responseRows: responseRows.map(r => r.index),
            headerRow: row,
            dilutionFactor: dilutionAnalysis.detectedFactor,
            detectedDilutionFactors: dilutionAnalysis.allFactors,
            outliers: dilutionAnalysis.outliers,
            concentrationRange: {
              min: Math.min(...concentrations.values),
              max: Math.max(...concentrations.values)
            },
            biologicalMetrics: {
              plateFormat: inferPlateFormat(concentrations.validCount, responseRows.length),
              dilutionType: dilutionAnalysis.dilutionName,
              replicateCount: responseRows.length,
              replicateConsistency: calculateReplicateConsistency(responseRows),
              concentrationUnit: 'nM',
              responseType: 'unknown'
            }
          });
        }
      }
    }
  }
  
  console.log(`🔄 HORIZONTAL: Found ${patterns.length} patterns total`);
  return patterns;
}

/**
 * Detect vertical dose-response patterns
 */
function detectVerticalPatterns(data: any[][]): EnhancedDosePattern[] {
  const patterns: EnhancedDosePattern[] = [];
  const maxCols = Math.max(...data.map(row => row?.length || 0));
  
  // Look for concentration headers in columns
  for (let col = 0; col < maxCols; col++) {
    const columnData = data.map(row => row?.[col]);
    const concentrations = extractConcentrations(columnData);
    
    if (concentrations.validCount >= 3) {
      // Analyze dilution pattern with outlier tolerance
      const dilutionAnalysis = analyzeFlexibleDilutionPattern(concentrations.values);
      
      if (dilutionAnalysis.confidence > 0.3) {
        // Look for response data in adjacent columns
        const responseColumns = findResponseColumns(data, col + 1, concentrations.indices);
        
        if (responseColumns.length > 0) {
          patterns.push({
            boundingBox: {
              startRow: Math.min(...concentrations.indices),
              endRow: Math.max(...concentrations.indices),
              startColumn: col,
              endColumn: col + responseColumns.length
            },
            confidence: Math.min(1.0, (dilutionAnalysis.confidence * 0.8 + 0.2 * (responseColumns.length / 10)) + calculateContextualConfidence(data, { startRow: Math.min(...concentrations.indices), endRow: Math.max(...concentrations.indices), startCol: col, endCol: col + responseColumns.length }, Math.min(...concentrations.indices))),
            orientation: 'vertical',
            patternType: 'classic-titration',
            description: `Vertical ${dilutionAnalysis.dilutionName} dilution series`,
            concentrationColumn: col,
            responseColumns: responseColumns.map(c => c.index),
            headerColumn: col,
            dilutionFactor: dilutionAnalysis.detectedFactor,
            detectedDilutionFactors: dilutionAnalysis.allFactors,
            outliers: dilutionAnalysis.outliers,
            concentrationRange: {
              min: Math.min(...concentrations.values),
              max: Math.max(...concentrations.values)
            },
            biologicalMetrics: {
              plateFormat: inferPlateFormat(concentrations.validCount, responseColumns.length),
              dilutionType: dilutionAnalysis.dilutionName,
              replicateCount: responseColumns.length,
              replicateConsistency: calculateReplicateConsistency(responseColumns),
              concentrationUnit: 'nM',
              responseType: 'unknown'
            }
          });
        }
      }
    }
  }
  
  console.log(`🔄 VERTICAL: Found ${patterns.length} patterns total`);
  return patterns;
}

/**
 * Extract and parse concentration values from an array
 */
function extractConcentrations(data: any[]): {values: number[], indices: number[], validCount: number} {
  const values: number[] = [];
  const indices: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const cell = data[i];
    
    // Skip null/undefined/empty
    if (cell === null || cell === undefined || cell === '') {
      continue;
    }
    
    // Try to parse as concentration
    const parsed = parseConcentrationValue(cell);
    if (parsed !== null) {
      values.push(parsed);
      indices.push(i);
    }
  }
  
  return {
    values,
    indices,
    validCount: values.length
  };
}

/**
 * Parse a concentration value - simplified to match original exactly
 */
function parseConcentrationValue(value: any): number | null {
  // Skip null/undefined/empty
  if (value == null || value === '') {
    return null;
  }
  
  // Match original detection logic exactly:
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  
  if (!isNaN(num) && num >= 0 && isFinite(num)) {
    return num;
  } else {
    return null;
  }
}

/**
 * Analyze dilution pattern with expanded factors and outlier tolerance
 */
function analyzeFlexibleDilutionPattern(concentrations: number[]): {
  confidence: number;
  detectedFactor: number;
  allFactors: number[];
  dilutionName: string;
  outliers: OutlierInfo[];
} {
  if (concentrations.length < 3) {
    return {
      confidence: 0,
      detectedFactor: 0,
      allFactors: [],
      dilutionName: 'unknown',
      outliers: []
    };
  }
  
  // Sort concentrations in descending order
  const sorted = [...concentrations].sort((a, b) => b - a);
  
  // Calculate ratios between consecutive concentrations
  const ratios: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] > 0) {
      ratios.push(sorted[i] / sorted[i + 1]);
    }
  }
  
  if (ratios.length === 0) {
    return {
      confidence: 0,
      detectedFactor: 0,
      allFactors: [],
      dilutionName: 'unknown',
      outliers: []
    };
  }
  
  // Test each dilution factor
  const results = [];
  for (const factor of DILUTION_FACTORS) {
    const analysis = analyzeDilutionFactor(ratios, factor);
    results.push({
      factor,
      ...analysis
    });
  }
  
  // Also try to detect custom factor
  const medianRatio = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
  if (!DILUTION_FACTORS.includes(Math.round(medianRatio))) {
    const customAnalysis = analyzeDilutionFactor(ratios, medianRatio);
    results.push({
      factor: medianRatio,
      ...customAnalysis
    });
  }
  
  // Select best result
  const best = results.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );
  
  return {
    confidence: best.confidence,
    detectedFactor: best.factor,
    allFactors: results.filter(r => r.confidence > 0.3).map(r => r.factor),
    dilutionName: COMMON_DILUTION_NAMES[Math.round(best.factor) as keyof typeof COMMON_DILUTION_NAMES] || `${best.factor.toFixed(1)}-fold custom`,
    outliers: best.outliers
  };
}

/**
 * Analyze a specific dilution factor with outlier tolerance
 */
function analyzeDilutionFactor(ratios: number[], expectedFactor: number, maxOutliers: number = 2): {
  confidence: number;
  outliers: OutlierInfo[];
} {
  const tolerance = 0.3; // 30% deviation allowed
  const outliers: OutlierInfo[] = [];
  const validRatios: number[] = [];
  
  // Identify outliers
  ratios.forEach((ratio, index) => {
    const deviation = Math.abs(ratio - expectedFactor) / expectedFactor;
    if (deviation > tolerance) {
      // Prioritize endpoint outliers
      const isEndpoint = index === 0 || index === ratios.length - 1;
      outliers.push({
        position: index,
        value: ratio,
        expectedValue: expectedFactor,
        deviation,
        type: isEndpoint ? 'endpoint' : 'internal'
      });
    } else {
      validRatios.push(ratio);
    }
  });
  
  // Check if too many outliers
  if (outliers.length > maxOutliers) {
    return { confidence: 0, outliers };
  }
  
  // Calculate confidence based on valid ratios
  if (validRatios.length === 0) {
    return { confidence: 0, outliers };
  }
  
  const meanRatio = validRatios.reduce((sum, r) => sum + r, 0) / validRatios.length;
  const variance = validRatios.reduce((sum, r) => sum + Math.pow(r - meanRatio, 2), 0) / validRatios.length;
  const cv = Math.sqrt(variance) / meanRatio;
  
  // Calculate confidence
  const factorAccuracy = 1 - Math.abs(meanRatio - expectedFactor) / expectedFactor;
  const consistency = Math.max(0, 1 - cv);
  const outlierPenalty = Math.min(0.5, outliers.length * 0.15);
  
  const confidence = Math.max(0, (factorAccuracy * consistency) * (1 - outlierPenalty));
  
  // Keep only the most significant outliers
  const significantOutliers = outliers
    .sort((a, b) => {
      // Prioritize endpoints
      if (a.type !== b.type) {
        return a.type === 'endpoint' ? -1 : 1;
      }
      return b.deviation - a.deviation;
    })
    .slice(0, maxOutliers);
  
  return { confidence, outliers: significantOutliers };
}

/**
 * Find response rows that correspond to concentration columns
 */
function findResponseRows(data: any[][], startRow: number, concentrationIndices: number[]): Array<{index: number, values: (number | null)[]}> {
  const responseRows = [];
  
  for (let row = startRow; row < Math.min(data.length, startRow + 20); row++) {
    const rowData = data[row] || [];
    const values = [];
    let validCount = 0;
    
    for (const colIndex of concentrationIndices) {
      const value = rowData[colIndex];
      if (typeof value === 'number' && isFinite(value)) {
        values.push(value);
        validCount++;
      } else {
        values.push(null);
      }
    }
    
    // Require at least 50% valid numeric data
    if (validCount >= concentrationIndices.length * 0.5) {
      responseRows.push({ index: row, values });
    }
  }
  
  return responseRows;
}

/**
 * Find response columns that correspond to concentration rows
 */
function findResponseColumns(data: any[][], startCol: number, concentrationIndices: number[]): Array<{index: number, values: (number | null)[]}> {
  const responseColumns = [];
  const maxCols = Math.max(...data.map(row => row?.length || 0));
  
  for (let col = startCol; col < Math.min(maxCols, startCol + 20); col++) {
    const values = [];
    let validCount = 0;
    
    for (const rowIndex of concentrationIndices) {
      const value = data[rowIndex]?.[col];
      if (typeof value === 'number' && isFinite(value)) {
        values.push(value);
        validCount++;
      } else {
        values.push(null);
      }
    }
    
    // Require at least 50% valid numeric data
    if (validCount >= concentrationIndices.length * 0.5) {
      responseColumns.push({ index: col, values });
    }
  }
  
  return responseColumns;
}

/**
 * Helper functions for pattern analysis
 */
function calculatePatternConsistency(patterns: EnhancedDosePattern[]): number {
  if (patterns.length === 0) return 0;
  if (patterns.length === 1) return patterns[0].confidence;
  
  // Check consistency of dilution factors across patterns
  const factors = patterns.map(p => p.dilutionFactor).filter(f => f !== undefined);
  if (factors.length < 2) return 0.5;
  
  const meanFactor = factors.reduce((sum, f) => sum + f, 0) / factors.length;
  const variance = factors.reduce((sum, f) => sum + Math.pow(f - meanFactor, 2), 0) / factors.length;
  const cv = Math.sqrt(variance) / meanFactor;
  
  return Math.max(0, 1 - cv);
}

function calculateStructuralConfidence(data: any[][], orientation: 'horizontal' | 'vertical'): number {
  // Simple heuristic based on data density and structure
  let filledCells = 0;
  let totalCells = 0;
  
  for (const row of data) {
    if (row) {
      for (const cell of row) {
        totalCells++;
        if (cell !== null && cell !== undefined && cell !== '') {
          filledCells++;
        }
      }
    }
  }
  
  const density = totalCells > 0 ? filledCells / totalCells : 0;
  return density * 0.5 + 0.5; // Baseline 0.5 confidence
}

function calculateConcentrationRange(patterns: EnhancedDosePattern[]): number {
  if (patterns.length === 0) return 0;
  
  const ranges = patterns
    .filter(p => p.concentrationRange)
    .map(p => Math.log10(p.concentrationRange!.max / p.concentrationRange!.min));
  
  if (ranges.length === 0) return 0;
  
  return Math.max(...ranges);
}

function calculateReplicateConsistency(replicates: Array<{values: (number | null)[]}>): number {
  // Calculate CV across replicates
  if (replicates.length < 2) return 1;
  
  const positions = replicates[0].values.length;
  let totalCV = 0;
  let validPositions = 0;
  
  for (let pos = 0; pos < positions; pos++) {
    const values = replicates.map(r => r.values[pos]).filter(v => v !== null) as number[];
    if (values.length >= 2) {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      totalCV += cv;
      validPositions++;
    }
  }
  
  if (validPositions === 0) return 0.5;
  
  const avgCV = totalCV / validPositions;
  return Math.max(0, 1 - avgCV);
}

function inferPlateFormat(concentrations: number, samples: number): '96-well' | '384-well' | 'custom' | 'unknown' {
  const totalWells = concentrations * samples;
  
  if (totalWells <= 96 && totalWells % 8 === 0) return '96-well';
  if (totalWells <= 384 && totalWells % 16 === 0) return '384-well';
  if (totalWells > 0) return 'custom';
  return 'unknown';
}

/**
 * Select best orientation based on comprehensive analysis
 */
function selectBestOrientation(horizontal: OrientationAnalysis, vertical: OrientationAnalysis): OrientationAnalysis {
  // Weight different factors
  const horizontalScore = horizontal.confidence * 0.5 + 
                         horizontal.patternConsistency * 0.2 +
                         horizontal.structuralConfidence * 0.2 +
                         horizontal.concentrationRange * 0.1;
                         
  const verticalScore = vertical.confidence * 0.5 + 
                       vertical.patternConsistency * 0.2 +
                       vertical.structuralConfidence * 0.2 +
                       vertical.concentrationRange * 0.1;
  
  // Slight preference for horizontal (biological assay standard)
  const adjustedHorizontalScore = horizontalScore * 1.1;
  
  return adjustedHorizontalScore >= verticalScore ? horizontal : vertical;
}

/**
 * Filter overlapping patterns, keeping highest confidence
 */
function filterOverlappingPatterns(patterns: EnhancedDosePattern[]): EnhancedDosePattern[] {
  if (patterns.length <= 1) return patterns;
  
  // Sort by confidence descending
  const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);
  const filtered: EnhancedDosePattern[] = [];
  
  for (const pattern of sorted) {
    const overlaps = filtered.some(existing => {
      const rowOverlap = Math.min(pattern.boundingBox.endRow, existing.boundingBox.endRow) - 
                        Math.max(pattern.boundingBox.startRow, existing.boundingBox.startRow);
      const colOverlap = Math.min(pattern.boundingBox.endColumn, existing.boundingBox.endColumn) - 
                        Math.max(pattern.boundingBox.startColumn, existing.boundingBox.startColumn);
      
      if (rowOverlap <= 0 || colOverlap <= 0) return false;
      
      const patternArea = (pattern.boundingBox.endRow - pattern.boundingBox.startRow + 1) * 
                         (pattern.boundingBox.endColumn - pattern.boundingBox.startColumn + 1);
      const overlapArea = rowOverlap * colOverlap;
      
      return overlapArea / patternArea > 0.7; // 70% overlap threshold
    });
    
    if (!overlaps) {
      filtered.push(pattern);
    }
  }
  
  return filtered;
}

/**
 * Calculate contextual confidence boost based on surrounding experimental indicators
 */
function calculateContextualConfidence(
  data: any[][], 
  matrixBounds: any, 
  concentrationHeaderRow: number
): number {
  let contextualBonus = 0;
  const searchRadius = 3; // Check 3 rows/cols around the pattern
  const foundIndicators: string[] = [];
  
  // Define experimental keywords with different weights
  const DOSE_TITRATION_KEYWORDS = [
    'dose', 'concentration', 'dilution', 'titration', 'serial', 'log',
    'nm', 'um', 'mm', 'μm', 'μg/ml', 'ng/ml', 'mg/ml', 'nM', 'μM', 'mM', 'M'
  ];
  
  const EXPERIMENTAL_KEYWORDS = [
    'cd4', 'cd8', 'cd25', 'cd3', 'cd28', 'activation', 'cytotoxicity', 'viability',
    'proliferation', 'stimulation', 'inhibition', 'apoptosis', 'cytokine',
    'il-2', 'il-4', 'il-10', 'ifn', 'tnf', 'assay', 'elisa', 'flow', 'facs',
    'treatment', 'compound', 'drug', 'inhibitor', 'agonist', 'antagonist',
    'control', 'positive', 'negative', 'blank', 'untreated', 'vehicle'
  ];
  
  const SERIES_PATTERNS = [
    /^[A-Z]$/i, // Single letters: A, B, C
    /^Row\s*[A-Z]$/i, // Row A, Row B, Row C
    /^Sample\s*\d+$/i, // Sample 1, Sample 2, Sample 3
    /^Well\s*[A-Z]\d+$/i, // Well A1, Well B2
    /^[A-Z]\d+$/i, // A1, B2, C3 (plate format)
    /^Article\s*\d+$/i, // Article 1, Article 2
    /^Group\s*\d+$/i, // Group 1, Group 2
    /^Condition\s*\d+$/i, // Condition 1, Condition 2
    /^\d+$/i // Just numbers: 1, 2, 3
  ];
  
  // Search area around the matrix
  const searchArea = {
    startRow: Math.max(0, matrixBounds.startRow - searchRadius),
    endRow: Math.min(data.length - 1, matrixBounds.endRow + searchRadius),
    startCol: Math.max(0, matrixBounds.startCol - searchRadius),
    endCol: Math.min((data[0]?.length || 0) - 1, matrixBounds.endCol + searchRadius)
  };
  
  // 1. Check for dose titration context
  let doseContextScore = 0;
  let experimentalContextScore = 0;
  let seriesPatternScore = 0;
  
  for (let row = searchArea.startRow; row <= searchArea.endRow; row++) {
    for (let col = searchArea.startCol; col <= searchArea.endCol; col++) {
      const cell = data[row]?.[col];
      if (cell != null && typeof cell === 'string') {
        const cellText = cell.toLowerCase().trim();
        
        // Check for dose titration keywords
        for (const keyword of DOSE_TITRATION_KEYWORDS) {
          if (cellText.includes(keyword)) {
            doseContextScore += 0.1;
            foundIndicators.push(`dose:${keyword}`);
            break; // Don't double-count same cell
          }
        }
        
        // Check for experimental keywords
        for (const keyword of EXPERIMENTAL_KEYWORDS) {
          if (cellText.includes(keyword)) {
            experimentalContextScore += 0.08;
            foundIndicators.push(`exp:${keyword}`);
            break; // Don't double-count same cell
          }
        }
      }
    }
  }
  
  // 2. Check for series naming patterns in sample identifiers
  const sampleColumn = matrixBounds.startCol;
  const sampleValues: string[] = [];
  
  for (let row = matrixBounds.startRow + 1; row <= matrixBounds.endRow; row++) {
    const sampleCell = data[row]?.[sampleColumn];
    if (sampleCell != null && typeof sampleCell === 'string') {
      sampleValues.push(sampleCell.trim());
    }
  }
  
  // Analyze sample naming patterns
  if (sampleValues.length >= 3) {
    let patternMatches = 0;
    
    for (const pattern of SERIES_PATTERNS) {
      const matches = sampleValues.filter(value => pattern.test(value));
      if (matches.length >= Math.min(3, sampleValues.length * 0.6)) {
        patternMatches++;
        foundIndicators.push(`series:${pattern.source}`);
      }
    }
    
    // Check for sequential numbering
    const numbers = sampleValues.map(v => parseInt(v)).filter(n => !isNaN(n));
    if (numbers.length >= 3) {
      numbers.sort((a, b) => a - b);
      const isSequential = numbers.every((num, i) => i === 0 || num === numbers[i - 1] + 1);
      if (isSequential) {
        patternMatches++;
        foundIndicators.push('series:sequential');
      }
    }
    
    // Check for alphabetical sequence
    const letters = sampleValues
      .map(v => v.match(/^([A-Z])/i)?.[1]?.toLowerCase())
      .filter(l => l !== undefined) as string[];
    
    if (letters.length >= 3) {
      const isAlphabetical = letters.every((letter, i) => {
        return i === 0 || letter.charCodeAt(0) === letters[i - 1].charCodeAt(0) + 1;
      });
      if (isAlphabetical) {
        patternMatches++;
        foundIndicators.push('series:alphabetical');
      }
    }
    
    seriesPatternScore = Math.min(0.2, patternMatches * 0.1);
  }
  
  // 3. Special bonus for concentration header context
  let headerContextScore = 0;
  const headerRow = data[concentrationHeaderRow] || [];
  const headerText = headerRow.slice(0, 3).join(' ').toLowerCase();
  
  if (headerText.includes('concentration') || headerText.includes('dose') || 
      headerText.includes('dilution') || headerText.includes('nm') ||
      headerText.includes('μm') || headerText.includes('mm')) {
    headerContextScore = 0.15;
    foundIndicators.push('header:concentration-context');
  }
  
  // Calculate final contextual bonus
  contextualBonus = Math.min(0.5, // Cap at 0.5 maximum bonus
    doseContextScore + 
    experimentalContextScore + 
    seriesPatternScore + 
    headerContextScore
  );
  
  // Log the contextual analysis
  if (foundIndicators.length > 0) {
    console.log(`🧬 CONTEXTUAL: Found indicators: [${foundIndicators.slice(0, 10).join(', ')}${foundIndicators.length > 10 ? '...' : ''}]`);
    console.log(`🧬 CONTEXTUAL: Scores - dose:${doseContextScore.toFixed(3)}, exp:${experimentalContextScore.toFixed(3)}, series:${seriesPatternScore.toFixed(3)}, header:${headerContextScore.toFixed(3)}`);
  } else {
    console.log(`🧬 CONTEXTUAL: No experimental indicators found in surrounding area`);
  }
  
  return contextualBonus;
}