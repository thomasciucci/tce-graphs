'use client';

import { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import DataEditor from '../components/DataEditor';
import CurveFitter from '../components/CurveFitter';
import ResultsDisplay from '../components/ResultsDisplay';
import { DataPoint, FittedCurve, Dataset } from '../types';
import { fitCurvesForData } from '../fitUtils';

const defaultColors = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];

export default function Home() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [fittedCurves, setFittedCurves] = useState<FittedCurve[]>([]);
  const [fittedCurvesByDataset, setFittedCurvesByDataset] = useState<Record<string, FittedCurve[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [curveColors, setCurveColors] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeDatasetIndex, setActiveDatasetIndex] = useState(0);
  const [isFittingAll, setIsFittingAll] = useState(false);
  const [curveColorsByDataset, setCurveColorsByDataset] = useState<Record<string, string[]>>({});

  const handleDataUpload = (uploadedData: DataPoint[]) => {
    setData(uploadedData);
    setDatasets([]); // Clear datasets when using combined mode
    setFittedCurves([]);
  };

  const handleMultipleDatasetsUpload = (uploadedDatasets: Dataset[]) => {
    setDatasets(uploadedDatasets);
    setData([]); // Clear single data when using separate mode
    setFittedCurves([]);
    setActiveDatasetIndex(0);
  };

  const handleDataUpdate = (updatedData: DataPoint[]) => {
    if (datasets.length > 0) {
      // Update the active dataset
      const updatedDatasets = [...datasets];
      updatedDatasets[activeDatasetIndex] = {
        ...updatedDatasets[activeDatasetIndex],
        data: updatedData
      };
      setDatasets(updatedDatasets);
      // Clear fit for this dataset
      const datasetId = updatedDatasets[activeDatasetIndex]?.id;
      if (datasetId) {
        setFittedCurvesByDataset(prev => {
          const copy = { ...prev };
          delete copy[datasetId];
          return copy;
        });
      }
    } else {
      setData(updatedData);
    }
    setFittedCurves([]);
  };

  const handleCurveFitting = async (curves: FittedCurve[]) => {
    setFittedCurves(curves);
    setIsProcessing(false);
    if (datasets.length > 0) {
      const datasetId = datasets[activeDatasetIndex]?.id;
      if (datasetId) {
        setFittedCurvesByDataset(prev => ({ ...prev, [datasetId]: curves }));
        // Initialize colors for this dataset if not already set
        setCurveColorsByDataset(prev => {
          if (prev[datasetId]) return prev;
          return { ...prev, [datasetId]: curves.map((_, idx) => defaultColors[idx % defaultColors.length]) };
        });
      }
    } else {
      setCurveColors(curves.map((_, idx) => defaultColors[idx % defaultColors.length]));
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Simulate curve fitting for all datasets (replace with your actual fitting logic if async)
  const fitAllCurves = async () => {
    setIsFittingAll(true);
    try {
      const newFitted: Record<string, FittedCurve[]> = { ...fittedCurvesByDataset };
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        // Use the utility to fit curves for this dataset
        newFitted[dataset.id] = fitCurvesForData(dataset.data);
      }
      setFittedCurvesByDataset(newFitted);
      // Set current tab's fit if available
      const currentId = datasets[activeDatasetIndex]?.id;
      if (currentId && newFitted[currentId]) {
        setFittedCurves(newFitted[currentId]);
      }
    } finally {
      setIsFittingAll(false);
    }
  };

  // Unified fit button handler
  const handleFitButton = async () => {
    if (datasets.length > 1) {
      await fitAllCurves();
    } else if (datasets.length === 1) {
      // Fit just the single dataset
      const dataset = datasets[0];
      const curves = fitCurvesForData(dataset.data);
      setFittedCurves(curves);
      setFittedCurvesByDataset(prev => ({ ...prev, [dataset.id]: curves }));
    } else if (data.length > 0) {
      // Single dataset in 'data' (not in datasets array)
      const curves = fitCurvesForData(data);
      setFittedCurves(curves);
    }
  };

  // Get current data (either single dataset or active dataset)
  const currentData = datasets.length > 0 ? datasets[activeDatasetIndex]?.data || [] : data;
  const currentDatasetId = datasets.length > 0 ? datasets[activeDatasetIndex]?.id : undefined;

  // Restore fit for current dataset on mount or when datasets/activeDatasetIndex change
  useEffect(() => {
    if (datasets.length > 0 && currentDatasetId) {
      if (fittedCurvesByDataset[currentDatasetId]) {
        setFittedCurves(fittedCurvesByDataset[currentDatasetId]);
      } else {
        setFittedCurves([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, activeDatasetIndex]);

  // When switching datasets, update curve colors for the active dataset
  useEffect(() => {
    if (datasets.length > 0) {
      const datasetId = datasets[activeDatasetIndex]?.id;
      if (datasetId && curveColorsByDataset[datasetId]) {
        setCurveColors(curveColorsByDataset[datasetId]);
      } else if (datasetId && fittedCurvesByDataset[datasetId]) {
        setCurveColors(fittedCurvesByDataset[datasetId].map((_, idx) => defaultColors[idx % defaultColors.length]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDatasetIndex, datasets, curveColorsByDataset, fittedCurvesByDataset]);

  // Handler for switching datasets
  const handleSwitchDataset = (index: number) => {
    setActiveDatasetIndex(index);
    // Restore fit for this dataset if available
    const datasetId = datasets[index]?.id;
    if (datasetId && fittedCurvesByDataset[datasetId]) {
      setFittedCurves(fittedCurvesByDataset[datasetId]);
    } else {
      setFittedCurves([]);
    }
    setRefreshKey(prev => prev + 1); // Force ResultsDisplay to re-render
  };

  // Handle color change for current dataset
  const handleColorChange = (idx: number, color: string) => {
    if (datasets.length > 0) {
      const datasetId = datasets[activeDatasetIndex]?.id;
      if (datasetId) {
        setCurveColorsByDataset(prev => {
          const newColors = prev[datasetId] ? [...prev[datasetId]] : [];
          newColors[idx] = color;
          return { ...prev, [datasetId]: newColors };
        });
        setCurveColors(prev => {
          const newColors = [...prev];
          newColors[idx] = color;
          return newColors;
        });
      }
    } else {
      setCurveColors(prev => {
        const newColors = [...prev];
        newColors[idx] = color;
        return newColors;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Dose Response Analyses
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Data Input */}
          <div className="space-y-6">
            <FileUpload 
              onDataUpload={handleDataUpload} 
              onMultipleDatasetsUpload={handleMultipleDatasetsUpload}
            />
            
            {currentData.length > 0 && (
              <>
                {/* Dataset Tabs (only show when multiple datasets) */}
                {datasets.length > 1 && (
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="mb-4 flex items-center gap-4">
                      <button
                        onClick={handleFitButton}
                        disabled={isFittingAll}
                        className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50"
                      >
                        {isFittingAll
                          ? (datasets.length > 1 ? 'Fitting All...' : 'Fitting...')
                          : (datasets.length > 1 ? 'Fit All Curves' : 'Fit Curve')}
                      </button>
                      {isFittingAll && <span className="text-green-700 text-sm">Fitting{datasets.length > 1 ? ' all datasets' : ''}...</span>}
                    </div>
                    {/* Curve color pickers for active dataset */}
                    {fittedCurves.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Curve Colors</h4>
                        <div className="flex flex-wrap gap-4">
                          {fittedCurves.map((curve, idx) => (
                            <div key={`${curve.sampleName || 'curve'}_${idx}`} className="flex items-center gap-2">
                              <span className="text-sm">{curve.sampleName}</span>
                              <input
                                type="color"
                                value={curveColors[idx] || defaultColors[idx % defaultColors.length]}
                                onChange={e => handleColorChange(idx, e.target.value)}
                              />
                              <span className="ml-1 text-xs">{curveColors[idx] || defaultColors[idx % defaultColors.length]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <h3 className="font-medium text-gray-900 mb-3">Select Dataset</h3>
                    <div className="flex flex-wrap gap-2">
                      {datasets.map((dataset, index) => {
                        // Use the best keyword for the tab label
                        let label = dataset.name;
                        const genericPattern = /^data table/i;
                        if (genericPattern.test(label)) {
                          // Try to find a better keyword in sample names
                          const sampleText = (dataset.data?.flatMap(d => d.sampleNames).join(' ') || '').toLowerCase();
                          if (sampleText.includes('cytotoxicity') || sampleText.includes('killing')) {
                            label = 'Cytotoxicity';
                          } else if (sampleText.includes('cd4')) {
                            label = 'CD4 Activation';
                          } else if (sampleText.includes('cd8')) {
                            label = 'CD8 Activation';
                          }
                        }
                        return (
                          <button
                            key={`${dataset.id || ''}_${index}`}
                            onClick={() => handleSwitchDataset(index)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                              index === activeDatasetIndex
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <DataEditor 
                  data={currentData} 
                  onDataUpdate={handleDataUpdate} 
                />
                
                <CurveFitter 
                  data={currentData}
                  onCurveFitting={handleCurveFitting}
                  isProcessing={isProcessing}
                  curveColors={curveColors}
                  setCurveColors={setCurveColors}
                  onRefresh={handleRefresh}
                  showFitButton={datasets.length <= 1}
                />
              </>
            )}
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {((fittedCurves.length > 0) || (currentDatasetId && fittedCurvesByDataset[currentDatasetId]?.length > 0)) && (
              <ResultsDisplay 
                key={`${refreshKey}-${activeDatasetIndex}`}
                data={currentData} 
                fittedCurves={fittedCurves.length > 0 ? fittedCurves : (currentDatasetId ? fittedCurvesByDataset[currentDatasetId] : [])}
                curveColors={curveColors}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


