export interface DataPoint {
  concentration: number;
  responses: number[];
  sampleNames: string[];
  replicateGroups?: string[];
}

export interface Dataset {
  id: string;
  name: string;
  data: DataPoint[];
  assayType: string;
  sheetName?: string;
  fittedCurves?: FittedCurve[];
  curveColors?: string[];
}

export interface FittedCurve {
  sampleName: string;
  ec50: number;
  hillSlope: number;
  top: number;
  bottom: number;
  rSquared: number;
  fittedPoints: { x: number; y: number }[];
  originalPoints: { x: number; y: number }[];
  meanPoints?: { x: number; y: number; sem: number }[];
}

export interface CurveParameters {
  top: number;
  bottom: number;
  ec50: number;
  hillSlope: number;
} 