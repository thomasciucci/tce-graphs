'use client';

import React, { useState } from 'react';
import { MultiSheetSelection, WorkbookData, SheetPatternComparison } from '../types';
import { Layers, Users, UserCheck, ArrowRight, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

interface PatternApplicationChoiceProps {
  multiSheetSelection: MultiSheetSelection;
  workbookData: WorkbookData;
  patternComparison?: SheetPatternComparison;
  onUnifiedPatternChoice: () => void;
  onIndividualPatternChoice: () => void;
  onBack: () => void;
}

export function PatternApplicationChoice({
  multiSheetSelection,
  workbookData,
  patternComparison,
  onUnifiedPatternChoice,
  onIndividualPatternChoice,
  onBack,
}: PatternApplicationChoiceProps) {
  const [selectedOption, setSelectedOption] = useState<'unified' | 'individual' | null>(null);

  const handleContinue = () => {
    if (selectedOption === 'unified') {
      onUnifiedPatternChoice();
    } else if (selectedOption === 'individual') {
      onIndividualPatternChoice();
    }
  };

  const isConsistent = patternComparison?.isConsistent ?? multiSheetSelection.hasConsistentPattern;
  const selectedSheetCount = multiSheetSelection.selectedSheets.length;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center space-x-1"
        >
          <ArrowLeft size={16} />
          <span>Back to sheet selection</span>
        </button>
        
        <div className="flex items-center space-x-3 mb-4">
          <Layers className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Choose Pattern Application</h2>
            <p className="text-gray-600">
              You&apos;ve selected {selectedSheetCount} sheets. How would you like to configure data patterns?
            </p>
          </div>
        </div>
      </div>

      {/* Pattern consistency info */}
      <div className={`p-4 rounded-lg border mb-6 ${
        isConsistent 
          ? 'bg-green-50 border-green-200' 
          : 'bg-orange-50 border-orange-200'
      }`}>
        <div className="flex items-start space-x-3">
          {isConsistent ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
          )}
          <div>
            <h4 className={`font-medium ${
              isConsistent ? 'text-green-800' : 'text-orange-800'
            }`}>
              {isConsistent ? 'Consistent Layouts Detected' : 'Different Layouts Detected'}
            </h4>
            <p className={`text-sm mt-1 ${
              isConsistent ? 'text-green-700' : 'text-orange-700'
            }`}>
              {isConsistent 
                ? 'Your selected sheets appear to have similar data layouts. You can apply the same pattern to all sheets.'
                : 'Your selected sheets have different data layouts. You may need to configure each sheet individually.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Option cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Unified Pattern Option */}
        <div
          className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
            selectedOption === 'unified'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSelectedOption('unified')}
        >
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-lg ${
              selectedOption === 'unified' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <Users className={`h-6 w-6 ${
                selectedOption === 'unified' ? 'text-blue-600' : 'text-gray-600'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Apply Same Pattern to All Sheets
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                Configure data pattern once and apply it to all {selectedSheetCount} sheets. 
                Best when sheets have identical layouts.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-gray-700">Faster setup</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-gray-700">Consistent processing</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-gray-700">Good for replicate experiments</span>
                </div>
              </div>

              {!isConsistent && (
                <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                  ⚠️ Warning: Your sheets have different layouts. This option may not work correctly.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Individual Pattern Option */}
        <div
          className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
            selectedOption === 'individual'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSelectedOption('individual')}
        >
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-lg ${
              selectedOption === 'individual' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <UserCheck className={`h-6 w-6 ${
                selectedOption === 'individual' ? 'text-blue-600' : 'text-gray-600'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Configure Each Sheet Individually
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                Set up data patterns for each sheet separately. 
                Best when sheets have different layouts or data types.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-gray-700">Maximum flexibility</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-gray-700">Handles different layouts</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-gray-700">Optimized for each sheet</span>
                </div>
              </div>

              {!isConsistent && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  ✅ Recommended: Your sheets have different layouts.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet preview */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 mb-3">Selected Sheets:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {multiSheetSelection.selectedSheets.map((sheetName) => {
            const sheetData = workbookData.sheets[sheetName];
            return (
              <div key={sheetName} className="bg-white rounded border p-3 text-sm">
                <div className="font-medium text-gray-900 truncate" title={sheetName}>
                  {sheetName}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {sheetData?.dimensions?.rows || 0} × {sheetData?.dimensions?.columns || 0}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {selectedOption ? (
            <span>Ready to proceed with {selectedOption === 'unified' ? 'unified' : 'individual'} pattern configuration</span>
          ) : (
            <span>Choose an option above to continue</span>
          )}
        </div>
        
        <button
          onClick={handleContinue}
          disabled={!selectedOption}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <span>Continue</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}