'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { DataPoint, Dataset } from '../types';

interface FileUploadProps {
  onDataUpload: (data: DataPoint[]) => void;
  onMultipleDatasetsUpload?: (datasets: Dataset[]) => void;
}

export default function FileUpload({ onDataUpload, onMultipleDatasetsUpload }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);
  const [previewData, setPreviewData] = useState<unknown[][]>([]);
  const [detectedTables, setDetectedTables] = useState<DetectedTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [importMode, setImportMode] = useState<'combined' | 'separate'>('combined');
  const [editedTableNames, setEditedTableNames] = useState<Record<string, string>>({});

  interface DetectedTable {
    id: string;
    title: string;
    assayType: string;
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    headerRow: number;
    concentrationCol: number;
    responseColumns: number[];
    sampleNames: string[];
    preview: unknown[][];
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setAvailableSheets([]);
    setSelectedSheets([]);
    setActiveSheet('');
    setPreviewData([]);

    try {
      const workbook = await loadExcelFile(file);
      setWorkbookData(workbook);
      setAvailableSheets(workbook.SheetNames);
      
      // Auto-select first sheet and show preview
      if (workbook.SheetNames.length > 0) {
        const firstSheet = workbook.SheetNames[0];
        setSelectedSheets([firstSheet]);
        setActiveSheet(firstSheet);
        showPreview(workbook, firstSheet);
        // Don't auto-detect tables - wait for user confirmation
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetToggle = (sheetName: string) => {
    setSelectedSheets(prev => {
      const newSelected = prev.includes(sheetName) 
        ? prev.filter(s => s !== sheetName)
        : [...prev, sheetName];
      
      // If we're deselecting the active sheet, switch to another one
      if (prev.includes(sheetName) && sheetName === activeSheet && newSelected.length > 0) {
        setActiveSheet(newSelected[0]);
        if (workbookData) {
          showPreview(workbookData, newSelected[0]);
        }
      }
      // If we're selecting a new sheet and no active sheet, set it as active
      else if (!prev.includes(sheetName) && !activeSheet) {
        setActiveSheet(sheetName);
        if (workbookData) {
          showPreview(workbookData, sheetName);
        }
      }
      
      return newSelected;
    });
    
    setDetectedTables([]);
    setSelectedTables([]);
  };

  const handleActiveSheetChange = (sheetName: string) => {
    setActiveSheet(sheetName);
    if (workbookData) {
      showPreview(workbookData, sheetName);
    }
  };

  const handleDetectTables = () => {
    if (workbookData && activeSheet) {
      setIsLoading(true);
      setError(null);
      
      try {
        detectDataTables(workbookData, activeSheet);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to detect tables');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleImportData = () => {
    if (!workbookData || !activeSheet || selectedTables.length === 0) return;
    
    setIsLoading(true);
    setError(null);

    try {
      if (selectedTables.length === 1) {
        // Single table import
        const table = detectedTables.find(t => t.id === selectedTables[0]);
        if (table) {
          const data = processTableData(workbookData, activeSheet, table);
          onDataUpload(data);
        }
      } else {
        // Multiple tables import - check if user wants combined or separate
        if (!showImportOptions) {
          setShowImportOptions(true);
          // Initialize editedTableNames with current titles
          const names: Record<string, string> = {};
          for (const tableId of selectedTables) {
            const table = detectedTables.find(t => t.id === tableId);
            if (table) names[tableId] = table.title;
          }
          setEditedTableNames(names);
          setIsLoading(false);
          return;
        }
        
        if (importMode === 'combined') {
          // Combine all tables into one dataset
          const allData: DataPoint[] = [];
          for (const tableId of selectedTables) {
            const table = detectedTables.find(t => t.id === tableId);
            if (table) {
              const tableData = processTableData(workbookData, activeSheet, table);
              // Use edited name for prefix
              const prefix = editedTableNames[tableId] || table.assayType;
              const prefixedData = tableData.map(dp => ({
                ...dp,
                sampleNames: dp.sampleNames.map(name => `${prefix}: ${name}`)
              }));
              
              if (allData.length === 0) {
                allData.push(...prefixedData);
              } else {
                // Merge data by concentration
                prefixedData.forEach(newRow => {
                  const existingRow = allData.find(row => Math.abs(row.concentration - newRow.concentration) < 1e-6);
                  if (existingRow) {
                    existingRow.responses.push(...newRow.responses);
                    existingRow.sampleNames.push(...newRow.sampleNames);
                  } else {
                    allData.push(newRow);
                  }
                });
              }
            }
          }
          
          // Sort by concentration
          allData.sort((a, b) => a.concentration - b.concentration);
          onDataUpload(allData);
        } else {
          // Create separate datasets
          const datasets: Dataset[] = [];
          for (const tableId of selectedTables) {
            const table = detectedTables.find(t => t.id === tableId);
            if (table) {
              const tableData = processTableData(workbookData, activeSheet, table);
              datasets.push({
                id: table.id,
                name: editedTableNames[tableId] || table.title,
                data: tableData,
                assayType: table.assayType
              });
            }
          }
          
          if (onMultipleDatasetsUpload) {
            onMultipleDatasetsUpload(datasets);
          } else {
            // Fallback to combined if callback not provided
            const allData: DataPoint[] = [];
            datasets.forEach(dataset => {
              const prefixedData = dataset.data.map(dp => ({
                ...dp,
                sampleNames: dp.sampleNames.map(name => `${dataset.name}: ${name}`)
              }));
              allData.push(...prefixedData);
            });
            allData.sort((a, b) => a.concentration - b.concentration);
            onDataUpload(allData);
          }
        }
        
        // Reset import options
        setShowImportOptions(false);
        setImportMode('combined');
        setEditedTableNames({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableSelection = (tableId: string, selected: boolean) => {
    setSelectedTables(prev => 
      selected 
        ? [...prev, tableId]
        : prev.filter(id => id !== tableId)
    );
  };

  const loadExcelFile = async (file: File): Promise<XLSX.WorkBook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          resolve(workbook);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const showPreview = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      
      // Show first 10 rows for preview
      setPreviewData(jsonData.slice(0, 10));
    } catch (err) {
      console.error('Error showing preview:', err);
      setPreviewData([]);
    }
  };

  const detectDataTables = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      
      const tables = findDataTables(jsonData, worksheet);
      setDetectedTables(tables);
      
      // Auto-select all tables if found
      if (tables.length > 0) {
        setSelectedTables(tables.map(t => t.id));
      }
    } catch (err) {
      console.error('Error detecting data tables:', err);
      setDetectedTables([]);
    }
  };

  // Replace findDataTables with improved detection logic
  const findDataTables = (jsonData: unknown[][], worksheet?: XLSX.WorkSheet): DetectedTable[] => {
    const tables: DetectedTable[] = [];
    
    // Flexible keyword matching - case insensitive, common variations
    const keywords = [
      "cytotoxicity", "cytotoxic", "cell death", "viability",
      "activation", "cd25", "cd25+", "il-2", "interleukin",
      "tce", "t cell", "tcell", "t-cell",
      "assay", "response", "signal", "fluorescence",
      "target cells", "target"
    ];

    // Specific assay type patterns for better naming
    const assayPatterns = [
      { pattern: /cytotoxicity|cytotoxic|cell death|viability/i, name: "Cytotoxicity" },
      { pattern: /cd4.*activation|activation.*cd4|cd4.*il-2|il-2.*cd4/i, name: "CD4 Activation" },
      { pattern: /cd8.*activation|activation.*cd8|cd8.*il-2|il-2.*cd8/i, name: "CD8 Activation" },
      { pattern: /cd25.*cd4|cd4.*cd25/i, name: "CD4 CD25+ Activation" },
      { pattern: /cd25.*cd8|cd8.*cd25/i, name: "CD8 CD25+ Activation" },
      { pattern: /target.*cells|% target/i, name: "Target Cells" },
      { pattern: /activation/i, name: "Activation" },
      { pattern: /cytotoxicity|cytotoxic/i, name: "Cytotoxicity" }
    ];
    
    // Flexible concentration patterns - prioritize TCE [nM] format
    const concentrationPatterns = [
      /tce\s*[\[\(]?\s*nm\s*[\]\)]?/i,  // Primary pattern: "TCE [nM]"
      /concentration\s*[\[\(]?\s*nm\s*[\]\)]?/i,
      /conc\s*[\[\(]?\s*nm\s*[\]\)]?/i,
      /dose\s*[\[\(]?\s*nm\s*[\]\)]?/i,
      /[\[\(]?\s*nm\s*[\]\)]?/i,
      /tce/i
    ];

    // Patterns to avoid (raw data tables)
    const avoidPatterns = [
      "well id", "sample id", "well", "sample",
      "ctv", "total live", "live cells"
    ];

    // Helper: fuzzy string matching (allows for typos and variations)
    function fuzzyMatch(text: string, patterns: (string | RegExp)[]): boolean {
      const normalizedText = text.toString().toLowerCase().replace(/[^\w\s]/g, ' ').trim();
      
      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          const normalizedPattern = pattern.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
          if (normalizedText.includes(normalizedPattern)) return true;
        } else {
          if (pattern.test(text)) return true;
        }
      }
      return false;
    }

    // Helper: check if row contains raw data patterns to avoid
    function shouldAvoidRow(rowData: unknown[]): boolean {
      const rowText = rowData.join(' ').toLowerCase();
      return avoidPatterns.some(pattern => rowText.includes(pattern));
    }

    // Helper: check if a column contains a proper dilution series
    function isDilutionSeries(columnData: unknown[]): boolean {
      const numbers = columnData
        .map(val => {
          const num = parseFloat(String(val));
          return isNaN(num) ? null : num;
        })
        .filter(num => num !== null) as number[];
      
      if (numbers.length < 3) return false;
      
      // Check for decreasing series (most common for TCE dilutions)
      let decreasing = 0;
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] < numbers[i - 1]) decreasing++;
      }
      
      // Check for increasing series
      let increasing = 0;
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] > numbers[i - 1]) increasing++;
      }
      
      // Check for wide range (at least 1 order of magnitude for TCE dilutions)
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const range = max / min;
      
      // For TCE dilutions, we expect either decreasing or increasing with reasonable range
      return (decreasing >= numbers.length - 2 || increasing >= numbers.length - 2) && range >= 2;
    }

    // Helper: find table boundaries
    function findTableBoundaries(jsonData: unknown[][], startRow: number, startCol: number): {
      endRow: number;
      endCol: number;
      validDataRows: number;
    } {
      let endRow = startRow;
      let endCol = startCol;
      let validDataRows = 0;
      
      // Find end row by looking for consecutive empty rows
      for (let row = startRow + 1; row < jsonData.length; row++) {
        const rowData = jsonData[row] as unknown[];
        if (!rowData) continue;
        
        const hasData = rowData.some((cell, col) => 
          col >= startCol && cell !== undefined && cell !== null && cell !== ''
        );
        
        if (hasData) {
          endRow = row;
          validDataRows++;
        } else {
          // Check if next few rows are also empty
          let consecutiveEmpty = 0;
          for (let checkRow = row; checkRow < Math.min(row + 3, jsonData.length); checkRow++) {
            const checkRowData = jsonData[checkRow] as unknown[];
            if (!checkRowData || !checkRowData.some((cell, col) => 
              col >= startCol && cell !== undefined && cell !== null && cell !== ''
            )) {
              consecutiveEmpty++;
            }
          }
          if (consecutiveEmpty >= 2) break;
        }
      }
      
      // Find end column
      for (let col = startCol; col < (jsonData[startRow] as unknown[])?.length || 0; col++) {
        let hasData = false;
        for (let row = startRow; row <= endRow; row++) {
          const cell = jsonData[row]?.[col];
          if (cell !== undefined && cell !== null && cell !== '') {
            hasData = true;
            break;
          }
        }
        if (hasData) {
          endCol = col;
        } else {
          // Check if next few columns are also empty
          let consecutiveEmpty = 0;
          for (let checkCol = col; checkCol < Math.min(col + 3, (jsonData[startRow] as unknown[])?.length || 0); checkCol++) {
            let colHasData = false;
            for (let row = startRow; row <= endRow; row++) {
              const cell = jsonData[row]?.[checkCol];
              if (cell !== undefined && cell !== null && cell !== '') {
                colHasData = true;
                break;
              }
            }
            if (!colHasData) consecutiveEmpty++;
          }
          if (consecutiveEmpty >= 2) break;
        }
      }
      
      return { endRow, endCol, validDataRows };
    }

    // Helper: extract sample names from header
    function extractSampleNames(headerRow: unknown[], startCol: number, endCol: number): string[] {
      const names: string[] = [];
      for (let col = startCol + 1; col <= endCol; col++) {
        const cell = headerRow[col];
        if (cell && String(cell).trim().length > 0) {
          names.push(String(cell).trim());
        }
      }
      return names;
    }

    // Helper: find keyword in nearby rows (look left of the table)
    function findKeywordNearby(jsonData: unknown[][], row: number, startCol: number): { found: boolean; keyword: string; title: string } {
      // Look in the current row and nearby rows, focusing on columns to the left of the table
      for (let checkRow = Math.max(0, row - 2); checkRow <= Math.min(jsonData.length - 1, row + 2); checkRow++) {
        const checkRowData = jsonData[checkRow] as unknown[];
        if (!checkRowData) continue;
        
        // Check columns to the left of the table for keywords
        for (let col = 0; col < startCol; col++) {
          const cell = checkRowData[col];
          if (!cell) continue;
          
          const cellText = String(cell).toLowerCase();
          
          // First try to match specific assay patterns for better naming
          for (const assayPattern of assayPatterns) {
            if (assayPattern.pattern.test(cellText)) {
              return { found: true, keyword: assayPattern.name.toLowerCase(), title: assayPattern.name };
            }
          }
          
          // Fallback to general keywords
          for (const keyword of keywords) {
            if (cellText.includes(keyword.toLowerCase())) {
              const title = `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`;
              return { found: true, keyword, title };
            }
          }
        }
        
        // Also check the entire row text
        const rowText = checkRowData.join(' ').toLowerCase();
        
        // First try to match specific assay patterns for better naming
        for (const assayPattern of assayPatterns) {
          if (assayPattern.pattern.test(rowText)) {
            return { found: true, keyword: assayPattern.name.toLowerCase(), title: assayPattern.name };
          }
        }
        
        // Fallback to general keywords
        for (const keyword of keywords) {
          if (rowText.includes(keyword.toLowerCase())) {
            const title = `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`;
            return { found: true, keyword, title };
          }
        }
      }
      
      return { found: false, keyword: '', title: '' };
    }

    // Helper: find specific assay type for this table by analyzing its content
    function findTableSpecificAssayType(jsonData: unknown[][], row: number, startCol: number, endCol: number): { found: boolean; keyword: string; title: string } {
      // Look more broadly around the table area for specific assay information
      for (let checkRow = Math.max(0, row - 10); checkRow <= Math.min(jsonData.length - 1, row + 10); checkRow++) {
        const checkRowData = jsonData[checkRow] as unknown[];
        if (!checkRowData) continue;
        
        // Check all columns in this row for assay-specific information
        for (let col = 0; col < checkRowData.length; col++) {
          const cell = checkRowData[col];
          if (!cell) continue;
          
          const cellText = String(cell).toLowerCase();
          
          // Look for specific patterns that indicate assay type
          if (cellText.includes('cytotoxicity') || cellText.includes('cytotoxic') || cellText.includes('killing')) {
            return { found: true, keyword: 'cytotoxicity', title: 'Cytotoxicity' };
          }
          
          if (cellText.includes('cd4') && (cellText.includes('activation') || cellText.includes('cd25') || cellText.includes('il-2'))) {
            return { found: true, keyword: 'cd4 activation', title: 'CD4 Activation' };
          }
          
          if (cellText.includes('cd8') && (cellText.includes('activation') || cellText.includes('cd25') || cellText.includes('il-2'))) {
            return { found: true, keyword: 'cd8 activation', title: 'CD8 Activation' };
          }
          
          if (cellText.includes('target') && cellText.includes('cells')) {
            return { found: true, keyword: 'target cells', title: 'Target Cells' };
          }
          
          // Look for percentage patterns that might indicate cell type
          if (cellText.includes('%') && cellText.includes('cd4')) {
            return { found: true, keyword: 'cd4 activation', title: 'CD4 Activation' };
          }
          
          if (cellText.includes('%') && cellText.includes('cd8')) {
            return { found: true, keyword: 'cd8 activation', title: 'CD8 Activation' };
          }
        }
      }
      
      return { found: false, keyword: '', title: '' };
    }

    // Scan all rows for potential table headers
    for (let row = 0; row < jsonData.length; row++) {
      const rowData = jsonData[row] as unknown[];
      if (!rowData) continue;
      
      // Skip rows that contain raw data patterns
      if (shouldAvoidRow(rowData)) continue;
      
      // Look for concentration column in this row
      let concentrationCol = -1;
      for (let col = 0; col < rowData.length; col++) {
        const cell = rowData[col];
        if (cell && fuzzyMatch(String(cell), concentrationPatterns)) {
          concentrationCol = col;
          break;
        }
      }
      
      if (concentrationCol === -1) continue;
      
      // Check for keywords in nearby rows (look to the left of the table)
      const { found: foundKeyword, keyword: assayType, title } = findKeywordNearby(jsonData, row, concentrationCol);
      
      // Check if there's a dilution series in the concentration column
      const concentrationData = [];
      for (let dataRow = row + 1; dataRow < Math.min(row + 20, jsonData.length); dataRow++) {
        const cell = jsonData[dataRow]?.[concentrationCol];
        if (cell !== undefined && cell !== null && cell !== '') {
          concentrationData.push(cell);
        }
      }
      
      if (!isDilutionSeries(concentrationData)) continue;
      
      // Find table boundaries
      const { endRow, endCol, validDataRows } = findTableBoundaries(jsonData, row, concentrationCol);
      
      // Validate table size
      if (validDataRows < 3 || validDataRows > 50) continue;
      if (endCol - concentrationCol < 1) continue; // Need at least 1 response column
      
      // If no specific keyword found, try to find table-specific assay type
      let finalTitle = title;
      let finalAssayType = assayType;
      
      if (!foundKeyword) {
        const { found: foundSpecific, keyword: specificAssayType, title: specificTitle } = findTableSpecificAssayType(jsonData, row, concentrationCol, endCol);
        if (foundSpecific) {
          finalTitle = specificTitle;
          finalAssayType = specificAssayType;
        } else {
          finalTitle = `Data Table (Row ${row + 1})`;
          finalAssayType = 'Data';
        }
      }
      
      // Extract sample names
      const sampleNames = extractSampleNames(rowData, concentrationCol, endCol);
      
      // If still no specific assay type found, try to infer from sample names or context
      let improvedTitle = finalTitle;
      let improvedAssayType = finalAssayType;
      
      if (!foundKeyword && finalAssayType === 'Data') {
        // Look for patterns in sample names
        const sampleText = sampleNames.join(' ').toLowerCase();
        for (const assayPattern of assayPatterns) {
          if (assayPattern.pattern.test(sampleText)) {
            improvedTitle = assayPattern.name;
            improvedAssayType = assayPattern.name.toLowerCase();
            break;
          }
        }
        
        // If still no match, try to extract from nearby rows
        for (let checkRow = Math.max(0, row - 5); checkRow <= Math.min(jsonData.length - 1, row + 5); checkRow++) {
          const checkRowData = jsonData[checkRow] as unknown[];
          if (!checkRowData) continue;
          
          const rowText = checkRowData.join(' ').toLowerCase();
          for (const assayPattern of assayPatterns) {
            if (assayPattern.pattern.test(rowText)) {
              improvedTitle = assayPattern.name;
              improvedAssayType = assayPattern.name.toLowerCase();
              break;
            }
          }
          if (improvedTitle !== finalTitle) break;
        }
      }
      
      // Create preview data
      const preview = jsonData.slice(row, Math.min(endRow + 1, row + 10))
        .map(r => (r as unknown[]).slice(concentrationCol, endCol + 1));
      
      // Create response columns array
      const responseColumns = Array.from(
        { length: endCol - concentrationCol }, 
        (_, i) => concentrationCol + 1 + i
      );
      
      tables.push({
        id: `table_${row}_${concentrationCol}_${improvedAssayType}`,
        title: improvedTitle,
        assayType: improvedAssayType,
        startRow: row + 1,
        endRow,
        startCol: concentrationCol,
        endCol,
        headerRow: row,
        concentrationCol,
        responseColumns,
        sampleNames,
        preview
      });
    }
    
    return tables;
  };

  const analyzeTableStructureAtPosition = (
    jsonData: unknown[][], 
    headerRow: number, 
    dataStartRow: number, 
    startCol: number,
    assayType: string, 
    title: string
  ): DetectedTable | null => {
    console.log(`Analyzing table structure at position: row=${headerRow}, col=${startCol}, assayType=${assayType}`);
    
    if (dataStartRow >= jsonData.length) {
      console.log(`Table rejected: dataStartRow ${dataStartRow} >= jsonData.length ${jsonData.length}`);
      return null;
    }

    const headerRowData = jsonData[headerRow] as unknown[];
    if (!headerRowData || headerRowData.length <= startCol) {
      console.log('Table rejected: header row insufficient data');
      return null;
    }
    
    // Extract header starting from startCol
    const headerSlice = headerRowData.slice(startCol);
    console.log(`Header slice from col ${startCol}:`, headerSlice);
    
    const concentrationCol = findConcentrationColumnInSlice(headerSlice, startCol);
    console.log(`Concentration column found at absolute index: ${concentrationCol}`);
    
    if (concentrationCol === -1) {
      console.log('Table rejected: no concentration column found');
      return null;
    }

    // Find response columns (columns after concentration within the slice)
    const responseColumns: number[] = [];
    const sampleNames: string[] = [];
    
    for (let col = concentrationCol + 1; col < Math.min(headerRowData.length, startCol + 20); col++) {
      const headerCell = headerRowData[col];
      if (headerCell && String(headerCell).trim().length > 0) {
        const cellText = String(headerCell).trim();
        
        // Check if this looks like a TCE or Row pattern
        const isTCEPattern = cellText.match(/^TCE\d+$/i) || cellText.match(/^Row\s+[A-Z]$/i);
        
        if (isTCEPattern) {
          console.log(`Found response column with TCE/Row pattern: "${cellText}" at col ${col}`);
        }
        
        responseColumns.push(col);
        sampleNames.push(cellText);
      }
    }

    console.log(`Response columns: ${responseColumns}, sample names: ${sampleNames}`);

    // Check column requirement (4-20 columns total: 1 concentration + 3-19 response columns)
    const totalColumns = 1 + responseColumns.length; // concentration + response columns
    if (totalColumns < 4 || totalColumns > 20) {
      console.log(`Table rejected: ${totalColumns} columns (need 4-20)`);
      return null;
    }

    if (responseColumns.length === 0) {
      console.log('Table rejected: no response columns found');
      return null;
    }

    // Find end of table by looking for valid data rows
    let endRow = dataStartRow - 1;
    let validDataRows = 0;
    
    console.log(`Checking data rows starting from ${dataStartRow}...`);
    
    for (let row = dataStartRow; row < jsonData.length && row < dataStartRow + 25; row++) {
      const dataRow = jsonData[row] as unknown[];
      if (!dataRow || dataRow.length <= concentrationCol) {
        console.log(`Row ${row}: insufficient data (length: ${dataRow?.length}, need > ${concentrationCol})`);
        break;
      }
      
      const concValue = dataRow[concentrationCol];
      if (!concValue || isNaN(parseFloat(String(concValue)))) {
        console.log(`Row ${row}: invalid concentration value: ${concValue}`);
        break;
      }
      
      // Check if this row has valid response data
      let hasValidResponses = true;
      let invalidResponseCount = 0;
      
      for (const colIndex of responseColumns) {
        const responseValue = dataRow[colIndex];
        if (!responseValue || isNaN(parseFloat(String(responseValue)))) {
          hasValidResponses = false;
          invalidResponseCount++;
        }
      }
      
      if (hasValidResponses) {
        endRow = row;
        validDataRows++;
        console.log(`Row ${row}: valid data row (${validDataRows} total)`);
      } else {
        console.log(`Row ${row}: invalid responses (${invalidResponseCount} invalid out of ${responseColumns.length})`);
        break; // Stop at first invalid row
      }
    }

    console.log(`Found ${validDataRows} valid data rows`);

    // Check row requirement (4-20 data rows)
    if (validDataRows < 4 || validDataRows > 20) {
      console.log(`Table rejected: ${validDataRows} data rows (need 4-20)`);
      return null;
    }

    // Create preview data (include title row if exists)
    const previewStart = Math.max(0, headerRow - 1);
    const previewData = jsonData.slice(previewStart, endRow + 1);

    console.log(`Table accepted: ${title} with ${validDataRows} data rows and ${totalColumns} columns`);

    return {
      id: `table_${headerRow}_${startCol}_${assayType}`,
      title: title || `${assayType} (Row ${headerRow + 1}, Col ${startCol + 1})`,
      assayType,
      startRow: dataStartRow,
      endRow,
      startCol,
      endCol: Math.max(...responseColumns),
      headerRow,
      concentrationCol,
      responseColumns,
      sampleNames,
      preview: previewData
    };
  };

  // Legacy function for backward compatibility
  const analyzeTableStructure = (
    jsonData: unknown[][], 
    headerRow: number, 
    dataStartRow: number, 
    assayType: string, 
    title: string
  ): DetectedTable | null => {
    return analyzeTableStructureAtPosition(jsonData, headerRow, dataStartRow, 0, assayType, title);
  };

  const findConcentrationColumnInSlice = (headerSlice: unknown[], startCol: number): number => {
    console.log('Finding concentration column in slice:', headerSlice, 'starting at col', startCol);
    
    // Try to find a column with concentration-related keywords
    for (let col = 0; col < headerSlice.length; col++) {
      const cell = String(headerSlice[col] || '').toLowerCase();
      if (cell.includes('concentration') || cell.includes('conc') || 
          cell.includes('dose') || cell.includes('tce') ||
          cell.includes('nm') || cell.includes('µm') || cell.includes('um') ||
          cell.includes('mol') || cell.includes('compound') || cell.includes('drug')) {
        console.log(`Found concentration column at slice index ${col}: "${headerSlice[col]}"`);
        return startCol + col; // Return absolute column index
      }
    }
    
    // Check if first column could be concentration (no header but has numeric titration)
    const firstColAbsolute = startCol;
    console.log('No concentration column found by keywords, checking if first column has titration pattern');
    
    // If no specific concentration column found, use first column in slice
    console.log('Defaulting to first column of slice');
    return startCol;
  };

  const findConcentrationColumn = (headerRow: unknown[]): number => {
    console.log('Finding concentration column in header:', headerRow);
    
    // Try to find a column with concentration-related keywords
    for (let col = 0; col < headerRow.length; col++) {
      const cell = String(headerRow[col] || '').toLowerCase();
      if (cell.includes('concentration') || cell.includes('conc') || 
          cell.includes('dose') || cell.includes('tce') ||
          cell.includes('nm') || cell.includes('µm') || cell.includes('um') ||
          cell.includes('mol') || cell.includes('compound') || cell.includes('drug')) {
        console.log(`Found concentration column at index ${col}: "${headerRow[col]}"`);
        return col;
      }
    }
    
    // If no specific concentration column found, check if first column contains numeric-looking data
    // This is a fallback for cases where the header might not have clear concentration indicators
    console.log('No concentration column found by keywords, defaulting to first column');
    return 0;
  };

  const findGeneralDataTable = (jsonData: unknown[][]): DetectedTable | null => {
    // Look for any table with numeric data that could be concentration-response
    for (let row = 0; row < jsonData.length - 4; row++) { // Need at least 4 more rows
      const headerCandidate = jsonData[row] as unknown[];
      if (!headerCandidate || headerCandidate.length < 4 || headerCandidate.length > 20) continue; // Need 4-20 columns

      const dataRow = jsonData[row + 1] as unknown[];
      if (!dataRow || dataRow.length < 4 || dataRow.length > 20) continue; // Need 4-20 columns

      // Check if first column contains numeric values (potential concentrations)
      const firstDataCell = dataRow[0];
      if (firstDataCell && !isNaN(parseFloat(String(firstDataCell)))) {
        console.log(`Found potential general table at row ${row}`);
        const table = analyzeTableStructure(jsonData, row, row + 1, 'general', 'Data Table');
        if (table) {
          console.log(`Valid general table created: ${table.title}`);
          return table;
        }
      }
    }
    console.log('No valid general table found');
    return null;
  };


  const processTableData = (workbook: XLSX.WorkBook, sheetName: string, table: DetectedTable): DataPoint[] => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    
    const processedData: DataPoint[] = [];
    
    console.log(`Processing table data: ${table.title}`);
    console.log(`Table bounds: rows ${table.startRow}-${table.endRow}, cols ${table.startCol}-${table.endCol}`);
    console.log(`Concentration column: ${table.concentrationCol}, Response columns: ${table.responseColumns}`);
    
    for (let row = table.startRow; row <= table.endRow; row++) {
      const dataRow = jsonData[row] as unknown[];
      if (!dataRow || dataRow.length <= table.concentrationCol) {
        console.log(`Skipping row ${row}: insufficient data`);
        continue;
      }
      
      const concentration = parseFloat(String(dataRow[table.concentrationCol]));
      if (isNaN(concentration)) {
        console.log(`Skipping row ${row}: invalid concentration ${dataRow[table.concentrationCol]}`);
        continue;
      }
      
      const responses = table.responseColumns.map(col => {
        const value = dataRow[col];
        if (value === null || value === undefined || value === '') {
          throw new Error(`Missing response value at row ${row + 1}, column ${col + 1}`);
        }
        const response = parseFloat(String(value));
        if (isNaN(response)) {
          throw new Error(`Invalid response value at row ${row + 1}, column ${col + 1}: ${value}`);
        }
        return response;
      });
      
      processedData.push({
        concentration,
        responses,
        sampleNames: table.sampleNames
      });
    }
    
    if (processedData.length === 0) {
      throw new Error(`No valid data found in table: ${table.title}`);
    }
    
    if (processedData.length < 3) {
      throw new Error(`At least 3 data points are required for curve fitting in table: ${table.title}`);
    }
    
    console.log(`Successfully processed ${processedData.length} data points from table: ${table.title}`);
    return processedData;
  };


  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Upload Excel File</h2>
      
      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Choose Excel File'}
          </label>
          <p className="mt-2 text-sm text-gray-600">
            Supports .xls and .xlsx files with multiple sheets
          </p>
        </div>

        {/* Sheet Selection */}
        {availableSheets.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-blue-900 mb-3">Select Sheet(s)</h3>
            <div className="space-y-2">
              {availableSheets.map((sheetName) => (
                <label key={`sheet_${sheetName}`} className="flex items-center">
                  <input
                    type="checkbox"
                    name="sheet"
                    value={sheetName}
                    checked={selectedSheets.includes(sheetName)}
                    onChange={() => handleSheetToggle(sheetName)}
                    className="mr-2"
                  />
                  <span className={`text-sm ${activeSheet === sheetName ? 'text-blue-800 font-bold' : 'text-blue-800'}`}>{sheetName}</span>
                  {activeSheet === sheetName && (
                    <span className="ml-2 text-xs text-blue-600">(Preview)</span>
                  )}
                  <button
                    type="button"
                    className="ml-2 text-xs text-blue-500 underline"
                    onClick={() => handleActiveSheetChange(sheetName)}
                  >
                    Preview
                  </button>
                </label>
              ))}
            </div>
            {selectedSheets.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    // Detect tables in all selected sheets
                    if (workbookData) {
                      setIsLoading(true);
                      setError(null);
                      try {
                        let allTables: DetectedTable[] = [];
                        selectedSheets.forEach(sheet => {
                          const worksheet = workbookData.Sheets[sheet];
                          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
                          const tables = findDataTables(jsonData, worksheet);
                          // Make table.id unique by including sheet name
                          allTables = allTables.concat(tables.map(t => ({ ...t, id: `${t.id}_${sheet}`, title: `${t.title} (${sheet})` })));
                        });
                        setDetectedTables(allTables);
                        if (allTables.length > 0) {
                          setSelectedTables(allTables.map(t => t.id));
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to detect tables');
                        setDetectedTables([]);
                      } finally {
                        setIsLoading(false);
                      }
                    }
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Detecting...' : 'Detect Data Tables'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detected Tables */}
        {detectedTables.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="font-medium text-green-900 mb-3">
              Detected Data Tables ({detectedTables.length} found)
            </h3>
            <div className="space-y-3">
              {detectedTables.map((table) => (
                <div key={table.id} className="bg-white border border-green-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table.id)}
                        onChange={(e) => handleTableSelection(table.id, e.target.checked)}
                        className="mr-2"
                      />
                      <span className="font-medium text-green-800">{table.title}</span>
                    </label>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      {table.assayType}
                    </span>
                  </div>
                  <div className="text-xs text-green-700 mb-2">
                    Rows {table.startRow + 1}-{table.endRow + 1} | 
                    Samples: {table.sampleNames.join(', ')}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <tbody>
                        {table.preview.slice(0, 5).map((row, rowIndex) => (
                          <tr key={`preview_row_${table.id}_${rowIndex}`} className={rowIndex === 0 ? 'bg-green-100' : 'hover:bg-gray-100'}>
                            {(row as unknown[]).map((cell, colIndex) => (
                              <td key={`preview_cell_${table.id}_${rowIndex}_${colIndex}`} className="border border-gray-300 px-1 py-0.5">
                                {cell ? String(cell) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-green-700">
                {selectedTables.length} table(s) selected
                {selectedTables.length > 1 && ' (will be combined)'}
              </div>
              <button
                onClick={handleImportData}
                disabled={isLoading || selectedTables.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : `Import ${selectedTables.length} Table(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Import Options Dialog */}
        {showImportOptions && selectedTables.length > 1 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Import Options</h3>
              <p className="text-gray-600 mb-4">
                You have selected {selectedTables.length} tables. You can rename them before import:
              </p>
              <div className="space-y-2 mb-6">
                {selectedTables.map(tableId => {
                  const table = detectedTables.find(t => t.id === tableId);
                  if (!table) return null;
                  return (
                    <div key={`import_option_${tableId}`} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editedTableNames[tableId] || table.title}
                        onChange={e => setEditedTableNames(names => ({ ...names, [tableId]: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 flex-1"
                      />
                      <span className="text-xs text-gray-500">({table.assayType})</span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3 mb-6">
                <label className="flex items-start">
                  <input
                    type="radio"
                    name="importMode"
                    value="combined"
                    checked={importMode === 'combined'}
                    onChange={(e) => setImportMode(e.target.value as 'combined' | 'separate')}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <div className="font-medium">Combined Graph</div>
                    <div className="text-sm text-gray-600">
                      All tables will be plotted on the same graph with different colors. 
                      Sample names will be prefixed with the name you set above.
                    </div>
                  </div>
                </label>
                
                <label className="flex items-start">
                  <input
                    type="radio"
                    name="importMode"
                    value="separate"
                    checked={importMode === 'separate'}
                    onChange={(e) => setImportMode(e.target.value as 'combined' | 'separate')}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <div className="font-medium">Separate Graphs</div>
                    <div className="text-sm text-gray-600">
                      Each table will be plotted on its own graph, using the name you set above. 
                      You can switch between graphs using tabs or dropdown.
                    </div>
                  </div>
                </label>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowImportOptions(false);
                    setImportMode('combined');
                    setEditedTableNames({});
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportData}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Preview - shown only when no tables detected yet */}
        {previewData.length > 0 && detectedTables.length === 0 && activeSheet && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="font-medium text-gray-900 mb-3">Data Preview (First 10 rows)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <tbody>
                  {previewData.map((row, rowIndex) => (
                    <tr key={`preview_row_${activeSheet}_${rowIndex}`} className={rowIndex === 0 ? 'bg-blue-100' : 'hover:bg-gray-100'}>
                      {(row as unknown[]).map((cell, colIndex) => (
                        <td key={`preview_cell_${activeSheet}_${rowIndex}_${colIndex}`} className="border border-gray-300 px-2 py-1">
                          {cell ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Click &quot;Detect Data Tables&quot; to find multiple assay types, or import basic data structure
              </div>
              <button
                onClick={() => {
                  // Use basic import for simple data structure
                  if (workbookData && activeSheet) {
                    setIsLoading(true);
                    setError(null);
                    try {
                      const worksheet = workbookData.Sheets[activeSheet];
                      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
                      const generalTable = findGeneralDataTable(jsonData);
                      if (generalTable) {
                        const data = processTableData(workbookData, activeSheet, generalTable);
                        onDataUpload(data);
                      } else {
                        setError('No valid data structure found in this sheet');
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to process data');
                    } finally {
                      setIsLoading(false);
                    }
                  }
                }}
                disabled={isLoading || !activeSheet}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Import Basic Data'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
} 