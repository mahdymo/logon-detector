
import React, { useState, useEffect } from 'react';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoginFormDetector } from '@/components/LoginFormDetector';
import { GeneratedLoginForm } from '@/components/GeneratedLoginForm';
import { LoginSubmissionForm } from '@/components/LoginSubmissionForm';
import { BatchJobManager } from '@/components/BatchJobManager';
import { FormHistory } from '@/components/FormHistory';
import { LoginDetector } from '@/utils/loginDetector';
import { FormGenerator } from '@/utils/formGenerator';
import { Shield, Zap, Target, Database, Bot, Cpu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DetectedField {
  type: 'username' | 'email' | 'password' | 'submit' | 'other';
  selector: string;
  placeholder?: string;
  label?: string;
  required: boolean;
}

interface SecurityFeature {
  type: string;
  details: any;
}

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [securityFeatures, setSecurityFeatures] = useState<SecurityFeature[]>([]);
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [savedForms, setSavedForms] = useState([]);
  const [submissionResults, setSubmissionResults] = useState<any[]>([]);
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

  const handleAnalyze = async (url: string, useBrowser = false) => {
    setIsAnalyzing(true);
    setAnalyzedUrl(url);
    
    try {
      console.log(`Analyzing ${url} with ${useBrowser ? 'browser' : 'static'} method`);
      
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, use_browser: useBrowser }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      setDetectedFields(result.fields || []);
      setSecurityFeatures(result.security_features || []);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${result.fields?.length || 0} login fields and ${result.security_features?.length || 0} security features`,
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
      setSecurityFeatures([]);
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

  const handleSubmissionComplete = (result: any) => {
    setSubmissionResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-blue-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Advanced Login Page Detector
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Complete login page analysis, form generation, and automated submission testing platform
          </p>
          
          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-slate-400">
              <Target className="h-5 w-5 text-green-400" />
              <span>Field Detection</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Bot className="h-5 w-5 text-blue-400" />
              <span>Auto Submission</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Shield className="h-5 w-5 text-red-400" />
              <span>Security Analysis</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Database className="h-5 w-5 text-purple-400" />
              <span>Batch Processing</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Cpu className="h-5 w-5 text-yellow-400" />
              <span>Browser Engine</span>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="analyze" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="analyze" className="data-[state=active]:bg-slate-700">
              Analysis & Detection
            </TabsTrigger>
            <TabsTrigger value="submit" className="data-[state=active]:bg-slate-700">
              Login Testing
            </TabsTrigger>
            <TabsTrigger value="batch" className="data-[state=active]:bg-slate-700">
              Batch Operations
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-slate-700">
              History & Results
            </TabsTrigger>
          </TabsList>

          {/* Analysis Tab */}
          <TabsContent value="analyze" className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
              <UrlInputForm 
                onAnalyze={handleAnalyze} 
                isLoading={isAnalyzing}
                supportsBrowser={true}
              />
              <LoginFormDetector 
                detectedFields={detectedFields} 
                securityFeatures={securityFeatures}
                isAnalyzing={isAnalyzing}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <GeneratedLoginForm 
                detectedFields={detectedFields}
                targetUrl={analyzedUrl}
                onSave={handleSaveForm}
              />
              <FormHistory savedForms={savedForms} onRefresh={loadSavedForms} />
            </div>
          </TabsContent>

          {/* Login Testing Tab */}
          <TabsContent value="submit" className="space-y-8">
            {analyzedUrl && detectedFields.length > 0 ? (
              <div className="grid lg:grid-cols-2 gap-8">
                <LoginSubmissionForm
                  targetUrl={analyzedUrl}
                  detectedFields={detectedFields}
                  securityFeatures={securityFeatures}
                  onSubmissionComplete={handleSubmissionComplete}
                />
                <div className="space-y-6">
                  {submissionResults.length > 0 && (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Recent Test Results</h3>
                      <div className="space-y-3">
                        {submissionResults.slice(0, 5).map((result, index) => (
                          <div key={index} className="p-3 bg-slate-800 rounded">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                {result.success ? 'SUCCESS' : 'FAILED'}
                              </span>
                              <span className="text-slate-400 text-sm">
                                {result.submission?.duration}ms
                              </span>
                            </div>
                            {result.submission?.redirect_url && (
                              <p className="text-slate-300 text-sm mt-1">
                                → {result.submission.redirect_url}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Target className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-400 mb-2">No Target Analyzed</h3>
                <p className="text-slate-500">
                  Please analyze a login page first in the "Analysis & Detection" tab
                </p>
              </div>
            )}
          </TabsContent>

          {/* Batch Operations Tab */}
          <TabsContent value="batch">
            <BatchJobManager />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <FormHistory savedForms={savedForms} onRefresh={loadSavedForms} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-500 text-sm">
            Advanced Security Testing Platform • Backend powered by microservices architecture
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
