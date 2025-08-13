/**
 * Enhanced dose-response pattern detection
 * Prioritizes classic dose titration table layouts with biological size constraints
 */

import { applyBiologicalSegmentation, filterBiologicallyRelevantDatasets, BiologicalConstraints } from './biologicalDatasetSegmentation';

export interface DosePattern {
  boundingBox: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  };
  confidence: number;
  patternType: 'classic-titration' | 'concentration-series' | 'multi-dilution' | 'horizontal-matrix' | 'generic';
  description: string;
  concentrationColumn: number;
  responseColumns: number[];
  headerRow: number;
  dilutionFactor?: number;
  concentrationRange?: { min: number; max: number };
  biologicalMetrics?: {
    plateFormat: '96-well' | '384-well' | 'custom' | 'unknown';
    dilutionType: '2-fold' | '3-fold' | '10-fold' | 'log-scale' | 'custom' | 'none';
    replicateCount: number;
    replicateConsistency: number; // 0-1 score
    concentrationUnit: string | null;
    responseType: 'OD' | 'fluorescence' | 'luminescence' | 'inhibition' | 'unknown';
    cvPercent?: number; // Coefficient of variation across replicates
  };
}

/**
 * Detect dose-response patterns with emphasis on biological assay formats
 * Prioritizes horizontal matrix layouts typical in biological assays
 */
