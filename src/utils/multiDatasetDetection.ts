/**
 * Multi-Dataset Detection for nVitro Studio
 * Scans Excel sheets for multiple data blocks and identifies boundaries
 */

import { CellData, DetectionResult, analyzeExcelData } from './dataDetection';
import { analyzeDilutionPattern, ConcentrationAnalysis } from './dilutionPatterns';

export interface DataBlock {
  id: string;
  name: string;
  bounds: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  };
  data: any[][];
  cellData: CellData[][];
  detection: DetectionResult;
  concentrationAnalysis?: ConcentrationAnalysis;
  confidence: number;
  layout: 'vertical' | 'horizontal' | 'block';
  hasValidPattern: boolean;
}

export interface MultiDatasetResult {
  totalBlocks: number;
  validBlocks: number;
  blocks: DataBlock[];
  layout: 'single' | 'vertical_stack' | 'horizontal_layout' | 'grid' | 'mixed';
  confidence: number;
  recommendations: string[];
}

export interface ScanOptions {
  minRows?: number; // Minimum rows for a valid dataset
  minCols?: number; // Minimum columns for a valid dataset
  maxGapRows?: number; // Maximum empty rows between datasets
  maxGapCols?: number; // Maximum empty columns between datasets
  requireHeaders?: boolean; // Whether headers are required
  requirePatterns?: boolean; // Whether dilution patterns are required
  // NEW: Biological size constraints for dose-response datasets
  maxSamplesPerDataset?: number; // Maximum samples in a single dataset (biological limit)
  maxConcentrationsPerDataset?: number; // Maximum concentration points per dataset
  enableMatrixSegmentation?: boolean; // Whether to segment large matrices
  replicateDetectionThreshold?: number; // Similarity threshold for detecting replicates
  preferIndividualCurves?: boolean; // Prioritize individual dose-response curves
}

/**
 * Scans entire Excel sheet for multiple datasets
 */
export function scanForMultipleDatasets(
  rawData: any[][],
  options: ScanOptions = {}
): MultiDatasetResult {
  const defaultOptions: ScanOptions = {
    minRows: 3,
    minCols: 2,
    maxGapRows: 3,
    maxGapCols: 2,
    requireHeaders: false,
    requirePatterns: true,
    // NEW: Biological constraints for dose-response datasets
    maxSamplesPerDataset: 8, // Maximum 8 samples per dataset (biological limit)
    maxConcentrationsPerDataset: 15, // Maximum 15 concentration points
    enableMatrixSegmentation: true, // Enable segmentation of large matrices
    replicateDetectionThreshold: 0.8, // 80% similarity for replicate detection
    preferIndividualCurves: true // Prioritize individual dose-response curves
  };

  const opts = { ...defaultOptions, ...options };
  
  const result: MultiDatasetResult = {
    totalBlocks: 0,
    validBlocks: 0,
    blocks: [],
    layout: 'single',
    confidence: 0,
    recommendations: []
  };

  // Convert raw data to cell data for analysis
  const cellData = convertToCellData(rawData);
  
  // Step 1: Identify potential data regions
  const dataRegions = identifyDataRegions(cellData, opts);
  
  // Step 2: Analyze each region for dataset characteristics
  const blocks: DataBlock[] = [];
  for (let i = 0; i < dataRegions.length; i++) {
    const region = dataRegions[i];
    const block = analyzeDataBlock(region, cellData, rawData, i, opts);
    if (block) {
      // NEW: Check if block needs segmentation based on biological constraints
      if (opts.enableMatrixSegmentation && isOversizedMatrix(block, opts)) {
        const segmentedBlocks = segmentOversizedMatrix(block, cellData, rawData, opts);
        blocks.push(...segmentedBlocks);
      } else {
        blocks.push(block);
      }
    }
  }

  result.blocks = blocks;
  result.totalBlocks = blocks.length;
  result.validBlocks = blocks.filter(b => b.hasValidPattern).length;

  // Step 3: Determine overall layout pattern
  result.layout = determineOverallLayout(blocks, cellData);
  
  // Step 4: Calculate overall confidence
  result.confidence = calculateOverallConfidence(blocks);
  
  // Step 5: Generate recommendations
  result.recommendations = generateRecommendations(result, opts);

  return result;
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
 * Identifies potential data regions in the sheet
 */
function identifyDataRegions(
  cellData: CellData[][],
  options: ScanOptions
): Array<{ startRow: number; endRow: number; startCol: number; endCol: number }> {
  const regions: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }> = [];
  
  // Create a density map of non-empty cells
  const densityMap = createDensityMap(cellData);
  
  // Find connected regions of data
  const visited = new Set<string>();
  
  for (let row = 0; row < cellData.length; row++) {
    for (let col = 0; col < (cellData[row]?.length || 0); col++) {
      const key = `${row},${col}`;
      
      if (visited.has(key) || densityMap[row]?.[col] === 0) {
        continue;
      }
      
      // Start flood fill to find connected region
      const region = floodFillRegion(densityMap, row, col, visited);
      
      if (region && 
          region.endRow - region.startRow + 1 >= (options.minRows || 3) &&
          region.endCol - region.startCol + 1 >= (options.minCols || 2)) {
        regions.push(region);
      }
    }
  }
  
  // Merge nearby regions that might be separated by small gaps
  return mergeNearbyRegions(regions, options);
}

