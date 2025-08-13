/**
 * Multi-Sheet Gate Processing Engine
 * Applies gate patterns across multiple sheets
 */

import { 
  GateSelection, 
  MultiSheetSelection, 
  WorkbookData, 
  GateAnalysisResult,
  ProcessedGate,
  SpreadsheetData,
  DataPoint
} from '../types';
import { processGates } from './gateProcessor';
import { extractDatasetName } from './datasetNaming';

/**
 * Process gates for multiple sheets using unified pattern
 */
export async function processGatesForMultipleSheets(
  gates: GateSelection[],
  multiSheetSelection: MultiSheetSelection,
  workbookData: WorkbookData
): Promise<GateAnalysisResult[]> {
  const allResults: GateAnalysisResult[] = [];

  for (const sheetName of multiSheetSelection.selectedSheets) {
    const spreadsheetData = workbookData.sheets[sheetName];
    if (!spreadsheetData) continue;

    // Apply each gate pattern to this sheet
    for (const gate of gates) {
      // Create a sheet-specific gate with adjusted coordinates if needed
      const adjustedGate = adjustGateForSheet(gate, spreadsheetData, multiSheetSelection);
      
      try {
        // Process the gate for this specific sheet
        const sheetResults = await processGates([adjustedGate], spreadsheetData);
        
        // Add sheet information to results
        for (const result of sheetResults) {
          // Update the dataset name to include sheet name
          if (result.processed.isValid) {
            result.processed.suggestedName = `${sheetName} - ${result.processed.suggestedName}`;
          }
          
          // Add sheet context
          result.gate.name = `${sheetName} - ${gate.name}`;
          result.rawData = extractGateDataForSheet(adjustedGate, spreadsheetData);
          
          allResults.push(result);
        }
      } catch (error) {
        console.error(`Error processing gate for sheet ${sheetName}:`, error);
        
        // Create error result for this sheet
        const errorResult: GateAnalysisResult = {
          gate: {
            ...adjustedGate,
            name: `${sheetName} - ${gate.name}`,
          },
          processed: {
            gateId: adjustedGate.id,
            isValid: false,
            confidence: 0,
            data: [],
            issues: [`Failed to process pattern in sheet "${sheetName}"`],
            autoDetection: {
              concentrationColumn: -1,
              responseColumns: [],
              headerRow: -1,
            },
            suggestedName: `${sheetName} - ${gate.name}`,
          },
          rawData: [],
        };
        
        allResults.push(errorResult);
      }
    }
  }

  console.log(`Processed ${gates.length} gate(s) across ${multiSheetSelection.selectedSheets.length} sheet(s), got ${allResults.length} results`);

  return allResults;
}

/**
 * Adjust gate coordinates for specific sheet if needed
 */
function adjustGateForSheet(
  gate: GateSelection,
  spreadsheetData: SpreadsheetData,
  multiSheetSelection: MultiSheetSelection
): GateSelection {
  // Create a copy of the gate for this sheet
  const adjustedGate: GateSelection = {
    ...gate,
    id: `${gate.id}-${spreadsheetData.sheetName}`,
  };

  // If patterns are consistent, use the gate as-is
  if (multiSheetSelection.hasConsistentPattern) {
    return adjustedGate;
  }

  // For inconsistent patterns, we might need to adjust coordinates
  // This is a simplified approach - in practice, we might want more sophisticated adjustment
  const { dimensions } = spreadsheetData;
  
  // Ensure the gate fits within the sheet dimensions
  adjustedGate.boundingBox = {
    startRow: Math.max(0, Math.min(gate.boundingBox.startRow, dimensions.rows - 1)),
    endRow: Math.min(dimensions.rows - 1, gate.boundingBox.endRow),
    startColumn: Math.max(0, Math.min(gate.boundingBox.startColumn, dimensions.columns - 1)),
    endColumn: Math.min(dimensions.columns - 1, gate.boundingBox.endColumn),
  };

  // If the pattern detection found a common pattern, try to use it as a hint
  if (multiSheetSelection.patternDetected) {
    const pattern = multiSheetSelection.patternDetected;
    
    // Adjust the gate to align with the detected pattern if reasonable
    const gateHeight = gate.boundingBox.endRow - gate.boundingBox.startRow;
    const gateWidth = gate.boundingBox.endColumn - gate.boundingBox.startColumn;
    
    // Try to center the gate around the detected pattern
    adjustedGate.boundingBox = {
      startRow: Math.max(0, pattern.headerRow),
      endRow: Math.min(dimensions.rows - 1, pattern.headerRow + gateHeight),
      startColumn: Math.max(0, Math.min(pattern.concentrationColumn, ...pattern.responseColumns) - 1),
      endColumn: Math.min(dimensions.columns - 1, Math.max(pattern.concentrationColumn, ...pattern.responseColumns) + 1),
    };
  }

  return adjustedGate;
}

/**
 * Extract gate data for a specific sheet
 */
function extractGateDataForSheet(gate: GateSelection, spreadsheetData: SpreadsheetData): any[][] {
  const { boundingBox } = gate;
  const result: any[][] = [];

  for (let row = boundingBox.startRow; row <= boundingBox.endRow; row++) {
    if (row < spreadsheetData.originalData.length) {
      const rowData = [];
      for (let col = boundingBox.startColumn; col <= boundingBox.endColumn; col++) {
        if (col < (spreadsheetData.originalData[row]?.length || 0)) {
          rowData.push(spreadsheetData.originalData[row][col]);
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
 * Process gates for individual sheets (when patterns are inconsistent)
 */
export async function processGatesForIndividualSheets(
  gatesPerSheet: Record<string, GateSelection[]>,
  workbookData: WorkbookData
): Promise<GateAnalysisResult[]> {
  const allResults: GateAnalysisResult[] = [];

  for (const [sheetName, gates] of Object.entries(gatesPerSheet)) {
    const spreadsheetData = workbookData.sheets[sheetName];
    if (!spreadsheetData || gates.length === 0) continue;

    try {
      const sheetResults = await processGates(gates, spreadsheetData);
      
      // Add sheet information to results
      for (const result of sheetResults) {
        if (result.processed.isValid) {
          result.processed.suggestedName = `${sheetName} - ${result.processed.suggestedName}`;
        }
        result.gate.name = `${sheetName} - ${result.gate.name}`;
        allResults.push(result);
      }
    } catch (error) {
      console.error(`Error processing gates for sheet ${sheetName}:`, error);
    }
  }

  return allResults;
}

/**
 * Generate summary of multi-sheet processing results
 */
export function summarizeMultiSheetResults(results: GateAnalysisResult[]): {
  totalResults: number;
  validResults: number;
  sheetsProcessed: Set<string>;
  issues: string[];
} {
  const sheetsProcessed = new Set<string>();
  const issues: string[] = [];
  let validResults = 0;

  for (const result of results) {
    // Extract sheet name from gate name
    const sheetName = result.gate.name.split(' - ')[0];
    sheetsProcessed.add(sheetName);

    if (result.processed.isValid) {
      validResults++;
    } else {
      issues.push(...result.processed.issues.map(issue => `${sheetName}: ${issue}`));
    }
  }

  return {
    totalResults: results.length,
    validResults,
    sheetsProcessed,
    issues,
  };
}