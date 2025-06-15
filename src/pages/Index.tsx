
import React, { useState, useEffect } from 'react';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoginFormDetector } from '@/components/LoginFormDetector';
import { GeneratedLoginForm } from '@/components/GeneratedLoginForm';
import { LoginSubmissionForm } from '@/components/LoginSubmissionForm';
import { BatchJobManager } from '@/components/BatchJobManager';
import { FormHistory } from '@/components/FormHistory';
import { DevModeInfo } from '@/components/DevModeInfo';
import { LoginDetector } from '@/utils/loginDetector';
import { FormGenerator } from '@/utils/formGenerator';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Server } from 'lucide-react';

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

interface SavedForm {
  id: string;
  target_url: string;
  fields: DetectedField[];
  created_at: string;
}

const Index = () => {
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [securityFeatures, setSecurityFeatures] = useState<SecurityFeature[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [servicesStatus, setServicesStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [savedForms, setSavedForms] = useState<SavedForm[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const { toast } = useToast();

  // Check if Docker services are running
  useEffect(() => {
    checkServicesStatus();
    loadSavedForms();
  }, []);

  const checkServicesStatus = async () => {
    try {
      const response = await fetch('http://localhost:3000/health', {
        method: 'GET',
      });
      
      if (response.ok) {
        setServicesStatus('running');
      } else {
        setServicesStatus('stopped');
      }
    } catch (error) {
      console.log('Services check failed:', error);
      setServicesStatus('stopped');
    }
  };

  const loadSavedForms = async () => {
    setIsLoadingForms(true);
    try {
      const forms = await FormGenerator.loadGeneratedForms();
      setSavedForms(forms);
    } catch (error) {
      console.error('Failed to load saved forms:', error);
      // Don't show error toast for this, as it's expected when services aren't running
    } finally {
      setIsLoadingForms(false);
    }
  };

  const handleRefreshForms = async () => {
    await loadSavedForms();
    toast({
      title: "Forms Refreshed",
      description: "Saved forms list has been updated",
      duration: 2000,
    });
  };

  const handleAnalyze = async (url: string, useBrowser?: boolean) => {
    setIsAnalyzing(true);
    setDetectedFields([]);
    setSecurityFeatures([]);
    setCurrentUrl(url);
    setSubmissionResult(null);

    try {
      const fields = await LoginDetector.analyzeLoginPage(url, useBrowser);
      setDetectedFields(fields);
      
      // Get security features if available (this would come from the enhanced analyzer)
      // For now, we'll just set empty array since the backend returns it
      setSecurityFeatures([]);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${fields.length} login-related fields`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the page",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveForm = async () => {
    if (!currentUrl || detectedFields.length === 0) {
      toast({
        title: "Cannot Save Form",
        description: "No form data to save. Please analyze a page first.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      const formId = await FormGenerator.saveGeneratedForm(currentUrl, detectedFields);
      toast({
        title: "Form Saved",
        description: `Form saved with ID: ${formId}`,
        duration: 3000,
      });
      // Refresh the forms list
      await loadSavedForms();
    } catch (error) {
      console.error('Error saving form:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the form",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleSubmissionComplete = (result: any) => {
    setSubmissionResult(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Enhanced Login Page Analyzer & Tester
          </h1>
          <p className="text-slate-300 text-lg">
            Detect, analyze, and test login forms with advanced security features
          </p>
        </div>

        {/* Access Information */}
        <DevModeInfo />

        {/* Services Status Alert */}
        <div className="mb-6">
          {servicesStatus === 'checking' && (
            <Alert className="bg-blue-900/50 border-blue-600">
              <Server className="h-4 w-4" />
              <AlertDescription className="text-blue-200">
                Checking Docker services status...
              </AlertDescription>
            </Alert>
          )}
          
          {servicesStatus === 'stopped' && (
            <Alert className="bg-red-900/50 border-red-600">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-200">
                <strong>Docker services are not running.</strong> Start them with: <code className="bg-red-800 px-2 py-1 rounded">docker-compose up -d</code>
                <br />
                The analyzer will not work without the backend services.
              </AlertDescription>
            </Alert>
          )}
          
          {servicesStatus === 'running' && (
            <Alert className="bg-green-900/50 border-green-600">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-green-200">
                All Docker services are running and ready!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Tabs defaultValue="analyze" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
            <TabsTrigger value="analyze" className="data-[state=active]:bg-slate-700">
              Analyze
            </TabsTrigger>
            <TabsTrigger value="test" className="data-[state=active]:bg-slate-700">
              Test Login
            </TabsTrigger>
            <TabsTrigger value="batch" className="data-[state=active]:bg-slate-700">
              Batch Jobs
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-slate-700">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <UrlInputForm 
                  onAnalyze={handleAnalyze} 
                  isLoading={isAnalyzing}
                  supportsBrowser={true}
                />
                <GeneratedLoginForm 
                  detectedFields={detectedFields}
                  targetUrl={currentUrl}
                  onSave={handleSaveForm}
                />
              </div>
              <LoginFormDetector 
                detectedFields={detectedFields}
                securityFeatures={securityFeatures}
                isAnalyzing={isAnalyzing}
              />
            </div>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            {detectedFields.length > 0 && currentUrl ? (
              <LoginSubmissionForm
                targetUrl={currentUrl}
                detectedFields={detectedFields}
                securityFeatures={securityFeatures}
                onSubmissionComplete={handleSubmissionComplete}
              />
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  Please analyze a login page first to enable testing
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="batch">
            <BatchJobManager />
          </TabsContent>

          <TabsContent value="history">
            <FormHistory 
              savedForms={savedForms}
              onRefresh={handleRefreshForms}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
