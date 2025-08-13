import { 
  Dataset, 
  FittedCurve, 
  AnalysisConfiguration, 
  AnalysisMetadata, 
  ExportMetadata,
  DataPoint 
} from '../types';

/**
 * Utility functions for generating comprehensive analysis metadata for exports
 */

export function generateExportMetadata(): ExportMetadata {
  return {
    exportTimestamp: new Date(),
    softwareVersion: 'nVitro Studio v2.0',
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

export function generateConstraintsSummary(config: AnalysisConfiguration): string {
  const constraints: string[] = [];
  
  if (config.constraints.topConstraints.enabled) {
    if (config.constraints.topConstraints.fixed !== undefined) {
      constraints.push(`Top fixed at ${config.constraints.topConstraints.fixed}`);
    } else {
      const min = config.constraints.topConstraints.min;
      const max = config.constraints.topConstraints.max;
      if (min !== undefined && max !== undefined) {
        constraints.push(`Top constrained: ${min} - ${max}`);
      } else if (min !== undefined) {
        constraints.push(`Top minimum: ${min}`);
      } else if (max !== undefined) {
        constraints.push(`Top maximum: ${max}`);
      }
    }
  }
  
  if (config.constraints.bottomConstraints.enabled) {
    if (config.constraints.bottomConstraints.fixed !== undefined) {
      constraints.push(`Bottom fixed at ${config.constraints.bottomConstraints.fixed}`);
    } else {
      const min = config.constraints.bottomConstraints.min;
      const max = config.constraints.bottomConstraints.max;
      if (min !== undefined && max !== undefined) {
        constraints.push(`Bottom constrained: ${min} - ${max}`);
      } else if (min !== undefined) {
        constraints.push(`Bottom minimum: ${min}`);
      } else if (max !== undefined) {
        constraints.push(`Bottom maximum: ${max}`);
      }
    }
  }
  
  if (config.constraints.hillSlopeConstraints.enabled) {
    if (config.constraints.hillSlopeConstraints.fixed !== undefined) {
      constraints.push(`Hill Slope fixed at ${config.constraints.hillSlopeConstraints.fixed}`);
    } else {
      constraints.push(`Hill Slope: ${config.constraints.hillSlopeConstraints.min} to ${config.constraints.hillSlopeConstraints.max}`);
    }
  }
  
  if (config.constraints.ec50Constraints.enabled) {
    const min = config.constraints.ec50Constraints.min;
    const max = config.constraints.ec50Constraints.max;
    if (min !== undefined && max !== undefined) {
      constraints.push(`EC50 constrained: ${min} - ${max} nM`);
    } else if (min !== undefined) {
      constraints.push(`EC50 minimum: ${min} nM`);
    } else if (max !== undefined) {
      constraints.push(`EC50 maximum: ${max} nM`);
    }
  }
  
  return constraints.length > 0 ? constraints.join('; ') : 'No constraints applied (free fitting)';
}

export function generateTransformationsSummary(config: AnalysisConfiguration): string[] {
  const transformations: string[] = [];
  
  if (config.preprocessing.logTransform.concentration) {
    transformations.push('Log10 concentration transformation');
  }
  
  if (config.preprocessing.logTransform.response) {
    transformations.push('Log10 response transformation');
  }
  
  if (config.preprocessing.normalization.enabled) {
    const method = config.preprocessing.normalization.method;
    switch (method) {
      case 'percent-control':
        transformations.push('Percent-of-control normalization');
        break;
      case 'min-max':
        transformations.push('Min-max normalization');
        break;
      default:
        transformations.push('Custom normalization');
    }
  }
  
  return transformations.length > 0 ? transformations : ['No data transformations applied'];
}

export function calculateQualityMetrics(
  fittedCurvesByDataset: Record<string, FittedCurve[]>,
  qualityThreshold: number = 0.80
): { averageRSquared: number; acceptedCurves: number; rejectedCurves: number } {
  const allCurves = Object.values(fittedCurvesByDataset).flat();
  
  if (allCurves.length === 0) {
    return { averageRSquared: 0, acceptedCurves: 0, rejectedCurves: 0 };
  }
  
  const validRSquared = allCurves
    .map(curve => curve.rSquared)
    .filter(r => !isNaN(r) && isFinite(r));
  
  const averageRSquared = validRSquared.length > 0 
    ? validRSquared.reduce((sum, r) => sum + r, 0) / validRSquared.length 
    : 0;
  
  const acceptedCurves = validRSquared.filter(r => r >= qualityThreshold).length;
  const rejectedCurves = validRSquared.filter(r => r < qualityThreshold).length;
  
  return { averageRSquared, acceptedCurves, rejectedCurves };
}

export function countTotalDataPoints(datasets: Dataset[]): number {
  return datasets.reduce((total, dataset) => {
    return total + dataset.data.length;
  }, 0);
}

export function countTotalCurves(fittedCurvesByDataset: Record<string, FittedCurve[]>): number {
  return Object.values(fittedCurvesByDataset).reduce((total, curves) => {
    return total + curves.length;
  }, 0);
}

export function generateAnalysisMetadata(
  datasets: Dataset[],
  fittedCurvesByDataset: Record<string, FittedCurve[]>,
  config: AnalysisConfiguration,
  analysisDate?: Date
): AnalysisMetadata {
  const totalCurves = countTotalCurves(fittedCurvesByDataset);
  const totalDataPoints = countTotalDataPoints(datasets);
  const qualityMetrics = calculateQualityMetrics(fittedCurvesByDataset, config.statistics.qualityThresholds.minimumRSquared);
  
  return {
    configuration: config,
    datasetSummary: {
      totalDatasets: datasets.length,
      totalCurves,
      totalDataPoints,
      analysisDate: analysisDate || new Date()
    },
    fittingMethod: {
      algorithm: 'Four-Parameter Logistic (4PL)',
      constraintsSummary: generateConstraintsSummary(config),
      qualityMetrics
    },
    statisticalSummary: {
      confidenceLevel: config.statistics.calculateCI ? config.statistics.confidenceLevel : undefined,
      outlierDetectionEnabled: config.statistics.outlierDetection.enabled,
      normalizationApplied: config.preprocessing.normalization.enabled,
      transformationsApplied: generateTransformationsSummary(config)
    },
    exportMetadata: generateExportMetadata()
  };
}

/**
 * Helper function to format analysis metadata for display in exports
 */
export function formatAnalysisMetadataForDisplay(metadata: AnalysisMetadata) {
  const { configuration, datasetSummary, fittingMethod, statisticalSummary, exportMetadata } = metadata;
  
  return {
    // Basic Analysis Information
    basicInfo: [
      ['Export Date', exportMetadata.exportTimestamp.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })],
      ['Analysis Date', datasetSummary.analysisDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })],
      ['Software Version', exportMetadata.softwareVersion],
      ['Session ID', exportMetadata.sessionId || 'N/A']
    ],
    
    // Dataset Summary
    datasetInfo: [
      ['Number of Datasets', datasetSummary.totalDatasets.toString()],
      ['Total Data Points', datasetSummary.totalDataPoints.toString()],
      ['Total Curves Fitted', datasetSummary.totalCurves.toString()],
      ['Assay Type', configuration.assayType.charAt(0).toUpperCase() + configuration.assayType.slice(1)]
    ],
    
    // Analysis Configuration
    analysisConfig: [
      ['Fitting Algorithm', fittingMethod.algorithm],
      ['Constraints Applied', fittingMethod.constraintsSummary],
      ['Quality Threshold (R²)', configuration.statistics.qualityThresholds.minimumRSquared.toFixed(2)],
      ['Minimum Data Points', configuration.statistics.qualityThresholds.minimumDataPoints.toString()]
    ],
    
    // Quality Metrics
    qualityMetrics: [
      ['Average R²', fittingMethod.qualityMetrics.averageRSquared?.toFixed(3) || 'N/A'],
      ['Curves Accepted', fittingMethod.qualityMetrics.acceptedCurves.toString()],
      ['Curves Rejected', fittingMethod.qualityMetrics.rejectedCurves.toString()],
      ['Success Rate', fittingMethod.qualityMetrics.acceptedCurves > 0 
        ? `${((fittingMethod.qualityMetrics.acceptedCurves / (fittingMethod.qualityMetrics.acceptedCurves + fittingMethod.qualityMetrics.rejectedCurves)) * 100).toFixed(1)}%`
        : '0%']
    ],
    
    // Statistical Options
    statisticalOptions: [
      ['Confidence Level', statisticalSummary.confidenceLevel ? `${(statisticalSummary.confidenceLevel * 100).toFixed(0)}%` : 'Not calculated'],
      ['Outlier Detection', statisticalSummary.outlierDetectionEnabled ? 'Enabled' : 'Disabled'],
      ['Normalization', statisticalSummary.normalizationApplied ? 'Applied' : 'None'],
      ['Data Transformations', statisticalSummary.transformationsApplied.join('; ')]
    ],
    
    // Calculated Metrics
    calculatedMetrics: [
      ['EC10 Calculation', configuration.metrics.calculateEC10 ? 'Enabled' : 'Disabled'],
      ['EC50 Calculation', configuration.metrics.calculateEC50 ? 'Enabled' : 'Disabled'],
      ['EC90 Calculation', configuration.metrics.calculateEC90 ? 'Enabled' : 'Disabled'],
      ['Hill Slope', configuration.metrics.calculateHillSlope ? 'Calculated' : 'Not calculated'],
      ['AUC Calculation', configuration.metrics.calculateAUC ? 'Enabled' : 'Disabled']
    ]
  };
}