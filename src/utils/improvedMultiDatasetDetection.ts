/**
 * Improved Multi-Dataset Detection for nVitro Studio
 * Uses statistical analysis and spatial pattern recognition to better detect datasets separated by gaps
 */

// Import only specific types to avoid circular dependency
export interface CellData {
  value: any;
  type: 'number' | 'string' | 'date' | 'empty' | 'error';
  originalValue: any;
  row: number;
  column: number;
}

export interface DetectionResult {
  confidence: number;
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  dataStartRow: number;
  detectedLayout: 'standard' | 'transposed' | 'multi-block' | 'unknown';
  concentrationUnit: string;
  issues: DetectionIssue[];
  preview: CellData[][];
  multipleDatasets?: any[];
  dilutionPattern?: DilutionPatternInfo;
  patternConfidence?: number;
}

export interface DetectionIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  row?: number;
  column?: number;
  suggestion?: string;
}

export interface DilutionPatternInfo {
  type: 'serial' | 'log-scale' | 'half-log' | 'custom' | 'irregular' | 'unknown';
  factor?: number;
  confidence: number;
  detectedRatio: number;
  concentrationRange: {
    min: number;
    max: number;
    orderOfMagnitude: number;
  };
  patternConsistency: number;
  missingPoints: number[];
  irregularities: string[];
}

