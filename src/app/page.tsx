'use client';

import { useState } from 'react';
import FileUpload from '../components/FileUpload';
import DataEditor from '../components/DataEditor';
import CurveFitter from '../components/CurveFitter';
import ResultsDisplay from '../components/ResultsDisplay';
import { DataPoint, FittedCurve } from '../types';

export default function Home() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [fittedCurves, setFittedCurves] = useState<FittedCurve[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDataUpload = (uploadedData: DataPoint[]) => {
    setData(uploadedData);
    setFittedCurves([]); // Reset curves when new data is uploaded
  };

  const handleDataUpdate = (updatedData: DataPoint[]) => {
    setData(updatedData);
    setFittedCurves([]); // Reset curves when data is edited
  };

  const handleCurveFitting = async (curves: FittedCurve[]) => {
    setFittedCurves(curves);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Four-Parameter Logistic Curve Fitter
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Data Input */}
          <div className="space-y-6">
            <FileUpload onDataUpload={handleDataUpload} />
            
            {data.length > 0 && (
              <>
                <DataEditor 
                  data={data} 
                  onDataUpdate={handleDataUpdate} 
                />
                
                <CurveFitter 
                  data={data}
                  onCurveFitting={handleCurveFitting}
                  isProcessing={isProcessing}
                />
              </>
            )}
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {fittedCurves.length > 0 && (
              <ResultsDisplay 
                data={data} 
                fittedCurves={fittedCurves} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


