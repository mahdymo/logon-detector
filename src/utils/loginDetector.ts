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

// Get API base URL from environment
// In container: uses internal container networking
// For external access: uses localhost with port mapping
const getApiBaseUrl = (): string => {
  // Check if running in browser (frontend)
  if (typeof window !== 'undefined') {
    // Browser environment - use the host's localhost for external access
    return (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';
  }
  // Server environment (if any SSR) - use container networking
  return process.env.VITE_API_BASE_URL || 'http://api-gateway:3000';
};

const API_BASE_URL = getApiBaseUrl();

export class LoginDetector {
  static async analyzeLoginPage(url: string, useBrowser: boolean = false): Promise<DetectedField[]> {
    try {
      console.log(`Starting analysis of: ${url} (browser mode: ${useBrowser})`);
      console.log(`Using API endpoint: ${API_BASE_URL}`);
      
      const startTime = Date.now();
      
      // Create AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150000); // 2.5 minutes timeout
      
      try {
        // Call our containerized API Gateway with extended timeout
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            url,
            use_browser: useBrowser 
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

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
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
    } catch (error) {
      console.error('Error analyzing login page:', error);
      
      // Enhanced error message with container-specific guidance
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Analysis timeout - the page took too long to analyze. Try disabling browser mode or use a simpler page.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        errorMessage = `Failed to connect to analysis service at ${API_BASE_URL}. Make sure all Docker services are running with 'docker-compose up' and that the API Gateway is accessible.`;
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Analysis timeout - the page took too long to load. Try again or disable browser mode for faster analysis.';
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