export interface BoundingBox {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface SpatialStatistics {
  meanGapSize: number;
  stdDevGapSize: number;
  gapDistribution: number[];
  optimalRowThreshold: number;
  optimalColThreshold: number;
}

export interface SpatialPoint {
  row: number;
  col: number;
  density: number;
  connectivity: number;
}

export interface DatasetBoundaryAnalysis {
  isNaturalBoundary: boolean;
  separationConfidence: number;
  gapCharacteristics: {
    size: number;
    consistency: number;
    alignment: 'horizontal' | 'vertical' | 'both';
  };
  patternType: 'dataset_separator' | 'missing_data' | 'unclear';
}

export interface EnhancedDatasetDetection {
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
  boundingBox: BoundingBox;
  preview: CellData[][];
  separationAnalysis: DatasetBoundaryAnalysis[];
  spatialConfidence: number;
}

export interface ImprovedMultiDatasetResult {
  datasets: EnhancedDatasetDetection[];
  totalDatasets: number;
  validDatasets: number;
  layoutType: 'horizontal' | 'vertical' | 'grid' | 'mixed';
  layoutConfidence: number;
  spatialStatistics: SpatialStatistics;
  overallConfidence: number;
  issues: DetectionIssue[];
}

/**
 * Main function for improved multi-dataset detection
 */
export function detectMultipleDatasetsImproved(rawData: any[][]): ImprovedMultiDatasetResult {
  if (!rawData || rawData.length === 0) {
    return {
      datasets: [],
      totalDatasets: 0,
      validDatasets: 0,
      layoutType: 'mixed',
      layoutConfidence: 0,
      spatialStatistics: {
        meanGapSize: 0,
        stdDevGapSize: 0,
        gapDistribution: [],
        optimalRowThreshold: 2,
        optimalColThreshold: 1
      },
      overallConfidence: 0,
      issues: [{ type: 'error', message: 'No data provided' }]
    };
  }

  // Convert raw data to cell data
  const cellData = convertToCellData(rawData);
  
  // Step 1: Calculate adaptive thresholds based on data distribution
  const spatialStats = calculateAdaptiveThresholds(cellData);
  
  // Step 2: Enhanced region detection with spatial awareness
  const regions = identifyDataRegionsEnhanced(cellData, {
    maxGapRows: spatialStats.optimalRowThreshold,
    maxGapCols: spatialStats.optimalColThreshold,
    use8Connectivity: true,
    densityThreshold: 0.3
  });
  
  // Step 3: Analyze boundaries between regions
  const validRegions = analyzeRegionBoundaries(cellData, regions);
  
  // Step 4: Convert regions to dataset detections
  const datasets = validRegions.map((region, index) => 
    analyzeDatasetBlock(cellData, rawData, region, index)
  );
  
  // Step 5: Determine overall layout pattern
  const layoutAnalysis = detectMixedLayouts(datasets.map(d => d.boundingBox));
  
  // Step 6: Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(datasets, layoutAnalysis.confidence);
  
  // Step 7: Generate issues and recommendations
  const issues = generateIssuesAndRecommendations(datasets, layoutAnalysis);
  
  return {
    datasets: datasets.filter(d => d.confidence > 0.2),
    totalDatasets: datasets.length,
    validDatasets: datasets.filter(d => d.confidence > 0.5).length,
    layoutType: layoutAnalysis.layoutType,
    layoutConfidence: layoutAnalysis.confidence,
    spatialStatistics: spatialStats,
    overallConfidence,
    issues
  };
}

/**
 * Calculates adaptive gap thresholds based on statistical analysis of data distribution
 */
function calculateAdaptiveThresholds(cellData: CellData[][]): SpatialStatistics {
  const rowGaps: number[] = [];
  const colGaps: number[] = [];
  
  // Analyze row gaps
  for (let row = 0; row < cellData.length - 1; row++) {
    let gapSize = 0;
    let foundGap = false;
    
    for (let nextRow = row + 1; nextRow < cellData.length; nextRow++) {
      const hasDataInRow = cellData[nextRow]?.some(cell => cell && cell.type !== 'empty');
      
      if (!hasDataInRow) {
        gapSize++;
        foundGap = true;
      } else if (foundGap) {
        rowGaps.push(gapSize);
        break;
      } else {
        break;
      }
    }
  }
  
  // Analyze column gaps
  for (let col = 0; col < (cellData[0]?.length || 0) - 1; col++) {
    let gapSize = 0;
    let foundGap = false;
    
    for (let nextCol = col + 1; nextCol < (cellData[0]?.length || 0); nextCol++) {
      const hasDataInCol = cellData.some(row => row?.[nextCol] && row[nextCol].type !== 'empty');
      
      if (!hasDataInCol) {
        gapSize++;
        foundGap = true;
      } else if (foundGap) {
        colGaps.push(gapSize);
        break;
      } else {
        break;
      }
    }
  }
  
  const meanRowGap = rowGaps.length > 0 ? rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length : 1;
  const meanColGap = colGaps.length > 0 ? colGaps.reduce((a, b) => a + b, 0) / colGaps.length : 1;
  
  const stdDevRow = Math.sqrt(rowGaps.reduce((acc, gap) => acc + Math.pow(gap - meanRowGap, 2), 0) / Math.max(rowGaps.length, 1));
  const stdDevCol = Math.sqrt(colGaps.reduce((acc, gap) => acc + Math.pow(gap - meanColGap, 2), 0) / Math.max(colGaps.length, 1));
  
  // Use statistical approach: mean + 1.5 * std dev for outlier detection
  const optimalRowThreshold = Math.max(2, Math.min(6, Math.floor(meanRowGap + 1.5 * stdDevRow)));
  const optimalColThreshold = Math.max(1, Math.min(4, Math.floor(meanColGap + 1.5 * stdDevCol)));
  
  return {
    meanGapSize: (meanRowGap + meanColGap) / 2,
    stdDevGapSize: (stdDevRow + stdDevCol) / 2,
    gapDistribution: [...rowGaps, ...colGaps],
    optimalRowThreshold,
    optimalColThreshold
  };
}

/**
 * Enhanced region identification with spatial awareness
 */
function identifyDataRegionsEnhanced(
  cellData: CellData[][],
  options: {
    maxGapRows: number;
    maxGapCols: number;
    use8Connectivity: boolean;
    densityThreshold: number;
  }
): Array<{ region: BoundingBox; confidence: number; points: SpatialPoint[] }> {
  const densityMap = createDensityMap(cellData);
  const visited = new Set<string>();
  const regions: Array<{ region: BoundingBox; confidence: number; points: SpatialPoint[] }> = [];
  
  for (let row = 0; row < cellData.length; row++) {
    for (let col = 0; col < (cellData[row]?.length || 0); col++) {
      const key = `${row},${col}`;
      
      if (visited.has(key) || densityMap[row]?.[col] === 0) {
        continue;
      }
      
      const regionResult = enhancedFloodFillRegion(
        densityMap,
        row,
        col,
        visited,
        options
      );
      
      if (regionResult && regionResult.points.length >= 6) { // Minimum viable dataset size
        regions.push(regionResult);
      }
    }
  }
  
  return regions;
}

/**
 * Enhanced flood fill with spatial awareness and density considerations
 */
function enhancedFloodFillRegion(
  densityMap: number[][],
  startRow: number,
  startCol: number,
  visited: Set<string>,
  options: {
    use8Connectivity: boolean;
    densityThreshold: number;
  }
): { region: BoundingBox; points: SpatialPoint[]; confidence: number } | null {
  
  const { use8Connectivity, densityThreshold } = options;
  const stack = [{ row: startRow, col: startCol }];
  const points: SpatialPoint[] = [];
  
  // Calculate local density for each point
  const getLocalDensity = (row: number, col: number, radius: number = 2): number => {
    let totalCells = 0;
    let filledCells = 0;
    
    for (let r = Math.max(0, row - radius); r <= Math.min(densityMap.length - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min((densityMap[r]?.length || 0) - 1, col + radius); c++) {
        totalCells++;
        if (densityMap[r]?.[c] === 1) filledCells++;
      }
    }
    
    return totalCells > 0 ? filledCells / totalCells : 0;
  };
  
  // 8-connectivity directions (includes diagonals)
  const directions = use8Connectivity 
    ? [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]
    : [[-1,0], [1,0], [0,-1], [0,1]];
  
  while (stack.length > 0) {
    const { row, col } = stack.pop()!;
    const key = `${row},${col}`;
    
    if (visited.has(key) || 
        row < 0 || row >= densityMap.length ||
        col < 0 || col >= (densityMap[row]?.length || 0)) {
      continue;
    }
    
    const cellValue = densityMap[row]?.[col] || 0;
    const localDensity = getLocalDensity(row, col);
    
    // Enhanced connectivity: consider cells with high local density even if empty
    if (cellValue === 0 && localDensity < densityThreshold) {
      continue;
    }
    
    visited.add(key);
    
    const connectivity = directions.reduce((sum, [dr, dc]) => {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < densityMap.length && 
          nc >= 0 && nc < (densityMap[nr]?.length || 0) &&
          densityMap[nr]?.[nc] === 1) {
        return sum + 1;
      }
      return sum;
    }, 0);
    
    points.push({
      row,
      col,
      density: localDensity,
      connectivity: connectivity / directions.length
    });
    
    // Add neighbors based on connectivity
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (!visited.has(`${nr},${nc}`)) {
        stack.push({ row: nr, col: nc });
      }
    }
  }
  
  if (points.length === 0) return null;
  
  const rows = points.map(p => p.row);
  const cols = points.map(p => p.col);
  const avgDensity = points.reduce((sum, p) => sum + p.density, 0) / points.length;
  const avgConnectivity = points.reduce((sum, p) => sum + p.connectivity, 0) / points.length;
  
  return {
    region: {
      startRow: Math.min(...rows),
      endRow: Math.max(...rows),
      startColumn: Math.min(...cols),
      endColumn: Math.max(...cols)
    },
    points,
    confidence: (avgDensity * 0.6 + avgConnectivity * 0.4)
  };
}

