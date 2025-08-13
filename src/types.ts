export interface DataPoint {
  concentration: number;
  responses: number[];
  sampleNames: string[];
  replicateGroups?: string[];
}

export interface Dataset {
  id: string;
  name: string;
  data: DataPoint[];
  assayType: string;
  sheetName?: string;
  fittedCurves?: FittedCurve[];
  curveColors?: string[];
}

export interface FittedCurve {
  sampleName: string;
  ec50: number;
  ec10?: number;
  ec90?: number;
  hillSlope: number;
  top: number;
  bottom: number;
  rSquared: number;
  auc?: number; // Area Under Curve
  fittedPoints: { x: number; y: number }[];
  originalPoints: { x: number; y: number }[];
  meanPoints?: { x: number; y: number; sem: number }[];
}

export interface CurveParameters {
  top: number;
  bottom: number;
  ec50: number;
  hillSlope: number;
}

// Analysis Configuration Types
export interface CurveFittingConstraints {
  topConstraints: {
    enabled: boolean;
    min?: number;
    max?: number;
    fixed?: number;
  };
  bottomConstraints: {
    enabled: boolean;
    min?: number;
    max?: number;
    fixed?: number;
  };
  hillSlopeConstraints: {
    enabled: boolean;
    min: number;
    max: number;
    fixed?: number;
  };
  ec50Constraints: {
    enabled: boolean;
    min?: number;
    max?: number;
  };
}

export interface StatisticalOptions {
  confidenceLevel: number; // 0.95 for 95% CI
  calculateCI: boolean;
  outlierDetection: {
    enabled: boolean;
    method: 'z-score' | 'iqr' | 'modified-z-score';
    threshold: number;
  };
  qualityThresholds: {
    minimumRSquared: number;
    minimumDataPoints: number;
  };
}

export interface OutputMetrics {
  calculateIC10: boolean;
  calculateIC50: boolean;
  calculateIC90: boolean;
  calculateEC10: boolean;
  calculateEC50: boolean;
  calculateEC90: boolean;
  calculateHillSlope: boolean;
  calculateAUC: boolean;
}

export interface DataPreprocessing {
  normalization: {
    enabled: boolean;
    method: 'percent-control' | 'min-max' | 'none';
    referenceValue?: number;
  };
  logTransform: {
    concentration: boolean;
    response: boolean;
  };
}

export interface AnalysisConfiguration {
  constraints: CurveFittingConstraints;
  statistics: StatisticalOptions;
  metrics: OutputMetrics;
  preprocessing: DataPreprocessing;
  assayType: 'inhibition' | 'stimulation' | 'binding' | 'custom';
}

// Gate-based selection system types
export interface BoundingBox {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface GateSelection {
  id: string;
  name: string;
  boundingBox: BoundingBox;
  isSelected: boolean;
  dataType: 'dose-response' | 'metadata' | 'unknown';
  color: string;
}

export interface CellData {
  value: any;
  row: number;
  column: number;
  isNumeric: boolean;
  isEmpty: boolean;
  isHeader: boolean;
}

export interface ProcessedGate {
  gateId: string;
  isValid: boolean;
  confidence: number;
  data: DataPoint[];
  issues: string[];
  autoDetection: {
    concentrationColumn: number;
    responseColumns: number[];
    headerRow: number;
    replicatePattern?: string;
  };
  suggestedName: string;
}

export interface GateAnalysisResult {
  gate: GateSelection;
  processed: ProcessedGate;
  rawData: any[][];
}

export interface SpreadsheetData {
  cells: CellData[][];
  originalData: any[][];
  sheetName: string;
  dimensions: {
    rows: number;
    columns: number;
  };
}

export interface WorkbookData {
  sheets: Record<string, SpreadsheetData>;
  sheetNames: string[];
  fileName: string;
}

export interface SheetPreview {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  hasData: boolean;
  preview: any[][];
  isSelected?: boolean;
}

export interface MultiSheetSelection {
  selectedSheets: string[];
  hasConsistentPattern: boolean;
  patternDetected?: {
    headerRow: number;
    concentrationColumn: number;
    responseColumns: number[];
    confidence: number;
  };
}

export interface SheetPatternComparison {
  isConsistent: boolean;
  confidence: number;
  commonPattern?: {
    headerRow: number;
    concentrationColumn: number;
    responseColumns: number[];
  };
  differences: {
    sheetName: string;
    pattern: any;
    issues: string[];
  }[];
}

// Replicate group management interfaces
export interface ReplicateGroupInfo {
  groupName: string;
  sampleIndices: number[];
  customName?: string;
}

export interface GroupedSampleData {
  groupName: string;
  displayName: string;
  sampleNames: string[];
  meanData: { x: number; y: number; sem?: number }[];
  individualData: { x: number; y: number; sampleIndex: number }[];
}

// Export Metadata Types for Enhanced Reporting
export interface ExportMetadata {
  exportTimestamp: Date;
  analysisTimestamp?: Date;
  softwareVersion: string;
  userId?: string;
  sessionId?: string;
}

export interface AnalysisMetadata {
  configuration: AnalysisConfiguration;
  datasetSummary: {
    totalDatasets: number;
    totalCurves: number;
    totalDataPoints: number;
    analysisDate: Date;
  };
  fittingMethod: {
    algorithm: 'Four-Parameter Logistic (4PL)';
    constraintsSummary: string;
    qualityMetrics: {
      averageRSquared?: number;
      acceptedCurves: number;
      rejectedCurves: number;
    };
  };
  statisticalSummary: {
    confidenceLevel?: number;
    outlierDetectionEnabled: boolean;
    normalizationApplied: boolean;
    transformationsApplied: string[];
  };
  exportMetadata: ExportMetadata;
}

export interface EnhancedExportOptions {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  curveVisibilityByDataset?: Record<string, boolean[]>;
  analysisMetadata: AnalysisMetadata;
  globalChartSettings?: {
    showGroups: boolean;
    showIndividuals: boolean;
    showCurveChart: boolean;
    showBarChart: boolean;
  };
  onDatasetSwitch?: (datasetIndex: number) => Promise<void>;
  onCurveVisibilityChange?: (datasetId: string, curveIndex: number, visible: boolean) => Promise<void>;
}

// Helper functions for replicate group management
export class ReplicateGroupUtils {
  /**
   * Get unique replicate groups from data
   */
  static getUniqueGroups(data: DataPoint[]): string[] {
    if (!data.length || !data[0].replicateGroups) return [];
    return Array.from(new Set(data[0].replicateGroups));
  }