export function detectDoseTitrationPatterns(data: any[][]): DosePattern[] {
  console.log('🔍 Starting dose titration pattern detection...');
  const patterns: DosePattern[] = [];
  
  if (!data || data.length < 4) {
    console.log('❌ Insufficient data for pattern detection:', data?.length || 0, 'rows');
    return patterns;
  }
  
  console.log('📊 Input data size:', data.length, 'rows ×', data[0]?.length || 0, 'columns');
  
  // Priority 1: Horizontal matrix patterns (concentrations in top row, samples in left column)
  console.log('\n🏢 PRIORITY 1: Checking horizontal matrix patterns...');
  const matrixPatterns = detectHorizontalMatrixPatterns(data);
  console.log('📈 Horizontal matrix patterns found:', matrixPatterns.length);
  patterns.push(...matrixPatterns);
  
  // Priority 2: Look for biological plate formats
  const biologicalPatterns = detectBiologicalPlatePatterns(data);
  patterns.push(...biologicalPatterns);
  
  // Priority 3: Classic vertical dose-response tables (fallback)
  for (let startRow = 0; startRow < data.length - 3; startRow++) {
    for (let startCol = 0; startCol < (data[startRow]?.length || 0) - 1; startCol++) {
      
      const classicPattern = detectClassicTitrationTable(data, startRow, startCol);
      if (classicPattern) {
        // Lower confidence for classic patterns when matrix patterns exist
        classicPattern.confidence *= matrixPatterns.length > 0 ? 0.7 : 1.0;
        const biologicalBonus = calculateBiologicalDimensionBonus(classicPattern);
        classicPattern.confidence += biologicalBonus;
        patterns.push(classicPattern);
      }
    }
  }
  
  // Sort by biological relevance, then confidence
  console.log('\n📊 FINAL PROCESSING: Calculating biological relevance scores...');
  const sortedPatterns = patterns
    .map(pattern => {
      const originalConfidence = pattern.confidence;
      // Calculate final biological score
      pattern.confidence = calculateBiologicalRelevanceScore(pattern);
      console.log(`🔄 Pattern ${pattern.patternType}: ${originalConfidence.toFixed(2)} → ${pattern.confidence.toFixed(2)}`);
      return pattern;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .filter((pattern, index, arr) => {
      // Remove patterns that significantly overlap with higher confidence ones
      return !arr.slice(0, index).some(existingPattern => 
        calculateOverlap(pattern.boundingBox, existingPattern.boundingBox) > 0.7
      );
    });
  
  console.log(`\n✅ RAW DETECTION COMPLETE: Found ${sortedPatterns.length} patterns`);
  
  // Apply biological segmentation to break down oversized patterns
  console.log('\n🧬 APPLYING BIOLOGICAL SEGMENTATION...');
  const biologicalConstraints: BiologicalConstraints = {
    maxSamplesPerDataset: 8,
    maxConcentrationsPerDataset: 15,
    minSamplesPerDataset: 1,
    minConcentrationsPerDataset: 6,     // Increased to 6 for meaningful dose-response
    preferIndividualCurves: true,
    enableMatrixSegmentation: true
  };
  
  const segmentationResult = applyBiologicalSegmentation(sortedPatterns, data, biologicalConstraints);
  
  console.log(`📊 SEGMENTATION RESULTS:`);
  console.log(`   Original patterns: ${segmentationResult.segmentationStats.totalOriginalPatterns}`);
  console.log(`   Oversized patterns: ${segmentationResult.segmentationStats.oversizedPatterns}`);
  console.log(`   Segmented patterns: ${segmentationResult.segmentationStats.segmentedPatterns}`);
  console.log(`   Final datasets: ${segmentationResult.segmentationStats.finalDatasets}`);
  
  // Convert segmented datasets back to DosePattern format
  const biologicallyRelevantPatterns: DosePattern[] = segmentationResult.segmentedDatasets.map(dataset => ({
    boundingBox: dataset.boundingBox,
    confidence: dataset.biologicalConfidence,
    patternType: dataset.sampleCount === 1 ? 'classic-titration' as const : 
                 dataset.sampleCount <= 4 ? 'multi-dilution' as const : 'horizontal-matrix' as const,
    description: `${dataset.name} - ${dataset.sampleCount} ${dataset.sampleCount === 1 ? 'sample' : 'samples'} × ${dataset.concentrationCount} concentrations`,
    concentrationColumn: dataset.boundingBox.startColumn,
    responseColumns: Array.from({length: dataset.sampleCount}, (_, i) => dataset.boundingBox.startColumn + 1 + i),
    headerRow: dataset.boundingBox.startRow,
    biologicalMetrics: {
      plateFormat: 'custom' as const,
      dilutionType: 'custom' as const,
      replicateCount: dataset.replicateInfo?.replicateCount || dataset.sampleCount,
      replicateConsistency: 0.9,
      concentrationUnit: 'nM',
      responseType: 'unknown' as const
    }
  }));
  
  // Log rejected patterns for transparency
  if (segmentationResult.rejectedPatterns.length > 0) {
    console.log(`\n❌ REJECTED OVERSIZED PATTERNS:`);
    segmentationResult.rejectedPatterns.forEach((rejected, i) => {
      console.log(`   ${i + 1}. ${rejected.size} - ${rejected.reason}`);
    });
  }
  
  // Apply final quality filtering - only return patterns with sufficient biological confidence
  const qualityThreshold = 0.5; // Minimum biological confidence for meaningful dose-response
  const highQualityPatterns = biologicallyRelevantPatterns.filter(pattern => 
    pattern.confidence >= qualityThreshold
  );
  
  console.log(`\n🔍 QUALITY FILTER: ${biologicallyRelevantPatterns.length} → ${highQualityPatterns.length} patterns (threshold: ${qualityThreshold})`);
  
  // Log rejected low-quality patterns
  const rejectedLowQuality = biologicallyRelevantPatterns.filter(pattern => 
    pattern.confidence < qualityThreshold
  );
  if (rejectedLowQuality.length > 0) {
    console.log(`❌ REJECTED LOW-QUALITY PATTERNS: ${rejectedLowQuality.length}`);
    rejectedLowQuality.slice(0, 5).forEach((pattern, i) => {
      console.log(`   ${i + 1}. ${pattern.description} (confidence: ${pattern.confidence.toFixed(2)})`);
    });
    if (rejectedLowQuality.length > 5) {
      console.log(`   ... and ${rejectedLowQuality.length - 5} more`);
    }
  }
  
  console.log(`\n✅ FINAL DETECTION COMPLETE: Returning ${highQualityPatterns.length} high-quality biologically appropriate patterns`);
  highQualityPatterns.forEach((pattern, i) => {
    console.log(`   ${i + 1}. ${pattern.patternType} (confidence: ${pattern.confidence.toFixed(2)}) - ${pattern.description}`);
  });
  
  return highQualityPatterns.slice(0, 15); // Return top 15 high-quality patterns
}

/**
 * Detect classic dose-response titration table with biological context
 * Expected format: Header row, then concentration column followed by response columns
 * Optimized for 96/384-well plate formats and typical dose ranges
 */
function detectClassicTitrationTable(data: any[][], startRow: number, startCol: number): DosePattern | null {
  const maxRows = Math.min(data.length, startRow + 20);
  const maxCols = Math.min(data[startRow]?.length || 0, startCol + 15);
  
  // Look for header row
  const headerRow = findHeaderRow(data, startRow, startCol);
  if (headerRow === -1) return null;
  
  const dataStartRow = headerRow + 1;
  if (dataStartRow >= data.length) return null;
  
  // Look for concentration column (first column with numeric decreasing/increasing pattern)
  const concentrationColumn = findConcentrationColumn(data, dataStartRow, startCol, maxCols);
  if (concentrationColumn === -1) return null;
  
  // Look for response columns (numeric columns after concentration)
  const responseColumns = findResponseColumns(data, dataStartRow, concentrationColumn + 1, maxCols, maxRows);
  if (responseColumns.length === 0) return null;
  
  // Analyze concentration pattern with biological context
  const concentrationAnalysis = analyzeConcentrationPattern(data, dataStartRow, concentrationColumn, maxRows);
  if (!concentrationAnalysis.isValid) return null;
  
  // Enhanced biological analysis
  const bounds = {
    startRow: headerRow,
    endRow: Math.min(maxRows - 1, dataStartRow + concentrationAnalysis.dataLength - 1),
    startColumn: startCol,
    endColumn: Math.max(concentrationColumn, Math.max(...responseColumns))
  };
  
  const biologicalMetrics = analyzeBiologicalCharacteristics(data, bounds, concentrationColumn, responseColumns);
  
  // Calculate comprehensive biological confidence
  const confidence = calculateBiologicalConfidence(
    concentrationAnalysis,
    { columns: responseColumns, consistency: 0.8, cvPercent: 15 },
    data,
    headerRow,
    concentrationColumn
  );
  
  return {
    boundingBox: bounds,
    confidence: Math.min(confidence, 1.0),
    patternType: concentrationAnalysis.isDilutionSeries ? 'classic-titration' : 'concentration-series',
    description: `${responseColumns.length} response column${responseColumns.length > 1 ? 's' : ''} with ${concentrationAnalysis.isDilutionSeries ? 'dilution series' : 'concentration range'}`,
    concentrationColumn,
    responseColumns,
    headerRow,
    dilutionFactor: concentrationAnalysis.dilutionFactor,
    concentrationRange: concentrationAnalysis.range,
    biologicalMetrics
  };
}

/**
 * Detect multi-dilution series (multiple datasets in proximity)
 */
function detectMultiDilutionSeries(data: any[][], startRow: number, startCol: number): DosePattern | null {
  // Look for patterns where multiple titration series are side by side
  const series: Array<{ col: number; pattern: any }> = [];
  const maxCols = Math.min(data[startRow]?.length || 0, startCol + 20);
  
  for (let col = startCol; col < maxCols - 1; col += 3) { // Skip by 3 to find separated series
    const pattern = detectClassicTitrationTable(data, startRow, col);
    if (pattern && pattern.confidence > 0.4) {
      series.push({ col, pattern });
    }
  }
  
  if (series.length < 2) return null;
  
  // Combine series into multi-dilution pattern
  const allResponseColumns = series.flatMap(s => s.pattern.responseColumns);
  const minCol = Math.min(...series.map(s => s.col));
  const maxCol = Math.max(...series.map(s => Math.max(...s.pattern.responseColumns)));
  
  return {
    boundingBox: {
      startRow: series[0].pattern.boundingBox.startRow,
      endRow: Math.max(...series.map(s => s.pattern.boundingBox.endRow)),
      startColumn: minCol,
      endColumn: maxCol
    },
    confidence: Math.max(...series.map(s => s.pattern.confidence)) + 0.1, // Bonus for multi-series
    patternType: 'multi-dilution',
    description: `${series.length} dilution series with ${allResponseColumns.length} total response columns`,
    concentrationColumn: series[0].pattern.concentrationColumn,
    responseColumns: allResponseColumns,
    headerRow: series[0].pattern.headerRow
  };
}

/**
 * Find header row by looking for text/mixed content
 */
function findHeaderRow(data: any[][], startRow: number, startCol: number): number {
  for (let row = startRow; row < Math.min(data.length, startRow + 3); row++) {
    const rowData = data[row] || [];
    let textCells = 0;
    let totalCells = 0;
    
    for (let col = startCol; col < Math.min(rowData.length, startCol + 10); col++) {
      const cell = rowData[col];
      if (cell != null && cell !== '') {
        totalCells++;
        if (typeof cell === 'string' && isNaN(Number(cell))) {
          textCells++;
        }
      }
    }
    
    // Header row should have mostly text
    if (totalCells >= 2 && textCells / totalCells > 0.5) {
      return row;
    }
  }
  
  return startRow; // Fallback to start row
}

/**
 * Find concentration column with biological pattern prioritization
 */
function findConcentrationColumn(data: any[][], startRow: number, startCol: number, maxCol: number): number {
  let bestCol = -1;
  let bestConfidence = 0;
  
  for (let col = startCol; col < maxCol; col++) {
    const pattern = analyzeConcentrationPattern(data, startRow, col, Math.min(data.length, startRow + 15));
    
    if (pattern.isValid && pattern.confidence > 0.3) {
      // Prioritize patterns with biological characteristics
      let adjustedConfidence = pattern.confidence;
      
      // Bonus for optimal dose point count (8-12)
      if (pattern.dataLength >= 8 && pattern.dataLength <= 12) {
        adjustedConfidence += 0.1;
      }
      
      // Bonus for biological dilution patterns
      if (pattern.isDilutionSeries && pattern.dilutionFactor) {
        if ([2, 3, 10].includes(Math.round(pattern.dilutionFactor))) {
          adjustedConfidence += 0.15;
        }
      }
      
      if (adjustedConfidence > bestConfidence) {
        bestConfidence = adjustedConfidence;
        bestCol = col;
      }
    }
  }
  
  return bestCol;
}

/**
 * Find response columns optimized for biological assays
 */
function findResponseColumns(data: any[][], startRow: number, startCol: number, maxCol: number, maxRow: number): number[] {
  const responseColumns: number[] = [];
  
  for (let col = startCol; col < maxCol && responseColumns.length < 12; col++) { // Limit to 12 replicates max
    let numericCount = 0;
    let totalCount = 0;
    const values: number[] = [];
    
    for (let row = startRow; row < maxRow && row < data.length; row++) {
      const cell = data[row]?.[col];
      if (cell != null && cell !== '') {
        totalCount++;
        if (typeof cell === 'number' || !isNaN(Number(cell))) {
          numericCount++;
          const val = typeof cell === 'number' ? cell : Number(cell);
          values.push(val);
        }
      }
    }
    
    // Response column should be mostly numeric
    if (totalCount >= 3 && numericCount / totalCount > 0.7) {
      // Additional biological checks
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
        const cv = (std / mean) * 100;
        
        // Accept if CV is reasonable for biological data (< 50%)
        if (isNaN(cv) || cv < 50) {
          responseColumns.push(col);
        }
      } else {
        responseColumns.push(col);
      }
    }
  }
  
  // Prioritize typical replicate counts (3-8)
  if (responseColumns.length >= 3 && responseColumns.length <= 8) {
    return responseColumns;
  }
  
  // If we have too many, take the first 8 (most common biological replicate count)
  return responseColumns.slice(0, 8);
}

/**
 * Analyze concentration pattern with biological context
 * Optimized for typical dose titration ranges (8-12 points)
 */
function analyzeConcentrationPattern(data: any[][], startRow: number, col: number, maxRow: number): {
  isValid: boolean;
  confidence: number;
  isDilutionSeries: boolean;
  isLogScale: boolean;
  dilutionFactor?: number;
  range?: { min: number; max: number };
  dataLength: number;
} {
  const values: number[] = [];
  
  // Extract numeric values
  for (let row = startRow; row < maxRow && row < data.length; row++) {
    const cell = data[row]?.[col];
    if (cell != null && cell !== '') {
      const num = typeof cell === 'number' ? cell : Number(cell);
      if (!isNaN(num) && num >= 0) {
        values.push(num);
      }
    }
  }
  
  if (values.length < 3) {
    return { isValid: false, confidence: 0, isDilutionSeries: false, isLogScale: false, dataLength: 0 };
  }
  
  // Check for dose patterns (allow for slight variations typical in biological data)
  const isDescending = values.every((val, i) => i === 0 || val <= values[i - 1] * 1.1); // 10% tolerance
  const isAscending = values.every((val, i) => i === 0 || val >= values[i - 1] * 0.9); // 10% tolerance
  
  if (!isDescending && !isAscending) {
    return { isValid: false, confidence: 0, isDilutionSeries: false, isLogScale: false, dataLength: values.length };
  }
  
  // Analyze dilution ratios with biological context
  const dilutionAnalysis = analyzeDilutionRatios(values, isDescending);
  const isDilutionSeries = dilutionAnalysis.dilutionType !== 'none';
  
  // Enhanced log scale analysis
  const logAnalysis = analyzeLogScale(values);
  
  // Calculate biological confidence
  let confidence = 0.4; // Base confidence
  
  // Biological pattern bonuses
  if (isDilutionSeries) {
    confidence += 0.25;
    if (['2-fold', '3-fold', '10-fold'].includes(dilutionAnalysis.dilutionType)) {
      confidence += 0.15; // Common biological dilutions
    }
  }
  
  if (logAnalysis.isLogScale) {
    confidence += 0.2;
  }
  
  // Optimal dose point count bonus (8-12 points)
  if (values.length >= 8 && values.length <= 12) {
    confidence += 0.15; // Sweet spot for dose-response
  } else if (values.length >= 6 && values.length <= 15) {
    confidence += 0.05; // Still good
  }
  
  // Concentration range appropriateness
  const range = Math.max(...values) / Math.min(...values.filter(v => v > 0));
  if (range >= 100 && range <= 10000) {
    confidence += 0.1; // Good dynamic range for biological assays
  }
  
  return {
    isValid: true,
    confidence: Math.min(confidence, 1.0),
    isDilutionSeries,
    isLogScale: logAnalysis.isLogScale,
    dilutionFactor: dilutionAnalysis.avgRatio,
    range: { min: Math.min(...values), max: Math.max(...values) },
    dataLength: values.length
  };
}

/**
 * Check if headers look appropriate for biological dose-response data
 */
function hasGoodHeaders(data: any[][], headerRow: number, concentrationCol: number, responseColumns: number[]): boolean {
  const row = data[headerRow] || [];
  
  // Check concentration header with expanded biological keywords
  const concHeader = String(row[concentrationCol] || '').toLowerCase();
  const concKeywords = [
    'conc', 'dose', 'dilution', 'concentration', 'treatment', 'compound',
    'drug', 'inhibitor', 'agonist', 'antagonist', 'stimulus', 'ligand',
    'µm', 'μm', 'nm', 'pm', 'mm', 'mg/ml', 'µg/ml', 'ng/ml'
  ];
  const hasGoodConcHeader = concKeywords.some(keyword => concHeader.includes(keyword));
  
  // Check response headers with biological assay terms
  const responseHeaders = responseColumns.map(col => String(row[col] || '').toLowerCase());
  const responseKeywords = [
    'response', 'signal', 'od', 'abs', 'absorbance', 'fluorescence', 'flu',
    'lum', 'rlu', 'luminescence', 'sample', 'well', 'replicate', 'rep',
    'viability', 'cytotox', 'activation', 'inhibition', 'binding',
    'proliferation', 'apoptosis', 'survival', 'growth', 'activity'
  ];
  
  const goodResponseHeaders = responseHeaders.filter(header => 
    responseKeywords.some(keyword => header.includes(keyword)) || 
    /^[a-h]\d+$/i.test(header) || // Well names like A1, B2
    /replicate|rep\d+|sample\d+|well\d+/i.test(header) || // Numbered replicates
    /^r\d+$/i.test(header) || // R1, R2, etc.
    /^\d+$/i.test(header) && header.length <= 2 // Simple numeric headers (1, 2, 3)
  ).length;
  
  // More lenient scoring for biological data
  return hasGoodConcHeader || goodResponseHeaders >= Math.min(responseColumns.length * 0.3, 2);
}

/**
 * Calculate overlap between two bounding boxes
 */
function calculateOverlap(box1: any, box2: any): number {
  const intersection = {
    startRow: Math.max(box1.startRow, box2.startRow),
    endRow: Math.min(box1.endRow, box2.endRow),
    startColumn: Math.max(box1.startColumn, box2.startColumn),
    endColumn: Math.min(box1.endColumn, box2.endColumn),
  };
  
  if (intersection.startRow > intersection.endRow || intersection.startColumn > intersection.endColumn) {
    return 0;
  }
  
  const intersectionArea = (intersection.endRow - intersection.startRow + 1) * 
                          (intersection.endColumn - intersection.startColumn + 1);
  const box1Area = (box1.endRow - box1.startRow + 1) * (box1.endColumn - box1.startColumn + 1);
  const box2Area = (box2.endRow - box2.startRow + 1) * (box2.endColumn - box2.startColumn + 1);
  const unionArea = box1Area + box2Area - intersectionArea;
  
  return intersectionArea / unionArea;
}

/**
 * Detect biological plate patterns (96/384-well formats)
 * Prioritizes common assay dimensions: 6-12 x 4-10 data blocks
 */
function detectBiologicalPlatePatterns(data: any[][]): DosePattern[] {
  const patterns: DosePattern[] = [];
  
  // Common biological assay dimensions
  const targetDimensions = [
    { rows: 8, cols: 12, format: '96-well' },    // 96-well plate
    { rows: 12, cols: 8, format: '96-well' },    // 96-well plate (rotated)
    { rows: 16, cols: 24, format: '384-well' },  // 384-well plate
    { rows: 24, cols: 16, format: '384-well' },  // 384-well plate (rotated)
    // Common dose-response block sizes
    { rows: 8, cols: 6, format: 'custom' },
    { rows: 10, cols: 8, format: 'custom' },
    { rows: 12, cols: 6, format: 'custom' },
    { rows: 6, cols: 10, format: 'custom' }
  ];
  
  for (let startRow = 0; startRow < data.length - 5; startRow++) {
    for (let startCol = 0; startCol < (data[0]?.length || 0) - 3; startCol++) {
      
      for (const { rows, cols, format } of targetDimensions) {
        if (startRow + rows >= data.length || startCol + cols >= (data[0]?.length || 0)) {
          continue;
        }
        
        const blockAnalysis = analyzePlateBlock(
          data, startRow, startCol, rows, cols, 0.8 // High tolerance for biological patterns
        );
        
        if (blockAnalysis.isValid && blockAnalysis.confidence > 0.6) {
          const biologicalMetrics = analyzeBiologicalCharacteristics(
            data, blockAnalysis.bounds, 
            blockAnalysis.concentrationCol, 
            blockAnalysis.responseCols
          );
          
          const fullBiologicalMetrics: DosePattern['biologicalMetrics'] = {
            plateFormat: format as '96-well' | '384-well' | 'custom' | 'unknown',
            dilutionType: biologicalMetrics?.dilutionType || 'none',
            replicateCount: biologicalMetrics?.replicateCount || blockAnalysis.responseCols.length,
            replicateConsistency: biologicalMetrics?.replicateConsistency || 0.8,
            concentrationUnit: biologicalMetrics?.concentrationUnit || null,
            responseType: biologicalMetrics?.responseType || 'unknown',
            cvPercent: biologicalMetrics?.cvPercent
          };
          
          patterns.push({
            boundingBox: blockAnalysis.bounds,
            confidence: blockAnalysis.confidence + 0.2, // Bonus for biological format
            patternType: 'classic-titration',
            description: `${format} format: ${blockAnalysis.responseCols.length} replicates, ${format === '96-well' || format === '384-well' ? format : 'dose-response'} layout`,
            concentrationColumn: blockAnalysis.concentrationCol,
            responseColumns: blockAnalysis.responseCols,
            headerRow: blockAnalysis.headerRow,
            dilutionFactor: blockAnalysis.dilutionFactor,
            concentrationRange: blockAnalysis.range,
            biologicalMetrics: fullBiologicalMetrics
          });
        }
      }
    }
  }
  
  return patterns;
}

/**
 * Detect horizontal matrix patterns (concentrations in top row, samples in left column)
 * This is the most common format in biological assays
 */
function detectHorizontalMatrixPatterns(data: any[][]): DosePattern[] {
  console.log('🔍 HORIZONTAL MATRIX DETECTION: Starting detection process');
  console.log(`📊 Input data size: ${data?.length || 0} rows × ${data?.[0]?.length || 0} columns`);
  
  const patterns: DosePattern[] = [];
  
  if (!data || data.length < 3) {
    console.log('❌ DETECTION FAILED: Insufficient data - need at least 3 rows');
    console.log(`   Current data: ${data?.length || 0} rows`);
    return patterns;
  }
  
  console.log('✅ Data size check passed - proceeding with pattern detection');
  
  // Look for patterns where:
  // - Top row contains concentration values (numeric, increasing)
  // - Left column contains sample/well identifiers
  // - Interior forms a data matrix
  
  let searchCount = 0;
  let concentrationHeadersFound = 0;
  let sampleColumnsFound = 0;
  let validMatrixBoundsFound = 0;
  let patternsWithSufficientConfidence = 0;
  
  for (let startRow = 0; startRow < data.length - 2; startRow++) {
    for (let startCol = 0; startCol < (data[startRow]?.length || 0) - 2; startCol++) {
      searchCount++;
      console.log(`🔎 Searching at position [${startRow}, ${startCol}] (search #${searchCount})`);
      
      // Look for concentration header patterns
      console.log(`   Step 1: Looking for concentration header row starting from row ${startRow}`);
      const concentrationHeaderRow = findConcentrationHeaderRow(data, startRow, startCol);
      
      if (concentrationHeaderRow === -1) {
        console.log(`   ❌ Step 1 FAILED: No concentration header found at [${startRow}, ${startCol}]`);
        console.log(`      Checked rows ${startRow} to ${Math.min(data.length, startRow + 3) - 1}`);
        console.log(`      Sample data from row ${startRow}:`, data[startRow]?.slice(startCol, startCol + 10));
        continue;
      }
      
      concentrationHeadersFound++;
      console.log(`   ✅ Step 1 SUCCESS: Concentration header found at row ${concentrationHeaderRow}`);
      console.log(`      Header data:`, data[concentrationHeaderRow]?.slice(startCol, startCol + 15));
      
      // Look for sample identifier column
      console.log(`   Step 2: Looking for sample identifier column starting from row ${concentrationHeaderRow + 1}, col ${startCol}`);
      const sampleColumn = findSampleIdentifierColumn(data, concentrationHeaderRow + 1, startCol);
      
      if (sampleColumn === -1) {
        console.log(`   ❌ Step 2 FAILED: No sample identifier column found`);
        console.log(`      Checked columns ${startCol} to ${Math.min((data[0]?.length || 0), startCol + 3) - 1}`);
        console.log(`      Sample data from first few data rows:`);
        for (let r = concentrationHeaderRow + 1; r < Math.min(data.length, concentrationHeaderRow + 4); r++) {
          console.log(`        Row ${r}:`, data[r]?.slice(startCol, startCol + 5));
        }
        continue;
      }
      
      sampleColumnsFound++;
      console.log(`   ✅ Step 2 SUCCESS: Sample identifier column found at column ${sampleColumn}`);
      console.log(`      Sample identifiers:`, data.slice(concentrationHeaderRow + 1, concentrationHeaderRow + 6).map(row => row?.[sampleColumn]));
      
      // Find the extent of the matrix
      console.log(`   Step 3: Finding matrix bounds with concentration row ${concentrationHeaderRow} and sample column ${sampleColumn}`);
      const matrixBounds = findMatrixBounds(data, concentrationHeaderRow, sampleColumn);
      
      if (!matrixBounds.isValid) {
        console.log(`   ❌ Step 3 FAILED: Invalid matrix bounds`);
        console.log(`      Matrix bounds result:`, matrixBounds);
        continue;
      }
      
      validMatrixBoundsFound++;
      console.log(`   ✅ Step 3 SUCCESS: Valid matrix bounds found`);
      console.log(`      Bounds: rows ${matrixBounds.startRow}-${matrixBounds.endRow}, cols ${matrixBounds.startCol}-${matrixBounds.endCol}`);
      console.log(`      Matrix size: ${matrixBounds.sampleCount} samples × ${matrixBounds.endCol - matrixBounds.startCol} concentrations`);
      
      // Analyze the pattern quality
      console.log(`   Step 4: Analyzing matrix pattern quality`);
      const matrixAnalysis = analyzeMatrixPattern(data, matrixBounds);
      console.log(`      Matrix analysis confidence: ${matrixAnalysis.confidence.toFixed(3)}`);
      
      if (matrixAnalysis.confidence < 0.5) {
        console.log(`   ❌ Step 4 FAILED: Insufficient confidence (${matrixAnalysis.confidence.toFixed(3)} < 0.5)`);
        continue;
      }
      
      patternsWithSufficientConfidence++;
      console.log(`   ✅ Step 4 SUCCESS: Pattern has sufficient confidence (${matrixAnalysis.confidence.toFixed(3)})`);
      
      // Extract concentration values from header row
      console.log(`   Step 5: Extracting concentration values from row ${concentrationHeaderRow}`);
      const concentrations = extractConcentrations(data, concentrationHeaderRow, matrixBounds.startCol + 1, matrixBounds.endCol);
      console.log(`      Extracted ${concentrations.length} concentrations:`, concentrations);
      
      // Create pattern
      const finalConfidence = matrixAnalysis.confidence + 0.3; // Bonus for horizontal matrix format
      console.log(`   Step 6: Creating pattern with final confidence ${finalConfidence.toFixed(3)}`);
      
      const pattern: DosePattern = {
        boundingBox: {
          startRow: matrixBounds.startRow,
          endRow: matrixBounds.endRow,
          startColumn: matrixBounds.startCol,
          endColumn: matrixBounds.endCol
        },
        confidence: finalConfidence,
        patternType: 'horizontal-matrix',
        description: `Horizontal matrix: ${matrixBounds.sampleCount} samples × ${concentrations.length} concentrations`,
        concentrationColumn: -1, // Not applicable for matrix format
        responseColumns: [], // Will be filled by matrix analysis
        headerRow: concentrationHeaderRow,
        concentrationRange: concentrations.length > 0 ? {
          min: Math.min(...concentrations.filter(c => !isNaN(c))),
          max: Math.max(...concentrations.filter(c => !isNaN(c)))
        } : undefined,
        biologicalMetrics: analyzeMatrixBiologicalCharacteristics(data, matrixBounds, concentrations)
      };
      
      console.log(`   ✅ PATTERN CREATED: Successfully created horizontal matrix pattern`);
      console.log(`      Pattern bounds: [${pattern.boundingBox.startRow}-${pattern.boundingBox.endRow}, ${pattern.boundingBox.startColumn}-${pattern.boundingBox.endColumn}]`);
      
      patterns.push(pattern);
    }
  }
  
  console.log('\n📈 HORIZONTAL MATRIX DETECTION SUMMARY:');
  console.log(`   Total search positions: ${searchCount}`);
  console.log(`   Concentration headers found: ${concentrationHeadersFound}`);
  console.log(`   Sample columns found: ${sampleColumnsFound}`);
  console.log(`   Valid matrix bounds found: ${validMatrixBoundsFound}`);
  console.log(`   Patterns with sufficient confidence: ${patternsWithSufficientConfidence}`);
  console.log(`   Final patterns created: ${patterns.length}`);
  
  if (patterns.length > 0) {
    console.log('\n🎯 DETECTED PATTERNS:');
    patterns.forEach((pattern, index) => {
      console.log(`   Pattern ${index + 1}: ${pattern.description} (confidence: ${pattern.confidence.toFixed(3)})`);
    });
  } else {
    console.log('\n❌ NO PATTERNS DETECTED');
    console.log('   Most common failure points:');
    if (concentrationHeadersFound === 0) {
      console.log('   - No concentration headers found (Step 1 failures)');
    }
    if (sampleColumnsFound === 0) {
      console.log('   - No sample identifier columns found (Step 2 failures)');
    }
    if (validMatrixBoundsFound === 0) {
      console.log('   - No valid matrix bounds found (Step 3 failures)');
    }
    if (patternsWithSufficientConfidence === 0) {
      console.log('   - No patterns with sufficient confidence (Step 4 failures)');
    }
  }
  
  return patterns;
}

/**
 * Find concentration header row (contains numeric series like 1.00, 2.00, 3.00)
 */
function findConcentrationHeaderRow(data: any[][], startRow: number, startCol: number): number {
  console.log(`      🔍 Finding concentration header row from row ${startRow}, col ${startCol}`);
  
  for (let row = startRow; row < Math.min(data.length, startRow + 3); row++) {
    const rowData = data[row] || [];
    console.log(`         Checking row ${row} for concentration pattern`);
    
    // Look for a series of numeric values that could be concentrations
    let numericCount = 0;
    let totalNonEmpty = 0;
    const values: number[] = [];
    
    for (let col = startCol + 1; col < Math.min(rowData.length, startCol + 15); col++) {
      const cell = rowData[col];
      if (cell != null && cell !== '') {
        totalNonEmpty++;
        const num = typeof cell === 'number' ? cell : parseFloat(String(cell));
        if (!isNaN(num) && num >= 0) {
          numericCount++;
          values.push(num);
        }
      }
    }
    
    console.log(`         Row ${row}: ${numericCount} numeric values out of ${totalNonEmpty} non-empty cells`);
    console.log(`         Values found: [${values.slice(0, 10).join(', ')}${values.length > 10 ? '...' : ''}]`);
    
    // Check if this looks like a concentration series
    if (numericCount >= 3 && numericCount >= totalNonEmpty * 0.7) {
      console.log(`         ✓ Row ${row} passes numeric criteria (${numericCount} >= 3 and ${numericCount}/${totalNonEmpty} >= 0.7)`);
      
      // Check if values are in increasing or decreasing order (both common in dose series)
      const isIncreasing = values.every((val, i) => i === 0 || val >= values[i - 1]);
      const isDecreasing = values.every((val, i) => i === 0 || val <= values[i - 1]);
      
      console.log(`         Order check: increasing=${isIncreasing}, decreasing=${isDecreasing}`);
      
      if (isIncreasing || isDecreasing) {
        console.log(`         ✅ Row ${row} selected as concentration header (${isIncreasing ? 'increasing' : 'decreasing'} order)`);
        return row;
      } else {
        console.log(`         ❌ Row ${row} rejected: values not in order`);
      }
    } else {
      console.log(`         ❌ Row ${row} rejected: insufficient numeric values`);
    }
  }
  
  console.log(`         ❌ No concentration header row found in range ${startRow} to ${Math.min(data.length, startRow + 3) - 1}`);
  return -1;
}

/**
 * Find sample identifier column (contains well IDs, sample names, etc.)
 */
function findSampleIdentifierColumn(data: any[][], startRow: number, startCol: number): number {
  console.log(`      🔍 Finding sample identifier column from row ${startRow}, col ${startCol}`);
  
  for (let col = startCol; col < Math.min((data[0]?.length || 0), startCol + 3); col++) {
    console.log(`         Checking column ${col} for sample identifiers`);
    
    let textCount = 0;
    let totalCount = 0;
    const sampleValues: string[] = [];
    
    for (let row = startRow; row < Math.min(data.length, startRow + 10); row++) {
      const cell = data[row]?.[col];
      if (cell != null && cell !== '') {
        totalCount++;
        const cellStr = String(cell);
        sampleValues.push(cellStr);
        
        // Look for sample identifiers: Row A, Row B, Well IDs, etc.
        if (/^(Row\s*[A-H]|[A-H]\d+|Sample|Well|Rep|R\d+)/i.test(cellStr) || 
            (typeof cell === 'string' && isNaN(Number(cell)))) {
          textCount++;
        }
      }
    }
    
    console.log(`         Column ${col}: ${textCount} text identifiers out of ${totalCount} non-empty cells`);
    console.log(`         Sample values: [${sampleValues.slice(0, 5).join(', ')}${sampleValues.length > 5 ? '...' : ''}]`);
    
    // Sample column should be mostly text/identifiers
    if (totalCount >= 2 && textCount >= totalCount * 0.6) {
      console.log(`         ✅ Column ${col} selected as sample identifier column (${textCount}/${totalCount} >= 0.6)`);
      return col;
    } else {
      console.log(`         ❌ Column ${col} rejected: insufficient text identifiers (${textCount}/${totalCount} < 0.6 or ${totalCount} < 2)`);
    }
  }
  
  console.log(`         ❌ No sample identifier column found in range ${startCol} to ${Math.min((data[0]?.length || 0), startCol + 3) - 1}`);
  return -1;
}

/**
 * Find the bounds of the data matrix
 */
function findMatrixBounds(data: any[][], concentrationRow: number, sampleCol: number): {
  isValid: boolean;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  sampleCount: number;
} {
  console.log(`      🔍 Finding matrix bounds with concentration row ${concentrationRow}, sample col ${sampleCol}`);
  
  const dataStartRow = concentrationRow + 1;
  let endRow = dataStartRow;
  let endCol = sampleCol + 1;
  let sampleCount = 0;
  
  console.log(`         Starting data analysis from row ${dataStartRow}`);
  
  // Find end of sample column (how many samples)
  console.log(`         Scanning sample column ${sampleCol} for samples:`);
  for (let row = dataStartRow; row < data.length; row++) {
    const cell = data[row]?.[sampleCol];
    if (cell != null && cell !== '') {
      console.log(`           Row ${row}: found sample "${cell}"`);
      endRow = row;
      sampleCount++;
    } else if (sampleCount > 0) {
      console.log(`           Row ${row}: empty cell, stopping sample scan`);
      break; // Stop at first empty cell after finding samples
    } else {
      console.log(`           Row ${row}: empty cell (no samples found yet)`);
    }
  }
  
  console.log(`         Found ${sampleCount} samples in rows ${dataStartRow} to ${endRow}`);
  
  // Find end of concentration row (how many concentrations)
  console.log(`         Scanning concentration row ${concentrationRow} for numeric values:`);
  const concentrationRowData = data[concentrationRow] || [];
  for (let col = sampleCol + 1; col < concentrationRowData.length; col++) {
    const cell = concentrationRowData[col];
    if (cell != null && cell !== '') {
      const num = typeof cell === 'number' ? cell : parseFloat(String(cell));
      if (!isNaN(num)) {
        console.log(`           Col ${col}: found concentration ${num}`);
        endCol = col;
      } else {
        console.log(`           Col ${col}: non-numeric value "${cell}"`);
      }
    } else {
      console.log(`           Col ${col}: empty cell`);
    }
  }
  
  console.log(`         Concentration range: columns ${sampleCol + 1} to ${endCol}`);
  const concentrationCount = endCol - sampleCol;
  
  const isValid = sampleCount >= 2 && concentrationCount >= 3;
  
  console.log(`         Matrix validation: ${sampleCount} samples >= 2? ${sampleCount >= 2}`);
  console.log(`         Matrix validation: ${concentrationCount} concentrations >= 3? ${concentrationCount >= 3}`);
  console.log(`         Matrix bounds valid: ${isValid}`);
  
  const result = {
    isValid,
    startRow: concentrationRow,
    endRow,
    startCol: sampleCol,
    endCol,
    sampleCount
  };
  
  console.log(`         Final bounds:`, result);
  
  return result;
}

/**
 * Analyze the quality of a matrix pattern
 */
function analyzeMatrixPattern(data: any[][], bounds: {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  sampleCount: number;
}): { confidence: number } {
  console.log(`      🔍 Analyzing matrix pattern quality`);
  console.log(`         Matrix bounds: rows ${bounds.startRow}-${bounds.endRow}, cols ${bounds.startCol}-${bounds.endCol}`);
  
  let confidence = 0.4; // Base confidence
  console.log(`         Starting with base confidence: ${confidence}`);
  
  // Check data density in the matrix
  let totalCells = 0;
  let filledCells = 0;
  let numericCells = 0;
  
  console.log(`         Analyzing data matrix content:`);
  for (let row = bounds.startRow + 1; row <= bounds.endRow; row++) {
    for (let col = bounds.startCol + 1; col <= bounds.endCol; col++) {
      totalCells++;
      const cell = data[row]?.[col];
      if (cell != null && cell !== '') {
        filledCells++;
        const num = typeof cell === 'number' ? cell : parseFloat(String(cell));
        if (!isNaN(num)) {
          numericCells++;
        }
      }
    }
  }
  
  const density = totalCells > 0 ? filledCells / totalCells : 0;
  const numericRatio = filledCells > 0 ? numericCells / filledCells : 0;
  
  console.log(`         Data matrix analysis:`);
  console.log(`           Total cells: ${totalCells}`);
  console.log(`           Filled cells: ${filledCells}`);
  console.log(`           Numeric cells: ${numericCells}`);
  console.log(`           Density: ${density.toFixed(3)} (${filledCells}/${totalCells})`);
  console.log(`           Numeric ratio: ${numericRatio.toFixed(3)} (${numericCells}/${filledCells})`);
  
  // High density and numeric content boost confidence
  const densityBonus = density * 0.3;
  const numericBonus = numericRatio * 0.2;
  confidence += densityBonus + numericBonus;
  console.log(`         Density bonus: +${densityBonus.toFixed(3)}, Numeric bonus: +${numericBonus.toFixed(3)}`);
  
  // Optimal sample count (3-12 typical for biological assays)
  if (bounds.sampleCount >= 3 && bounds.sampleCount <= 12) {
    confidence += 0.2;
    console.log(`         Sample count bonus: +0.2 (${bounds.sampleCount} samples is optimal)`);
  } else {
    console.log(`         No sample count bonus (${bounds.sampleCount} samples not in optimal range 3-12)`);
  }
  
  // Good concentration count (4-12 typical)
  const concCount = bounds.endCol - bounds.startCol;
  if (concCount >= 4 && concCount <= 12) {
    confidence += 0.1;
    console.log(`         Concentration count bonus: +0.1 (${concCount} concentrations is good)`);
  } else {
    console.log(`         No concentration count bonus (${concCount} concentrations not in range 4-12)`);
  }
  
  const finalConfidence = Math.min(confidence, 1.0);
  console.log(`         Final confidence: ${finalConfidence.toFixed(3)} (capped at 1.0)`);
  
  return { confidence: finalConfidence };
}

/**
 * Extract concentration values from header row
 */
function extractConcentrations(data: any[][], row: number, startCol: number, endCol: number): number[] {
  const concentrations: number[] = [];
  const rowData = data[row] || [];
  
  for (let col = startCol; col <= endCol; col++) {
    const cell = rowData[col];
    if (cell != null && cell !== '') {
      const num = typeof cell === 'number' ? cell : parseFloat(String(cell));
      if (!isNaN(num)) {
        concentrations.push(num);
      }
    }
  }
  
  return concentrations;
}

/**
 * Analyze biological characteristics of a matrix pattern
 */
function analyzeMatrixBiologicalCharacteristics(
  data: any[][],
  bounds: any,
  concentrations: number[]
): DosePattern['biologicalMetrics'] {
  // Determine dilution pattern from concentrations
  let dilutionType: '2-fold' | '3-fold' | '10-fold' | 'log-scale' | 'custom' | 'none' = 'none';
  
  if (concentrations.length >= 3) {
    const ratios = [];
    for (let i = 1; i < concentrations.length; i++) {
      if (concentrations[i] > 0 && concentrations[i - 1] > 0) {
        ratios.push(concentrations[i] / concentrations[i - 1]);
      }
    }
    
    if (ratios.length > 0) {
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      if (Math.abs(avgRatio - 2) < 0.3) dilutionType = '2-fold';
      else if (Math.abs(avgRatio - 3) < 0.5) dilutionType = '3-fold';
      else if (Math.abs(avgRatio - 10) < 1.5) dilutionType = '10-fold';
      else if (avgRatio > 1.5) dilutionType = 'custom';
    }
  }
  
  return {
    plateFormat: bounds.sampleCount >= 6 && bounds.sampleCount <= 12 ? 'custom' : 'unknown',
    dilutionType,
    replicateCount: bounds.sampleCount,
    replicateConsistency: 0.8,
    concentrationUnit: null,
    responseType: 'unknown'
  };
}

/**
 * Calculate bonus confidence for patterns matching biological dimensions
 */
function calculateBiologicalDimensionBonus(pattern: DosePattern): number {
  const bounds = pattern.boundingBox;
  const rows = bounds.endRow - bounds.startRow + 1;
  const cols = bounds.endColumn - bounds.startColumn + 1;
  
  let bonus = 0;
  
  // Bonus for common dose titration sizes (6-12 x 4-10)
  if ((rows >= 6 && rows <= 12) && (cols >= 4 && cols <= 10)) {
    bonus += 0.15;
  }
  
  // Extra bonus for optimal dose point counts (8-12 points)
  if (rows >= 8 && rows <= 12) {
    bonus += 0.1;
  }
  
  // Bonus for typical replicate counts (3-8)
  if (pattern.responseColumns.length >= 3 && pattern.responseColumns.length <= 8) {
    bonus += 0.1;
  }
  
  // Bonus for biological dilution factors
  if (pattern.dilutionFactor) {
    if ([2, 3, 10].includes(Math.round(pattern.dilutionFactor))) {
      bonus += 0.15;
    }
  }
  
  return bonus;
}

// Enhanced helper functions for biological analysis

/**
 * Analyze dilution ratios with biological context
 */
function analyzeDilutionRatios(values: number[], isDescending: boolean): {
  ratios: number[];
  dilutionType: '2-fold' | '3-fold' | '10-fold' | 'log-scale' | 'custom' | 'none';
  avgRatio: number | undefined;
} {
  const ratios = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > 0 && values[i - 1] > 0) {
      const ratio = isDescending ? values[i - 1] / values[i] : values[i] / values[i - 1];
      if (ratio > 1.1 && ratio < 50) { // Reasonable dilution range
        ratios.push(ratio);
      }
    }
  }
  
  if (ratios.length < 2) {
    return { ratios: [], dilutionType: 'none', avgRatio: undefined };
  }
  
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const isConsistent = ratios.every(r => Math.abs(r - avgRatio) / avgRatio < 0.25);
  
  if (!isConsistent) {
    return { ratios, dilutionType: 'custom', avgRatio };
  }
  
  // Classify dilution type
  let dilutionType: '2-fold' | '3-fold' | '10-fold' | 'log-scale' | 'custom' | 'none';
  if (Math.abs(avgRatio - 2) < 0.3) dilutionType = '2-fold';
  else if (Math.abs(avgRatio - 3) < 0.5) dilutionType = '3-fold';
  else if (Math.abs(avgRatio - 10) < 1.5) dilutionType = '10-fold';
  else if (avgRatio >= 9 && avgRatio <= 11) dilutionType = 'log-scale';
  else dilutionType = 'custom';
  
  return { ratios, dilutionType, avgRatio: Math.round(avgRatio * 100) / 100 };
}