/**
 * Analyzes boundaries between regions to determine if they represent dataset separators
 */
function analyzeRegionBoundaries(
  cellData: CellData[][],
  regions: Array<{ region: BoundingBox; confidence: number; points: SpatialPoint[] }>
): Array<{ region: BoundingBox; confidence: number; separationAnalysis: DatasetBoundaryAnalysis[] }> {
  const validRegions: Array<{
    region: BoundingBox;
    confidence: number;
    separationAnalysis: DatasetBoundaryAnalysis[];
  }> = [];
  
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const separationAnalysis: DatasetBoundaryAnalysis[] = [];
    
    // Analyze separation from other regions
    for (let j = 0; j < regions.length; j++) {
      if (i !== j) {
        const boundary = analyzeDatasetBoundary(cellData, region.region, regions[j].region);
        separationAnalysis.push(boundary);
      }
    }
    
    // Only include regions that are well-separated or are the only region
    const avgSeparationConfidence = separationAnalysis.length > 0 
      ? separationAnalysis.reduce((sum, analysis) => sum + analysis.separationConfidence, 0) / separationAnalysis.length
      : 1;
    
    if (avgSeparationConfidence > 0.3 || separationAnalysis.length === 0) {
      validRegions.push({
        region: region.region,
        confidence: region.confidence * Math.max(avgSeparationConfidence, 0.5),
        separationAnalysis
      });
    }
  }
  
  return validRegions;
}

