#!/usr/bin/env tsx
/**
 * CLI Script for Enhanced Data Detection Tests
 * Usage: npm run test:enhanced-detection [options]
 */

import { 
  runEnhancedTests, 
  runCategoryTests, 
  runDifficultyTests,
  runSmokeTests,
  runFullTestSuite,
  TestRunOptions
} from '../src/utils/testRunner';
import { EnhancedParseOptions } from '../src/utils/enhancedParser';

interface CliOptions {
  category?: string;
  difficulty?: string;
  verbose?: boolean;
  smoke?: boolean;
  full?: boolean;
  help?: boolean;
  'pattern-confidence'?: number;
  'enable-multi'?: boolean;
  'prioritize-patterns'?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--category':
      case '-c':
        options.category = args[++i];
        break;
      case '--difficulty':
      case '-d':
        options.difficulty = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--smoke':
      case '-s':
        options.smoke = true;
        break;
      case '--full':
      case '-f':
        options.full = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--pattern-confidence':
        options['pattern-confidence'] = parseFloat(args[++i]);
        break;
      case '--enable-multi':
        options['enable-multi'] = true;
        break;
      case '--prioritize-patterns':
        options['prioritize-patterns'] = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`⚠️  Unknown option: ${arg}`);
        }
    }
  }
  
  return options;
}

function printHelp(): void {
  console.log(`
🧪 Enhanced Data Detection Test Runner

Usage:
  npm run test:enhanced-detection [options]

Options:
  -c, --category <type>           Run tests for specific category:
                                  dilution_patterns, multi_dataset, 
                                  pattern_vs_keyword, complex_scenarios
  
  -d, --difficulty <level>        Run tests for specific difficulty:
                                  easy, medium, hard, extreme
  
  -s, --smoke                     Run smoke tests (quick validation)
  -f, --full                      Run full test suite with detailed reporting
  -v, --verbose                   Enable verbose output
  -h, --help                      Show this help message

Parser Options:
  --pattern-confidence <num>      Minimum pattern confidence (0.0-1.0)
  --enable-multi                  Enable multi-dataset detection
  --prioritize-patterns           Prioritize pattern detection over keywords

Examples:
  npm run test:enhanced-detection --smoke
  npm run test:enhanced-detection --category dilution_patterns --verbose
  npm run test:enhanced-detection --difficulty hard --pattern-confidence 0.6
  npm run test:enhanced-detection --full --enable-multi --prioritize-patterns
`);
}

async function main(): Promise<void> {
  const options = parseArgs();
  
  if (options.help) {
    printHelp();
    return;
  }
  
  // Build parse options
  const parseOptions: EnhancedParseOptions = {};
  
  if (options['pattern-confidence'] !== undefined) {
    parseOptions.minPatternConfidence = options['pattern-confidence'];
  }
  
  if (options['enable-multi']) {
    parseOptions.enableMultiDataset = true;
  }
  
  if (options['prioritize-patterns']) {
    parseOptions.prioritizePatterns = true;
  }
  
  // Show configuration
  console.log('🔧 Test Configuration:');
  if (Object.keys(parseOptions).length > 0) {
    console.log('   Parse Options:', JSON.stringify(parseOptions, null, 2));
  } else {
    console.log('   Parse Options: Default settings');
  }
  console.log();
  
  try {
    let report;
    
    if (options.smoke) {
      report = await runSmokeTests(parseOptions);
    } else if (options.full) {
      report = await runFullTestSuite(parseOptions);
    } else if (options.category) {
      const validCategories = ['dilution_patterns', 'multi_dataset', 'pattern_vs_keyword', 'complex_scenarios'];
      if (!validCategories.includes(options.category)) {
        console.error(`❌ Invalid category: ${options.category}`);
        console.error(`   Valid categories: ${validCategories.join(', ')}`);
        process.exit(1);
      }
      report = await runCategoryTests(options.category as any, parseOptions);
    } else if (options.difficulty) {
      const validDifficulties = ['easy', 'medium', 'hard', 'extreme'];
      if (!validDifficulties.includes(options.difficulty)) {
        console.error(`❌ Invalid difficulty: ${options.difficulty}`);
        console.error(`   Valid difficulties: ${validDifficulties.join(', ')}`);
        process.exit(1);
      }
      report = await runDifficultyTests(options.difficulty as any, parseOptions);
    } else {
      // Default: run all tests
      const testOptions: TestRunOptions = {
        verbose: options.verbose,
        generateReport: true
      };
      report = await runEnhancedTests(testOptions, parseOptions);
    }
    
    // Exit with appropriate code
    const successRate = report.summary.successRate;
    if (successRate >= 80) {
      console.log('🎉 All tests passed successfully!');
      process.exit(0);
    } else if (successRate >= 60) {
      console.log('⚠️  Some tests failed, but system is functional');
      process.exit(1);
    } else {
      console.log('❌ Critical test failures detected');
      process.exit(2);
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:');
    console.error(error);
    process.exit(3);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled promise rejection:');
  console.error(reason);
  process.exit(3);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:');
  console.error(error);
  process.exit(3);
});

// Run the CLI
if (require.main === module) {
  main();
}