/**
 * Detect concentration units in text
 */
function detectConcentrationUnit(strings: string[]): string | undefined {
  const unitPatterns = [
    { pattern: /µm|μm/i, unit: 'µM' },
    { pattern: /nm/i, unit: 'nM' },
    { pattern: /pm/i, unit: 'pM' },
    { pattern: /mm(?!\d)/i, unit: 'mM' }, // Avoid matching in dates
    { pattern: /mg\/ml/i, unit: 'mg/mL' },
    { pattern: /µg\/ml|μg\/ml/i, unit: 'µg/mL' },
    { pattern: /ng\/ml/i, unit: 'ng/mL' }
  ];
  
  const allText = strings.join(' ');
  for (const { pattern, unit } of unitPatterns) {
    if (pattern.test(allText)) return unit;
  }
  
  return undefined;
}

/**
 * Enhanced log scale analysis
 */
function analyzeLogScale(values: number[]): { isLogScale: boolean; logSpacing: number } {
  const positiveValues = values.filter(v => v > 0);
  if (positiveValues.length < 4) return { isLogScale: false, logSpacing: 0 };
  
  const logValues = positiveValues.map(v => Math.log10(v));
  const spacings = [];
  
  for (let i = 1; i < logValues.length; i++) {
    spacings.push(Math.abs(logValues[i] - logValues[i - 1]));
  }
  
  const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
  const isConsistent = spacings.every(s => Math.abs(s - avgSpacing) / avgSpacing < 0.4);
  const isLogScale = isConsistent && avgSpacing > 0.2 && avgSpacing < 2;
  
  return { isLogScale, logSpacing: avgSpacing };
}

