
import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, ExternalLink, RefreshCw, Calendar } from "lucide-react";

interface SavedForm {
  id: string;
  target_url: string;
  fields: Array<{
    type: string;
    label?: string;
    required: boolean;
  }>;
  created_at: string;
}

interface FormHistoryProps {
  savedForms: SavedForm[];
  onRefresh: () => void;
}

export const FormHistory = ({ savedForms, onRefresh }: FormHistoryProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFieldCount = (fields: any[]) => {
    return fields.filter(f => f.type !== 'submit').length;
  };

  return (
    <Card className="p-6 bg-slate-900 border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Form History</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="text-slate-300 border-slate-600"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {savedForms.length > 0 ? (
        <div className="space-y-3">
          {savedForms.map((form) => (
            <div key={form.id} className="p-4 bg-slate-800 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{form.target_url}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-3 w-3 text-slate-500" />
                    <span className="text-xs text-slate-500">{formatDate(form.created_at)}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(form.target_url, '_blank')}
                  className="ml-2 text-slate-300 border-slate-600"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getFieldCount(form.fields)} fields
                </Badge>
                {form.fields.some(f => f.type === 'password') && (
                  <Badge variant="outline" className="text-xs bg-red-900/20 text-red-400">
                    Password
                  </Badge>
                )}
                {form.fields.some(f => f.type === 'email') && (
                  <Badge variant="outline" className="text-xs bg-blue-900/20 text-blue-400">
                    Email
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <History className="h-12 w-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No saved forms yet</p>
          <p className="text-sm text-slate-500">Analyze and save login forms to see them here</p>
        </div>
      )}
    </Card>
  );
};