/**
 * Creates a density map showing data concentration
 */
function createDensityMap(cellData: CellData[][]): number[][] {
  const densityMap: number[][] = [];
  
  for (let row = 0; row < cellData.length; row++) {
    densityMap[row] = [];
    for (let col = 0; col < (cellData[row]?.length || 0); col++) {
      const cell = cellData[row]?.[col];
      densityMap[row][col] = (cell && cell.type !== 'empty') ? 1 : 0;
    }
  }
  
  return densityMap;
}

/**
 * Flood fill algorithm to find connected data regions
 */
function floodFillRegion(
  densityMap: number[][],
  startRow: number,
  startCol: number,
  visited: Set<string>
): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
  const stack = [{row: startRow, col: startCol}];
  const cells: Array<{row: number; col: number}> = [];
  
  while (stack.length > 0) {
    const {row, col} = stack.pop()!;
    const key = `${row},${col}`;
    
    if (visited.has(key) || 
        row < 0 || row >= densityMap.length ||
        col < 0 || col >= (densityMap[row]?.length || 0) ||
        densityMap[row]?.[col] === 0) {
      continue;
    }
    
    visited.add(key);
    cells.push({row, col});
    
    // Add adjacent cells (4-connectivity)
    stack.push(
      {row: row - 1, col},
      {row: row + 1, col},
      {row, col: col - 1},
      {row, col: col + 1}
    );
  }
  
  if (cells.length === 0) return null;
  
  const rows = cells.map(c => c.row);
  const cols = cells.map(c => c.col);
  
  return {
    startRow: Math.min(...rows),
    endRow: Math.max(...rows),
    startCol: Math.min(...cols),
    endCol: Math.max(...cols)
  };
}

/**
 * Merges nearby regions that might be separated by small gaps
 */
function mergeNearbyRegions(
  regions: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }>,
  options: ScanOptions
): Array<{ startRow: number; endRow: number; startCol: number; endCol: number }> {
  if (regions.length <= 1) return regions;
  
  const maxGapRows = options.maxGapRows || 3;
  const maxGapCols = options.maxGapCols || 2;
  
  const merged: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }> = [];
  const used = new Set<number>();
  
  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;
    
    let current = regions[i];
    used.add(i);
    
    // Look for nearby regions to merge
    let foundMerge = true;
    while (foundMerge) {
      foundMerge = false;
      
      for (let j = 0; j < regions.length; j++) {
        if (used.has(j)) continue;
        
        const other = regions[j];
        
        // Check if regions are close enough to merge
        const rowGap = Math.max(0, other.startRow - current.endRow - 1, current.startRow - other.endRow - 1);
        const colGap = Math.max(0, other.startCol - current.endCol - 1, current.startCol - other.endCol - 1);
        
        if (rowGap <= maxGapRows && colGap <= maxGapCols) {
          // Merge regions
          current = {
            startRow: Math.min(current.startRow, other.startRow),
            endRow: Math.max(current.endRow, other.endRow),
            startCol: Math.min(current.startCol, other.startCol),
            endCol: Math.max(current.endCol, other.endCol)
          };
          used.add(j);
          foundMerge = true;
        }
      }
    }
    
    merged.push(current);
  }
  
  return merged;
}

/**
 * Analyzes a data block to determine if it's a valid dataset
 */
function analyzeDataBlock(
  region: { startRow: number; endRow: number; startCol: number; endCol: number },
  cellData: CellData[][],
  rawData: any[][],
  index: number,
  options: ScanOptions
): DataBlock | null {
  // Extract data for this region
  const blockData: any[][] = [];
  const blockCellData: CellData[][] = [];
  
  for (let row = region.startRow; row <= region.endRow; row++) {
    const dataRow: any[] = [];
    const cellRow: CellData[] = [];
    
    for (let col = region.startCol; col <= region.endCol; col++) {
      dataRow.push(rawData[row]?.[col] || null);
      cellRow.push(cellData[row]?.[col] || {
        value: null,
        type: 'empty',
        originalValue: null,
        row,
        column: col
      });
    }
    
    blockData.push(dataRow);
    blockCellData.push(cellRow);
  }
  
  // Run standard detection on this block
  const detection = analyzeExcelData(blockData);
  
  // Analyze concentration patterns if a concentration column was detected
  let concentrationAnalysis: ConcentrationAnalysis | undefined;
  let hasValidPattern = false;
  
  if (detection.concentrationColumn >= 0 && detection.dataStartRow >= 0) {
    const concValues: any[] = [];
    for (let row = detection.dataStartRow; row < blockData.length; row++) {
      concValues.push(blockData[row]?.[detection.concentrationColumn]);
    }
    
    concentrationAnalysis = analyzeDilutionPattern(concValues);
    hasValidPattern = concentrationAnalysis.isValid && detection.confidence > 0.4;
  }
  
  // Determine layout orientation
  const layout = determineBlockLayout(region);
  
  // Calculate block confidence
  const blockConfidence = calculateBlockConfidence(detection, concentrationAnalysis, options);
  
  // Generate block name
  const blockName = generateBlockName(index, region, detection);
  
  return {
    id: `block_${index}`,
    name: blockName,
    bounds: region,
    data: blockData,
    cellData: blockCellData,
    detection,
    concentrationAnalysis,
    confidence: blockConfidence,
    layout,
    hasValidPattern
  };
}

