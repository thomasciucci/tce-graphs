'use client';

import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { SpreadsheetData, CellData, WorkbookData } from '../types';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

interface SimpleFileUploadProps {
  onFileProcessed: (spreadsheetData: SpreadsheetData) => void;
  onWorkbookProcessed: (workbookData: WorkbookData) => void;
  acceptedFileTypes?: string;
}

export function SimpleFileUpload({ 
  onFileProcessed,
  onWorkbookProcessed,
  acceptedFileTypes = '.xlsx,.xls' 
}: SimpleFileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const convertToSpreadsheetData = useCallback((rawData: any[][], sheetName: string): SpreadsheetData => {
    const cells: CellData[][] = [];
    
    for (let row = 0; row < rawData.length; row++) {
      const cellRow: CellData[] = [];
      const dataRow = rawData[row] || [];
      
      for (let col = 0; col < Math.max(dataRow.length, 20); col++) {
        const value = dataRow[col];
        const isEmpty = value == null || value === '';
        const isNumeric = !isEmpty && !isNaN(Number(value)) && typeof value !== 'boolean';
        
        // Simple header detection - check if in first 3 rows and is text
        const isHeader = row < 3 && !isEmpty && !isNumeric && typeof value === 'string';
        
        cellRow.push({
          value: isEmpty ? null : value,
          row,
          column: col,
          isNumeric,
          isEmpty,
          isHeader,
        });
      }
      cells.push(cellRow);
    }

    return {
      cells,
      originalData: rawData,
      sheetName,
      dimensions: {
        rows: rawData.length,
        columns: Math.max(...rawData.map(row => row?.length || 0), 20),
      },
    };
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setUploadedFile(file);

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellText: false,
        cellDates: true,
      });

      // Check if workbook has multiple sheets
      if (workbook.SheetNames.length > 1) {
        // Multiple sheets - process all and let user choose
        const workbookData: WorkbookData = {
          sheets: {},
          sheetNames: workbook.SheetNames,
          fileName: file.name,
        };

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (worksheet) {
            const rawData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              raw: false,
              defval: null,
            }) as any[][];

            workbookData.sheets[sheetName] = convertToSpreadsheetData(rawData, sheetName);
          }
        }

        onWorkbookProcessed(workbookData);
      } else {
        // Single sheet - process directly
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('No sheets found in the Excel file');
        }

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error('Could not read the worksheet');
        }

        // Convert to JSON array with headers
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          raw: false,
          defval: null,
        }) as any[][];

        if (rawData.length === 0) {
          throw new Error('The Excel sheet appears to be empty');
        }

        // Convert to our SpreadsheetData format
        const spreadsheetData = convertToSpreadsheetData(rawData, sheetName);
        
        onFileProcessed(spreadsheetData);
      }
      
    } catch (err) {
      console.error('File processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process the file');
    } finally {
      setIsLoading(false);
    }
  }, [convertToSpreadsheetData, onFileProcessed, onWorkbookProcessed]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const fakeEvent = {
        target: { files }
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(fakeEvent);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">nVitro Studio</h1>
        <p className="text-gray-600">Professional dose-response analysis tool</p>
      </div>

      {!uploadedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isLoading 
              ? 'border-blue-300 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                <p className="text-blue-600 font-medium">Processing your file...</p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Upload your Excel file
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Drag and drop your .xlsx or .xls file here
                  </p>
                  
                  <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Choose File
                    <input
                      type="file"
                      accept={acceptedFileTypes}
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                </div>
                
                <p className="text-xs text-gray-500">
                  Supports Excel files (.xlsx, .xls) up to 10MB
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="font-medium text-gray-900">{uploadedFile.name}</h3>
                <p className="text-sm text-gray-500">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setUploadedFile(null);
                setError(null);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              Upload Different File
            </button>
          </div>
          
          <p className="text-sm text-gray-600">
            File uploaded successfully. Now you can select your data regions on the next screen.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Upload Error</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <p className="text-red-600 text-xs mt-2">
                Please check that your file is a valid Excel file and try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help section */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Supported File Formats</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Excel files (.xlsx, .xls)</li>
          <li>• Files containing dose-response data</li>
          <li>• Multiple datasets per file supported</li>
          <li>• Various data layouts (standard, transposed, multi-block)</li>
        </ul>
        
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            After upload, you&apos;ll be able to visually select your data regions for analysis.
          </p>
        </div>
      </div>
    </div>
  );
}