  /**
   * Get samples belonging to a specific group
   */
  static getSamplesInGroup(data: DataPoint[], groupName: string): number[] {
    if (!data.length || !data[0].replicateGroups) return [];
    return data[0].replicateGroups
      .map((group, index) => group === groupName ? index : -1)
      .filter(index => index !== -1);
  }

  /**
   * Get display name for a replicate group (falls back to group name)
   */
  static getGroupDisplayName(data: DataPoint[], groupName: string): string {
    // For now, just return the group name. Later we can add custom display names
    return groupName;
  }

  /**
   * Create grouped sample data for visualization
   */
  static createGroupedData(data: DataPoint[]): GroupedSampleData[] {
    const groups = this.getUniqueGroups(data);
    return groups.map(groupName => {
      const sampleIndices = this.getSamplesInGroup(data, groupName);
      const sampleNames = sampleIndices.map(i => data[0].sampleNames[i]);
      
      // Calculate mean data points across all concentrations
      const meanData = data.map(point => {
        const groupValues = sampleIndices.map(i => point.responses[i]).filter(val => val !== null && val !== undefined);
        if (groupValues.length === 0) return { x: point.concentration, y: 0 };
        
        const mean = groupValues.reduce((sum, val) => sum + val, 0) / groupValues.length;
        const sem = groupValues.length > 1 ? 
          Math.sqrt(groupValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (groupValues.length - 1)) / Math.sqrt(groupValues.length) : 
          undefined;
        
        return { x: point.concentration, y: mean, sem };
      });

      // Individual data points
      const individualData = data.flatMap(point => 
        sampleIndices.map(sampleIndex => ({
          x: point.concentration,
          y: point.responses[sampleIndex],
          sampleIndex
        }))
      ).filter(point => point.y !== null && point.y !== undefined);

      return {
        groupName,
        displayName: this.getGroupDisplayName(data, groupName),
        sampleNames,
        meanData,
        individualData
      };
    });
  }

  /**
   * Update replicate group names across all data points
   */
  static updateGroupNames(data: DataPoint[], oldName: string, newName: string): DataPoint[] {
    return data.map(point => ({
      ...point,
      replicateGroups: point.replicateGroups?.map(group => group === oldName ? newName : group)
    }));
  }

  /**
   * Ensure all data points have replicate groups (create defaults if missing)
   */
  static ensureReplicateGroups(data: DataPoint[]): DataPoint[] {
    return data.map(point => ({
      ...point,
      replicateGroups: point.replicateGroups && point.replicateGroups.length === point.sampleNames.length
        ? point.replicateGroups
        : point.sampleNames.map((_, i) => `Group ${i + 1}`)
    }));
  }
} 