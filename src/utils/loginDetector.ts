
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

// Get API base URL from environment or default to localhost
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

export class LoginDetector {
  static async analyzeLoginPage(url: string, useBrowser: boolean = false): Promise<DetectedField[]> {
    try {
      console.log(`Starting analysis of: ${url} (browser mode: ${useBrowser})`);
      
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
      
      // Instead of fallback data, throw a proper error
      throw new Error(`Failed to analyze login page: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure the Docker services are running with 'docker-compose up'`);
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