/**
 * Calculate biological confidence score
 */
function calculateConcentrationConfidence(analysis: {
  values: number[];
  isDilutionSeries: boolean;
  dilutionType: string;
  avgRatio?: number;
  biologicalUnit?: string;
  logAnalysis: { isLogScale: boolean; logSpacing: number };
  ratios: number[];
}): number {
  let confidence = 0.4; // Base confidence
  
  // Strong biological indicators
  if (analysis.isDilutionSeries) confidence += 0.25;
  if (['2-fold', '3-fold', '10-fold'].includes(analysis.dilutionType)) confidence += 0.2;
  if (analysis.biologicalUnit) confidence += 0.15;
  if (analysis.logAnalysis.isLogScale) confidence += 0.15;
  
  // Data quality indicators
  if (analysis.values.length >= 6 && analysis.values.length <= 12) confidence += 0.1;
  if (analysis.ratios.length >= 4) confidence += 0.05;
  
  // Range appropriateness
  const range = Math.max(...analysis.values) / Math.min(...analysis.values.filter(v => v > 0));
  if (range >= 100 && range <= 10000) confidence += 0.1; // Good dose range
  
  return confidence;
}

/**
 * Analyze replicate consistency
 */
function analyzeReplicateConsistency(values: number[][], columns: number[]): {
  replicateGroups: number[][];
  consistency: number;
  cvPercent: number;
} {
  if (values.length === 0) {
    return { replicateGroups: [], consistency: 0, cvPercent: 0 };
  }
  
  // Calculate CV for each concentration point
  const cvs: number[] = [];
  
  for (let i = 0; i < values[0].length; i++) {
    const pointValues = values.map(col => col[i]).filter(v => !isNaN(v));
    if (pointValues.length >= 2) {
      const mean = pointValues.reduce((a, b) => a + b, 0) / pointValues.length;
      const std = Math.sqrt(pointValues.reduce((a, b) => a + (b - mean) ** 2, 0) / pointValues.length);
      const cv = (std / mean) * 100;
      if (cv < 100) cvs.push(cv); // Exclude outliers
    }
  }
  
  const avgCV = cvs.length > 0 ? cvs.reduce((a, b) => a + b, 0) / cvs.length : 0;
  const consistency = Math.max(0, 1 - avgCV / 50); // Scale: 0% CV = 1.0, 50% CV = 0.0
  
  // Simple replicate grouping (assume all response columns are replicates)
  const replicateGroups = [columns];
  
  return {
    replicateGroups,
    consistency,
    cvPercent: avgCV
  };
}

