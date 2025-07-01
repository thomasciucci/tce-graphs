'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { DataPoint } from '../types';

interface FileUploadProps {
  onDataUpload: (data: DataPoint[]) => void;
}

export default function FileUpload({ onDataUpload }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await readExcelFile(file);
      onDataUpload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setIsLoading(false);
    }
  };

  const readExcelFile = async (file: File): Promise<DataPoint[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON with headers
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            throw new Error('File must contain at least 2 rows (header + data)');
          }
          
          if (jsonData.length > 1000) {
            throw new Error('File contains too many rows. Maximum 1000 rows supported.');
          }

          const headerRow = jsonData[0] as string[];
          const dataRows = jsonData.slice(1) as unknown[][];

          // Validate header row
          if (!headerRow || headerRow.length < 2) {
            throw new Error('File must have at least 2 columns (concentration + at least 1 sample)');
          }

          // Extract sample names (all columns except the first)
          const sampleNames = headerRow.slice(1).filter(name => name && name.toString().trim());
          
          if (sampleNames.length === 0) {
            throw new Error('No valid sample names found in header row');
          }
          
          if (sampleNames.length > 20) {
            throw new Error('Too many samples. Maximum 20 samples supported.');
          }
          
          // Process data rows
          const processedData: DataPoint[] = dataRows
            .filter(row => row.length > 0 && row[0] !== null && row[0] !== undefined)
            .map(row => {
              const concentration = parseFloat(String(row[0]));
              if (isNaN(concentration)) {
                throw new Error(`Invalid concentration value: ${row[0]}`);
              }

              const responses = row.slice(1, sampleNames.length + 1).map((val, index) => {
                const response = parseFloat(String(val));
                if (isNaN(response)) {
                  throw new Error(`Invalid response value in column ${index + 2}, row ${dataRows.indexOf(row) + 2}: ${val}`);
                }
                if (response < 0) {
                  console.warn(`Negative response value found: ${response} in column ${index + 2}, row ${dataRows.indexOf(row) + 2}`);
                }
                return response;
              });

              return {
                concentration,
                responses,
                sampleNames
              };
            });

          if (processedData.length === 0) {
            throw new Error('No valid data rows found in the file');
          }
          
          if (processedData.length < 3) {
            throw new Error('At least 3 data points are required for curve fitting');
          }

          resolve(processedData);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
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
            Supports .xls and .xlsx files
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
} 