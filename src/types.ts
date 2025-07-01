export interface DataPoint {
  concentration: number;
  responses: number[];
  sampleNames: string[];
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
}

export interface CurveParameters {
  top: number;
  bottom: number;
  ec50: number;
  hillSlope: number;
} 