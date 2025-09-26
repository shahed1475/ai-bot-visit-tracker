#!/usr/bin/env python3
"""
Master Test Runner for AI Bot Visit Tracker Multi-Framework Support

This script runs all framework-specific tests and provides a comprehensive
summary of the AI Bot Visit Tracker's functionality across all supported
frameworks: Node.js, Flask, and Django.

Usage: python tests/run_all_tests.py
"""

import os
import sys
import time
import subprocess
import json
from datetime import datetime
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Test configuration
TEST_CONFIG = {
    'frameworks': {
        'nodejs': {
            'name': 'Node.js Express',
            'test_script': 'tests/test_nodejs_middleware.js',
            'command': ['node', 'tests/test_nodejs_middleware.js'],
            'database_file': 'tests/test_nodejs.sqlite'
        },
        'flask': {
            'name': 'Flask',
            'test_script': 'tests/test_flask_middleware.py',
            'command': ['python', 'tests/test_flask_middleware.py'],
            'database_file': 'tests/test_flask.sqlite'
        },
        'django': {
            'name': 'Django',
            'test_script': 'tests/test_django_middleware.py',
            'command': ['python', 'tests/test_django_middleware.py'],
            'database_file': 'tests/test_django.sqlite'
        }
    },
    'timeout': 120,  # 2 minutes per test
    'cleanup_databases': False  # Keep test databases for inspection
}