/**
 * Analyzes boundary characteristics between two regions
 */
function analyzeDatasetBoundary(
  cellData: CellData[][],
  region1: BoundingBox,
  region2: BoundingBox
): DatasetBoundaryAnalysis {
  
  // Calculate gap characteristics
  const rowGap = Math.max(0, Math.abs(region1.endRow - region2.startRow) - 1, Math.abs(region2.endRow - region1.startRow) - 1);
  const colGap = Math.max(0, Math.abs(region1.endColumn - region2.startColumn) - 1, Math.abs(region2.endColumn - region1.startColumn) - 1);
  
  // Analyze gap consistency (how uniform the empty space is)
  let emptyCount = 0;
  let totalCount = 0;
  
  const gapStartRow = Math.min(region1.endRow + 1, region2.startRow, region1.startRow, region2.endRow + 1);
  const gapEndRow = Math.max(region1.endRow, region2.startRow - 1, region1.startRow - 1, region2.endRow);
  const gapStartCol = Math.min(region1.endColumn + 1, region2.startColumn, region1.startColumn, region2.endColumn + 1);
  const gapEndCol = Math.max(region1.endColumn, region2.startColumn - 1, region1.startColumn - 1, region2.endColumn);
  
  for (let row = Math.max(0, gapStartRow); row <= Math.min(cellData.length - 1, gapEndRow); row++) {
    for (let col = Math.max(0, gapStartCol); col <= Math.min((cellData[row]?.length || 0) - 1, gapEndCol); col++) {
      totalCount++;
      const cell = cellData[row]?.[col];
      if (!cell || cell.type === 'empty') {
        emptyCount++;
      }
    }
  }
  
  const gapConsistency = totalCount > 0 ? emptyCount / totalCount : 0;
  
  // Pattern analysis using statistical measures
  const region1Density = calculateRegionDensity(cellData, region1);
  const region2Density = calculateRegionDensity(cellData, region2);
  
  // If both regions have high density and are separated by consistent gap
  const isNaturalBoundary = (
    gapConsistency > 0.7 && // Gap is mostly empty
    region1Density > 0.4 && // First region has decent data density
    region2Density > 0.4 && // Second region has decent data density
    (rowGap >= 2 || colGap >= 1) // Sufficient separation
  );
  
  const separationConfidence = (
    gapConsistency * 0.4 +
    Math.min(region1Density, region2Density) * 0.3 +
    (Math.min(Math.max(rowGap, colGap), 4) / 4) * 0.3
  );
  
  const alignment = rowGap > colGap ? 'horizontal' : 
                   colGap > rowGap ? 'vertical' : 'both';
  
  const patternType = isNaturalBoundary ? 'dataset_separator' :
                     separationConfidence > 0.4 ? 'missing_data' : 'unclear';
  
  return {
    isNaturalBoundary,
    separationConfidence,
    gapCharacteristics: {
      size: Math.max(rowGap, colGap),
      consistency: gapConsistency,
      alignment
    },
    patternType
  };
}

/**
 * Calculates data density within a region
 */
function calculateRegionDensity(cellData: CellData[][], region: BoundingBox): number {
  let filledCells = 0;
  let totalCells = 0;
  
  for (let row = region.startRow; row <= region.endRow; row++) {
    for (let col = region.startColumn; col <= region.endColumn; col++) {
      totalCells++;
      const cell = cellData[row]?.[col];
      if (cell && cell.type !== 'empty') {
        filledCells++;
      }
    }
  }
  
  return totalCells > 0 ? filledCells / totalCells : 0;
}

/**
 * Analyzes individual dataset blocks
 */
