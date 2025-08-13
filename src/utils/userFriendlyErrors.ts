/**
 * User-friendly error handling for nVitro Studio
 * Converts technical errors into actionable user messages
 */

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestions: string[];
  severity: 'error' | 'warning' | 'info';
  canRetry: boolean;
}

export interface ErrorContext {
  operation: 'file-upload' | 'gate-processing' | 'curve-fitting' | 'export';
  fileName?: string;
  gateId?: string;
  datasetName?: string;
}

/**
 * Convert technical error to user-friendly format
 */
export function createUserFriendlyError(error: Error | string, context: ErrorContext): UserFriendlyError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? '' : error.stack || '';

  // File upload errors
  if (context.operation === 'file-upload') {
    return handleFileUploadError(errorMessage, context);
  }

  // Gate processing errors
  if (context.operation === 'gate-processing') {
    return handleGateProcessingError(errorMessage, context);
  }

  // Curve fitting errors
  if (context.operation === 'curve-fitting') {
    return handleCurveFittingError(errorMessage, context);
  }

  // Export errors
  if (context.operation === 'export') {
    return handleExportError(errorMessage, context);
  }

  // Generic fallback
  return {
    title: 'Unexpected Error',
    message: 'Something went wrong while processing your request.',
    suggestions: [
      'Try refreshing the page and starting over',
      'Check your file format and data structure',
      'Contact support if the problem persists'
    ],
    severity: 'error',
    canRetry: true,
  };
}

