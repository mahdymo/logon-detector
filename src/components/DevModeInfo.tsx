
import React from 'react';
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Monitor, Globe, Terminal } from "lucide-react";

export const DevModeInfo = () => {
  return (
    <Card className="p-6 bg-slate-900 border-slate-700 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Monitor className="h-6 w-6 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Access Information</h3>
      </div>
      
      <div className="space-y-3">
        <Alert className="bg-blue-900/50 border-blue-600">
          <Globe className="h-4 w-4" />
          <AlertDescription className="text-blue-200">
            <strong>Current Preview:</strong> You're viewing this in Lovable's preview environment.
          </AlertDescription>
        </Alert>
        
        <Alert className="bg-green-900/50 border-green-600">
          <Terminal className="h-4 w-4" />
          <AlertDescription className="text-green-200">
            <strong>Local Access:</strong> Run <code className="bg-green-800 px-2 py-1 rounded">docker-compose up -d && npm run dev</code>
            <br />
            Then visit: <code className="bg-green-800 px-2 py-1 rounded">http://localhost:5173</code>
          </AlertDescription>
        </Alert>
        
        <Alert className="bg-purple-900/50 border-purple-600">
          <Globe className="h-4 w-4" />
          <AlertDescription className="text-purple-200">
            <strong>External Access:</strong> Replace localhost with your IP address for remote access
            <br />
            Example: <code className="bg-purple-800 px-2 py-1 rounded">http://192.168.1.100:5173</code>
          </AlertDescription>
        </Alert>
      </div>
    </Card>
  );
};
