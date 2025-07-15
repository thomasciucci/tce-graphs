# Four-Parameter Logistic Curve Fitter

A web application for analyzing concentration-response data using the four-parameter logistic equation. This tool automatically fits curves to experimental data and provides statistical summaries and visualizations.

## Features

- **Excel File Upload**: Supports .xls and .xlsx files
- **Data Editing**: Inline editing capabilities for uploaded data
- **Automatic Curve Fitting**: Uses the four-parameter logistic equation with optimized parameters
- **Interactive Charts**: Concentration-response curves with original data points and fitted curves
- **Statistical Summaries**: EC50, Hill Slope, and R² values for each sample
- **Real-time Processing**: Immediate results display

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

## Data Format

Upload Excel files with the following structure:
- **First column**: Concentration values (nM)
- **Additional columns**: Response values for each sample
- **First row**: Sample names (headers)

Example:
```
TCE [nM] | TCE1 | TCE2 | TCE3
50        | 13.9 | 89.3 | 94.9
10        | 21.9 | 90.7 | 94.0
2         | 11.6 | 92.5 | 95.5
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload Data**: Click "Choose Excel File" and select your concentration-response data
2. **Edit Data** (optional): Use the data editor to modify values or add/remove rows
3. **Fit Curves**: Click "Fit Curves" to automatically calculate parameters
4. **View Results**: Examine the fitted curves, statistical summaries, and processed data

## Technical Details

- **Frontend**: Next.js with React and TypeScript
- **Charts**: Recharts library for data visualization
- **Excel Processing**: xlsx library for file parsing
- **Styling**: Tailwind CSS for responsive design
- **Curve Fitting**: Grid search algorithm for parameter optimization

## Output

The application provides:
- **Summary Statistics**: EC50, Hill Slope, R², Top, and Bottom values for each sample
- **Concentration-Response Curves**: Interactive charts showing original data points and fitted curves
- **Processed Data Table**: Formatted data with calculated values

## Sample Data

The application includes sample data files in the `Sample Data/` directory:
- `Table1_cytotoxicity.xls` - Cytotoxicity data
- `Table2_activation.xls` - Activation data

These files demonstrate the expected data format and can be used to test the application.
