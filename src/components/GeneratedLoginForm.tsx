
import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code, Copy, Play, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DetectedField {
  type: 'username' | 'email' | 'password' | 'submit' | 'other';
  selector: string;
  placeholder?: string;
  label?: string;
  required: boolean;
}

interface GeneratedLoginFormProps {
  detectedFields: DetectedField[];
  targetUrl: string;
  onSave?: () => void;
}

export const GeneratedLoginForm = ({ detectedFields, targetUrl, onSave }: GeneratedLoginFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showCode, setShowCode] = useState(false);

  const handleInputChange = (fieldType: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldType]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Form Submission",
      description: `Would submit to: ${targetUrl}`,
      duration: 3000,
    });
    console.log('Form data:', formData);
  };

  const generateFormCode = () => {
    const fields = detectedFields.filter(f => f.type !== 'submit');
    return `<form method="POST" action="${targetUrl}">
${fields.map(field => `  <div>
    <label for="${field.type}">${field.label || field.type.charAt(0).toUpperCase() + field.type.slice(1)}</label>
    <input 
      type="${field.type === 'password' ? 'password' : 'text'}" 
      name="${field.type}"
      id="${field.type}"
      ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
      ${field.required ? 'required' : ''}
    />
  </div>`).join('\n')}
  <button type="submit">Login</button>
</form>`;
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(generateFormCode());
    toast({
      title: "Code Copied",
      description: "Form HTML code copied to clipboard",
      duration: 2000,
    });
  };

  const loginFields = detectedFields.filter(f => f.type !== 'submit');

  if (loginFields.length === 0) {
    return (
      <Card className="p-6 bg-slate-900 border-slate-700">
        <div className="text-center py-8">
          <Code className="h-12 w-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No form to generate yet</p>
          <p className="text-sm text-slate-500">Analyze a login page to see the generated form</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-slate-900 border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Play className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Generated Login Form</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCode(!showCode)}
            className="text-slate-300 border-slate-600"
          >
            <Code className="h-4 w-4 mr-1" />
            {showCode ? 'Hide' : 'Show'} Code
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copyCodeToClipboard}
            className="text-slate-300 border-slate-600"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          {onSave && targetUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              className="text-slate-300 border-slate-600"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          )}
        </div>
      </div>

      {showCode ? (
        <div className="bg-slate-800 p-4 rounded-lg">
          <pre className="text-sm text-green-400 overflow-x-auto">
            <code>{generateFormCode()}</code>
          </pre>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {loginFields.map((field, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={field.type} className="text-slate-300">
                {field.label || field.type.charAt(0).toUpperCase() + field.type.slice(1)}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </Label>
              <Input
                id={field.type}
                type={field.type === 'password' ? 'password' : 'text'}
                placeholder={field.placeholder || `Enter your ${field.type}`}
                value={formData[field.type] || ''}
                onChange={(e) => handleInputChange(field.type, e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                required={field.required}
              />
            </div>
          ))}
          
          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
            Test Login Form
          </Button>
        </form>
      )}
    </Card>
  );
};
