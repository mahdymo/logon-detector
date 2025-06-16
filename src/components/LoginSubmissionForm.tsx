import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Target, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface LoginSubmissionFormProps {
  targetUrl: string;
  detectedFields: DetectedField[];
  securityFeatures: SecurityFeature[];
  onSubmissionComplete: (result: any) => void;
}

export const LoginSubmissionForm = ({ 
  targetUrl, 
  detectedFields, 
  securityFeatures, 
  onSubmissionComplete 
}: LoginSubmissionFormProps) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [options, setOptions] = useState({
    use_browser: false,
    timeout: 30000,
    user_agent: 'LoginDetector/1.0'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const { toast } = useToast();

  // Use relative API URL since everything is served from the same origin (port 80)
  const getApiBaseUrl = () => {
    return window.location.origin; // No port needed, everything is on port 80
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both username and password",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      console.log('Submitting login attempt...');
      
      const apiBaseUrl = getApiBaseUrl();
      console.log(`Using API endpoint: ${apiBaseUrl}`);
      
      const response = await fetch(`${apiBaseUrl}/api/login-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: targetUrl,
          credentials,
          options
        }),
      });

      if (!response.ok) {
        throw new Error(`Submission failed: ${response.statusText}`);
      }

      const result = await response.json();
      setSubmissionResult(result);
      onSubmissionComplete(result);

      toast({
        title: result.success ? "Login Successful!" : "Login Failed",
        description: result.success 
          ? "Successfully logged into the target site" 
          : "Login attempt failed. Check the results for details.",
        variant: result.success ? "default" : "destructive",
        duration: 5000,
      });

    } catch (error) {
      console.error('Error submitting login:', error);
      toast({
        title: "Submission Error",
        description: "An error occurred while attempting login. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSecurityConcerns = securityFeatures.some(f => 
    ['captcha', 'mfa'].includes(f.type)
  );

  return (
    <Card className="p-6 bg-slate-900 border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-6 w-6 text-red-400" />
        <h3 className="text-lg font-semibold text-white">Login Submission Test</h3>
      </div>

      {/* Security warnings */}
      {hasSecurityConcerns && (
        <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-600 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <span className="text-yellow-200 font-medium">Security Features Detected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {securityFeatures.map((feature, index) => (
              <Badge key={index} variant="outline" className="text-yellow-300 border-yellow-600">
                {feature.type.toUpperCase()}
              </Badge>
            ))}
          </div>
          <p className="text-yellow-200 text-sm mt-2">
            These security features may prevent automated login attempts.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Credentials */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="username" className="text-slate-300">
              Username/Email
            </Label>
            <Input
              id="username"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              placeholder="Enter username or email"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-slate-300">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              placeholder="Enter password"
              required
            />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-4 border-t border-slate-700">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use_browser"
              checked={options.use_browser}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, use_browser: !!checked }))
              }
            />
            <Label htmlFor="use_browser" className="text-slate-300 text-sm">
              Use headless browser (for JavaScript-heavy sites)
            </Label>
          </div>

          <div>
            <Label htmlFor="timeout" className="text-slate-300 text-sm">
              Timeout (ms)
            </Label>
            <Input
              id="timeout"
              type="number"
              value={options.timeout}
              onChange={(e) => setOptions(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              className="bg-slate-800 border-slate-600 text-white"
              min="5000"
              max="60000"
            />
          </div>

          <div>
            <Label htmlFor="user_agent" className="text-slate-300 text-sm">
              User Agent
            </Label>
            <Input
              id="user_agent"
              type="text"
              value={options.user_agent}
              onChange={(e) => setOptions(prev => ({ ...prev, user_agent: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !targetUrl || detectedFields.length === 0}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          {isSubmitting ? "Attempting Login..." : "Submit Login Attempt"}
        </Button>
      </form>

      {/* Results */}
      {submissionResult && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className={`h-5 w-5 ${submissionResult.success ? 'text-green-400' : 'text-red-400'}`} />
            <span className={`font-medium ${submissionResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {submissionResult.success ? 'Login Successful' : 'Login Failed'}
            </span>
          </div>

          {submissionResult.submission?.duration && (
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Duration: {submissionResult.submission.duration}ms</span>
            </div>
          )}

          {submissionResult.submission?.redirect_url && (
            <div className="p-3 bg-slate-800 rounded">
              <p className="text-slate-300 text-sm">
                <strong>Redirected to:</strong> {submissionResult.submission.redirect_url}
              </p>
            </div>
          )}

          {submissionResult.errors && submissionResult.errors.length > 0 && (
            <div className="p-3 bg-red-900/50 border border-red-600 rounded">
              <p className="text-red-200 text-sm font-medium mb-2">Errors:</p>
              <ul className="text-red-300 text-sm space-y-1">
                {submissionResult.errors.map((error: string, index: number) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