function analyzeDatasetBlock(
  cellData: CellData[][],
  rawData: any[][],
  regionInfo: { region: BoundingBox; confidence: number; separationAnalysis: DatasetBoundaryAnalysis[] },
  index: number
): EnhancedDatasetDetection {
  const { region, confidence, separationAnalysis } = regionInfo;
  
  // Extract data for this region
  const blockData: any[][] = [];
  const blockCellData: CellData[][] = [];
  
  for (let row = region.startRow; row <= region.endRow; row++) {
    const dataRow: any[] = [];
    const cellRow: CellData[] = [];
    
    for (let col = region.startColumn; col <= region.endColumn; col++) {
      dataRow.push(rawData[row]?.[col] || null);
      
      const originalCell = cellData[row]?.[col];
      cellRow.push(originalCell ? {
        ...originalCell,
        row: row - region.startRow,
        column: col - region.startColumn
      } : {
        value: null,
        type: 'empty',
        originalValue: null,
        row: row - region.startRow,
        column: col - region.startColumn
      });
    }
    
    blockData.push(dataRow);
    blockCellData.push(cellRow);
  }
  
  // Run simplified detection on this block
  const detection = analyzeBlockData(blockData, blockCellData);
  
  // Generate dataset name
  const columnLetter = region.startColumn < 26 ? 
    String.fromCharCode(65 + region.startColumn) : 
    `Col${region.startColumn + 1}`;
  const datasetName = `Dataset ${index + 1} (${columnLetter}${region.startRow + 1})`;
  
  // Calculate spatial confidence
  const spatialConfidence = confidence * 0.7 + detection.confidence * 0.3;
  
  return {
    id: `enhanced-dataset-${index}`,
    name: datasetName,
    confidence: spatialConfidence,
    headerRow: region.startRow + Math.max(0, detection.headerRow),
    concentrationColumn: region.startColumn + Math.max(0, detection.concentrationColumn),
    responseColumns: detection.responseColumns.map(col => 
      region.startColumn + col
    ).filter(col => col >= 0),
    dataStartRow: region.startRow + Math.max(0, detection.dataStartRow),
    dataEndRow: region.endRow,
    concentrationUnit: detection.concentrationUnit || 'nM',
    dilutionPattern: detection.dilutionPattern,
    issues: detection.issues || [],
    boundingBox: region,
    preview: blockCellData.slice(0, 5), // Limit preview
    separationAnalysis,
    spatialConfidence
  };
}

/**
 * Detects mixed layout patterns
 */
function detectMixedLayouts(regions: BoundingBox[]): {
  layoutType: 'horizontal' | 'vertical' | 'grid' | 'mixed';
  confidence: number;
} {
  if (regions.length < 2) {
    return { layoutType: 'mixed', confidence: 0 };
  }
  
  let horizontalPairs = 0;
  let verticalPairs = 0;
  let totalPairs = 0;
  
  for (let i = 0; i < regions.length - 1; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const region1 = regions[i];
      const region2 = regions[j];
      
      const rowOverlap = Math.max(0, Math.min(region1.endRow, region2.endRow) - Math.max(region1.startRow, region2.startRow));
      const colOverlap = Math.max(0, Math.min(region1.endColumn, region2.endColumn) - Math.max(region1.startColumn, region2.startColumn));
      
      totalPairs++;
      
      if (rowOverlap > 0 && colOverlap === 0) {
        horizontalPairs++; // Side by side
      } else if (colOverlap > 0 && rowOverlap === 0) {
        verticalPairs++; // Stacked
      }
    }
  }
  
  const horizontalRatio = totalPairs > 0 ? horizontalPairs / totalPairs : 0;
  const verticalRatio = totalPairs > 0 ? verticalPairs / totalPairs : 0;
  
  let layoutType: 'horizontal' | 'vertical' | 'grid' | 'mixed';
  let confidence: number;
  
  if (horizontalRatio > 0.7) {
    layoutType = 'horizontal';
    confidence = horizontalRatio;
  } else if (verticalRatio > 0.7) {
    layoutType = 'vertical';
    confidence = verticalRatio;
  } else if (horizontalRatio > 0.3 && verticalRatio > 0.3) {
    layoutType = 'grid';
    confidence = Math.min(horizontalRatio, verticalRatio);
  } else {
    layoutType = 'mixed';
    confidence = 1 - Math.max(horizontalRatio, verticalRatio);
  }
  
  return { layoutType, confidence };
}

/**
 * Calculates overall confidence for the detection result
 */
function calculateOverallConfidence(
  datasets: EnhancedDatasetDetection[],
  layoutConfidence: number
): number {
  if (datasets.length === 0) return 0;
  
  const avgDatasetConfidence = datasets.reduce((sum, dataset) => sum + dataset.confidence, 0) / datasets.length;
  const spatialConfidence = datasets.reduce((sum, dataset) => sum + dataset.spatialConfidence, 0) / datasets.length;
  
  return avgDatasetConfidence * 0.5 + spatialConfidence * 0.3 + layoutConfidence * 0.2;
}