class MasterTestRunner:
    def __init__(self):
        self.results = {}
        self.start_time = None
        self.end_time = None
        self.summary = {
            'total_frameworks': 0,
            'passed_frameworks': 0,
            'failed_frameworks': 0,
            'total_duration': 0,
            'errors': []
        }

    def print_header(self):
        """Print the test suite header"""
        print('🚀 AI Bot Visit Tracker - Multi-Framework Test Suite')
        print('=' * 60)
        print(f'Testing frameworks: {", ".join(TEST_CONFIG["frameworks"].keys())}')
        print(f'Started at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        print('=' * 60)

    def check_prerequisites(self):
        """Check if all required dependencies are available"""
        print('\n🔍 Checking Prerequisites')
        print('-' * 30)

        prerequisites = {
            'node': ['node', '--version'],
            'python': ['python', '--version'],
            'npm': ['npm', '--version']
        }

        missing = []
        for name, command in prerequisites.items():
            try:
                result = subprocess.run(command, capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    version = result.stdout.strip()
                    print(f'✅ {name}: {version}')
                else:
                    print(f'❌ {name}: Not available')
                    missing.append(name)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                print(f'❌ {name}: Not found')
                missing.append(name)

        if missing:
            print(f'\n⚠️  Missing prerequisites: {", ".join(missing)}')
            print('Please install the missing dependencies before running tests.')
            return False

        # Check for Node.js dependencies
        nodejs_deps = project_root / 'middleware' / 'nodejs' / 'node_modules'
        if not nodejs_deps.exists():
            print('\n📦 Installing Node.js dependencies...')
            try:
                subprocess.run(['npm', 'install'], 
                             cwd=project_root / 'middleware' / 'nodejs',
                             check=True, timeout=60)
                print('✅ Node.js dependencies installed')
            except subprocess.CalledProcessError:
                print('❌ Failed to install Node.js dependencies')
                return False

        # Check for Python dependencies
        try:
            import flask
            import django
            print('✅ Python dependencies available')
        except ImportError as e:
            print(f'❌ Missing Python dependencies: {e}')
            print('Please install: pip install flask django')
            return False

        return True

    def run_framework_test(self, framework_key, framework_config):
        """Run a test for a specific framework"""
        print(f'\n🧪 Testing {framework_config["name"]}')
        print('-' * 40)

        test_result = {
            'framework': framework_config['name'],
            'success': False,
            'duration': 0,
            'error': None,
            'output': '',
            'database_file': framework_config['database_file']
        }

        try:
            start_time = time.time()

            # Change to project root directory
            process = subprocess.run(
                framework_config['command'],
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=TEST_CONFIG['timeout']
            )

            end_time = time.time()
            test_result['duration'] = end_time - start_time
            test_result['output'] = process.stdout
            test_result['error_output'] = process.stderr

            if process.returncode == 0:
                test_result['success'] = True
                print(f'✅ {framework_config["name"]} test PASSED')
                print(f'   Duration: {test_result["duration"]:.1f}s')
            else:
                test_result['success'] = False
                test_result['error'] = f'Exit code: {process.returncode}'
                print(f'❌ {framework_config["name"]} test FAILED')
                print(f'   Duration: {test_result["duration"]:.1f}s')
                print(f'   Error: {test_result["error"]}')

            # Print key output lines
            if process.stdout:
                output_lines = process.stdout.split('\n')
                summary_lines = [line for line in output_lines if any(keyword in line for keyword in 
                               ['✅', '❌', 'PASS', 'FAIL', 'Total Requests', 'Bot Detections', 'Overall Result'])]
                if summary_lines:
                    print('   Key Results:')
                    for line in summary_lines[-5:]:  # Show last 5 relevant lines
                        print(f'     {line.strip()}')

        except subprocess.TimeoutExpired:
            test_result['error'] = f'Test timed out after {TEST_CONFIG["timeout"]}s'
            print(f'⏰ {framework_config["name"]} test TIMED OUT')
        except Exception as e:
            test_result['error'] = str(e)
            print(f'💥 {framework_config["name"]} test ERROR: {e}')

        return test_result

    def analyze_database_files(self):
        """Analyze the test database files for additional insights"""
        print('\n📊 Analyzing Test Database Files')
        print('-' * 40)

        database_analysis = {}

        for framework_key, framework_config in TEST_CONFIG['frameworks'].items():
            db_path = project_root / framework_config['database_file']
            
            if db_path.exists():
                try:
                    import sqlite3
                    conn = sqlite3.connect(str(db_path))
                    cursor = conn.cursor()

                    # Get basic statistics
                    cursor.execute("SELECT COUNT(*) FROM visits")
                    total_visits = cursor.fetchone()[0]

                    cursor.execute("SELECT COUNT(DISTINCT bot_name) FROM visits WHERE bot_name != 'unknown'")
                    unique_bots = cursor.fetchone()[0]

                    cursor.execute("SELECT classification, COUNT(*) FROM visits GROUP BY classification")
                    classifications = dict(cursor.fetchall())

                    cursor.execute("SELECT bot_name, COUNT(*) FROM visits WHERE bot_name != 'unknown' GROUP BY bot_name")
                    bot_counts = dict(cursor.fetchall())

                    conn.close()

                    database_analysis[framework_key] = {
                        'total_visits': total_visits,
                        'unique_bots': unique_bots,
                        'classifications': classifications,
                        'bot_counts': bot_counts,
                        'file_size': db_path.stat().st_size
                    }

                    print(f'📈 {framework_config["name"]}:')
                    print(f'   Total Visits: {total_visits}')
                    print(f'   Unique Bots: {unique_bots}')
                    print(f'   Classifications: {len(classifications)}')
                    print(f'   Database Size: {db_path.stat().st_size} bytes')

                except Exception as e:
                    print(f'❌ Error analyzing {framework_config["name"]} database: {e}')
                    database_analysis[framework_key] = {'error': str(e)}
            else:
                print(f'⚠️  {framework_config["name"]} database not found: {db_path}')
                database_analysis[framework_key] = {'error': 'Database file not found'}

        return database_analysis

    def generate_summary_report(self, database_analysis):
        """Generate a comprehensive summary report"""
        print('\n📋 Test Summary Report')
        print('=' * 50)

        # Overall statistics
        print(f'🎯 Overall Results:')
        print(f'   Total Frameworks Tested: {self.summary["total_frameworks"]}')
        print(f'   Passed: {self.summary["passed_frameworks"]}')
        print(f'   Failed: {self.summary["failed_frameworks"]}')
        print(f'   Success Rate: {(self.summary["passed_frameworks"] / self.summary["total_frameworks"] * 100):.1f}%')
        print(f'   Total Duration: {self.summary["total_duration"]:.1f}s')

        # Framework-specific results
        print(f'\n📊 Framework Results:')
        for framework_key, result in self.results.items():
            status = '✅ PASS' if result['success'] else '❌ FAIL'
            print(f'   {result["framework"]}: {status} ({result["duration"]:.1f}s)')
            if result['error']:
                print(f'     Error: {result["error"]}')

        # Database consistency check
        print(f'\n🔍 Database Consistency Check:')
        if len(database_analysis) > 1:
            # Compare visit counts across frameworks
            visit_counts = {k: v.get('total_visits', 0) for k, v in database_analysis.items() if 'total_visits' in v}
            if visit_counts:
                min_visits = min(visit_counts.values())
                max_visits = max(visit_counts.values())
                if min_visits == max_visits:
                    print(f'   ✅ Visit counts consistent across frameworks: {min_visits}')
                else:
                    print(f'   ⚠️  Visit counts vary: {min_visits} - {max_visits}')
                    for framework, count in visit_counts.items():
                        print(f'     {framework}: {count} visits')

            # Compare bot detection across frameworks
            all_bots = set()
            for analysis in database_analysis.values():
                if 'bot_counts' in analysis:
                    all_bots.update(analysis['bot_counts'].keys())
            
            if all_bots:
                print(f'   🤖 Detected Bot Types: {", ".join(sorted(all_bots))}')
            else:
                print(f'   ⚠️  No bots detected across frameworks')

        # Recommendations
        print(f'\n💡 Recommendations:')
        if self.summary['failed_frameworks'] > 0:
            print(f'   • Review failed framework tests and fix issues')
            print(f'   • Check error logs for specific failure reasons')
        
        if self.summary['passed_frameworks'] == self.summary['total_frameworks']:
            print(f'   • All tests passed! The multi-framework implementation is working correctly')
            print(f'   • Consider running performance benchmarks next')
        
        print(f'   • Test databases are preserved for inspection:')
        for framework_key, framework_config in TEST_CONFIG['frameworks'].items():
            db_path = project_root / framework_config['database_file']
            if db_path.exists():
                print(f'     {framework_config["name"]}: {db_path}')

    def cleanup(self):
        """Clean up test environment"""
        if TEST_CONFIG['cleanup_databases']:
            print('\n🧹 Cleaning up test databases')
            for framework_config in TEST_CONFIG['frameworks'].values():
                db_path = project_root / framework_config['database_file']
                if db_path.exists():
                    db_path.unlink()
                    print(f'   ✅ Removed {db_path}')

    def run(self):
        """Run the complete test suite"""
        self.start_time = time.time()
        
        try:
            self.print_header()
            
            # Check prerequisites
            if not self.check_prerequisites():
                print('\n❌ Prerequisites check failed. Exiting.')
                return False

            # Run tests for each framework
            self.summary['total_frameworks'] = len(TEST_CONFIG['frameworks'])
            
            for framework_key, framework_config in TEST_CONFIG['frameworks'].items():
                result = self.run_framework_test(framework_key, framework_config)
                self.results[framework_key] = result
                
                if result['success']:
                    self.summary['passed_frameworks'] += 1
                else:
                    self.summary['failed_frameworks'] += 1
                    self.summary['errors'].append({
                        'framework': framework_config['name'],
                        'error': result['error']
                    })

            self.end_time = time.time()
            self.summary['total_duration'] = self.end_time - self.start_time

            # Analyze database files
            database_analysis = self.analyze_database_files()

            # Generate summary report
            self.generate_summary_report(database_analysis)

            # Determine overall success
            overall_success = self.summary['failed_frameworks'] == 0

            print(f'\n🏁 Test Suite Complete: {"✅ ALL PASSED" if overall_success else "❌ SOME FAILED"}')
            
            return overall_success

        except KeyboardInterrupt:
            print('\n⚠️  Test suite interrupted by user')
            return False
        except Exception as e:
            print(f'\n💥 Test suite failed with error: {e}')
            import traceback
            traceback.print_exc()
            return False
        finally:
            self.cleanup()


def main():
    """Main function"""
    runner = MasterTestRunner()
    success = runner.run()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()