/**
 * Determines the layout orientation of a block
 */
function determineBlockLayout(
  region: { startRow: number; endRow: number; startCol: number; endCol: number }
): 'vertical' | 'horizontal' | 'block' {
  const height = region.endRow - region.startRow + 1;
  const width = region.endCol - region.startCol + 1;
  
  if (height > width * 1.5) return 'vertical';
  if (width > height * 1.5) return 'horizontal';
  return 'block';
}

/**
 * Calculates confidence score for a block with biological relevance weighting
 */
function calculateBlockConfidence(
  detection: DetectionResult,
  concentrationAnalysis?: ConcentrationAnalysis,
  options?: ScanOptions
): number {
  let confidence = detection.confidence * 0.4; // Reduced base detection weight to make room for biological scoring
  
  if (concentrationAnalysis) {
    confidence += concentrationAnalysis.overallConfidence * 0.3; // Pattern confidence
  }
  
  // Bonus for having clear headers
  if (detection.headerRow >= 0) {
    confidence += 0.05;
  }
  
  // NEW: Biological relevance scoring (30% of total confidence)
  const biologicalScore = calculateBiologicalRelevanceScore(detection, options);
  confidence += biologicalScore * 0.3;
  
  return Math.min(confidence, 1.0);
}

/**
 * NEW: Calculates biological relevance score based on dataset dimensions
 */
function calculateBiologicalRelevanceScore(
  detection: DetectionResult,
  options?: ScanOptions
): number {
  const maxSamples = options?.maxSamplesPerDataset || 8;
  const maxConcentrations = options?.maxConcentrationsPerDataset || 15;
  
  const sampleCount = detection.responseColumns.length;
  const concentrationCount = 10; // Estimate - would need actual data to calculate precisely
  
  // Apply biological confidence calculation
  return calculateBiologicalConfidence(sampleCount, concentrationCount, options || {});
}

/**
 * Generates a descriptive name for a data block with biological context
 */
function generateBlockName(
  index: number,
  region: { startRow: number; endRow: number; startCol: number; endCol: number },
  detection: DetectionResult
): string {
  const position = `${String.fromCharCode(65 + region.startCol)}${region.startRow + 1}`;
  const sampleCount = detection.responseColumns.length;
  const concentrationCount = region.endRow - region.startRow; // Approximate
  
  if (sampleCount > 0) {
    // Provide biological context in naming
    if (sampleCount === 1) {
      return `Individual Dose-Response Curve ${index + 1} (${position})`;
    } else if (sampleCount <= 4) {
      return `Small Dataset ${index + 1} (${sampleCount} samples, ${position})`;
    } else if (sampleCount <= 8) {
      return `Medium Dataset ${index + 1} (${sampleCount} samples, ${position})`;
    } else {
      return `Large Matrix ${index + 1} (${sampleCount} samples × ${concentrationCount} conc., ${position}) - Consider Segmentation`;
    }
  }
  
  const size = `${region.endRow - region.startRow + 1}x${region.endCol - region.startCol + 1}`;
  return `Data Block ${index + 1} (${position}, ${size})`;
}

/**
 * Determines the overall layout pattern of all blocks
 */
