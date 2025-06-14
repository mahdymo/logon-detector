
import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, User, Lock, Mail, Shield, AlertTriangle } from "lucide-react";

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

interface LoginFormDetectorProps {
  detectedFields: DetectedField[];
  securityFeatures?: SecurityFeature[];
  isAnalyzing: boolean;
}

export const LoginFormDetector = ({ detectedFields, securityFeatures = [], isAnalyzing }: LoginFormDetectorProps) => {
  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'username':
      case 'email':
        return <User className="h-4 w-4" />;
      case 'password':
        return <Lock className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getFieldColor = (type: string) => {
    switch (type) {
      case 'username':
      case 'email':
        return 'bg-blue-500';
      case 'password':
        return 'bg-red-500';
      case 'submit':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSecurityFeatureIcon = (type: string) => {
    switch (type) {
      case 'captcha':
        return <AlertTriangle className="h-4 w-4" />;
      case 'csrf':
        return <Shield className="h-4 w-4" />;
      case 'mfa':
        return <Lock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSecurityFeatureColor = (type: string) => {
    switch (type) {
      case 'captcha':
        return 'bg-yellow-500';
      case 'csrf':
        return 'bg-blue-500';
      case 'mfa':
        return 'bg-purple-500';
      case 'oauth':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isAnalyzing) {
    return (
      <Card className="p-6 bg-slate-900 border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-yellow-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">Analyzing Page Structure...</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-slate-900 border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle className="h-6 w-6 text-green-400" />
        <h3 className="text-lg font-semibold text-white">Detection Results</h3>
      </div>
      
      {detectedFields.length > 0 || securityFeatures.length > 0 ? (
        <div className="space-y-6">
          {/* Login Fields */}
          {detectedFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Login Fields ({detectedFields.length})</h4>
              <div className="space-y-3">
                {detectedFields.map((field, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${getFieldColor(field.type)}`}>
                        {getFieldIcon(field.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium capitalize">{field.type}</span>
                          {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                        </div>
                        <p className="text-sm text-slate-400">{field.selector}</p>
                        {field.placeholder && (
                          <p className="text-xs text-slate-500">Placeholder: {field.placeholder}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Features */}
          {securityFeatures.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Security Features ({securityFeatures.length})</h4>
              <div className="space-y-3">
                {securityFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${getSecurityFeatureColor(feature.type)}`}>
                        {getSecurityFeatureIcon(feature.type)}
                      </div>
                      <div>
                        <span className="text-white font-medium capitalize">{feature.type}</span>
                        <p className="text-sm text-slate-400">
                          {feature.type === 'captcha' && 'CAPTCHA protection detected'}
                          {feature.type === 'csrf' && 'CSRF token protection'}
                          {feature.type === 'mfa' && 'Multi-factor authentication'}
                          {feature.type === 'oauth' && 'OAuth/SSO integration'}
                        </p>
                        {feature.details && (
                          <p className="text-xs text-slate-500">
                            {JSON.stringify(feature.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No login fields or security features detected yet</p>
          <p className="text-sm text-slate-500">Enter a URL above to start analysis</p>
        </div>
      )}
    </Card>
  );
};
