
import React, { useState } from 'react';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoginFormDetector } from '@/components/LoginFormDetector';
import { GeneratedLoginForm } from '@/components/GeneratedLoginForm';
import { LoginDetector } from '@/utils/loginDetector';
import { Shield, Zap, Target } from 'lucide-react';

interface DetectedField {
  type: 'username' | 'email' | 'password' | 'submit' | 'other';
  selector: string;
  placeholder?: string;
  label?: string;
  required: boolean;
}

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [analyzedUrl, setAnalyzedUrl] = useState('');

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true);
    setAnalyzedUrl(url);
    
    try {
      const fields = await LoginDetector.analyzeLoginPage(url);
      setDetectedFields(fields);
    } catch (error) {
      console.error('Error analyzing login page:', error);
      setDetectedFields([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-blue-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Login Page Detector
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Automatically analyze login pages and generate compatible login forms
          </p>
          
          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-slate-400">
              <Target className="h-5 w-5 text-green-400" />
              <span>Field Detection</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Zap className="h-5 w-5 text-yellow-400" />
              <span>Auto Generation</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Shield className="h-5 w-5 text-blue-400" />
              <span>Security Focused</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-1">
            <UrlInputForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          </div>

          {/* Detection Results */}
          <div className="lg:col-span-1">
            <LoginFormDetector 
              detectedFields={detectedFields} 
              isAnalyzing={isAnalyzing}
            />
          </div>

          {/* Generated Form */}
          <div className="lg:col-span-1">
            <GeneratedLoginForm 
              detectedFields={detectedFields}
              targetUrl={analyzedUrl}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-500 text-sm">
            Built for security researchers and developers
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
