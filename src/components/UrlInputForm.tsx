
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Globe, Bot } from "lucide-react";

interface UrlInputFormProps {
  onAnalyze: (url: string, useBrowser?: boolean) => void;
  isLoading: boolean;
  supportsBrowser?: boolean;
}

export const UrlInputForm = ({ onAnalyze, isLoading, supportsBrowser = false }: UrlInputFormProps) => {
  const [url, setUrl] = useState('');
  const [useBrowser, setUseBrowser] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyze(url.trim(), useBrowser);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="h-6 w-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Enhanced Login Page Analyzer</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium text-slate-300">
            Enter website URL to analyze
          </label>
          <div className="relative">
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400 pr-12"
              placeholder="https://example.com/login"
              required
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {supportsBrowser && (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="useBrowser"
              checked={useBrowser}
              onCheckedChange={(checked) => setUseBrowser(!!checked)}
            />
            <Label htmlFor="useBrowser" className="text-slate-300 text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-yellow-400" />
              Use headless browser (for JavaScript-heavy pages)
            </Label>
          </div>
        )}
        
        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? "Analyzing..." : "Analyze Login Page"}
        </Button>
      </form>

      {supportsBrowser && (
        <div className="mt-4 p-3 bg-slate-800/50 rounded border border-slate-700">
          <p className="text-slate-400 text-xs">
            💡 <strong>Browser mode</strong> executes JavaScript and can detect dynamic content, 
            but takes longer. Use for modern single-page applications.
          </p>
        </div>
      )}
    </Card>
  );
};
