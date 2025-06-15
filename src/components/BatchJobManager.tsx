
import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText, Play, RefreshCw, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BatchJob {
  id: string;
  job_name: string;
  target_urls: string[];
  status: string;
  progress: number;
  results?: any;
  created_at: string;
  completed_at?: string;
}

export const BatchJobManager = () => {
  const [jobName, setJobName] = useState('');
  const [targetUrls, setTargetUrls] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/batch');
      if (response.ok) {
        const jobList = await response.json();
        setJobs(jobList);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName || !targetUrls || !credentials.username || !credentials.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsCreating(true);

    try {
      const urlList = targetUrls.split('\n').filter(url => url.trim());
      
      const response = await fetch('http://localhost:3000/api/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_name: jobName,
          target_urls: urlList,
          credentials,
          options: {
            use_browser: false,
            timeout: 30000
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create job: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Batch Job Created",
        description: `Job "${jobName}" started with ${urlList.length} targets`,
        duration: 3000,
      });

      setJobName('');
      setTargetUrls('');
      setCredentials({ username: '', password: '' });
      loadJobs();

    } catch (error) {
      console.error('Error creating batch job:', error);
      toast({
        title: "Job Creation Failed",
        description: "Failed to create batch job. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const downloadResults = (job: BatchJob) => {
    if (job.results) {
      const dataStr = JSON.stringify(job.results, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${job.job_name}_results.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Create New Job */}
      <Card className="p-6 bg-slate-900 border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <Database className="h-6 w-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Batch Login Testing</h3>
        </div>

        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <Label htmlFor="jobName" className="text-slate-300">
              Job Name
            </Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
              placeholder="My Batch Test Job"
              required
            />
          </div>

          <div>
            <Label htmlFor="targetUrls" className="text-slate-300">
              Target URLs (one per line)
            </Label>
            <Textarea
              id="targetUrls"
              value={targetUrls}
              onChange={(e) => setTargetUrls(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white h-24"
              placeholder="https://example1.com/login&#10;https://example2.com/signin&#10;https://example3.com/auth"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batchUsername" className="text-slate-300">
                Username
              </Label>
              <Input
                id="batchUsername"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                required
              />
            </div>
            <div>
              <Label htmlFor="batchPassword" className="text-slate-300">
                Password
              </Label>
              <Input
                id="batchPassword"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isCreating}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isCreating ? "Creating Job..." : "Start Batch Job"}
          </Button>
        </form>
      </Card>

      {/* Job List */}
      <Card className="p-6 bg-slate-900 border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Batch Jobs</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadJobs}
            className="text-slate-300 border-slate-600"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No batch jobs yet</p>
              <p className="text-sm text-slate-500">Create a job to start batch testing</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">{job.job_name}</h4>
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
                
                <div className="text-sm text-slate-400 mb-3">
                  {job.target_urls.length} target{job.target_urls.length !== 1 ? 's' : ''} • 
                  Created {new Date(job.created_at).toLocaleDateString()}
                </div>

                {job.status === 'running' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-slate-400 mb-1">
                      <span>Progress</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}

                {job.status === 'completed' && job.results && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadResults(job)}
                    className="text-slate-300 border-slate-600"
                  >
                    Download Results
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