/**
 * Calculate biological relevance score with enhanced biological factors
 */
function calculateBiologicalRelevanceScore(pattern: DosePattern): number {
  let score = pattern.confidence;
  const bounds = pattern.boundingBox;
  const rows = bounds.endRow - bounds.startRow + 1;
  const cols = bounds.endColumn - bounds.startColumn + 1;
  
  // Special bonus for horizontal matrix patterns (most common in biology)
  if (pattern.description?.includes('Horizontal matrix')) {
    score += 0.3;
  }
  
  // Dimension-based scoring for matrix patterns
  if ((rows >= 3 && rows <= 15) && (cols >= 4 && cols <= 15)) {
    score += 0.2; // Good biological matrix dimensions
  }
  
  // Sample count bonus (3-12 is typical)
  if (rows >= 3 && rows <= 12) {
    score += 0.15;
  }
  
  // Concentration point bonus (4-12 is optimal)
  if (cols >= 4 && cols <= 12) {
    score += 0.15;
  }
  
  if (pattern.biologicalMetrics) {
    const metrics = pattern.biologicalMetrics;
    
    // Plate format bonus (96/384-well plates are gold standard)
    if (['96-well', '384-well'].includes(metrics.plateFormat)) {
      score += 0.25; // Higher bonus for standard formats
    } else if (metrics.plateFormat === 'custom') {
      score += 0.1;
    }
    
    // Dilution type bonus (common biological dilutions)
    if (['2-fold', '3-fold', '10-fold'].includes(metrics.dilutionType)) {
      score += 0.2;
    } else if (metrics.dilutionType === 'log-scale') {
      score += 0.15;
    }
    
    // Replicate analysis bonus (3-12 samples typical)
    if (metrics.replicateCount >= 3 && metrics.replicateCount <= 12) {
      score += 0.15;
    } else if (metrics.replicateCount >= 2) {
      score += 0.05;
    }
    
    if (metrics.replicateConsistency > 0.7) score += 0.1;
    
    // CV bonus (lower is better for biological assays)
    if (metrics.cvPercent) {
      if (metrics.cvPercent < 10) score += 0.15; // Excellent reproducibility
      else if (metrics.cvPercent < 20) score += 0.1; // Good reproducibility
      else if (metrics.cvPercent < 30) score += 0.05; // Acceptable
    }
    
    // Unit detection bonus (biological concentrations)
    if (metrics.concentrationUnit) score += 0.1;
    
    // Response type bonus (biological readouts)
    if (['OD', 'fluorescence', 'luminescence'].includes(metrics.responseType)) {
      score += 0.05;
    }
  }
  
  // Penalize overly large or small patterns
  if (rows < 4 || cols < 3) score -= 0.2;
  if (rows > 20 || cols > 15) score -= 0.1;
  
  return Math.min(score, 1.0);
}