function determineOverallLayout(
  blocks: DataBlock[],
  cellData: CellData[][]
): MultiDatasetResult['layout'] {
  if (blocks.length <= 1) return 'single';
  
  // Analyze spatial arrangement of blocks
  const arrangements = {
    vertical: 0,
    horizontal: 0,
    grid: 0
  };
  
  for (let i = 0; i < blocks.length - 1; i++) {
    const current = blocks[i].bounds;
    const next = blocks[i + 1].bounds;
    
    // Check if blocks are vertically stacked
    if (Math.abs(current.startCol - next.startCol) < 2 && next.startRow > current.endRow) {
      arrangements.vertical++;
    }
    
    // Check if blocks are horizontally arranged
    if (Math.abs(current.startRow - next.startRow) < 2 && next.startCol > current.endCol) {
      arrangements.horizontal++;
    }
    
    // Check for grid pattern (neither pure vertical nor horizontal)
    if (next.startRow > current.endRow && next.startCol > current.endCol) {
      arrangements.grid++;
    }
  }
  
  const total = arrangements.vertical + arrangements.horizontal + arrangements.grid;
  if (total === 0) return 'mixed';
  
  if (arrangements.vertical / total > 0.6) return 'vertical_stack';
  if (arrangements.horizontal / total > 0.6) return 'horizontal_layout';
  if (arrangements.grid / total > 0.4) return 'grid';
  
  return 'mixed';
}

/**
 * Calculates overall confidence for the multi-dataset detection
 */
function calculateOverallConfidence(blocks: DataBlock[]): number {
  if (blocks.length === 0) return 0;
  
  const avgConfidence = blocks.reduce((sum, block) => sum + block.confidence, 0) / blocks.length;
  const validRatio = blocks.filter(b => b.hasValidPattern).length / blocks.length;
  
  return avgConfidence * 0.7 + validRatio * 0.3;
}

/**
 * Generates recommendations for the multi-dataset result with biological guidance
 */
function generateRecommendations(
  result: MultiDatasetResult,
  options: ScanOptions
): string[] {
  const recommendations: string[] = [];
  
  if (result.totalBlocks === 0) {
    recommendations.push('No data blocks detected. Check if the sheet contains tabular data.');
    return recommendations;
  }
  
  if (result.validBlocks === 0) {
    recommendations.push('No valid datasets detected. Ensure concentration columns follow dilution patterns.');
  }
  
  if (result.validBlocks < result.totalBlocks) {
    const invalid = result.totalBlocks - result.validBlocks;
    recommendations.push(`${invalid} blocks lack clear dilution patterns. Consider manual review.`);
  }
  
  if (result.layout === 'mixed') {
    recommendations.push('Complex layout detected. Consider separating datasets into different sheets.');
  }
  
  if (result.confidence < 0.5) {
    recommendations.push('Low overall confidence. Consider using standard dose-response formats.');
  }
  
  // NEW: Biological relevance recommendations
  const oversizedBlocks = result.blocks.filter(b => {
    const sampleCount = b.detection.responseColumns?.length || 0;
    return sampleCount > (options.maxSamplesPerDataset || 8);
  });
  
  if (oversizedBlocks.length > 0) {
    recommendations.push(`${oversizedBlocks.length} datasets are too large for typical dose-response analysis. Consider segmenting into individual curves.`);
  }
  
  const individualCurves = result.blocks.filter(b => {
    const sampleCount = b.detection.responseColumns?.length || 0;
    return sampleCount === 1;
  });
  
  if (individualCurves.length > 0) {
    recommendations.push(`${individualCurves.length} individual dose-response curves detected - ideal for biological analysis.`);
  }
  
  const replicateGroups = result.blocks.filter(b => {
    const sampleCount = b.detection.responseColumns?.length || 0;
    return sampleCount >= 2 && sampleCount <= 4;
  });
  
  if (replicateGroups.length > 0) {
    recommendations.push(`${replicateGroups.length} small datasets detected (2-4 samples) - likely replicate groups, which is good for statistical analysis.`);
  }
  
  // Block-specific recommendations
  const lowConfidenceBlocks = result.blocks.filter(b => b.confidence < 0.5);
  if (lowConfidenceBlocks.length > 0) {
    recommendations.push(`${lowConfidenceBlocks.length} blocks have low confidence scores. Review manually.`);
  }
  
  // NEW: Segmentation recommendations
  if (options.enableMatrixSegmentation && oversizedBlocks.length > 0) {
    recommendations.push('Matrix segmentation is enabled. Large datasets will be automatically split into individual curves.');
  }
  
  return recommendations;
}

/**
 * Filters blocks by minimum confidence threshold with biological relevance
 */
export function filterValidBlocks(
  result: MultiDatasetResult,
  minConfidence: number = 0.5
): DataBlock[] {
  return result.blocks.filter(block => 
    block.confidence >= minConfidence && block.hasValidPattern
  );
}

/**
 * NEW: Filters blocks specifically for biological relevance
 */
export function filterBiologicallyRelevantBlocks(
  result: MultiDatasetResult,
  options: ScanOptions = {}
): DataBlock[] {
  const maxSamples = options.maxSamplesPerDataset || 8;
  const preferIndividual = options.preferIndividualCurves !== false; // Default to true
  
  return result.blocks.filter(block => {
    const sampleCount = block.detection.responseColumns?.length || 0;
    
    // Always include individual curves (highest biological relevance)
    if (sampleCount === 1) {
      return true;
    }
    
    // Include small replicate groups (2-4 samples)
    if (sampleCount >= 2 && sampleCount <= 4) {
      return block.confidence >= 0.4; // Lower threshold for good replicate groups
    }
    
    // Include medium-sized datasets with high confidence
    if (sampleCount <= maxSamples) {
      return block.confidence >= 0.7; // Higher threshold for larger datasets
    }
    
    // Exclude oversized matrices unless they have exceptional quality
    return block.confidence >= 0.9;
  });
}

