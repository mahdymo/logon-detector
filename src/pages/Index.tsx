
import React, { useState, useEffect } from 'react';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoginFormDetector } from '@/components/LoginFormDetector';
import { GeneratedLoginForm } from '@/components/GeneratedLoginForm';
import { FormHistory } from '@/components/FormHistory';
import { LoginDetector } from '@/utils/loginDetector';
import { FormGenerator } from '@/utils/formGenerator';
import { Shield, Zap, Target, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [savedForms, setSavedForms] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    loadSavedForms();
  }, []);

  const loadSavedForms = async () => {
    try {
      const forms = await FormGenerator.loadGeneratedForms();
      setSavedForms(forms);
    } catch (error) {
      console.error('Failed to load saved forms:', error);
    }
  };

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true);
    setAnalyzedUrl(url);
    
    try {
      const fields = await LoginDetector.analyzeLoginPage(url);
      setDetectedFields(fields);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${fields.length} login fields`,
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Error analyzing login page:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze the page. Please check the URL and try again.",
        variant: "destructive",
        duration: 5000,
      });
      setDetectedFields([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveForm = async () => {
    if (!analyzedUrl || detectedFields.length === 0) return;
    
    try {
      await FormGenerator.saveGeneratedForm(analyzedUrl, detectedFields);
      await loadSavedForms();
      
      toast({
        title: "Form Saved",
        description: "Generated form has been saved successfully",
        duration: 3000,
      });
      
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Unable to save the form. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
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
            <div className="flex items-center gap-2 text-slate-400">
              <Database className="h-5 w-5 text-purple-400" />
              <span>Form Storage</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Input Form */}
          <div>
            <UrlInputForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          </div>

          {/* Detection Results */}
          <div>
            <LoginFormDetector 
              detectedFields={detectedFields} 
              isAnalyzing={isAnalyzing}
            />
          </div>
        </div>

        {/* Generated Form */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <GeneratedLoginForm 
              detectedFields={detectedFields}
              targetUrl={analyzedUrl}
              onSave={handleSaveForm}
            />
          </div>

          {/* Form History */}
          <div>
            <FormHistory savedForms={savedForms} onRefresh={loadSavedForms} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-500 text-sm">
            Built for security researchers and developers • Backend powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