/**
 * Analyze biological characteristics with comprehensive detection
 */
function analyzeBiologicalCharacteristics(
  data: any[][],
  bounds: { startRow: number; endRow: number; startColumn: number; endColumn: number },
  concentrationCol: number,
  responseColumns: number[]
): DosePattern['biologicalMetrics'] {
  // Determine plate format based on dimensions
  const rows = bounds.endRow - bounds.startRow + 1;
  const cols = bounds.endColumn - bounds.startColumn + 1;
  
  let plateFormat: '96-well' | '384-well' | 'custom' | 'unknown';
  if ((rows === 8 && cols === 12) || (rows === 12 && cols === 8)) {
    plateFormat = '96-well';
  } else if ((rows === 16 && cols === 24) || (rows === 24 && cols === 16)) {
    plateFormat = '384-well';
  } else if (rows >= 6 && rows <= 12 && cols >= 4 && cols <= 12) {
    plateFormat = 'custom';
  } else {
    plateFormat = 'unknown';
  }
  
  // Analyze concentration pattern  
  const concPattern = analyzeConcentrationPattern(
    data, bounds.startRow + 1, concentrationCol, bounds.endRow + 1
  );
  
  // Detect concentration unit from data and headers
  const headerRow = data[bounds.startRow] || [];
  const concentrationHeader = String(headerRow[concentrationCol] || '').toLowerCase();
  const concentrationValues = [];
  for (let row = bounds.startRow + 1; row <= bounds.endRow; row++) {
    const cell = data[row]?.[concentrationCol];
    if (cell != null) {
      concentrationValues.push(String(cell));
    }
  }
  
  const concentrationUnit = detectConcentrationUnit([concentrationHeader, ...concentrationValues]);
  
  // Analyze dilution pattern with biological context
  const dilutionAnalysis = analyzeDilutionRatios(
    concentrationValues.map(v => parseFloat(v)).filter(v => !isNaN(v)),
    true // assume descending for now
  );
  
  // Analyze response data quality
  const responseData: number[][] = [];
  for (const col of responseColumns) {
    const colData: number[] = [];
    for (let row = bounds.startRow + 1; row <= bounds.endRow; row++) {
      const cell = data[row]?.[col];
      const val = typeof cell === 'number' ? cell : parseFloat(String(cell || ''));
      if (!isNaN(val)) colData.push(val);
    }
    if (colData.length > 0) responseData.push(colData);
  }
  
  // Calculate replicate consistency
  const replicateAnalysis = analyzeReplicateConsistency(responseData, responseColumns);
  
  // Detect response type from headers and values
  const responseHeaders = responseColumns.map(col => String(headerRow[col] || '').toLowerCase());
  const allResponseText = responseHeaders.join(' ');
  
  let responseType: 'OD' | 'fluorescence' | 'luminescence' | 'inhibition' | 'unknown';
  if (/od|abs|absorbance/i.test(allResponseText)) responseType = 'OD';
  else if (/flu|fluorescence|gfp|yfp|cfp|rfp/i.test(allResponseText)) responseType = 'fluorescence';
  else if (/lum|rlu|luminescence|luciferase/i.test(allResponseText)) responseType = 'luminescence';
  else if (/inhibition|%|percent|viability|survival/i.test(allResponseText)) responseType = 'inhibition';
  else responseType = 'unknown';
  
  return {
    plateFormat,
    dilutionType: dilutionAnalysis.dilutionType,
    replicateCount: responseColumns.length,
    replicateConsistency: replicateAnalysis.consistency,
    concentrationUnit: concentrationUnit || null,
    responseType,
    cvPercent: replicateAnalysis.cvPercent
  };
}

