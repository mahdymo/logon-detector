interface DetectedField {
  type: 'username' | 'email' | 'password' | 'submit' | 'other';
  selector: string;
  placeholder?: string;
  label?: string;
  required: boolean;
}

interface AnalysisResult {
  success: boolean;
  fields: DetectedField[];
  security_features?: any[];
  error?: string;
  metadata?: {
    title?: string;
    forms_found: number;
    analyzed_at: string;
    analysis_duration_ms?: number;
  };
  debug_error?: string;
  duration_ms?: number;
}

// Use relative API paths since everything is served from the same origin (port 80)
const getApiBaseUrl = (): string => {
  // Since the gateway serves both frontend and API on the same port,
  // we can use relative paths or current origin
  if (typeof window !== 'undefined') {
    // In browser - use current origin (no port needed, defaults to 80)
    return window.location.origin;
  }
  
  // Server environment fallback (shouldn't be used in this setup)
  return '';
};

const API_BASE_URL = getApiBaseUrl();

export class LoginDetector {
  static async analyzeLoginPage(url: string, useBrowser: boolean = false): Promise<DetectedField[]> {
    try {
      console.log(`Starting analysis of: ${url} (browser mode: ${useBrowser})`);
      console.log(`Using API endpoint: ${API_BASE_URL}`);
      
      const startTime = Date.now();
      
      // Call our API Gateway with relative path - everything is on port 80 now
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          use_browser: useBrowser 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Analysis failed: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Keep original error message if JSON parsing fails
        }
        
        throw new Error(errorMessage);
      }

      const result: AnalysisResult = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.debug_error || 'Analysis failed');
      }

      const duration = Date.now() - startTime;
      console.log(`Analysis completed successfully in ${duration}ms:`, result.metadata);
      console.log('Detected fields:', result.fields);
      
      return result.fields;
      
    } catch (error) {
      console.error('Error analyzing login page:', error);
      
      // Enhanced error message with specific guidance
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        errorMessage = `Failed to connect to analysis service. Make sure all Docker services are running with 'docker-compose up' and that the application is accessible on port 80.`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        errorMessage = 'Analysis timeout - the page took too long to analyze. The page may be too complex or have heavy JavaScript. Try disabling browser mode for faster analysis.';
      } else if (errorMessage.includes('408') || errorMessage.includes('Request timeout')) {
        errorMessage = 'Analysis timeout - the server took too long to process the request. Try again or use a simpler page.';
      }
      
      throw new Error(`Failed to analyze login page: ${errorMessage}`);
    }
  }

  static detectFieldType(element: any): 'username' | 'email' | 'password' | 'submit' | 'other' {
    const type = element.type?.toLowerCase();
    const name = element.name?.toLowerCase();
    const id = element.id?.toLowerCase();
    const placeholder = element.placeholder?.toLowerCase();

    if (type === 'password') return 'password';
    if (type === 'email' || name?.includes('email') || id?.includes('email')) return 'email';
    if (name?.includes('user') || id?.includes('user') || placeholder?.includes('user')) return 'username';
    if (type === 'submit' || element.tagName === 'BUTTON') return 'submit';
    
    return 'other';
  }
}