/**
 * NEW: Validates biological appropriateness of detected datasets
 */
export function validateBiologicalRelevance(
  result: MultiDatasetResult,
  options: ScanOptions = {}
): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
  biologicalScore: number;
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const maxSamples = options.maxSamplesPerDataset || 8;
  const maxConcentrations = options.maxConcentrationsPerDataset || 15;
  
  // Analyze dataset size distribution
  const sizeCounts = {
    individual: 0,    // 1 sample
    replicates: 0,    // 2-4 samples
    medium: 0,        // 5-8 samples
    large: 0          // >8 samples
  };
  
  for (const block of result.blocks) {
    const sampleCount = block.detection.responseColumns?.length || 0;
    if (sampleCount === 1) sizeCounts.individual++;
    else if (sampleCount <= 4) sizeCounts.replicates++;
    else if (sampleCount <= 8) sizeCounts.medium++;
    else sizeCounts.large++;
  }
  
  // Calculate biological appropriateness score
  let biologicalScore = 0;
  const totalBlocks = result.blocks.length;
  
  if (totalBlocks > 0) {
    biologicalScore = (
      (sizeCounts.individual * 1.0) +     // Perfect biological relevance
      (sizeCounts.replicates * 0.8) +     // Good for statistical analysis
      (sizeCounts.medium * 0.4) +         // Acceptable but not ideal
      (sizeCounts.large * 0.1)            // Poor biological relevance
    ) / totalBlocks;
  }
  
  // Generate issues and recommendations
  if (sizeCounts.large > 0) {
    issues.push(`${sizeCounts.large} datasets exceed recommended size for dose-response analysis (>${maxSamples} samples)`);
    recommendations.push('Consider segmenting large matrices into individual dose-response curves');
  }
  
  if (sizeCounts.individual === 0 && sizeCounts.replicates === 0) {
    issues.push('No individual curves or small replicate groups detected');
    recommendations.push('Typical dose-response experiments should contain individual curves (1 sample each) or small replicate groups (2-4 samples)');
  }
  
  if (biologicalScore < 0.3) {
    issues.push('Low biological relevance score - most datasets are too large for typical dose-response analysis');
    recommendations.push('Review data organization - each biological sample should have its own dose-response curve');
  }
  
  const isValid = biologicalScore >= 0.5 && issues.length === 0;
  
  if (sizeCounts.individual > 0) {
    recommendations.push(`${sizeCounts.individual} individual dose-response curves detected - excellent for biological analysis`);
  }
  
  if (sizeCounts.replicates > 0) {
    recommendations.push(`${sizeCounts.replicates} replicate groups (2-4 samples) detected - good for statistical validation`);
  }
  
  return {
    isValid,
    issues,
    recommendations,
    biologicalScore
  };
}

/**
 * Converts blocks back to standard Dataset format
 */
export function convertBlocksToDatasets(blocks: DataBlock[]): Array<{
  id: string;
  name: string;
  data: any[];
  detection: DetectionResult;
  concentrationAnalysis?: ConcentrationAnalysis;
}> {
  return blocks.map(block => ({
    id: block.id,
    name: block.name,
    data: block.data,
    detection: block.detection,
    concentrationAnalysis: block.concentrationAnalysis
  }));
}

/**
 * NEW: Checks if a data block exceeds biological size constraints for dose-response datasets
 */
function isOversizedMatrix(block: DataBlock, options: ScanOptions): boolean {
  const maxSamples = options.maxSamplesPerDataset || 8;
  const maxConcentrations = options.maxConcentrationsPerDataset || 15;
  
  // Calculate effective dataset dimensions
  const dataRows = block.bounds.endRow - block.bounds.startRow;
  const dataCols = block.bounds.endCol - block.bounds.startCol;
  
  // For horizontal matrices: samples are columns, concentrations are rows
  if (block.layout === 'horizontal') {
    const sampleCount = dataCols - 1; // Subtract 1 for concentration column
    const concentrationCount = dataRows - 1; // Subtract 1 for header row
    return sampleCount > maxSamples || concentrationCount > maxConcentrations;
  }
  
  // For vertical matrices: samples are rows, concentrations are columns
  if (block.layout === 'vertical') {
    const sampleCount = dataRows - 1; // Subtract 1 for header row
    const concentrationCount = dataCols - 1; // Subtract 1 for sample column
    return sampleCount > maxSamples || concentrationCount > maxConcentrations;
  }
  
  // For block layouts, use heuristics
  return dataRows > maxSamples + 2 || dataCols > maxConcentrations + 2;
}