/**
 * Analyze a plate block for biological characteristics
 */
function analyzePlateBlock(
  data: any[][],
  startRow: number,
  startCol: number,
  targetRows: number,
  targetCols: number,
  tolerance: number
): {
  isValid: boolean;
  confidence: number;
  bounds: { startRow: number; endRow: number; startColumn: number; endColumn: number };
  concentrationCol: number;
  responseCols: number[];
  headerRow: number;
  dilutionFactor?: number;
  range?: { min: number; max: number };
} {
  const endRow = Math.min(startRow + targetRows - 1, data.length - 1);
  const endCol = Math.min(startCol + targetCols - 1, (data[0]?.length || 0) - 1);
  
  // Check data density in the block
  let totalCells = 0;
  let filledCells = 0;
  let numericCells = 0;
  
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      totalCells++;
      const cell = data[row]?.[col];
      if (cell != null && cell !== '') {
        filledCells++;
        if (typeof cell === 'number' || !isNaN(Number(cell))) {
          numericCells++;
        }
      }
    }
  }
  
  const density = filledCells / totalCells;
  const numericRatio = filledCells > 0 ? numericCells / filledCells : 0;
  
  if (density < 0.5 || numericRatio < 0.6) {
    return {
      isValid: false,
      confidence: 0,
      bounds: { startRow, endRow, startColumn: startCol, endColumn: endCol },
      concentrationCol: -1,
      responseCols: [],
      headerRow: startRow
    };
  }
  
  // Look for concentration column (usually first or second column)
  const headerRow = findHeaderRow(data, startRow, startCol);
  const dataStartRow = headerRow + 1;
  
  let concentrationCol = -1;
  let maxConfidence = 0;
  
  for (let col = startCol; col <= Math.min(startCol + 2, endCol); col++) {
    const pattern = analyzeConcentrationPattern(data, dataStartRow, col, endRow + 1);
    if (pattern.isValid && pattern.confidence > maxConfidence) {
      maxConfidence = pattern.confidence;
      concentrationCol = col;
    }
  }
  
  if (concentrationCol === -1) {
    return {
      isValid: false,
      confidence: 0,
      bounds: { startRow, endRow, startColumn: startCol, endColumn: endCol },
      concentrationCol: -1,
      responseCols: [],
      headerRow
    };
  }
  
  // Find response columns
  const responseColumns = findResponseColumns(
    data, dataStartRow, concentrationCol + 1, endCol + 1, endRow + 1
  );
  const responseAnalysis = { columns: responseColumns, consistency: 0.8, cvPercent: 15 };
  
  if (responseAnalysis.columns.length === 0) {
    return {
      isValid: false,
      confidence: 0,
      bounds: { startRow, endRow, startColumn: startCol, endColumn: endCol },
      concentrationCol,
      responseCols: [],
      headerRow
    };
  }
  
  // Calculate overall confidence
  const concPattern = analyzeConcentrationPattern(data, dataStartRow, concentrationCol, endRow + 1);
  let confidence = (density + numericRatio + maxConfidence + responseAnalysis.consistency) / 4;
  
  // Bonus for good replicate count (3-8 typical)
  if (responseAnalysis.columns.length >= 3 && responseAnalysis.columns.length <= 8) {
    confidence += 0.1;
  }
  
  return {
    isValid: true,
    confidence: Math.min(confidence, 1.0),
    bounds: { startRow, endRow, startColumn: startCol, endColumn: endCol },
    concentrationCol,
    responseCols: responseAnalysis.columns,
    headerRow,
    dilutionFactor: concPattern.dilutionFactor,
    range: concPattern.range
  };
}