function handleFileUploadError(errorMessage: string, context: ErrorContext): UserFriendlyError {
  const fileName = context.fileName || 'your file';

  // File format errors
  if (errorMessage.includes('Unsupported file type') || errorMessage.includes('not a valid')) {
    return {
      title: 'Invalid File Format',
      message: `${fileName} is not a supported Excel file format.`,
      suggestions: [
        'Save your file as .xlsx or .xls format',
        'Make sure the file is not corrupted',
        'Try opening the file in Excel first to verify it works'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  // File size errors
  if (errorMessage.includes('too large') || errorMessage.includes('size')) {
    return {
      title: 'File Too Large',
      message: `${fileName} is too large to process.`,
      suggestions: [
        'Try reducing the file size by removing unnecessary sheets',
        'Split large datasets into separate files',
        'Maximum supported file size is 10MB'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  // Empty file errors
  if (errorMessage.includes('empty') || errorMessage.includes('No sheets found')) {
    return {
      title: 'Empty File',
      message: `${fileName} appears to be empty or has no data sheets.`,
      suggestions: [
        'Check that your file contains data',
        'Make sure at least one worksheet has content',
        'Verify the file opens correctly in Excel'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  // Corrupted file errors
  if (errorMessage.includes('corrupted') || errorMessage.includes('cannot read')) {
    return {
      title: 'File Cannot Be Read',
      message: `${fileName} may be corrupted or password-protected.`,
      suggestions: [
        'Try saving a new copy of your file',
        'Remove password protection if present',
        'Check that the file opens correctly in Excel'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  return {
    title: 'File Upload Error',
    message: `Could not upload ${fileName}.`,
    suggestions: [
      'Check that your file is a valid Excel file (.xlsx or .xls)',
      'Try saving your file in a different format',
      'Make sure the file is not corrupted or password-protected'
    ],
    severity: 'error',
    canRetry: true,
  };
}

function handleGateProcessingError(errorMessage: string, context: ErrorContext): UserFriendlyError {
  const gateName = context.gateId ? `Gate ${context.gateId}` : 'your selected region';

  // No data errors
  if (errorMessage.includes('No data found') || errorMessage.includes('empty')) {
    return {
      title: 'No Data in Selection',
      message: `${gateName} appears to be empty or contains no usable data.`,
      suggestions: [
        'Try selecting a larger region that includes your data',
        'Make sure your selection includes both concentration and response columns',
        'Check that cells contain numeric values, not formulas'
      ],
      severity: 'warning',
      canRetry: true,
    };
  }

  // Concentration detection errors
  if (errorMessage.includes('concentration')) {
    return {
      title: 'Concentration Data Not Found',
      message: `Could not identify concentration values in ${gateName}.`,
      suggestions: [
        'Make sure your selection includes a column with dose/concentration values',
        'Verify that concentration values are numbers, not text',
        'Include column headers if they help identify concentration data'
      ],
      severity: 'warning',
      canRetry: true,
    };
  }

  // Response detection errors
  if (errorMessage.includes('response')) {
    return {
      title: 'Response Data Not Found',
      message: `Could not identify response values in ${gateName}.`,
      suggestions: [
        'Make sure your selection includes columns with response/measurement data',
        'Verify that response values are numbers',
        'Check that you have at least one response column'
      ],
      severity: 'warning',
      canRetry: true,
    };
  }

  // Too small selection
  if (errorMessage.includes('too small') || errorMessage.includes('minimum')) {
    return {
      title: 'Selection Too Small',
      message: `${gateName} is too small for dose-response analysis.`,
      suggestions: [
        'Select a larger region with at least 3 rows of data',
        'Include at least 2 columns (concentration + response)',
        'Make sure to include enough data points for curve fitting'
      ],
      severity: 'info',
      canRetry: true,
    };
  }

  return {
    title: 'Data Processing Error',
    message: `Could not process the data in ${gateName}.`,
    suggestions: [
      'Check that your selection contains dose-response data',
      'Verify that concentration and response values are numeric',
      'Try selecting a different region or adjusting the selection boundaries'
    ],
    severity: 'warning',
    canRetry: true,
  };
}

function handleCurveFittingError(errorMessage: string, context: ErrorContext): UserFriendlyError {
  const datasetName = context.datasetName || 'your dataset';

  // Insufficient data points
  if (errorMessage.includes('insufficient') || errorMessage.includes('not enough')) {
    return {
      title: 'Not Enough Data Points',
      message: `${datasetName} doesn't have enough data points for curve fitting.`,
      suggestions: [
        'You need at least 4 data points for four-parameter curve fitting',
        'Check that your data has valid numeric values',
        'Remove any empty rows or invalid entries'
      ],
      severity: 'warning',
      canRetry: false,
    };
  }

  // No response variation
  if (errorMessage.includes('no variation') || errorMessage.includes('constant')) {
    return {
      title: 'No Response Variation',
      message: `${datasetName} has constant response values, so no curve can be fitted.`,
      suggestions: [
        'Check that your response data varies across different concentrations',
        'Verify that you selected the correct response columns',
        'Make sure you have both high and low response values'
      ],
      severity: 'warning',
      canRetry: false,
    };
  }

  // Convergence errors
  if (errorMessage.includes('convergence') || errorMessage.includes('fitting failed')) {
    return {
      title: 'Curve Fitting Failed',
      message: `Could not fit a dose-response curve to ${datasetName}.`,
      suggestions: [
        'Your data may not follow a standard dose-response pattern',
        'Try manually adjusting problematic data points',
        'Check for outliers that might be affecting the fit'
      ],
      severity: 'warning',
      canRetry: true,
    };
  }

  return {
    title: 'Curve Fitting Error',
    message: `Could not fit curves for ${datasetName}.`,
    suggestions: [
      'Check that your data follows a dose-response pattern',
      'Verify that you have sufficient data points (at least 4)',
      'Make sure response values vary across concentrations'
    ],
    severity: 'warning',
    canRetry: true,
  };
}

function handleExportError(errorMessage: string, context: ErrorContext): UserFriendlyError {
  // PDF export errors
  if (errorMessage.includes('PDF') || errorMessage.includes('pdf')) {
    return {
      title: 'PDF Export Failed',
      message: 'Could not create the PDF report.',
      suggestions: [
        'Try the export again',
        'Check that you have fitted curves to export',
        'Make sure your browser allows file downloads'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  // PowerPoint export errors
  if (errorMessage.includes('PowerPoint') || errorMessage.includes('pptx')) {
    return {
      title: 'PowerPoint Export Failed',
      message: 'Could not create the PowerPoint presentation.',
      suggestions: [
        'Try the export again',
        'Check that you have charts to export',
        'Make sure your browser allows file downloads'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  // CSV export errors
  if (errorMessage.includes('CSV') || errorMessage.includes('csv')) {
    return {
      title: 'CSV Export Failed',
      message: 'Could not create the CSV file.',
      suggestions: [
        'Try the export again',
        'Check that you have data to export',
        'Make sure your browser allows file downloads'
      ],
      severity: 'error',
      canRetry: true,
    };
  }

  return {
    title: 'Export Error',
    message: 'Could not export your data.',
    suggestions: [
      'Try the export again',
      'Check that you have data to export',
      'Make sure your browser allows file downloads'
    ],
    severity: 'error',
    canRetry: true,
  };
}

/**
 * Format error for display in UI components
 */
export function formatErrorForDisplay(error: UserFriendlyError): {
  iconColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (error.severity) {
    case 'error':
      return {
        iconColor: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
      };
    case 'warning':
      return {
        iconColor: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
      };
    case 'info':
      return {
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
      };
    default:
      return {
        iconColor: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
      };
  }
}

/**
 * Quick helper to show success messages
 */
export function createSuccessMessage(operation: string, details?: string): UserFriendlyError {
  return {
    title: 'Success',
    message: `${operation} completed successfully.${details ? ' ' + details : ''}`,
    suggestions: [],
    severity: 'info',
    canRetry: false,
  };
}