/**
 * Generates issues and recommendations
 */
function generateIssuesAndRecommendations(
  datasets: EnhancedDatasetDetection[],
  layoutAnalysis: { layoutType: string; confidence: number }
): DetectionIssue[] {
  const issues: DetectionIssue[] = [];
  
  if (datasets.length === 0) {
    issues.push({
      type: 'error',
      message: 'No datasets detected with improved algorithm',
      suggestion: 'Check if data follows standard dose-response format'
    });
    return issues;
  }
  
  const lowConfidenceDatasets = datasets.filter(d => d.confidence < 0.5);
  if (lowConfidenceDatasets.length > 0) {
    issues.push({
      type: 'warning',
      message: `${lowConfidenceDatasets.length} datasets have low confidence scores`,
      suggestion: 'Review these datasets manually and consider improving data formatting'
    });
  }
  
  const unclearBoundaries = datasets.filter(d => 
    d.separationAnalysis.some(analysis => analysis.patternType === 'unclear')
  );
  if (unclearBoundaries.length > 0) {
    issues.push({
      type: 'warning',
      message: 'Some dataset boundaries are unclear',
      suggestion: 'Consider adding clearer separation between datasets (empty rows/columns)'
    });
  }
  
  if (layoutAnalysis.confidence < 0.5) {
    issues.push({
      type: 'info',
      message: 'Complex or mixed dataset layout detected',
      suggestion: 'Consider organizing datasets in a more consistent pattern'
    });
  }
  
  return issues;
}

/**
 * Creates density map for flood fill algorithm
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
 * Converts raw data to structured cell data
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
 * Determines cell type
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
 * Simplified block data analysis for concentration and response detection
 */
function analyzeBlockData(blockData: any[][], blockCellData: CellData[][]): DetectionResult {
  const result: DetectionResult = {
    confidence: 0,
    headerRow: -1,
    concentrationColumn: -1,
    responseColumns: [],
    dataStartRow: -1,
    detectedLayout: 'unknown',
    concentrationUnit: 'nM',
    issues: [],
    preview: blockCellData
  };

  if (!blockData || blockData.length < 2) {
    result.issues.push({
      type: 'error',
      message: 'Insufficient data in block for analysis'
    });
    return result;
  }

  // Simple header detection - look for first row with text
  for (let row = 0; row < Math.min(blockData.length, 3); row++) {
    const hasText = blockCellData[row]?.some(cell => cell.type === 'string' && cell.value);
    if (hasText) {
      result.headerRow = row;
      result.dataStartRow = row + 1;
      break;
    }
  }

  if (result.headerRow === -1) {
    result.dataStartRow = 0; // No header detected, data starts at first row
  }

  // Simple concentration column detection - look for numeric columns
  const numericColumns: Array<{ column: number; score: number }> = [];
  
  for (let col = 0; col < (blockData[0]?.length || 0); col++) {
    let numericCount = 0;
    let totalCount = 0;
    
    for (let row = result.dataStartRow; row < Math.min(blockData.length, result.dataStartRow + 10); row++) {
      const cell = blockCellData[row]?.[col];
      if (cell && cell.type !== 'empty') {
        totalCount++;
        if (cell.type === 'number') {
          numericCount++;
        }
      }
    }
    
    const score = totalCount > 0 ? numericCount / totalCount : 0;
    if (score > 0.5) {
      numericColumns.push({ column: col, score });
    }
  }

  // Sort by score and assign first as concentration, rest as response
  numericColumns.sort((a, b) => b.score - a.score);
  
  if (numericColumns.length > 0) {
    result.concentrationColumn = numericColumns[0].column;
    result.responseColumns = numericColumns.slice(1).map(col => col.column);
  }

  // Simple confidence calculation
  if (result.concentrationColumn >= 0 && result.responseColumns.length > 0) {
    result.confidence = 0.8;
    result.detectedLayout = 'standard';
  } else if (result.concentrationColumn >= 0) {
    result.confidence = 0.5;
  } else {
    result.confidence = 0.2;
    result.issues.push({
      type: 'warning',
      message: 'Could not detect clear concentration and response columns'
    });
  }

  return result;
}