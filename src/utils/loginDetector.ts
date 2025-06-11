
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
  error?: string;
  metadata?: {
    title?: string;
    forms_found: number;
    analyzed_at: string;
  };
}

export class LoginDetector {
  static async analyzeLoginPage(url: string): Promise<DetectedField[]> {
    try {
      console.log(`Starting analysis of: ${url}`);
      
      // Call our Supabase Edge Function
      const response = await fetch('https://mbjldjsdkxibnmkxswjh.supabase.co/functions/v1/analyze-login-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iamxkanNka3hpYm5ta3hzd2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2ODIzNzYsImV4cCI6MjA2NTI1ODM3Nn0.TSPkKdMgD79grpkzQ6mnJP3fozp2MX5spJQ_VvrCb-E`
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      console.log('Analysis completed successfully:', result.metadata);
      return result.fields;
      
    } catch (error) {
      console.error('Error analyzing login page:', error);
      
      // Fallback to mock data for development/demo purposes
      console.log('Falling back to mock data...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return [
        {
          type: 'email',
          selector: 'input[type="email"], input[name*="email"], input[id*="email"]',
          placeholder: 'Enter your email',
          label: 'Email Address',
          required: true
        },
        {
          type: 'password',
          selector: 'input[type="password"]',
          placeholder: 'Enter your password',
          label: 'Password',
          required: true
        },
        {
          type: 'submit',
          selector: 'button[type="submit"], input[type="submit"]',
          label: 'Login',
          required: false
        }
      ];
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