/**
 * Calculate biological confidence with comprehensive factors
 */
function calculateBiologicalConfidence(
  concentrationAnalysis: any,
  responseAnalysis: any,
  data: any[][],
  headerRow: number,
  concentrationColumn: number
): number {
  let confidence = 0.5; // Base confidence
  
  // Concentration analysis factors
  if (concentrationAnalysis.isDilutionSeries) confidence += 0.2;
  if (['2-fold', '3-fold', '10-fold'].includes(concentrationAnalysis.dilutionType)) confidence += 0.15;
  if (concentrationAnalysis.biologicalUnit) confidence += 0.1;
  if (concentrationAnalysis.isLogScale) confidence += 0.1;
  
  // Response analysis factors
  if (responseAnalysis.columns.length >= 3 && responseAnalysis.columns.length <= 8) confidence += 0.1;
  if (responseAnalysis.consistency > 0.7) confidence += 0.1;
  if (responseAnalysis.cvPercent < 25) confidence += 0.05;
  
  // Header analysis
  const hasGoodHeadersResult = hasGoodHeaders(data, headerRow, concentrationColumn, responseAnalysis.columns);
  confidence += hasGoodHeadersResult ? 0.2 : 0;
  
  // Data length (typical assay point count)
  if (concentrationAnalysis.dataLength >= 6 && concentrationAnalysis.dataLength <= 12) {
    confidence += 0.05;
  }
  
  return confidence;
}