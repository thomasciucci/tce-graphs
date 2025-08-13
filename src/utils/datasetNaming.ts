/**
 * Smart dataset naming utilities
 * Extracts meaningful names from data content based on keywords
 */

// Keywords to look for in data
const DATASET_KEYWORDS = [
  // Assay types
  { keyword: 'cytotox', name: 'Cytotoxicity' },
  { keyword: 'cytotoxicity', name: 'Cytotoxicity' },
  { keyword: 'activation', name: 'Activation' },
  { keyword: 'proliferation', name: 'Proliferation' },
  { keyword: 'viability', name: 'Viability' },
  { keyword: 'apoptosis', name: 'Apoptosis' },
  { keyword: 'cell death', name: 'Cell Death' },
  { keyword: 'inhibition', name: 'Inhibition' },
  { keyword: 'stimulation', name: 'Stimulation' },
  { keyword: 'binding', name: 'Binding' },
  { keyword: 'potency', name: 'Potency' },
  { keyword: 'ec50', name: 'EC50' },
  { keyword: 'ic50', name: 'IC50' },
  
  // Cell types
  { keyword: 't cells', name: 'T Cells' },
  { keyword: 't-cells', name: 'T Cells' },
  { keyword: 'tcells', name: 'T Cells' },
  { keyword: 'b cells', name: 'B Cells' },
  { keyword: 'b-cells', name: 'B Cells' },
  { keyword: 'bcells', name: 'B Cells' },
  { keyword: 'nk cells', name: 'NK Cells' },
  { keyword: 'nk-cells', name: 'NK Cells' },
  { keyword: 'pbmc', name: 'PBMC' },
  { keyword: 'pbmcs', name: 'PBMCs' },
  { keyword: 'monocyte', name: 'Monocytes' },
  { keyword: 'macrophage', name: 'Macrophages' },
  { keyword: 'dendritic', name: 'Dendritic Cells' },
  { keyword: 'neutrophil', name: 'Neutrophils' },
  
  // Markers
  { keyword: 'cd3', name: 'CD3' },
  { keyword: 'cd4', name: 'CD4' },
  { keyword: 'cd8', name: 'CD8' },
  { keyword: 'cd19', name: 'CD19' },
  { keyword: 'cd56', name: 'CD56' },
  { keyword: 'cd14', name: 'CD14' },
  { keyword: 'cd16', name: 'CD16' },
  { keyword: 'cd25', name: 'CD25' },
  { keyword: 'cd69', name: 'CD69' },
  { keyword: 'cd107a', name: 'CD107a' },
  
  // Cytokines
  { keyword: 'ifn', name: 'IFN' },
  { keyword: 'interferon', name: 'Interferon' },
  { keyword: 'il-2', name: 'IL-2' },
  { keyword: 'il2', name: 'IL-2' },
  { keyword: 'il-4', name: 'IL-4' },
  { keyword: 'il4', name: 'IL-4' },
  { keyword: 'il-6', name: 'IL-6' },
  { keyword: 'il6', name: 'IL-6' },
  { keyword: 'il-10', name: 'IL-10' },
  { keyword: 'il10', name: 'IL-10' },
  { keyword: 'tnf', name: 'TNF' },
  { keyword: 'tumor necrosis', name: 'TNF' },
  
  // Other markers
  { keyword: 'granzyme', name: 'Granzyme' },
  { keyword: 'perforin', name: 'Perforin' },
  { keyword: 'foxp3', name: 'FoxP3' },
  { keyword: 'pd-1', name: 'PD-1' },
  { keyword: 'pd1', name: 'PD-1' },
  { keyword: 'ctla-4', name: 'CTLA-4' },
  { keyword: 'ctla4', name: 'CTLA-4' },
];

/**
 * Extract meaningful dataset name from raw data
 */
export function extractDatasetName(rawData: any[][], sheetName?: string): string {
  const foundKeywords = new Set<string>();
  const keywordCounts = new Map<string, number>();
  
  // Convert all data to lowercase strings for searching
  const dataStrings: string[] = [];
  
  for (const row of rawData) {
    if (!row) continue;
    for (const cell of row) {
      if (cell != null) {
        dataStrings.push(String(cell).toLowerCase());
      }
    }
  }
  
  const fullText = dataStrings.join(' ');
  
  // Search for keywords
  for (const { keyword, name } of DATASET_KEYWORDS) {
    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
    const matches = fullText.match(regex);
    
    if (matches) {
      foundKeywords.add(name);
      keywordCounts.set(name, (keywordCounts.get(name) || 0) + matches.length);
    }
  }
  
  // Prioritize dataset naming
  const assayTypes = ['Cytotoxicity', 'Activation', 'Proliferation', 'Viability', 
                      'Apoptosis', 'Cell Death', 'Inhibition', 'Stimulation', 
                      'Binding', 'Potency', 'EC50', 'IC50'];
  const cellTypes = ['T Cells', 'B Cells', 'NK Cells', 'PBMC', 'PBMCs', 
                     'Monocytes', 'Macrophages', 'Dendritic Cells', 'Neutrophils'];
  
  let foundAssay = '';
  let foundCellType = '';
  const otherMarkers: string[] = [];
  
  for (const keyword of foundKeywords) {
    if (assayTypes.includes(keyword) && !foundAssay) {
      foundAssay = keyword;
    } else if (cellTypes.includes(keyword) && !foundCellType) {
      foundCellType = keyword;
    } else if (!assayTypes.includes(keyword) && !cellTypes.includes(keyword)) {
      otherMarkers.push(keyword);
    }
  }
  
  // Build dataset name
  const nameParts: string[] = [];
  
  if (foundCellType) {
    nameParts.push(foundCellType);
  }
  
  if (foundAssay) {
    nameParts.push(foundAssay);
  }
  
  // Add up to 2 other markers
  if (otherMarkers.length > 0) {
    nameParts.push(...otherMarkers.slice(0, 2));
  }
  
  // If we found meaningful keywords, use them
  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }
  
  // Fallback to sheet name if provided
  if (sheetName && sheetName.toLowerCase() !== 'sheet1' && sheetName.toLowerCase() !== 'data') {
    return sheetName;
  }
  
  // Default fallback
  return 'Dataset';
}

/**
 * Extract assay type from dataset name or content
 */
export function extractAssayType(rawData: any[][], datasetName: string): string {
  const name = datasetName.toLowerCase();
  
  // Check common assay types
  if (name.includes('cytotox')) return 'Cytotoxicity';
  if (name.includes('activation')) return 'Cell Activation';
  if (name.includes('proliferation')) return 'Cell Proliferation';
  if (name.includes('viability')) return 'Cell Viability';
  if (name.includes('apoptosis') || name.includes('cell death')) return 'Cell Death';
  if (name.includes('binding')) return 'Binding Assay';
  if (name.includes('ec50') || name.includes('potency')) return 'Potency Assay';
  if (name.includes('ic50') || name.includes('inhibition')) return 'Inhibition Assay';
  
  // Default
  return 'Dose-Response';
}

/**
 * Generate unique dataset names when multiple similar datasets exist
 */
export function makeDatasetNamesUnique(names: string[]): string[] {
  const nameCounts = new Map<string, number>();
  const result: string[] = [];
  
  for (const name of names) {
    const count = nameCounts.get(name) || 0;
    nameCounts.set(name, count + 1);
    
    if (count === 0) {
      result.push(name);
    } else {
      result.push(`${name} ${count + 1}`);
    }
  }
  
  return result;
}