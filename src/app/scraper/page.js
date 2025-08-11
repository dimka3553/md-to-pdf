'use client';

import { useState } from 'react';

export default function ScraperTest() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('markdown');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (including http:// or https://)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint = format === 'markdown' ? '/api/scrape' : '/api/scrapehtml';
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(`${endpoint}?url=${encodedUrl}&noCache=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'Ok') {
        setResult(data);
      } else {
        setError(data.message || 'Scraping failed');
      }
    } catch (err) {
      console.error('Scraping error:', err);
      setError(err.message || 'Failed to scrape the URL');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScrape();
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Web Scraper Test
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Test the web scraping functionality by entering a URL and choosing your preferred output format.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
                URL to Scrape
              </label>
              <input
                id="url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="markdown"
                    checked={format === 'markdown'}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <span className="ml-2 text-gray-700">Markdown</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="html"
                    checked={format === 'html'}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <span className="ml-2 text-gray-700">HTML</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleScrape}
              disabled={loading || !url.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Scraping...
                </div>
              ) : (
                'Scrape URL'
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Scraped Content ({format === 'markdown' ? 'Markdown' : 'HTML'})
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => copyToClipboard(result.page.content)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
                >
                  Copy Content
                </button>
                <button
                  onClick={() => copyToClipboard(result.page.url)}
                  className="px-4 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors duration-200"
                >
                  Copy URL
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">URL:</span>
                  <p className="text-gray-800 break-all">{result.page.url}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Duration:</span>
                  <p className="text-gray-800">{result.metadata.duration}ms</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Timestamp:</span>
                  <p className="text-gray-800">{new Date(result.metadata.timestamp).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Content Display */}
            <div className="border border-gray-200 rounded-lg">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">
                  Content ({result.page.content.length.toLocaleString()} characters)
                </span>
              </div>
              <div className="p-4">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words overflow-x-auto bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                  {result.page.content}
                </pre>
              </div>
            </div>

            {/* Convert to PDF Option */}
            {format === 'markdown' && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Convert to PDF</h3>
                <p className="text-blue-700 text-sm mb-4">
                  You can now convert this scraped markdown content to a PDF using the main converter.
                </p>
                <button
                  onClick={() => {
                    // Navigate to main page with the content
                    const encodedContent = encodeURIComponent(result.page.content);
                    window.location.href = `/?content=${encodedContent}`;
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors duration-200"
                >
                  Convert to PDF
                </button>
              </div>
            )}
          </div>
        )}

        {/* Example URLs */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Example URLs to Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'https://example.com',
              'https://en.wikipedia.org/wiki/Web_scraping',
              'https://github.com/microsoft/vscode',
              'https://nextjs.org/docs'
            ].map((exampleUrl) => (
              <button
                key={exampleUrl}
                onClick={() => setUrl(exampleUrl)}
                className="text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                disabled={loading}
              >
                <span className="text-blue-600 text-sm break-all">{exampleUrl}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to PDF Converter
          </a>
        </div>
      </div>
    </div>
  );
}
