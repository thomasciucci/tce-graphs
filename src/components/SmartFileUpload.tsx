'use client';

import { DataPoint, Dataset } from '../types';
import FileUpload from './FileUpload';

interface SmartFileUploadProps {
  onDataUpload: (data: DataPoint[]) => void;
  onMultipleDatasetsUpload?: (datasets: Dataset[]) => void;
}

export default function SmartFileUpload({ onDataUpload, onMultipleDatasetsUpload }: SmartFileUploadProps) {
  return (
    <div className="space-y-4">

      <FileUpload
        onDataUpload={onDataUpload}
        onMultipleDatasetsUpload={onMultipleDatasetsUpload}
      />
    </div>
  );
}