/**
 * NEW: Segments oversized matrices into individual dose-response datasets
 */
function segmentOversizedMatrix(
  block: DataBlock,
  cellData: CellData[][],
  rawData: any[][],
  options: ScanOptions
): DataBlock[] {
  const segmentedBlocks: DataBlock[] = [];
  const maxSamples = options.maxSamplesPerDataset || 8;
  
  try {
    if (block.layout === 'horizontal') {
      // Horizontal matrix: concentration column + multiple sample columns
      segmentedBlocks.push(...segmentHorizontalMatrix(block, cellData, rawData, options));
    } else if (block.layout === 'vertical') {
      // Vertical matrix: sample column + multiple concentration columns
      segmentedBlocks.push(...segmentVerticalMatrix(block, cellData, rawData, options));
    } else {
      // Block layout: attempt intelligent segmentation
      segmentedBlocks.push(...segmentBlockMatrix(block, cellData, rawData, options));
    }
    
    // If segmentation failed or produced no results, return original block with penalty
    if (segmentedBlocks.length === 0) {
      const penalizedBlock = { ...block };
      penalizedBlock.confidence *= 0.3; // Apply heavy penalty for oversized matrices
      penalizedBlock.name += ' (Oversized - Manual Review Needed)';
      return [penalizedBlock];
    }
    
    return segmentedBlocks;
  } catch (error) {
    console.warn('Error segmenting oversized matrix:', error);
    // Return original block with penalty if segmentation fails
    const penalizedBlock = { ...block };
    penalizedBlock.confidence *= 0.3;
    penalizedBlock.name += ' (Segmentation Failed)';
    return [penalizedBlock];
  }
}

/**
 * NEW: Segments horizontal matrices (concentration column + sample columns)
 */
function segmentHorizontalMatrix(
  block: DataBlock,
  cellData: CellData[][],
  rawData: any[][],
  options: ScanOptions
): DataBlock[] {
  const segments: DataBlock[] = [];
  const maxSamples = options.maxSamplesPerDataset || 8;
  const concentrationCol = block.detection.concentrationColumn;
  
  if (concentrationCol === -1 || !block.detection.responseColumns.length) {
    return [];
  }
  
  // Group response columns into segments
  const responseColumns = block.detection.responseColumns;
  const columnGroups: number[][] = [];
  
  // Check if columns might be replicates by examining their names/patterns
  const replicateGroups = detectReplicateColumns(block, cellData, options);
  
  if (replicateGroups.length > 0) {
    // Use detected replicate groups
    columnGroups.push(...replicateGroups);
  } else {
    // Create individual datasets (1 sample per dataset for maximum granularity)
    for (const col of responseColumns) {
      columnGroups.push([col]);
    }
  }
  
  // Create segments for each column group
  let segmentIndex = 0;
  for (const columnGroup of columnGroups) {
    if (columnGroup.length === 0) continue;
    
    // Create new bounds for this segment
    const segmentBounds = {
      startRow: block.bounds.startRow,
      endRow: block.bounds.endRow,
      startCol: Math.min(block.bounds.startCol, concentrationCol),
      endCol: Math.max(concentrationCol, Math.max(...columnGroup))
    };
    
    // Extract data for this segment
    const segmentData = extractSegmentData(rawData, segmentBounds);
    const segmentCellData = extractSegmentCellData(cellData, segmentBounds);
    
    // Create new detection result for this segment
    const segmentDetection = createSegmentDetection(block.detection, concentrationCol, columnGroup, segmentBounds);
    
    // Calculate biological confidence (prefer smaller, more focused datasets)
    const biologicalConfidence = calculateBiologicalConfidence(columnGroup.length, 
      segmentBounds.endRow - segmentBounds.startRow, options);
    
    const segment: DataBlock = {
      id: `${block.id}_segment_${segmentIndex}`,
      name: `Individual Curve ${segmentIndex + 1} (${columnGroup.length} replicate${columnGroup.length > 1 ? 's' : ''})`,
      bounds: segmentBounds,
      data: segmentData,
      cellData: segmentCellData,
      detection: segmentDetection,
      concentrationAnalysis: block.concentrationAnalysis,
      confidence: Math.min(block.confidence * biologicalConfidence, 1.0),
      layout: 'horizontal',
      hasValidPattern: block.hasValidPattern && biologicalConfidence > 0.3
    };
    
    segments.push(segment);
    segmentIndex++;
  }
  
  return segments;
}

/**
 * NEW: Segments vertical matrices (sample rows + concentration columns)
 */
