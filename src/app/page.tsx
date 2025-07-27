'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import DataEditor from '../components/DataEditor';
import CurveFitter from '../components/CurveFitter';
import ResultsDisplay from '../components/ResultsDisplay';
import { exportToPDF, captureChartImage } from '../utils/pdfExport';
import PrismExportModal from '../components/PrismExportModal';

import { DataPoint, FittedCurve, Dataset } from '../types';
import { fitCurvesForData } from '../fitUtils';
import React from 'react';
import { Dialog } from '@headlessui/react';


const defaultColors = [
  '#1f77b4', '#2ca02c', '#ff7f0e', '#d62728', '#9467bd', '#8c564b', // Blue, Light Green, Orange, Brown, Purple, Dark Green
  '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#a6cee3', '#fb9a99',
  '#fdbf6f', '#cab2d6', '#ffff99', '#b15928', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9'
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
  const [curveVisibilityByDataset, setCurveVisibilityByDataset] = useState<Record<string, boolean[]>>({});
  
  // Global chart settings that apply to all datasets
  const [globalChartSettings, setGlobalChartSettings] = useState({
    showGroups: true,
    showIndividuals: true,
    showCurveChart: true,
    showBarChart: false
  });
  const [globalCurveColors, setGlobalCurveColors] = useState<string[]>([]);
  const [globalCurveVisibility, setGlobalCurveVisibility] = useState<boolean[]>([]);
  
  const [fitAllProgress, setFitAllProgress] = useState(0);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPrismExportModal, setShowPrismExportModal] = useState(false);
  
  // Add state to track original data for PDF export
  const [originalDataByDataset, setOriginalDataByDataset] = useState<Record<string, DataPoint[]>>({});
  const [editedDataByDataset, setEditedDataByDataset] = useState<Record<string, DataPoint[]>>({});

  const [showReplicatePrompt, setShowReplicatePrompt] = useState(false);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [pendingData, setPendingData] = useState<DataPoint[] | null>(null);
  const [pendingDatasets, setPendingDatasets] = useState<Dataset[]>([]);
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [workflowOptions, setWorkflowOptions] = useState({
    hasReplicates: false,
    mergeTables: false,
    sameFormat: false,
    groupAssignments: [] as string[]
  });

  // Add ref for chart capture
  const chartRef = useRef<HTMLDivElement>(null);

  // Current data and dataset tracking - use edited data for display (memoized)
  const currentDatasetId = useMemo(() => 
    datasets.length > 0 ? datasets[activeDatasetIndex]?.id : undefined, 
    [datasets, activeDatasetIndex]
  );
  
  const currentData = useMemo(() => 
    datasets.length > 0 
      ? (currentDatasetId ? editedDataByDataset[currentDatasetId] || datasets[activeDatasetIndex]?.data || [] : [])
      : data,
    [datasets, activeDatasetIndex, currentDatasetId, editedDataByDataset, data]
  );
  
  // Helper function to get display column names for multiple tables (memoized)
  const getDisplayColumnNames = useCallback(() => {
    if (pendingData) {
      return pendingData[0]?.sampleNames || [];
    }
    
    if (workflowOptions.mergeTables) {
      // When merging, show all columns from all tables with table name prefixes
      return pendingDatasets.flatMap(ds => 
        ds.data[0]?.sampleNames.map(colName => `${ds.name}: ${colName}`) || []
      );
    } else {
      // When not merging, show current table's columns
      return pendingDatasets[currentTableIndex]?.data[0]?.sampleNames || [];
    }
  }, [pendingData, workflowOptions.mergeTables, pendingDatasets, currentTableIndex]);
  

  // Update fitted curves when switching datasets
  useEffect(() => {
    if (datasets.length > 0 && currentDatasetId) {
      if (fittedCurvesByDataset[currentDatasetId]) {
        setFittedCurves(fittedCurvesByDataset[currentDatasetId]);
        setCurveColors(curveColorsByDataset[currentDatasetId] || []);
      } else {
        setFittedCurves([]);
        setCurveColors([]);
      }
    }
  }, [datasets, activeDatasetIndex, fittedCurvesByDataset, currentDatasetId, curveColorsByDataset]);

  // Update original data tracking when datasets are set (preserve original, initialize edited)
  useEffect(() => {
    const newOriginalData: Record<string, DataPoint[]> = {};
    const newEditedData: Record<string, DataPoint[]> = {};
    
    datasets.forEach(dataset => {
      // Only set original data if it hasn't been set before (preserve the first import)
      if (!originalDataByDataset[dataset.id]) {
        newOriginalData[dataset.id] = JSON.parse(JSON.stringify(dataset.data)); // Deep copy
      } else {
        newOriginalData[dataset.id] = originalDataByDataset[dataset.id]; // Keep existing original
      }
      
      // Set edited data to current dataset data
      newEditedData[dataset.id] = JSON.parse(JSON.stringify(dataset.data)); // Deep copy
    });
    
    setOriginalDataByDataset(newOriginalData);
    setEditedDataByDataset(newEditedData);
  }, [datasets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Optimized workflow state
  const handleDataUpload = useCallback((uploadedData: DataPoint[]) => {
    setPendingData(uploadedData);
    setPendingDatasets([]);
    setShowColumnEditor(true); // Show unified configuration modal directly
    setShowReplicatePrompt(false); // Skip replicate prompt
    setData([]);
    setDatasets([]);
    setFittedCurves([]);
  }, []);

  // Multiple tables import - go directly to comprehensive configuration
  const handleMultipleDatasetsUpload = useCallback((uploadedDatasets: Dataset[]) => {
    setPendingData(null);
    setPendingDatasets(uploadedDatasets);
    setShowColumnEditor(true);
    setShowReplicatePrompt(false);
    setData([]);
    setDatasets([]);
    setFittedCurves([]);
  }, []);

  // Single table: replicate prompt (keep this simple for single tables)
  const handleReplicatePrompt = (hasReps: boolean) => {
    setWorkflowOptions(prev => ({ ...prev, hasReplicates: hasReps }));
    setShowReplicatePrompt(false);
    setShowColumnEditor(true);
  };

  // Remove the separate same format prompt handler since it's now integrated

  // Column editor save handler
  const handleColumnEditorSave = (columnNames: string[], groupAssignments: string[]) => {
    
    if (pendingData) {
      // Single table
      const updatedData = pendingData.map(row => ({
        ...row,
        sampleNames: columnNames,
        replicateGroups: workflowOptions.hasReplicates ? groupAssignments : undefined,
      }));
      setData(updatedData);
      setShowColumnEditor(false);
      setPendingData(null);
      
      // Auto-fit curves for single table to improve UX
      setTimeout(() => {
        const curves = fitCurvesForData(updatedData);
        setFittedCurves(curves);
        const newColors = curves.map((_, idx) => defaultColors[idx % defaultColors.length]);
        setCurveColors(newColors);
        setGlobalCurveColors(newColors);
        setGlobalCurveVisibility(curves.map(() => true));
      }, 100);
    } else if (pendingDatasets.length > 0) {
      if (workflowOptions.mergeTables) {
        // Merge all tables into one dataset
        const allData: DataPoint[] = [];
        
        // Collect all unique concentrations from all tables
        const allConcentrations = new Set<number>();
        pendingDatasets.forEach(dataset => {
          dataset.data.forEach(row => {
            allConcentrations.add(row.concentration);
          });
        });
        const sortedConcentrations = Array.from(allConcentrations).sort((a, b) => a - b);
        
        // Create merged data points for each concentration
        sortedConcentrations.forEach(concentration => {
          const mergedRow: DataPoint = {
            concentration,
            responses: [],
            sampleNames: columnNames, // Use the columnNames passed from the editor (which are the prefixed names)
            replicateGroups: workflowOptions.hasReplicates ? groupAssignments : undefined,
          };
          
          // Collect responses from all tables for this concentration
          pendingDatasets.forEach(dataset => {
            const matchingRow = dataset.data.find(row => Math.abs(row.concentration - concentration) < 1e-6);
            if (matchingRow) {
              mergedRow.responses.push(...matchingRow.responses);
            }
          });
          
          allData.push(mergedRow);
        });
        
        setData(allData);
        setShowColumnEditor(false);
        setPendingDatasets([]);
        
        // Auto-fit curves for merged data
        setTimeout(() => {
          const curves = fitCurvesForData(allData);
          setFittedCurves(curves);
          const newColors = curves.map((_, idx) => defaultColors[idx % defaultColors.length]);
          setCurveColors(newColors);
          setGlobalCurveColors(newColors);
          setGlobalCurveVisibility(curves.map(() => true));
        }, 100);
      } else if (workflowOptions.sameFormat) {
        // Apply to all tables
        const updatedDatasets = pendingDatasets.map(ds => ({
          ...ds,
          data: ds.data.map(row => ({
            ...row,
            sampleNames: columnNames,
            replicateGroups: groupAssignments,
          })),
        }));
        setDatasets(updatedDatasets);
        setShowColumnEditor(false);
        setPendingDatasets([]);
      } else {
        // Per-table editing
        const updatedDatasets = [...pendingDatasets];
        updatedDatasets[currentTableIndex] = {
          ...updatedDatasets[currentTableIndex],
          data: updatedDatasets[currentTableIndex].data.map(row => ({
            ...row,
            sampleNames: columnNames,
            replicateGroups: groupAssignments,
          })),
        };
        setPendingDatasets(updatedDatasets);
        if (currentTableIndex + 1 < updatedDatasets.length) {
          setCurrentTableIndex(currentTableIndex + 1);
        } else {
          setDatasets(updatedDatasets);
          setShowColumnEditor(false);
          setPendingDatasets([]);
        }
      }
    }
  };


  const handleDataUpdate = (updatedData: DataPoint[]) => {
    if (datasets.length > 0) {
      // DO NOT update the original dataset - only update edited data tracking
      const datasetId = datasets[activeDatasetIndex]?.id;
      if (datasetId) {
        // Update only the edited data tracking - preserve original dataset
        setEditedDataByDataset(prev => ({
          ...prev,
          [datasetId]: JSON.parse(JSON.stringify(updatedData)) // Deep copy
        }));
        
        // Clear fit for this dataset since data changed
        setFittedCurvesByDataset(prev => {
          const copy = { ...prev };
          delete copy[datasetId];
          return copy;
        });
        setFittedCurves([]);
        setCurveColors([]);
      }
    } else {
      // For single dataset mode, preserve original and update edited
      if (!originalDataByDataset['single']) {
        setOriginalDataByDataset(prev => ({
          ...prev,
          'single': JSON.parse(JSON.stringify(data)) // Preserve current as original
        }));
      }
      setData(updatedData);
      setEditedDataByDataset(prev => ({
        ...prev,
        'single': JSON.parse(JSON.stringify(updatedData))
      }));
    }
  };

  const handleCurveFitting = async (curves: FittedCurve[]) => {
    setFittedCurves(curves);
    
    // Initialize global settings based on the first dataset's curves
    if (globalCurveColors.length === 0 || globalCurveColors.length !== curves.length) {
      setGlobalCurveColors(curves.map((_, idx) => defaultColors[idx % defaultColors.length]));
      setGlobalCurveVisibility(curves.map(() => true));
    }
    
    if (datasets.length > 0) {
      const datasetId = datasets[activeDatasetIndex]?.id;
      if (datasetId) {
        setFittedCurvesByDataset(prev => ({ ...prev, [datasetId]: curves }));
        // Initialize colors for this dataset if not already set - use global colors
        setCurveColorsByDataset(prev => {
          if (prev[datasetId]) return prev;
          return { ...prev, [datasetId]: globalCurveColors.length > 0 ? globalCurveColors : curves.map((_, idx) => defaultColors[idx % defaultColors.length]) };
        });
        // Initialize visibility for this dataset - use global visibility if available, otherwise all true
        setCurveVisibilityByDataset(prev => {
          const newVisibility = globalCurveVisibility.length > 0 ? [...globalCurveVisibility] : curves.map(() => true);
          // Ensure the array is the right length
          while (newVisibility.length < curves.length) {
            newVisibility.push(true);
          }
          return { ...prev, [datasetId]: newVisibility };
        });
      }
    } else {
      const newColors = globalCurveColors.length > 0 ? globalCurveColors : curves.map((_, idx) => defaultColors[idx % defaultColors.length]);
      setCurveColors(newColors);
      if (globalCurveColors.length === 0) {
        setGlobalCurveColors(newColors);
        setGlobalCurveVisibility(curves.map(() => true));
      }
      
      // Initialize visibility for single dataset case
      setCurveVisibilityByDataset(prev => {
        const newVisibility = globalCurveVisibility.length > 0 ? [...globalCurveVisibility] : curves.map(() => true);
        while (newVisibility.length < curves.length) {
          newVisibility.push(true);
        }
        return { ...prev, 'single': newVisibility };
      });
    }
    setIsProcessing(false);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Simulate curve fitting for all datasets (replace with your actual fitting logic if async)
  const fitAllCurves = async () => {
    setIsFittingAll(true);
    setFitAllProgress(0);
    try {
      const newFitted: Record<string, FittedCurve[]> = { ...fittedCurvesByDataset };
      const newColors: Record<string, string[]> = { ...curveColorsByDataset };
      
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        // Use edited data for curve fitting instead of original dataset data
        const dataToFit = editedDataByDataset[dataset.id] || dataset.data;
        const curves = fitCurvesForData(dataToFit);
        newFitted[dataset.id] = curves;
        // Set colors for this dataset
        newColors[dataset.id] = curves.map((_, idx) => defaultColors[idx % defaultColors.length]);
        setFitAllProgress(((i + 1) / datasets.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setFittedCurvesByDataset(newFitted);
      setCurveColorsByDataset(newColors);
      
      // Set current tab's fit if available
      const currentId = datasets[activeDatasetIndex]?.id;
      if (currentId && newFitted[currentId]) {
        setFittedCurves(newFitted[currentId]);
        setCurveColors(newColors[currentId] || []);
      }
    } finally {
      setIsFittingAll(false);
      setFitAllProgress(0);
    }
  };

  // Unified fit button handler
  const handleFitButton = async () => {
    if (datasets.length > 1) {
      await fitAllCurves();
    } else if (datasets.length === 1) {
      // Fit just the single dataset using edited data
      const dataset = datasets[0];
      const dataToFit = editedDataByDataset[dataset.id] || dataset.data;
      const curves = fitCurvesForData(dataToFit);
      setFittedCurves(curves);
      setFittedCurvesByDataset(prev => ({ ...prev, [dataset.id]: curves }));
      // Set colors for this dataset
      const newColors = curves.map((_, idx) => defaultColors[idx % defaultColors.length]);
      setCurveColorsByDataset(prev => ({ ...prev, [dataset.id]: newColors }));
      setCurveColors(newColors);
      if (globalCurveColors.length === 0) {
        setGlobalCurveColors(newColors);
        setGlobalCurveVisibility(curves.map(() => true));
      }
      
      // Initialize visibility for this dataset
      setCurveVisibilityByDataset(prev => {
        const newVisibility = globalCurveVisibility.length > 0 ? [...globalCurveVisibility] : curves.map(() => true);
        while (newVisibility.length < curves.length) {
          newVisibility.push(true);
        }
        return { ...prev, [dataset.id]: newVisibility };
      });
    } else if (data.length > 0) {
      // Single dataset in 'data' (not in datasets array) - use edited data if available
      const dataToFit = editedDataByDataset['single'] || data;
      const curves = fitCurvesForData(dataToFit);
      setFittedCurves(curves);
      const newColors = curves.map((_, idx) => defaultColors[idx % defaultColors.length]);
      setCurveColors(newColors);
      if (globalCurveColors.length === 0) {
        setGlobalCurveColors(newColors);
        setGlobalCurveVisibility(curves.map(() => true));
      }
      
      // Initialize visibility for single dataset case
      setCurveVisibilityByDataset(prev => {
        const newVisibility = globalCurveVisibility.length > 0 ? [...globalCurveVisibility] : curves.map(() => true);
        while (newVisibility.length < curves.length) {
          newVisibility.push(true);
        }
        return { ...prev, 'single': newVisibility };
      });
    }
  };

  // Update PDF export handler to include chart
  const handleExportPDF = async () => {
    if (isExportingPDF) return; // Prevent multiple simultaneous exports
    
    try {
      setIsExportingPDF(true);
      
      // Capture chart image if available
      let chartImage = '';
      if (chartRef.current) {
        try {
          // Give the chart extra time to render fully
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Call the improved capture function
          const capturedImage = await captureChartImage();
          
          if (capturedImage) {
            chartImage = capturedImage;
          }
        } catch (captureError) {
          console.error('Error during chart capture:', captureError);
        }
      }

      const exportOptions = {
        datasets: datasets.length > 0 ? datasets : [{ id: 'single', name: 'Single Dataset', data, assayType: 'Not specified' }],
        fittedCurvesByDataset: datasets.length > 0 ? fittedCurvesByDataset : { 'single': fittedCurves },
        originalDataByDataset: datasets.length > 0 ? originalDataByDataset : { 'single': originalDataByDataset['single'] || data },
        editedDataByDataset: datasets.length > 0 ? editedDataByDataset : { 'single': editedDataByDataset['single'] || data },
        curveColorsByDataset: datasets.length > 0 ? curveColorsByDataset : { 'single': curveColors },
        curveVisibilityByDataset: datasets.length > 0 ? curveVisibilityByDataset : { 'single': curveVisibilityByDataset['single'] || [] },
        assayType: datasets[activeDatasetIndex]?.assayType,
        chartImage,
        globalChartSettings,
        // Add callbacks for PDF generation
        onDatasetSwitch: datasets.length > 1 ? handleSwitchDataset : undefined,
        onCurveVisibilityChange: handleCurveVisibilityChangeForPDF
      };
      
      await exportToPDF(exportOptions);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Check if we have results to export (memoized)
  const hasResults = useMemo(() => 
    datasets.length > 0 
      ? Object.keys(fittedCurvesByDataset).length > 0
      : fittedCurves.length > 0,
    [datasets.length, fittedCurvesByDataset, fittedCurves.length]
  );

  // Handler for switching datasets
  const handleSwitchDataset = async (index: number) => {
    setActiveDatasetIndex(index);
    
    // Restore fit for this dataset if available
    const datasetId = datasets[index]?.id;
    if (datasetId && fittedCurvesByDataset[datasetId]) {
      setFittedCurves(fittedCurvesByDataset[datasetId]);
      setCurveColors(curveColorsByDataset[datasetId] || []);
    } else {
      setFittedCurves([]);
      setCurveColors([]);
    }
    
    setRefreshKey(prev => prev + 1); // Force ResultsDisplay to re-render
    
    // Wait for state to update and component to re-render
    await new Promise(resolve => setTimeout(resolve, 100));
  };


  // Handle curve visibility change for PDF export (with dataset ID)
  const handleCurveVisibilityChangeForPDF = async (datasetId: string, curveIndex: number, visible: boolean) => {
    setCurveVisibilityByDataset(prev => {
      const newVisibility = prev[datasetId] ? [...prev[datasetId]] : [];
      newVisibility[curveIndex] = visible;
      return { ...prev, [datasetId]: newVisibility };
    });
    
    // Force re-render
    setRefreshKey(prev => prev + 1);
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  // Global handlers that apply changes to all datasets
  const handleGlobalChartSettingsChange = (setting: keyof typeof globalChartSettings, value: boolean) => {
    setGlobalChartSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleGlobalColorChange = (idx: number, color: string) => {
    // Update global colors
    setGlobalCurveColors(prev => {
      const newColors = [...prev];
      newColors[idx] = color;
      return newColors;
    });

    // Apply to all datasets
    setCurveColorsByDataset(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(datasetId => {
        if (updated[datasetId] && updated[datasetId][idx] !== undefined) {
          updated[datasetId][idx] = color;
        }
      });
      return updated;
    });

    // Also update current single dataset colors if applicable
    setCurveColors(prev => {
      const newColors = [...prev];
      newColors[idx] = color;
      return newColors;
    });
  };

  const handleGlobalVisibilityChange = (idx: number, visible: boolean) => {
    // Update global visibility
    setGlobalCurveVisibility(prev => {
      const newVisibility = [...prev];
      newVisibility[idx] = visible;
      return newVisibility;
    });

    // Apply to all datasets - ensure we handle both existing and non-existing datasets
    setCurveVisibilityByDataset(prev => {
      const updated = { ...prev };
      
      // If we have datasets, update all of them
      if (datasets.length > 0) {
        datasets.forEach(dataset => {
          const datasetId = dataset.id;
          if (!updated[datasetId]) {
            // Initialize if not exists
            updated[datasetId] = new Array(idx + 1).fill(true);
          }
          
          // Ensure the array is long enough
          const currentArray = [...updated[datasetId]];
          while (currentArray.length <= idx) {
            currentArray.push(true); // Default new entries to visible
          }
          currentArray[idx] = visible;
          updated[datasetId] = currentArray;
        });
      } else {
        // For single dataset case, use 'single' as key
        const datasetId = 'single';
        if (!updated[datasetId]) {
          updated[datasetId] = new Array(idx + 1).fill(true);
        }
        
        const currentArray = [...updated[datasetId]];
        while (currentArray.length <= idx) {
          currentArray.push(true);
        }
        currentArray[idx] = visible;
        updated[datasetId] = currentArray;
      }
      
      return updated;
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F2E6ED' }}>
      {/* Simple App Title */}
      <header className="w-full py-8 mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center" style={{ color: '#8A0051', letterSpacing: '0.05em' }}>
          nVitro Studio
        </h1>
      </header>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Dose Response Analyses
        </h1>
                          {/* Single Table: Replicate Prompt */}
         <Dialog open={showReplicatePrompt} onClose={() => setShowReplicatePrompt(false)}>
           <Dialog.Panel className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
             <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
               <h2 className="text-xl font-semibold mb-4">Technical Replicates?</h2>
               <p className="mb-6">Are there technical replicates in this dataset?</p>
               <div className="flex gap-4 justify-end">
                 <button className="bg-[#8A0051] text-white px-4 py-2 rounded hover:bg-[#6A003F]" onClick={() => handleReplicatePrompt(true)}>Yes</button>
                 <button className="bg-gray-200 px-4 py-2 rounded" onClick={() => handleReplicatePrompt(false)}>No</button>
               </div>
             </div>
           </Dialog.Panel>
         </Dialog>



         {/* Column Editor Modal */}
         {showColumnEditor && (
           <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
             <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
               <h2 className="text-xl font-semibold mb-4">
                 {pendingData ? 'Configure Dataset' : 'Configure Multiple Tables'}
               </h2>
               
               {/* Multiple Tables: Comprehensive Options */}
               {!pendingData && (
                 <div className="mb-6 space-y-6">
                   {/* Analysis Method */}
                   <div>
                     <h3 className="font-medium text-gray-900 mb-3">1. How do you want to analyze your data?</h3>
                     <div className="space-y-2">
                       <div className="flex items-center">
                         <input
                           type="radio"
                           id="merge"
                           name="analysisOption"
                           checked={workflowOptions.mergeTables}
                           onChange={() => setWorkflowOptions(prev => ({ ...prev, mergeTables: true }))}
                           className="mr-2"
                         />
                         <label htmlFor="merge">Merge all tables into one graph</label>
                       </div>
                       <div className="flex items-center">
                         <input
                           type="radio"
                           id="separate"
                           name="analysisOption"
                           checked={!workflowOptions.mergeTables}
                           onChange={() => setWorkflowOptions(prev => ({ ...prev, mergeTables: false }))}
                           className="mr-2"
                         />
                         <label htmlFor="separate">Keep tables separate</label>
                       </div>
                     </div>
                   </div>

                   {/* Replicates Option */}
                   <div>
                     <h3 className="font-medium text-gray-900 mb-3">2. Do you have technical replicates?</h3>
                     <div className="flex items-center">
                       <input
                         type="checkbox"
                         id="hasReplicates"
                         checked={workflowOptions.hasReplicates}
                         onChange={e => setWorkflowOptions(prev => ({ ...prev, hasReplicates: e.target.checked }))}
                         className="mr-2"
                       />
                       <label htmlFor="hasReplicates">My data includes technical replicates</label>
                     </div>
                   </div>

                   {/* Table Format Option - only show when NOT merging */}
                   {!workflowOptions.mergeTables && (
                     <div>
                       <h3 className="font-medium text-gray-900 mb-3">3. Do all tables have the same format?</h3>
                       <div className="space-y-2">
                         <div className="flex items-center">
                           <input
                             type="radio"
                             id="sameFormat"
                             name="formatOption"
                             checked={workflowOptions.sameFormat}
                             onChange={() => setWorkflowOptions(prev => ({ ...prev, sameFormat: true }))}
                             className="mr-2"
                           />
                           <label htmlFor="sameFormat">Yes, all tables have the same format</label>
                         </div>
                         <div className="flex items-center">
                           <input
                             type="radio"
                             id="differentFormat"
                             name="formatOption"
                             checked={!workflowOptions.sameFormat}
                             onChange={() => setWorkflowOptions(prev => ({ ...prev, sameFormat: false }))}
                             className="mr-2"
                           />
                           <label htmlFor="differentFormat">No, tables have different formats</label>
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
               )}

               {/* Single Table: Replicates Option */}
               {pendingData && (
                 <div className="mb-6">
                   <h3 className="font-medium text-gray-900 mb-3">Do you have technical replicates?</h3>
                   <div className="flex items-center">
                     <input
                       type="checkbox"
                       id="hasReplicates"
                       checked={workflowOptions.hasReplicates}
                       onChange={e => setWorkflowOptions(prev => ({ ...prev, hasReplicates: e.target.checked }))}
                       className="mr-2"
                     />
                     <label htmlFor="hasReplicates">My data includes technical replicates</label>
                   </div>
                 </div>
               )}
               
               {/* Column Names Editing */}
               <div className="mb-6">
                 <h3 className="font-medium text-gray-900 mb-3">
                   {pendingData ? 'Column Names' : 
                    workflowOptions.mergeTables ? 'Column Names (All Tables Combined)' :
                    workflowOptions.sameFormat ? 'Column Names (Applied to All Tables)' : 
                    `Column Names: ${pendingDatasets[currentTableIndex]?.name || 'Unknown Table'} (${currentTableIndex + 1} of ${pendingDatasets.length})`}
                 </h3>
                 <div className="space-y-2">
                   {getDisplayColumnNames().map((name, index) => (
                     <div key={index} className="flex items-center gap-2">
                       <span className="text-sm font-medium w-20">Column {index + 1}:</span>
                       <input
                         type="text"
                         value={name}
                         onChange={e => {
                           const displayNames = getDisplayColumnNames();
                           const newDisplayNames = [...displayNames];
                           newDisplayNames[index] = e.target.value;
                           
                           if (pendingData) {
                             setPendingData(prev => prev ? prev.map(row => ({ ...row, sampleNames: newDisplayNames })) : null);
                           } else if (workflowOptions.mergeTables) {
                             // When merging, we need to parse the prefixed names back to individual table names
                             // For now, just update the display names - the actual merging will happen in handleColumnEditorSave
                             // This is a simplified approach - in a full implementation, we'd need to parse the prefixes
                           } else {
                             setPendingDatasets(prev => prev.map((ds, idx) => 
                               idx === currentTableIndex ? {
                                 ...ds,
                                 data: ds.data.map(row => ({ ...row, sampleNames: newDisplayNames }))
                               } : ds
                             ));
                           }
                         }}
                         className="border rounded px-2 py-1 flex-1"
                       />
                     </div>
                   ))}
                 </div>
               </div>

               {/* Replicate Group Assignment */}
               {workflowOptions.hasReplicates && (
                 <div className="mb-6">
                   <h3 className="font-medium text-gray-900 mb-3">Assign Replicate Groups</h3>
                   <div className="space-y-2">
                     {getDisplayColumnNames().map((name, index) => (
                       <div key={index} className="flex items-center gap-2">
                         <span className="text-sm font-medium w-32">{name}:</span>
                         <select
                           value={workflowOptions.groupAssignments?.[index] || ''}
                           onChange={e => {
                             const newAssignments = [...(workflowOptions.groupAssignments || [])];
                             newAssignments[index] = e.target.value;
                             setWorkflowOptions(prev => ({ ...prev, groupAssignments: newAssignments }));
                           }}
                           className="border rounded px-2 py-1 flex-1"
                         >
                           <option value="">Select group...</option>
                           {Array.from(new Set((workflowOptions.groupAssignments || []).filter(Boolean))).map(group => (
                             <option key={group} value={group}>{group}</option>
                           ))}
                           <option value="__add_new__">+ New Group</option>
                         </select>
                         {/* When '+ New Group' is selected, assign next available group name */}
                         {workflowOptions.groupAssignments?.[index] === '__add_new__' && (() => {
                           // Find next available group name
                           const existingGroups = (workflowOptions.groupAssignments || []).filter(Boolean).filter(g => g !== '__add_new__');
                           let nextNumber = 1;
                           while (existingGroups.includes(`Group ${nextNumber}`)) {
                             nextNumber++;
                           }
                           const nextGroup = `Group ${nextNumber}`;
                           // Immediately update assignment
                           setTimeout(() => {
                             const newAssignments = [...(workflowOptions.groupAssignments || [])];
                             newAssignments[index] = nextGroup;
                             setWorkflowOptions(prev => ({ ...prev, groupAssignments: newAssignments }));
                           }, 0);
                           return null;
                         })()}
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               <div className="flex justify-end gap-4">
                 <button
                   className="bg-gray-200 px-4 py-2 rounded"
                   onClick={() => setShowColumnEditor(false)}
                 >
                   Cancel
                 </button>
                 <button
                   className="bg-[#8A0051] text-white px-4 py-2 rounded hover:bg-[#6A003F]"
                   onClick={() => handleColumnEditorSave(
                     getDisplayColumnNames(),
                     workflowOptions.groupAssignments || []
                   )}
                 >
                   Apply Configuration
                 </button>
               </div>
             </div>
           </div>
         )}
 
         {!showReplicatePrompt && !showColumnEditor && (
          <div className="space-y-8">
            {/* Top Section - Data Input Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - File Upload, Fit All Curves, and Assay Summary */}
              <div className="space-y-6">
                <FileUpload 
                  onDataUpload={handleDataUpload}
                  onMultipleDatasetsUpload={handleMultipleDatasetsUpload}
                />
                
                {currentData.length > 0 && (
                  <>
                    {/* Prominent Fit All Curves Button (only show when multiple datasets) */}
                    {datasets.length > 1 && (
                      <div className="bg-white p-6 rounded-lg shadow">
                        <div className="text-center">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Calculate Results for All Datasets</h3>
                          <button
                            onClick={handleFitButton}
                            disabled={isFittingAll}
                            className="px-8 py-4 bg-[#8A0051] text-white rounded-lg hover:bg-[#6A003F] disabled:opacity-50 text-lg font-medium transition-colors shadow-lg hover:shadow-xl"
                          >
                            {isFittingAll ? 'Calculating Results...' : 'Calculate Results'}
                          </button>
                          {isFittingAll && (
                            <div className="mt-4">
                              <div className="mb-2 text-[#8A0051] text-sm font-medium">
                                Calculating results... {Math.round(fitAllProgress)}%
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-[#8A0051] h-3 rounded-full transition-all duration-300" style={{ width: `${fitAllProgress}%` }}></div>
                              </div>
                              <div className="mt-2 text-gray-600 text-xs">
                                Processing {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}...
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <CurveFitter 
                      data={currentData}
                      onCurveFitting={handleCurveFitting}
                      isProcessing={isProcessing}
                      curveColors={curveColors}
                      setCurveColors={setCurveColors}
                      onRefresh={handleRefresh}
                      showFitButton={datasets.length <= 1}
                      onProcessingChange={setIsProcessing}
                    />

                    {/* Enhanced Quick Summary with Assay Characteristics */}
                    {fittedCurves.length > 0 && (
                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="font-medium text-gray-900 mb-3">Assay Summary & Methods</h3>
                        <div className="space-y-3 text-sm">
                          <div className="border-b border-gray-200 pb-2">
                            <h4 className="font-medium text-gray-800 mb-1">Dataset Information</h4>
                            <p className="text-gray-600">• Dataset: {datasets.length > 0 ? datasets[activeDatasetIndex]?.name : 'Unknown'}</p>
                            <p className="text-gray-600">• Assay Type: {datasets.length > 0 ? datasets[activeDatasetIndex]?.assayType : 'Unknown'}</p>
                            <p className="text-gray-600">• Data Points: {currentData.length}</p>
                            <p className="text-gray-600">• Concentration Range: {Math.min(...currentData.map(d => d.concentration)).toExponential(2)} - {Math.max(...currentData.map(d => d.concentration)).toExponential(2)} nM</p>
                          </div>
                          
                          <div className="border-b border-gray-200 pb-2">
                            <h4 className="font-medium text-gray-800 mb-1">Curve Fitting Results</h4>
                            <p className="text-gray-600">• {fittedCurves.length} curve{fittedCurves.length !== 1 ? 's' : ''} fitted</p>
                            <p className="text-gray-600">• Average R²: {(fittedCurves.reduce((sum, curve) => sum + curve.rSquared, 0) / fittedCurves.length).toFixed(3)}</p>
                            <p className="text-gray-600">• EC50 Range: {Math.min(...fittedCurves.map(c => c.ec50)).toFixed(2)} - {Math.max(...fittedCurves.map(c => c.ec50)).toFixed(2)} nM</p>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-gray-800 mb-1">Analysis Method</h4>
                            <p className="text-gray-600">• Four-parameter logistic regression</p>
                            <p className="text-gray-600">• Log-scale concentration axis</p>
                            <p className="text-gray-600">• Response range: 0-100%</p>
                            <p className="text-gray-600">• Non-linear least squares fitting</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Column - Data Editor Only */}
              <div className="space-y-6">
                {currentData.length > 0 && (
                  <DataEditor 
                    data={currentData} 
                    onDataUpdate={handleDataUpdate}
                    datasets={datasets}
                    activeDatasetIndex={activeDatasetIndex}
                    onDatasetChange={handleSwitchDataset}
                    hasReplicates={workflowOptions.hasReplicates}
                  />
                )}
              </div>
            </div>

            {/* Bottom Section - Full Width Graph */}
            <div className="w-full">
              {((fittedCurves.length > 0) || (currentDatasetId && fittedCurvesByDataset[currentDatasetId]?.length > 0)) && (
                <ResultsDisplay 
                  ref={chartRef}
                  key={`${refreshKey}-${activeDatasetIndex}`}
                  data={currentData} 
                  fittedCurves={fittedCurves.length > 0 ? fittedCurves : (currentDatasetId ? fittedCurvesByDataset[currentDatasetId] : [])}
                  curveColors={curveColors}
                  datasetName={
                    datasets.length > 0
                      ? datasets[activeDatasetIndex]?.name
                      : datasets.length === 1
                        ? datasets[0]?.name
                        : 'Dataset'
                  }
                  assayType={
                    datasets.length > 0
                      ? datasets[activeDatasetIndex]?.assayType
                      : datasets.length === 1
                        ? datasets[0]?.assayType
                        : ''
                  }
                  onColorChange={handleGlobalColorChange}
                  onCurveVisibilityChange={handleGlobalVisibilityChange}
                  curveVisibility={currentDatasetId ? curveVisibilityByDataset[currentDatasetId] : globalCurveVisibility}
                  datasets={datasets}
                  activeDatasetIndex={activeDatasetIndex}
                  onDatasetChange={handleSwitchDataset}
                  globalChartSettings={globalChartSettings}
                  onGlobalChartSettingsChange={handleGlobalChartSettingsChange}
                  hasReplicates={workflowOptions.hasReplicates}
                />
              )}
            </div>

            {/* Export buttons */}
            {hasResults && (
              <div className="bg-white p-6 rounded-lg shadow mb-6">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Export Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={handleExportPDF}
                      disabled={isExportingPDF}
                      className={`px-6 py-3 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl ${
                        isExportingPDF 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-[#8A0051] hover:bg-[#6A003F]'
                      }`}
                    >
                      {isExportingPDF ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Generating PDF...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export to PDF
                        </div>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setShowPrismExportModal(true)}
                      className="px-6 py-3 bg-[#8A0051] text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl hover:bg-[#6A003F]"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Export to Prism
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prism Export Modal */}
        <PrismExportModal
          isOpen={showPrismExportModal}
          onClose={() => setShowPrismExportModal(false)}
          datasets={datasets}
          fittedCurves={fittedCurves}
          fittedCurvesByDataset={fittedCurvesByDataset}
          originalDataByDataset={originalDataByDataset}
          editedDataByDataset={editedDataByDataset}
          curveColorsByDataset={curveColorsByDataset}
          currentData={currentData}
          hasReplicates={workflowOptions.hasReplicates}
        />
      </div>
    </div>
  );
}


