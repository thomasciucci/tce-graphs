# nVitro Studio

Professional dose-response analysis tool for biological assays. A Next.js-based web application for analyzing and visualizing dose-response curves with comprehensive export capabilities.

## Features

- **Data Import**: Support for Excel files (.xls, .xlsx) with automatic data parsing
- **Dose-Response Analysis**: Four-parameter logistic regression curve fitting
- **Visualization**: Interactive charts with customizable display options
- **Export Options**: 
  - PDF reports with charts and statistical summaries
  - PowerPoint presentations with formatted slides
  - **GraphPad Prism Export**: Template-based export with analysis preservation
    - Built-in dose-response templates (supports 1-3 datasets, 6 samples each)
    - Custom template upload (.pzfx files)
    - Preserves all analysis settings and graph configurations
- **Technical Replicates**: Built-in support for replicate grouping and averaging
- **Multi-Dataset Support**: Analyze multiple datasets with comparison capabilities

## Four-Parameter Logistic Equation

The application uses the following equation:

```
Y = Bottom + (Top - Bottom) / (1 + (2^(1/HillSlope) - 1) * (EC50/X)^HillSlope)
```

Where:
- **Y**: Response value (%)
- **X**: Concentration (nM)
- **Top**: Maximum response (optimized parameter)
- **Bottom**: Minimum response (optimized parameter)
- **EC50**: Concentration producing 50% of maximum response
- **HillSlope**: Steepness of the curve

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd tce-graphs

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Sample Data

Sample datasets are included in the `Sample Data/` directory:
- `Table1_cytotoxicity.xls` - Cytotoxicity assay example
- `Table2_activation.xls` - Cell activation assay example

## Basic Usage

1. **Upload Data**: Drag and drop Excel files or use the file picker
2. **Configure Dataset**: Set column names and replicate groups if applicable
3. **Fit Curves**: Click "Calculate Results" to perform curve fitting
4. **Visualize**: View dose-response curves with statistical parameters
5. **Export**: Generate PDF reports, PowerPoint slides, or Prism files

## Core Technologies

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS
- **Charts**: Recharts for data visualization
- **File Processing**: XLSX for Excel file parsing
- **PDF Generation**: jsPDF with html2canvas for chart capture
- **UI Components**: Headless UI for accessible components

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application page
├── components/            # React components
│   ├── CurveFitter.tsx    # Curve fitting interface
│   ├── DataEditor.tsx     # Data editing interface
│   ├── FileUpload.tsx     # File upload component
│   ├── ResultsDisplay.tsx # Chart and results display
│   └── PowerPointExport.tsx # PowerPoint export functionality
├── utils/                 # Utility functions
│   ├── csvExport.ts       # CSV export utilities
│   ├── pdfExport.ts       # PDF generation
│   ├── pptExport.ts       # PowerPoint generation
│   ├── prismExport.ts     # Basic Prism data export
│   └── actualTemplateExport.ts # Template-based Prism export
├── fitUtils.ts            # Curve fitting algorithms
└── types.ts               # TypeScript type definitions
```

## Recent Updates

### Prism Export Enhancement (Latest)
- **Simplified UI**: Reduced from 6 complex options to 2 clean choices
- **Template-Based Export**: 
  - Built-in dose-response templates (1-3 datasets, 6 samples each)
  - Custom template upload (.pzfx files)
  - Preserves all analysis settings and graph configurations
- **Fixed Multi-Dataset Support**: Now exports all datasets and all columns correctly
- **Custom Template Upload**: Users can upload their own Prism template files

### Next Development Priorities
1. Template library expansion (IC50, competitive binding, time-course)
2. Template validation and compatibility checking
3. Enhanced user experience (preview, progress indicators)
4. Comprehensive testing with various dataset configurations

## Data Format

The application expects Excel files with:
- First column: Concentration values (numeric)
- Subsequent columns: Response values for each sample
- Optional: Technical replicates can be grouped

Example:
```
Concentration | Sample A | Sample B | Sample C
0.1          | 10.2     | 12.1     | 9.8
1.0          | 25.4     | 28.2     | 24.9
10.0         | 67.3     | 71.2     | 69.1
```

## Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## License

Private project - All rights reserved

## Support

For issues and feature requests, please refer to the project documentation or contact the development team.