function segmentVerticalMatrix(
  block: DataBlock,
  cellData: CellData[][],
  rawData: any[][],
  options: ScanOptions
): DataBlock[] {
  const segments: DataBlock[] = [];
  const maxSamples = options.maxSamplesPerDataset || 8;
  
  // For vertical matrices, segment by rows (each row or group of rows becomes a dataset)
  const dataStartRow = Math.max(block.detection.dataStartRow, block.bounds.startRow + 1);
  const dataEndRow = block.bounds.endRow;
  const totalDataRows = dataEndRow - dataStartRow + 1;
  
  // Create individual datasets for each row (maximum biological granularity)
  let segmentIndex = 0;
  for (let row = dataStartRow; row <= dataEndRow; row++) {
    // Create bounds for single row segment
    const segmentBounds = {
      startRow: Math.max(block.bounds.startRow, row - 1), // Include header
      endRow: row,
      startCol: block.bounds.startCol,
      endCol: block.bounds.endCol
    };
    
    // Extract data for this row
    const segmentData = extractSegmentData(rawData, segmentBounds);
    const segmentCellData = extractSegmentCellData(cellData, segmentBounds);
    
    // Skip empty rows
    if (isSegmentEmpty(segmentCellData)) {
      continue;
    }
    
    // Create detection result for this row
    const segmentDetection = createRowSegmentDetection(block.detection, segmentBounds);
    
    // Calculate biological confidence (individual curves get higher confidence)
    const biologicalConfidence = calculateBiologicalConfidence(1, 
      segmentBounds.endCol - segmentBounds.startCol, options);
    
    const segment: DataBlock = {
      id: `${block.id}_row_${segmentIndex}`,
      name: `Individual Sample ${segmentIndex + 1}`,
      bounds: segmentBounds,
      data: segmentData,
      cellData: segmentCellData,
      detection: segmentDetection,
      concentrationAnalysis: block.concentrationAnalysis,
      confidence: Math.min(block.confidence * biologicalConfidence, 1.0),
      layout: 'vertical',
      hasValidPattern: block.hasValidPattern && biologicalConfidence > 0.3
    };
    
    segments.push(segment);
    segmentIndex++;
  }
  
  return segments;
}

/**
 * NEW: Segments block matrices using intelligent pattern detection
 */
function segmentBlockMatrix(
  block: DataBlock,
  cellData: CellData[][],
  rawData: any[][],
  options: ScanOptions
): DataBlock[] {
  // For now, try both horizontal and vertical segmentation and use the better result
  const horizontalSegments = segmentHorizontalMatrix(block, cellData, rawData, options);
  const verticalSegments = segmentVerticalMatrix(block, cellData, rawData, options);
  
  // Choose the segmentation that produces more biologically relevant results
  const horizontalAvgConfidence = horizontalSegments.length > 0 ? 
    horizontalSegments.reduce((sum, seg) => sum + seg.confidence, 0) / horizontalSegments.length : 0;
  const verticalAvgConfidence = verticalSegments.length > 0 ?
    verticalSegments.reduce((sum, seg) => sum + seg.confidence, 0) / verticalSegments.length : 0;
  
  if (horizontalAvgConfidence > verticalAvgConfidence) {
    return horizontalSegments;
  } else {
    return verticalSegments;
  }
}

/**
 * NEW: Detects replicate columns by analyzing column headers and data patterns
 */
function detectReplicateColumns(
  block: DataBlock,
  cellData: CellData[][],
  options: ScanOptions
): number[][] {
  const replicateGroups: number[][] = [];
  const threshold = options.replicateDetectionThreshold || 0.8;
  
  if (block.detection.headerRow === -1 || !block.detection.responseColumns.length) {
    return replicateGroups;
  }
  
  const headerRow = block.detection.headerRow;
  const responseColumns = block.detection.responseColumns;
  
  // Group columns by similar names/patterns
  const columnGroups: { [key: string]: number[] } = {};
  
  for (const col of responseColumns) {
    const headerCell = cellData[headerRow]?.[col];
    if (headerCell?.type === 'string') {
      // Extract base name (remove replicate indicators like _1, _2, Rep1, etc.)
      const baseName = extractBaseName(headerCell.value);
      if (!columnGroups[baseName]) {
        columnGroups[baseName] = [];
      }
      columnGroups[baseName].push(col);
    }
  }
  
  // Convert groups to arrays, filtering out single-column groups unless they represent individual samples
  for (const [baseName, columns] of Object.entries(columnGroups)) {
    if (columns.length >= 2 && columns.length <= 4) {
      // Typical replicate group size (2-4 replicates)
      replicateGroups.push(columns);
    } else if (columns.length === 1) {
      // Individual samples become their own groups
      replicateGroups.push(columns);
    }
    // Skip groups with >4 columns as they're likely not replicates
  }
  
  return replicateGroups;
}

/**
 * NEW: Extracts base name from column header for replicate detection
 */
