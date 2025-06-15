
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
  };
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
      
      // Call our containerized API Gateway
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          use_browser: useBrowser 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: AnalysisResult = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      console.log('Analysis completed successfully:', result.metadata);
      console.log('Detected fields:', result.fields);
      
      return result.fields;
      
    } catch (error) {
      console.error('Error analyzing login page:', error);
      
      // Enhanced error message with container-specific guidance
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        throw new Error(`Failed to connect to analysis service at ${API_BASE_URL}. Make sure all Docker services are running with 'docker-compose up' and that the API Gateway is accessible.`);
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