function extractBaseName(headerValue: string): string {
  if (!headerValue || typeof headerValue !== 'string') {
    return 'Unknown';
  }
  
  // Remove common replicate indicators
  const cleaned = headerValue
    .replace(/[_\-\s]*(rep|replicate|r)\s*[0-9]+$/i, '')
    .replace(/[_\-\s]*[0-9]+$/g, '')
    .replace(/[_\-\s]*(a|b|c|d)$/i, '')
    .trim();
  
  return cleaned || headerValue;
}

/**
 * NEW: Calculates biological confidence based on dataset dimensions
 */
function calculateBiologicalConfidence(
  sampleCount: number,
  concentrationCount: number,
  options: ScanOptions
): number {
  const idealSampleRange = [1, 4]; // 1-4 samples (individual curves or small replicate groups)
  const idealConcentrationRange = [6, 12]; // 6-12 concentration points
  const maxSamples = options.maxSamplesPerDataset || 8;
  const maxConcentrations = options.maxConcentrationsPerDataset || 15;
  
  let confidence = 1.0;
  
  // Sample count scoring (prefer individual curves)
  if (sampleCount === 1) {
    confidence *= 1.0; // Perfect for individual curves
  } else if (sampleCount <= 4) {
    confidence *= 0.9; // Good for replicate groups
  } else if (sampleCount <= maxSamples) {
    confidence *= 0.6; // Acceptable but not ideal
  } else {
    confidence *= 0.2; // Too large for biological relevance
  }
  
  // Concentration count scoring
  if (concentrationCount >= idealConcentrationRange[0] && concentrationCount <= idealConcentrationRange[1]) {
    confidence *= 1.0; // Ideal range
  } else if (concentrationCount >= 4 && concentrationCount <= maxConcentrations) {
    confidence *= 0.8; // Acceptable range
  } else if (concentrationCount < 4) {
    confidence *= 0.4; // Too few points for good curve fitting
  } else {
    confidence *= 0.6; // More points can be good but may indicate over-aggregation
  }
  
  return Math.max(confidence, 0.1); // Minimum confidence floor
}

/**
 * NEW: Extracts data for a specific segment
 */
function extractSegmentData(rawData: any[][], bounds: { startRow: number; endRow: number; startCol: number; endCol: number }): any[][] {
  const segmentData: any[][] = [];
  
  for (let row = bounds.startRow; row <= bounds.endRow; row++) {
    const segmentRow: any[] = [];
    for (let col = bounds.startCol; col <= bounds.endCol; col++) {
      segmentRow.push(rawData[row]?.[col] || null);
    }
    segmentData.push(segmentRow);
  }
  
  return segmentData;
}

/**
 * NEW: Extracts cell data for a specific segment
 */
function extractSegmentCellData(cellData: CellData[][], bounds: { startRow: number; endRow: number; startCol: number; endCol: number }): CellData[][] {
  const segmentCellData: CellData[][] = [];
  
  for (let row = bounds.startRow; row <= bounds.endRow; row++) {
    const segmentRow: CellData[] = [];
    for (let col = bounds.startCol; col <= bounds.endCol; col++) {
      const originalCell = cellData[row]?.[col];
      if (originalCell) {
        // Adjust coordinates to be relative to segment
        segmentRow.push({
          ...originalCell,
          row: row - bounds.startRow,
          column: col - bounds.startCol
        });
      } else {
        segmentRow.push({
          value: null,
          type: 'empty',
          originalValue: null,
          row: row - bounds.startRow,
          column: col - bounds.startCol
        });
      }
    }
    segmentCellData.push(segmentRow);
  }
  
  return segmentCellData;
}

/**
 * NEW: Creates detection result for a column segment
 */
function createSegmentDetection(
  originalDetection: DetectionResult,
  concentrationCol: number,
  responseColumns: number[],
  bounds: { startRow: number; endRow: number; startCol: number; endCol: number }
): DetectionResult {
  return {
    ...originalDetection,
    concentrationColumn: concentrationCol - bounds.startCol,
    responseColumns: responseColumns.map(col => col - bounds.startCol),
    dataStartRow: Math.max(0, originalDetection.dataStartRow - bounds.startRow)
  };
}

/**
 * NEW: Creates detection result for a row segment
 */
function createRowSegmentDetection(
  originalDetection: DetectionResult,
  bounds: { startRow: number; endRow: number; startCol: number; endCol: number }
): DetectionResult {
  return {
    ...originalDetection,
    concentrationColumn: Math.max(0, originalDetection.concentrationColumn - bounds.startCol),
    responseColumns: originalDetection.responseColumns.map(col => Math.max(0, col - bounds.startCol)),
    dataStartRow: Math.max(0, originalDetection.dataStartRow - bounds.startRow)
  };
}

/**
 * NEW: Checks if a segment is empty
 */
function isSegmentEmpty(segmentCellData: CellData[][]): boolean {
  for (const row of segmentCellData) {
    for (const cell of row) {
      if (cell.type !== 'empty') {
        return false;
      }
    }
  }
  return true;
}